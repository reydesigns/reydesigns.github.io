#!/usr/bin/env node
/**
 * Drives the landing scroll sequence in a real browser and proves it.
 *
 *   node scripts/sequence.mjs [outDir] [width] [height] [reduced]
 *
 * Two things about headless Chrome make a naive version of this script lie,
 * and both are worked around here:
 *
 *   1. It stops producing frames when nothing is damaging the screen, and
 *      `requestAnimationFrame` stops with them. Lenis drives its scrolling from
 *      rAF, so the page simply freezes mid-glide and the sequence looks broken
 *      when it is not. `pump()` holds a frame going by asking the compositor
 *      for one in a loop — the same reason scripts/shot.mjs avoids
 *      `chrome --headless --screenshot`.
 *
 *   2. Puppeteer's own `page.screenshot()` moves the scroll position. Every
 *      capture here goes through raw `Page.captureScreenshot` instead, which
 *      leaves the page where it was. Finding this cost an hour; please do not
 *      swap it back.
 *
 * What it checks:
 *   1. `/` is three viewports tall and starts on the hero.
 *   2. A wheel gesture past 40% of the first screen engages the loader.
 *   3. Scrolling is actually locked while it plays — it keeps wheeling and
 *      asserts the page does not move.
 *   4. The hand-off lands at --loader-total-ms after the loader started, and
 *      the wordmark stepped two loops of four frames to fill it — the loader
 *      drives the extracted PNG frames itself, since a browser cannot retime a
 *      GIF to the client's 2s. There is no skip control any more.
 *   5. The page ends on the works screen with the nav pill at the left edge,
 *      and it is the SAME element that was at the bottom.
 *   6. Scrolling back to the hero and down again replays the loader.
 *   7. The nav's "works" button skips the loader entirely.
 *   8. Nothing is left locked, and nothing overflows horizontally.
 */
import fs from 'node:fs'
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const [, , outDir = '/tmp/seq', w = '1728', h = '1117', reduced = ''] = process.argv
const isReduced = reduced === 'reduced'
fs.mkdirSync(outDir, { recursive: true })

const results = []
const failures = []
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  protocolTimeout: 180000,
  args: [
    '--hide-scrollbars',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--force-device-scale-factor=1',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ],
})

const page = await browser.newPage()
await page.setViewport({ width: Number(w), height: Number(h), deviceScaleFactor: 1 })
if (isReduced) {
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
}
const cdp = await page.createCDPSession()

