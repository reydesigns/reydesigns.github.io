#!/usr/bin/env node
/**
 * Landing-page checks: the hero status line, and the two-screen document
 * (hero -> works) with its desktop glide.
 *
 *   node scripts/checks/landing.mjs
 *
 * Desktop runs at the 1728x1117 reference, the phone at 390x844, and a third
 * desktop tab emulates prefers-reduced-motion. Supersedes scripts/sequence.mjs,
 * which tested the old three-screen loader sequence.
 */
import { launch, openPage, waitBoot, sleep, check, done } from '../lib/browser.mjs'

/* Scroll to the very top without animating, through Lenis when it is there
   (it keeps its own position and would otherwise drag the page back). */
const toTop = () => {
  if (window.__lenis) window.__lenis.scrollTo(0, { immediate: true, force: true })
  else window.scrollTo(0, 0)
}

/* The works section's document offset, in viewports. */
const worksTop = () => {
  const el = document.querySelector('[data-stage="works"]')
  return el ? el.offsetTop / window.innerHeight : null
}

/* Waits (up to `ms`) for the page to come to rest within 0.05vh of `ratio`
   viewports down, then returns where it is. "At rest" includes Lenis letting
   go of the glide's lock: the expo tail is inside 0.05vh with half the glide
   still to run, and the next step must start from a finished glide. The glide
   is Lenis, i.e. rAF, and headless Chrome rendering the swiftshader drawings
   has been seen to go five to seven seconds between frames, so a fixed sleep
   measures the test machine rather than the page — and the budget is long. */
async function settleAt(page, ratio, ms = 10000) {
  await page
    .waitForFunction((r) => !window.__lenis?.isLocked && Math.abs(scrollY / innerHeight - r) < 0.05,
      { timeout: ms, polling: 100 }, ratio)
    .catch(() => {})
  return page.evaluate(() => scrollY / innerHeight)
}

/* Waits (up to `ms`) for the nav pill to mark "works" as the current page.
   Stage changes ride on scroll events, which wait on a rendered frame — and
   headless Chrome can hold frames back for seconds (see settleAt). */
const navSaysWorks = (page, ms = 10000) =>
  page
    .waitForFunction(() => document.querySelector('nav[aria-label="Sections"] [data-flip-id="nav-works"]')
      ?.getAttribute('aria-current') === 'page', { timeout: ms, polling: 100 })
    .then(() => true, () => false)

/* Inside the page, before a wheel: arms window.__cut, which cuts the next hero
   -> works glide short with an immediate jump to the top. That resets Lenis
   without ever calling the glide's onComplete — the same thing lenis.stop()
   under a dialog or a middle-click does. It fires from a scroll listener in the
   very event that starts the glide (the hook's listener runs first and takes
   Lenis' lock synchronously); polling for the lock from outside can miss a
   glide that headless Chrome finishes in a frame or two. Resolves false if no
   glide started within 15s (frames stall for seconds; see settleAt). */
const armCut = () => {
  window.__cut = new Promise((resolve) => {
    const onScroll = () => {
      if (!window.__lenis?.isLocked) return
      window.removeEventListener('scroll', onScroll)
      clearTimeout(timer)
      window.__lenis.scrollTo(0, { immediate: true, force: true })
      resolve(true)
    }
    const timer = setTimeout(() => {
      window.removeEventListener('scroll', onScroll)
      resolve(false)
    }, 15000)
    window.addEventListener('scroll', onScroll, { passive: true })
  })
}