const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`))

/**
 * One compositor frame, as cheaply as the protocol allows.
 *
 * Any capture wakes the compositor, which is all `pump` is after — but a full
 * 1728x1117 frame under swiftshader costs ~3 seconds on a loaded machine, and
 * a probe loop that only samples the page every 3s cannot see a state that
 * lasts 2 (the loader lock, for one). Clipping to 8x8 is the same wake-up for
 * ~300ms. Full-size captures are still what `shot()` writes out.
 */
const wake = () =>
  cdp.send('Page.captureScreenshot', {
    format: 'jpeg',
    quality: 1,
    clip: { x: 0, y: 0, width: 8, height: 8, scale: 1 },
  })

/** Hold the compositor awake for `ms`, so rAF keeps ticking. */
async function pump(ms) {
  const end = Date.now() + ms
  do {
    await wake()
  } while (Date.now() < end)
}

/**
 * Pump until the page reports what we are waiting for. A capture under
 * swiftshader can take a few hundred milliseconds, so a fixed `pump(600)` is
 * not a 600ms wait and timing-sensitive assertions must never be built on one.
 */
async function pumpUntil(test, timeoutMs = 8000) {
  const end = Date.now() + timeoutMs
  let state = await probe()
  while (!test(state) && Date.now() < end) {
    await wake()
    state = await probe()
  }
  return state
}

async function shot(name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(`${outDir}/${name}.png`, Buffer.from(data, 'base64'))
}

const probe = () =>
  page.evaluate(() => {
    const nav = document.querySelector('nav[data-flip-id="nav-pill"]')
    const r = nav?.getBoundingClientRect()
    const mark = document.querySelector('[aria-label="rey designs"] img')
    return {
      y: Math.round(window.scrollY),
      vh: window.innerHeight,
      docH: document.documentElement.scrollHeight,
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      locked: !!window.__seqLocked,
      lenisStopped: !!window.__lenis?.isStopped,
      hasLenis: !!window.__lenis,
      log: (window.__seqLog ?? []).slice(),
      navCount: document.querySelectorAll('nav[data-flip-id="nav-pill"]').length,
      nav: r
        ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
        : null,
      navUid: nav?.__uid ?? null,
      mark: mark ? mark.src.split('/').pop().replace(/\?.*$/, '') : null,
      // The loader drives the four extracted frames itself (a browser cannot
      // retime a GIF), and leaves a trail of every frame change behind it.
      frames: (window.__loaderFrames ?? []).slice(),
      skip: !!document.querySelector('[data-skip-loader]'),
    }
  })

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 30000 })
await pump(2800) // let the headline scramble settle so captures are honest

// Tag the pill so we can prove the one at the left edge is the same DOM node.
await page.evaluate(() => {
  const nav = document.querySelector('nav[data-flip-id="nav-pill"]')
  if (nav) nav.__uid = 'pill-1'
})

const start = await probe()
await shot('01-hero')

check('exactly one nav pill in the document', start.navCount === 1, `${start.navCount}`)
check('document is three screens tall', Math.abs(start.docH - start.vh * 3) < 40,
  `docH=${start.docH} vh=${start.vh}`)
check('starts at the top', start.y < 4, `y=${start.y}`)
check('no horizontal overflow (hero)', start.scrollW <= start.clientW,
  `${start.scrollW} vs ${start.clientW}`)
check('nav pill starts at the bottom, horizontal',
  !!start.nav && start.nav.w > start.nav.h && start.nav.y > start.vh * 0.75,
  JSON.stringify(start.nav))
// The skip button was pulled at the client's request: the loader is 2s now, and
// an escape hatch from a two-second wait was more chrome than it was worth.
check('the loader has no skip control', !start.skip)
check(isReduced ? 'lenis is off under reduced motion' : 'lenis is driving',
  isReduced ? !start.hasLenis : start.hasLenis)

/* --- 1. scroll down into the loader -------------------------------------- */
await page.mouse.move(Number(w) / 2, Number(h) / 2)
await page.mouse.wheel({ deltaY: 700 })
const engaged = isReduced
  ? await pumpUntil(() => false, 900)
  : await pumpUntil((s) => s.locked, 4000)
const loaderStart = engaged.log.find((e) => e.event === 'loader-start')

if (isReduced) {
  check('reduced motion never engages the loader', !loaderStart, JSON.stringify(engaged.log))
  check('reduced motion never locks the scroll', !engaged.locked)
  check('reduced motion shows the composited still, and never runs the clock',
    /frame-04/.test(engaged.mark ?? '') && engaged.frames.length === 0,
    `${engaged.mark} frames=${engaged.frames.length}`)
} else {
  check('scrolling down engages the loader', !!loaderStart, JSON.stringify(engaged.log))
  check('scroll is locked while the loader plays', engaged.locked && engaged.lenisStopped,
    `locked=${engaged.locked} lenisStopped=${engaged.lenisStopped}`)

  /* --- 2. prove the lock actually holds ---------------------------------- */
  // Wait for the take-over glide to land rather than guessing how long it took.
  const settled = await pumpUntil((s) => s.locked && Math.abs(s.y - s.vh) < 8, 4000)
  check('the loader screen is what the take-over lands on',
    Math.abs(settled.y - settled.vh) < 8, `y=${settled.y} vh=${settled.vh}`)
  check('the wordmark is a frame of the extracted set, not the GIF',
    /frame-0\d/.test(settled.mark ?? ''), String(settled.mark))
  check('and the frame clock is already running', settled.frames.length >= 1,
    JSON.stringify(settled.frames))
  await shot('02-loader')

  for (let i = 0; i < 4; i += 1) await page.mouse.wheel({ deltaY: 500 })
  const held = await probe()
  check('wheel input cannot move the page while locked',
    held.locked && Math.abs(held.y - settled.y) < 3,
    `${settled.y} -> ${held.y} (locked=${held.locked})`)
}

/* --- 3. the hand-off ------------------------------------------------------ */
const handed = isReduced
  ? await probe()
  : await pumpUntil((s) => s.log.some((e) => e.event === 'handoff'), 6000)

if (!isReduced) {
  const handoff = handed.log.find((e) => e.event === 'handoff')
  check('hands off once the loops are done', !!handoff, JSON.stringify(handed.log))
  if (handoff && loaderStart) {
    const dt = handoff.t - loaderStart.t
    const total = await page.evaluate(() =>
      Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--loader-total-ms'),
      ),
    )
    // A timer may be late, never early. 150ms of slack for a busy main thread.
    check(`hand-off is --loader-total-ms (${total}ms) after the loader starts`,
      dt >= total - 5 && dt <= total + 150, `measured ${dt}ms`)
  }
  check('scroll is released at the hand-off', !handed.locked && !handed.lenisStopped)
}

const arrived = isReduced
  ? await probe()
  : await pumpUntil((s) => Math.abs(s.y - s.vh * 2) < 8, 5000)
await shot('03-works')

if (!isReduced) {
  check('lands on the works screen', Math.abs(arrived.y - arrived.vh * 2) < 24,
    `y=${arrived.y} expected ~${arrived.vh * 2}`)
  // The scroll landing and the Flip tween are independent: arriving at the
  // works screen does not mean the pill has finished travelling. Sampling
  // `arrived` here caught it mid-flight and reported a false failure, so wait
  // for the pill itself to settle before judging it.
  const docked = await pumpUntil(
    (s) => !!s.nav && s.nav.h > s.nav.w && s.nav.x < 120,
    3000,
  )
  check('nav pill is now vertical at the left edge',
    !!docked.nav && docked.nav.h > docked.nav.w && docked.nav.x < 120,
    JSON.stringify(docked.nav))
  check('it is the same pill element, not a second one', arrived.navUid === 'pill-1',
    String(arrived.navUid))
  check('the loop ended on the composited still',
    /frame-04/.test(arrived.mark ?? ''), String(arrived.mark))

  // The loader is no longer a GIF — it steps the four extracted frames itself,
  // because a browser cannot retime a GIF and the hand-off is now 2s flat.
  // Two loops of four frames at --loader-frame-ms is the whole 2000ms.
  const [step, loop] = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement)
    return ['--loader-frame-ms', '--loader-loop-ms'].map((n) =>
      Number.parseFloat(s.getPropertyValue(n)),
    )
  })
  const seen = arrived.frames
  const trail = seen.map((f) => `${f.frame}@${f.t}`).join(' ')

  // Every frame change is checked against the slot its timestamp falls in, not
  // against a fixed list: swiftshader paints far below 60fps, so a correct
  // clock legitimately skips frames here. What cannot happen on a correct clock
  // is a frame showing up in the wrong 250ms slot.
  const offSlot = seen.filter((f) => Math.floor(f.t / step) % 4 !== f.frame)
  check(`every frame landed in its own ${step}ms slot`,
    seen.length >= 2 && offSlot.length === 0, offSlot.length ? JSON.stringify(offSlot) : trail)
  check('the wordmark drew all four frames', new Set(seen.map((f) => f.frame)).size === 4, trail)
  // The frame index running backwards is the second loop starting.
  check(`it looped twice (--loader-loop-ms ${loop}ms)`,
    seen.some((f, i) => i > 0 && f.frame < seen[i - 1].frame) &&
      seen[seen.length - 1].t >= loop,
    trail)
  check('and came to rest on the last, fully composited frame',
    seen[seen.length - 1]?.frame === 3, trail)
}
check('no horizontal overflow (works screen)', arrived.scrollW <= arrived.clientW,
  `${arrived.scrollW} vs ${arrived.clientW}`)

/* --- 4. reduced motion: can still reach works by plain scrolling ---------- */
if (isReduced) {
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 2, behavior: 'auto' }))
  await pump(600)
  const rm = await probe()
  check('reduced motion can reach the works screen by scrolling',
    Math.abs(rm.y - rm.vh * 2) < 24, `y=${rm.y}`)
  check('and the pill still ends up vertical at the left edge',
    !!rm.nav && rm.nav.h > rm.nav.w && rm.nav.x < 120, JSON.stringify(rm.nav))
  await shot('03-works')
}

/* --- 5. replay ------------------------------------------------------------ */
if (!isReduced) {
  await page.evaluate(() => window.__lenis?.scrollTo(0, { duration: 0.5, force: true }))
  const back = await pumpUntil((s) => s.y < 6, 5000)
  check('scrolling back reaches the hero again', back.y < 6, `y=${back.y}`)

  await page.mouse.wheel({ deltaY: 700 })
  const replay = await pumpUntil(
    (s) => s.log.filter((e) => e.event === 'loader-start').length >= 2,
    5000,
  )
  const runs = replay.log.filter((e) => e.event === 'loader-start')
  check('the loader replays on the way down again', runs.length >= 2, `${runs.length} run(s)`)
  check('and locks again', replay.locked)
  await shot('04-replay')

  // Let that run finish rather than leaving the page mid-lock.
  await pumpUntil((s) => !s.locked, 6000)
}

/* --- 6. the nav's Works button skips the loader ---------------------------- */
await page.evaluate(() => {
  window.__seqLog = []
  if (window.__lenis) window.__lenis.scrollTo(0, { immediate: true, force: true })
  else window.scrollTo(0, 0)
})
await pumpUntil((s) => s.y < 6, 4000)
await page.evaluate(() => {
  document.querySelector('nav[data-flip-id="nav-pill"] [data-flip-id="nav-works"]')?.click()
})
const skipped = await pumpUntil((s) => Math.abs(s.y - s.vh * 2) < 8, 5000)
check('the nav Works button skips the loader',
  !skipped.log.some((e) => e.event === 'loader-start'), JSON.stringify(skipped.log))
check('and still arrives at the works screen', Math.abs(skipped.y - skipped.vh * 2) < 24,
  `y=${skipped.y}`)
check('url stays on / (it is the same document)', new URL(page.url()).pathname === '/', page.url())
await shot('05-skip')

/* --- 7. nothing left locked ------------------------------------------------ */
const final = await probe()
check('page is scrollable at the end', !final.locked && !final.lenisStopped)

console.log(results.join('\n'))
console.log(`\nconsole/page errors: ${errors.length}`)
errors.forEach((e) => console.log(`  ${e}`))
console.log(`\n${failures.length ? `FAILED: ${failures.join(', ')}` : 'all checks passed'}`)

await browser.close()
process.exit(failures.length || errors.length ? 1 : 0)