const browser = await launch()
try {
  /* ---- status line (Phase A) ------------------------------------------- */
  const { page, errors } = await openPage(browser, '/')
  const status = await page.evaluate(() => {
    const p = [...document.querySelectorAll('p')].find((el) => el.textContent.includes('Master of Information'))
    if (!p) return null
    const cs = getComputedStyle(p)
    return { text: p.textContent.trim(), weight: Number(cs.fontWeight), opacity: Number(cs.opacity),
             align: cs.textAlign, bg: cs.backgroundColor, dot: !!document.querySelector('.status-dot') }
  })
  check('status text', status?.text === 'Master of Information @ UofT', status?.text)
  check('status bold', status?.weight >= 700, status?.weight)
  check('status muted', status?.opacity > 0 && status?.opacity < 1, status?.opacity)
  check('status centred', status?.align === 'center', status?.align)
  check('no pill background', status?.bg === 'rgba(0, 0, 0, 0)', status?.bg)
  check('no dot', status?.dot === false)

  /* ---- desktop: two screens and the glide ------------------------------ */
  const doc = await page.evaluate(() => document.documentElement.scrollHeight / innerHeight)
  check('two screens', doc < 2.6, doc.toFixed(2))
  check('no loader screen', !(await page.$('[data-stage="loader"]')))

  const worksTopRatio = await page.evaluate(worksTop)
  await page.mouse.move(864, 500)
  await page.mouse.wheel({ deltaY: 300 })
  const y = await settleAt(page, worksTopRatio)
  check('glided to works', worksTopRatio != null && Math.abs(y - worksTopRatio) < 0.05,
    `scrollY=${y.toFixed(3)}vh works=${worksTopRatio?.toFixed(3)}vh`)
  check('not locked', await page.evaluate(() =>
    !window.__lenis?.isStopped && getComputedStyle(document.documentElement).overflow !== 'hidden'))
  check('nav says works at the grid', await navSaysWorks(page))

  // Back at the top the glide re-arms; scrolling down again glides again.
  await page.evaluate(toTop)
  await sleep(400)
  await page.mouse.wheel({ deltaY: 300 })
  const y2 = await settleAt(page, worksTopRatio)
  check('re-arms at the top', Math.abs(y2 - worksTopRatio) < 0.05, `scrollY=${y2.toFixed(3)}vh`)

  // A glide cut short in mid-flight must not leave the hero unable to re-arm.
  await page.evaluate(toTop)
  await sleep(400)
  await page.evaluate(armCut)
  await page.mouse.wheel({ deltaY: 300 })
  const cut = await page.evaluate(() => window.__cut)
  await sleep(400)
  await page.mouse.wheel({ deltaY: 300 })
  const y3 = await settleAt(page, worksTopRatio)
  check('re-arms after a glide cut short', cut && Math.abs(y3 - worksTopRatio) < 0.05,
    `cut=${cut} scrollY=${y3.toFixed(3)}vh`)

  // The nav's "works" from the top glides to the grid instead of navigating.
  await page.evaluate(toTop)
  await sleep(400)
  await page.click('nav[aria-label="Sections"] [data-flip-id="nav-works"]')
  await settleAt(page, worksTopRatio)
  const navd = await page.evaluate(() => ({ path: location.pathname, y: scrollY / innerHeight }))
  check('nav works glides, URL unchanged',
    navd.path === '/' && Math.abs(navd.y - worksTopRatio) < 0.05, `${navd.path} scrollY=${navd.y.toFixed(3)}vh`)

  // A reload always starts at the hero, wherever the page was left.
  await page.evaluate(() => scrollTo(0, innerHeight))
  await page.reload({ waitUntil: 'networkidle2' })
  await waitBoot(page)
  const ry = await page.evaluate(() => scrollY)
  check('reload at hero', ry < 5, ry)
  check('desktop: no console errors', errors.length === 0, errors.join(' | '))

  /* ---- phone: natural scroll, works rendered under the hero ------------ */
  const { page: phone, errors: phoneErrors } = await openPage(browser, '/', { w: 390, h: 844 })
  check('phone renders works', !!(await phone.$('[data-stage="works"]')))
  await phone.mouse.move(195, 400)
  await phone.mouse.wheel({ deltaY: 200 })
  await sleep(1200)
  const py = await phone.evaluate(() => scrollY)
  check('phone: no auto-glide', py < 400, py)

  // Every card sits fully above the fixed pill at the end of the page, and the
  // footer row is reachable above it too.
  await phone.evaluate(() => {
    const y = document.documentElement.scrollHeight - innerHeight
    if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true })
    else window.scrollTo(0, y)
  })
  await sleep(600)
  // No glide on a phone, but the nav still follows the reader down to the grid.
  check('phone: nav says works at the grid', await navSaysWorks(phone))
  const clear = await phone.evaluate(() => {
    const pill = document.querySelector('nav[aria-label="Sections"]').getBoundingClientRect()
    const cards = [...document.querySelectorAll('[data-stage="works"] li')]
    const last = cards.at(-1)?.getBoundingClientRect()
    const foot = document.querySelector('footer').getBoundingClientRect()
    return { pillTop: pill.top, lastBottom: last?.bottom, footBottom: foot.bottom, cards: cards.length }
  })
  check('phone: four cards', clear.cards === 4, clear.cards)
  check('phone: last card above the pill', clear.lastBottom != null && clear.lastBottom <= clear.pillTop,
    `card bottom ${Math.round(clear.lastBottom)} pill top ${Math.round(clear.pillTop)}`)
  check('phone: footer on screen at the end', clear.footBottom <= 844 + 1, Math.round(clear.footBottom))

  // On a phone the nav's "works" is a plain smooth scroll to the grid.
  await phone.evaluate(toTop)
  await sleep(400)
  const phoneWorksTop = await phone.evaluate(() => document.querySelector('[data-stage="works"]')?.offsetTop ?? -1)
  await phone.click('nav[aria-label="Sections"] [data-flip-id="nav-works"]')
  await settleAt(phone, phoneWorksTop / 844)
  const pn = await phone.evaluate(() => ({ path: location.pathname, y: scrollY }))
  check('phone: nav works scrolls to the grid, URL unchanged',
    pn.path === '/' && Math.abs(pn.y - phoneWorksTop) < 4, `${pn.path} scrollY=${pn.y} works=${phoneWorksTop}`)
  check('phone: no console errors', phoneErrors.length === 0, phoneErrors.join(' | '))

  /* ---- reduced motion: no glide, stage follows position ---------------- */
  const { page: reducedPage, errors: reducedErrors } = await openPage(browser, '/', { reduced: true })
  await reducedPage.mouse.move(864, 500)
  await reducedPage.mouse.wheel({ deltaY: 300 })
  await sleep(1200)
  check('reduced: no glide', (await reducedPage.evaluate(() =>
    (window.__seqLog ?? []).some((e) => e.event === 'glide'))) === false)
  const ryr = await reducedPage.evaluate(() => scrollY)
  check('reduced: stays where the reader put it', ryr < 400, ryr)

  // Scrolled to the grid by hand, the nav still marks "works" as current.
  // A fresh tab: in headless Chrome (software GL) a programmatic scroll right
  // after a wheel gesture stops the tab producing frames, so no scroll event
  // is ever dispatched and input times out — a harness stall, not the page.
  const { page: reducedJump } = await openPage(browser, '/', { reduced: true })
  await reducedJump.evaluate(() => scrollTo(0, innerHeight))
  check('reduced: nav says works at the grid', await navSaysWorks(reducedJump))
  check('reduced: no console errors', reducedErrors.length === 0, reducedErrors.join(' | '))
} finally {
  await browser.close()
}
done()
