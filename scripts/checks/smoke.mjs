#!/usr/bin/env node
/**
 * End-to-end smoke test: every route at every common viewport, then the main
 * click-through flows on a desktop and a phone.
 *
 *   node scripts/checks/smoke.mjs                 (dev server on :5173)
 *   SHOTS=/some/dir node scripts/checks/smoke.mjs  also saves a screenshot per
 *                                                  route/size + contact sheets
 *   ONLY=sizing|flows node scripts/checks/smoke.mjs  run one half
 *
 * Sizing (per route x viewport): console/page/request errors, horizontal
 * overflow, content running off the side of the screen, broken images/videos,
 * fixed chrome (top bar, nav pill) on screen, the right nav for the width,
 * Works grid geometry and its clearance of the pill, case-study panel vs strip.
 *
 * Flows: nav pill + top-bar home, unknown routes, contact links, phone links
 * sheet, case-study section links / next study / HOME, every Design print,
 * the Me page's pieces.
 *
 * The landing scroll glide and the case-study pop-up have their own suites
 * (landing.mjs, modal.mjs); this does not repeat them.
 */
import { writeFile } from 'node:fs/promises'
import { launch, openPage, sleep, check, done, BASE } from '../lib/browser.mjs'

const SHOTS = process.env.SHOTS
const ONLY = process.env.ONLY

const ROUTES = ['/', '/works', '/works/heyso', '/works/tmu-kpop', '/works/lipton', '/works/shore-up', '/design', '/me']
const VIEWPORTS = [
  [320, 568], [375, 667], [390, 844], [768, 1024], [1024, 768],
  [1280, 800], [1440, 900], [1728, 1117], [1920, 1080], [2560, 1440],
]
const SHOT_WIDTHS = new Set([390, 768, 1280, 1728, 2560])

const browser = await launch()

/* ---------------------------------------------------------------- helpers */

/* Jump without animating, through Lenis when it owns the scroll. */
const jump = (page, y) =>
  page.evaluate((y) => {
    if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true })
    else window.scrollTo(0, y)
  }, y)

/* Walks the page top to bottom so in-view and lazy content wakes up, then
   back to the top. */
async function scrollThrough(page) {
  const { h, vh } = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, vh: innerHeight }))
  const steps = Math.min(40, Math.ceil(h / (vh * 0.8)))
  for (let i = 1; i <= steps; i++) {
    await jump(page, Math.round(i * vh * 0.8))
    await sleep(180)
  }
  await sleep(600)
}

/* Everything measured in-page for the sizing sweep. Must be self-contained. */
function probe() {
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight
  const visible = (el) => {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const name = (el) => {
    const id = el.id ? `#${el.id}` : ''
    const cls = typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''
    const text = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30)
    return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ''}`
  }

  // Off the side of the screen, and not inside a box that clips or scrolls it.
  const containedByClip = (el) => {
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a)
      if (/hidden|clip|auto|scroll/.test(cs.overflowX)) {
        const r = a.getBoundingClientRect()
        if (r.left >= -1 && r.right <= vw + 1) return true
      }
    }
    return false
  }
  const offside = []
  for (const el of document.body.querySelectorAll('*')) {
    if (!visible(el)) continue
    if (el.closest('[aria-hidden="true"], .sr-only, dialog:not([open])')) continue
    const r = el.getBoundingClientRect()
    if (r.right <= vw + 1 && r.left >= -1) continue
    if (getComputedStyle(el).position === 'fixed' && r.right < 0) continue // parked off-canvas on purpose
    if (containedByClip(el)) continue
    if (offside.some((o) => o.el.contains(el))) continue
    offside.push({ el, d: `${name(el)} [${Math.round(r.left)}..${Math.round(r.right)}]` })
  }

  // Text spilling out of its own block box.
  const spill = []
  for (const el of document.body.querySelectorAll('h1,h2,h3,h4,p,li,a,button,span,div')) {
    if (!visible(el)) continue
    const cs = getComputedStyle(el)
    if (cs.display.startsWith('inline') && cs.display !== 'inline-block' && cs.display !== 'inline-flex') continue
    if (cs.overflowX !== 'visible') continue
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) spill.push(`${name(el)} ${el.scrollWidth}>${el.clientWidth}`)
  }

  // Smallest visible text.
  let minFont = Infinity
  let minFontEl = ''
  for (const el of document.body.querySelectorAll('*')) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
    if (!visible(el) || el.closest('.sr-only, [aria-hidden="true"]')) continue
    const fs = parseFloat(getComputedStyle(el).fontSize)
    if (fs < minFont) { minFont = fs; minFontEl = name(el) }
  }

  const brokenImgs = [...document.images]
    .filter((i) => i.complete && i.currentSrc && i.naturalWidth === 0)
    .map((i) => i.currentSrc.split('/').pop())
  const brokenVideos = [...document.querySelectorAll('video')].filter((v) => v.error).map((v) => v.currentSrc.split('/').pop())

  const rect = (el) => (el && visible(el) ? el.getBoundingClientRect().toJSON() : null)
  const inView = (r) => r && r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1

  const pill = document.querySelector('nav[aria-label="Sections"]')
  const topbar = document.querySelector('header.layer-chrome')
  const topLinks = topbar?.querySelector('nav')
  const linksBtn = pill?.querySelector('button[aria-expanded]')
  const navItems = pill ? [...pill.querySelectorAll('[data-nav-item]')].filter(visible).map((e) => e.getBoundingClientRect()) : []
  const csNavs = [...document.querySelectorAll('nav[aria-label="Case study sections"]')]
  const csPanel = csNavs.find((n) => n.classList.contains('fixed'))
  const csStrip = csNavs.find((n) => !n.classList.contains('fixed'))
  const skip = document.querySelector('[data-skip-target]')

  // four case studies (links) and three toys, the Vinyl Player, Binary
  // Bloom and the Comic Hoarder (each an <article> + button)
  const cards = [...document.querySelectorAll('[data-card]')].filter(visible).map((c) => c.getBoundingClientRect().toJSON())

  return {
    vw, vh,
    scrollW: document.documentElement.scrollWidth,
    scrollH: document.documentElement.scrollHeight,
    bodyScrollW: document.body.scrollWidth,
    offside: offside.slice(0, 6).map((o) => o.d),
    offsideCount: offside.length,
    spill: spill.slice(0, 5),
    spillCount: spill.length,
    minFont, minFontEl,
    brokenImgs, brokenVideos,
    font: document.fonts.check('16px Inter'),
    bodyFont: getComputedStyle(document.body).fontFamily,
    pill: rect(pill), pillInView: pill ? inView(rect(pill)) : null,
    topbar: rect(topbar),
    topLinksShown: !!rect(topLinks),
    linksBtnShown: !!rect(linksBtn),
    minNavItem: navItems.length ? Math.min(...navItems.map((r) => Math.min(r.width, r.height))) : null,
    csPanel: rect(csPanel), csStrip: rect(csStrip),
    skipLeft: skip ? skip.getBoundingClientRect().left + parseFloat(getComputedStyle(skip).paddingLeft) : null,
    cards,
    title: document.title,
  }
}

const round = (n) => Math.round(n)

/* ------------------------------------------------------------ sizing sweep */

const shots = {} // width -> [{route, file}]

async function sizing() {
  console.log('\n=== sizing sweep ===')
  for (const [w, h] of VIEWPORTS) {
    for (const route of ROUTES) {
      const tag = `${String(w).padStart(4)}x${String(h).padEnd(4)} ${route}`
      let page
      let errors
      try {
        ;({ page, errors } = await openPage(browser, route, { w, h }))
        const top = await page.evaluate(probe)
        if (SHOTS && SHOT_WIDTHS.has(w)) {
          const file = `${SHOTS}/smoke-${w}${route.replace(/\//g, '_') || '_'}.png`
          await page.screenshot({ path: file })
          ;(shots[w] ??= []).push({ route, file })
        }

        await scrollThrough(page)
        const end = await page.evaluate(probe)
        await jump(page, 0)

        const problems = []
        const warn = []
        if (top.scrollW > top.vw || end.scrollW > end.vw) problems.push(`h-overflow ${Math.max(top.scrollW, end.scrollW)}>${top.vw}`)
        if (top.offsideCount || end.offsideCount) problems.push(`off-screen: ${[...new Set([...top.offside, ...end.offside])].slice(0, 4).join('; ')}`)
        if (end.brokenImgs.length) problems.push(`broken img: ${end.brokenImgs.slice(0, 3).join(', ')}`)
        if (end.brokenVideos.length) problems.push(`broken video: ${end.brokenVideos.join(', ')}`)
        if (!top.font || !/Inter/.test(top.bodyFont)) problems.push(`font: check=${top.font} body=${top.bodyFont}`)
        if (!top.topbar) problems.push('no top bar')
        if (top.pill && !top.pillInView) problems.push(`pill off-screen ${JSON.stringify(top.pill)}`)
        if (top.pill) {
          const phone = w < 640
          if (phone && top.topLinksShown) problems.push('top-bar links shown on phone')
          if (!phone && !top.topLinksShown) problems.push('top-bar links hidden')
          if (phone && !top.linksBtnShown) problems.push('no "links" button on phone')
          if (!phone && top.linksBtnShown) problems.push('"links" button shown above phone width')
          if (phone && top.minNavItem < 44) warn.push(`nav item ${round(top.minNavItem)}px < 44`)
        }
        if (route.startsWith('/works/')) {
          const lg = w >= 1024
          if (lg && (!top.csPanel || top.csStrip)) problems.push('expected side panel, not strip')
          if (!lg && (top.csPanel || !top.csStrip)) problems.push('expected strip, not side panel')
          if (lg && top.csPanel && top.skipLeft < top.csPanel.right) problems.push(`article under side panel (${round(top.skipLeft)} < ${round(top.csPanel.right)})`)
          if (lg && top.csPanel && (top.csPanel.top < 0 || top.csPanel.bottom > top.vh)) problems.push(`side panel taller than screen (${round(top.csPanel.top)}..${round(top.csPanel.bottom)} of ${top.vh})`)
        }
        if (route === '/works') {
          const c = top.cards
          const cols = new Set(c.map((r) => round(r.left))).size
          const want = w >= 1024 ? 2 : 1
          // four studies and three toys (the Vinyl Player, Binary Bloom, Comic Hoarder)
          if (c.length !== 7) problems.push(`${c.length} cards, want 7`)
          if (cols !== want) problems.push(`${cols} column(s), want ${want}`)
          if (want === 2 && c.length >= 2) {
            const gap = c[1].left - c[0].right
            const left = c[0].left
            const right = top.vw - c[1].right
            if (Math.abs(gap - 24) > 1.5) problems.push(`column gap ${round(gap)} != 24`)
            if (Math.abs(left - right) > 1.5) problems.push(`grid off-centre (${round(left)} vs ${round(right)})`)
            if (w <= 1968 && Math.abs(left - 24) > 1.5) problems.push(`side margin ${round(left)} != 24`)
            if (Math.abs(c[0].width - c[1].width) > 1 || Math.abs(c[0].height - c[2]?.height) > 1) problems.push('cards not equal size')
            warn.push(`card ${round(c[0].width)}x${round(c[0].height)}`)
          } else if (c.length) {
            warn.push(`card ${round(c[0].width)}x${round(c[0].height)}`)
          }
          // at the end of the scroll the last card must clear the pill
          const last = end.cards.at(-1)
          if (last && end.pill && last.bottom > end.pill.top - 4 && last.left < end.pill.right && last.right > end.pill.left) {
            problems.push(`last card under pill (${round(last.bottom)} > ${round(end.pill.top)})`)
          }
        }
        if (top.spillCount || end.spillCount) warn.push(`text spill x${Math.max(top.spillCount, end.spillCount)}: ${[...top.spill, ...end.spill][0]}`)
        if (top.minFont < 11) warn.push(`min font ${top.minFont}px (${top.minFontEl})`)
        problems.push(...errors.slice(0, 3))

        check(tag, problems.length === 0, [...problems, ...warn.map((x) => `· ${x}`)].join(' | '))
      } catch (e) {
        check(tag, false, e.message.slice(0, 120))
      }
      await page?.close().catch(() => {})
    }
  }
}

/* ------------------------------------------------------------------ flows */

const path = (page) => page.evaluate(() => location.pathname)
const waitPath = (page, p, ms = 8000) =>
  page.waitForFunction((p) => location.pathname === p, { timeout: ms, polling: 100 }, p).then(() => true, () => false)
const current = (page) =>
  page.evaluate(() => document.querySelector('nav[aria-label="Sections"] [aria-current="page"]')?.dataset.flipId ?? null)

/* The Vinyl Player card on /works opens its own pop-up (dialog.vp-pop). */
async function vinyl(page, tag, how) {
  // /works is the landing page now (its grid), whose 3D drawings keep the
  // network busy for a long time under software GL: wait for the page, not
  // for the network to go quiet.
  await page.goto(`${BASE}/works`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('article[data-card] button[aria-label="Vinyl Player"]', { timeout: 30000 })
  await sleep(2500)
  const sel = 'article[data-card] button[aria-label="Vinyl Player"]'
  const card = await page.$(sel)
  check(`${tag}: Vinyl Player card on /works`, !!card)
  if (!card) return
  await card.evaluate((b) => b.scrollIntoView({ block: 'center' }))
  await sleep(400)
  await (how === 'tap' ? card.tap() : card.click())
  const opened = await page.waitForFunction(() => document.querySelector('dialog.vp-pop')?.open, { timeout: 6000 }).then(() => true, () => false)
  await sleep(800)
  const info = await page.evaluate(() => {
    const d = document.querySelector('dialog.vp-pop')
    const r = d?.querySelector('.vp-frame')?.getBoundingClientRect()
    const stage = d?.querySelector('.vp-stage')?.getBoundingClientRect()
    return {
      title: d?.querySelector('.vp-title')?.textContent.trim(),
      rect: r && [r.left, r.top, r.right, r.bottom].map(Math.round).join(','),
      fits: !!r && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5,
      stage: stage ? `${Math.round(stage.width)}x${Math.round(stage.height)}` : null,
      locked: getComputedStyle(document.documentElement).overflow === 'hidden' || !!window.__lenis?.isStopped,
    }
  })
  check(`${tag}: Vinyl Player opens and fits the screen`, opened && info.fits && !!info.stage, `"${info.title}" frame=${info.rect} stage=${info.stage}`)
  check(`${tag}:   page behind is scroll-locked`, info.locked)
  if (how === 'tap') await page.tap('dialog.vp-pop button.vp-dot--close')
  else await page.keyboard.press('Escape')
  const closed = await page.waitForFunction(() => !document.querySelector('dialog.vp-pop')?.open, { timeout: 4000 }).then(() => true, () => false)
  check(`${tag}:   closes (${how === 'tap' ? 'close button' : 'Escape'})`, closed)
  await sleep(400)
  check(`${tag}:   focus back on the card`, await page.evaluate((s) => document.activeElement === document.querySelector(s), sel))
}

async function flowsDesktop() {
  console.log('\n=== flows: desktop 1440x900 ===')
  const { page, errors } = await openPage(browser, '/works', { w: 1440, h: 900 })

  // nav pill round trip. "works" from another page is the landing page's
  // grid: / (the old /works forwards there), glided down to the grid.
  for (const [label, to] of [['design', '/design'], ['me', '/me'], ['works', '/']]) {
    await page.click(`nav[aria-label="Sections"] [data-flip-id="nav-${label}"]`)
    const ok = await waitPath(page, to)
    await sleep(label === 'works' ? 2200 : 800)
    check(`pill "${label}" -> ${to}`, ok && (await current(page)) === `nav-${label}`, `at ${await path(page)}, current=${await current(page)}`)
    if (label === 'works') {
      const at = await page.evaluate(() => ({ y: scrollY, grid: document.querySelector('[data-stage="works"]').getBoundingClientRect().top + scrollY }))
      check('  and glides down to the grid, the hero above it', Math.abs(at.y - at.grid) < 4, `${Math.round(at.y)} vs ${Math.round(at.grid)}`)
    } else check(`  ${to} starts at the top`, (await page.evaluate(() => scrollY)) === 0)
  }

  // top-bar monogram goes home
  await page.click('header a[aria-label="reydesigns — home"]')
  check('top-bar home -> /', await waitPath(page, '/'))
  await sleep(1500)

  // contact links
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('header nav a')].map((a) => ({ t: a.textContent.trim(), href: a.href, target: a.target, rel: a.rel })),
  )
  check('top bar has LINKEDIN, EMAIL, RESUME', links.map((l) => l.t).join() === 'LINKEDIN,EMAIL,RESUME', links.map((l) => l.t).join())
  for (const l of links.filter((l) => l.target === '_blank')) {
    check(`  ${l.t} opens safely in a new tab`, /noopener/.test(l.rel))
  }
  const resume = links.find((l) => l.t === 'RESUME')
  if (resume) {
    const r = await page.evaluate(async (u) => {
      const res = await fetch(u)
      return { status: res.status, type: res.headers.get('content-type'), size: (await res.arrayBuffer()).byteLength }
    }, resume.href)
    check('  resume PDF is served', r.status === 200 && /pdf/.test(r.type ?? '') && r.size > 10000, `${r.status} ${r.type} ${r.size}B`)
  }
  check('  email is a mailto:', /^mailto:/.test(links.find((l) => l.t === 'EMAIL')?.href ?? ''))

  // unknown routes
  await page.goto(`${BASE}/nope/at/all`, { waitUntil: 'networkidle2' })
  check('unknown route -> /', await waitPath(page, '/'))
  await page.goto(`${BASE}/works/not-a-study`, { waitUntil: 'networkidle2' })
  check('unknown study -> / (the grid)', await waitPath(page, '/'))

  // case studies on their own routes
  for (const slug of ['heyso', 'tmu-kpop', 'lipton']) {
    await page.goto(`${BASE}/works/${slug}`, { waitUntil: 'networkidle2' })
    await sleep(1500)
    const sections = await page.evaluate(() =>
      [...document.querySelectorAll('nav.fixed[aria-label="Case study sections"] a[data-section]')].map((a) => a.dataset.section),
    )
    check(`/works/${slug}: side panel lists sections`, sections.length >= 2, sections.join(', '))
    for (const id of sections) {
      await page.click(`nav.fixed[aria-label="Case study sections"] a[data-section="${id}"]`)
      const landed = await page
        .waitForFunction((id) => {
          const el = document.getElementById(id)
          const top = el?.getBoundingClientRect().top
          return el && top > -40 && top < innerHeight * 0.5
        }, { timeout: 6000, polling: 100 }, id)
        .then(() => true, () => false)
      await sleep(400)
      const state = await page.evaluate((id) => ({
        top: Math.round(document.getElementById(id)?.getBoundingClientRect().top ?? NaN),
        cur: document.querySelector('nav.fixed[aria-label="Case study sections"] [aria-current="true"]')?.dataset.section,
        atEnd: Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2,
      }), id)
      // the last section may be too short to reach the top; then the page bottoms out
      check(`  section "${id}" scrolls into view + highlights`, (landed || state.atEnd) && state.cur === id, `top=${state.top} current=${state.cur}`)
    }
    const next = await page.$('a[data-cs-next]')
    if (next) {
      const href = await page.evaluate((a) => a.getAttribute('href'), next)
      await page.evaluate((a) => a.click(), next)
      check(`  "Next case study" -> ${href}`, await waitPath(page, href.replace(/^.*(?=\/works)/, '')))
      await sleep(800)
      check('  next study starts at the top', (await page.evaluate(() => scrollY)) < 2)
    } else {
      check(`  /works/${slug} has a "Next case study" link`, false)
    }
  }
  await page.goto(`${BASE}/works/heyso`, { waitUntil: 'networkidle2' })
  await sleep(1000)
  // No HOME button in the section nav (the window closes; the page has the top bar).
  check('case-study nav has no HOME button', !(await page.$('nav[aria-label="Case study sections"] a[href$="/works"], nav[aria-label="Case study sections"] button')))

  await vinyl(page, 'desktop', 'click')

  // Design (once Funzies): the old address redirects; every pinned print
  // opens its window, a thumbnail picks a picture, Escape + close button close it
  await page.goto(`${BASE}/funzies`, { waitUntil: 'networkidle2' })
  await sleep(800)
  check('/funzies redirects to /design', (await path(page)) === '/design', await path(page))
  await page.goto(`${BASE}/design`, { waitUntil: 'networkidle2' })
  await sleep(1500)
  const cards = await page.$$eval('button.fz-card', (bs) => bs.map((b) => b.getAttribute('aria-label')))
  check('/design has 6 pinned prints', cards.length === 6, cards.join(', '))
  for (const [i, label] of cards.entries()) {
    const btn = (await page.$$('button.fz-card'))[i]
    await btn.evaluate((b) => b.scrollIntoView({ block: 'center' }))
    await sleep(300)
    await btn.click()
    const opened = await page
      .waitForFunction(() => document.querySelector('dialog.fz-pop')?.open, { timeout: 5000 })
      .then(() => true, () => false)
    await sleep(400)
    const info = await page.evaluate(() => {
      const d = document.querySelector('dialog.fz-pop')
      const r = d?.querySelector('.fz-pop__window')?.getBoundingClientRect()
      return {
        title: d?.querySelector('.fz-pop__title')?.textContent.trim(),
        fits: r ? r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight : false,
        rect: r && [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)].join(','),
        thumbs: d?.querySelectorAll('.fz-pop__thumb').length ?? 0,
        shown: d?.querySelector('.fz-pop__stage img, .fz-pop__stage video')?.getAttribute('src') ?? null,
        broken: [...(d?.querySelectorAll('.fz-pop__stage img, .fz-pop__text img') ?? [])].filter((i) => i.complete && i.naturalWidth === 0).length,
      }
    })
    check(`${label}: window opens and fits the screen`, opened && info.fits && info.broken === 0 && info.thumbs > 0, `"${info.title}" rect=${info.rect} thumbs=${info.thumbs} broken=${info.broken}`)
    if (info.thumbs > 1) {
      await page.click('dialog.fz-pop .fz-pop__thumb-list li:nth-child(2) .fz-pop__thumb')
      await sleep(400)
      const after = await page.evaluate(() => {
        const d = document.querySelector('dialog.fz-pop')
        return {
          shown: d.querySelector('.fz-pop__stage img, .fz-pop__stage video')?.getAttribute('src') ?? null,
          current: [...d.querySelectorAll('.fz-pop__thumb')].findIndex((t) => t.hasAttribute('aria-current')),
        }
      })
      check('  a thumbnail picks its picture', after.shown !== info.shown && after.current === 1, `current=${after.current}`)
    }
    if (i % 2) await page.keyboard.press('Escape')
    else await page.click('dialog.fz-pop button[aria-label="Close"]')
    const closed = await page
      .waitForFunction(() => !document.querySelector('dialog.fz-pop')?.open, { timeout: 4000 })
      .then(() => true, () => false)
    check(`  closes (${i % 2 ? 'Escape' : 'close button'})`, closed)
    await sleep(300)
  }

  // Me
  await page.goto(`${BASE}/me`, { waitUntil: 'networkidle2' })
  await sleep(2000)
  const me = await page.evaluate(() => ({
    stops: document.querySelectorAll('.me-tl__stop').length,
    mailto: document.querySelector('.term__link')?.getAttribute('href'),
    prints: [...document.querySelectorAll('.me-side img')].map((i) => i.complete && i.naturalWidth > 0),
    canvases: document.querySelectorAll('.me-side canvas').length,
    title: document.title,
  }))
  check('/me: timeline, terminal link, fridge prints', me.stops > 0 && /^mailto:/.test(me.mailto ?? '') && me.prints.length > 0 && me.prints.every(Boolean),
    `stops=${me.stops} prints=${me.prints.length} ok=${me.prints.filter(Boolean).length} canvases=${me.canvases}`)

  // titles
  for (const [route, want] of [['/works', /Works/], ['/design', /Design/], ['/me', /About/], ['/works/heyso', /HeySo/i]]) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2' })
    await sleep(500)
    const t = await page.title()
    check(`title on ${route}`, want.test(t), t)
  }

  check('desktop flows: no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  await page.close()
}

async function flowsPhone() {
  console.log('\n=== flows: phone 390x844 ===')
  const { page, errors } = await openPage(browser, '/works', { w: 390, h: 844 })
  await page.emulate({
    viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  await page.reload({ waitUntil: 'networkidle2' })
  await sleep(1500)

  const btn = 'nav[aria-label="Sections"] button[aria-expanded]'
  const sheetOpen = () => page.evaluate((s) => document.querySelector(s)?.getAttribute('aria-expanded') === 'true', btn)
  const sheetLinks = () => page.evaluate((s) => {
    const id = document.querySelector(s)?.getAttribute('aria-controls')
    const sheet = id && document.getElementById(id)
    if (!sheet) return null
    const r = sheet.getBoundingClientRect()
    return {
      labels: [...sheet.querySelectorAll('a')].map((a) => a.firstChild.textContent.trim()),
      fits: r.left >= 0 && r.right <= innerWidth && r.top >= 0,
      focus: sheet.contains(document.activeElement),
      rowH: Math.min(...[...sheet.querySelectorAll('a')].map((a) => a.getBoundingClientRect().height)),
    }
  }, btn)

  await page.tap(btn)
  await sleep(400)
  let s = await sheetLinks()
  check('links button opens the sheet', (await sheetOpen()) && s?.labels.length === 3, s && s.labels.join(', '))
  check('  sheet fits on screen, focus moves into it', !!s?.fits && !!s?.focus)
  check('  sheet rows are 44px tap targets', (s?.rowH ?? 0) >= 44, `${s?.rowH}px`)
  await page.keyboard.press('Escape')
  await sleep(300)
  check('  Escape closes it', !(await sheetOpen()))
  await page.tap(btn)
  await sleep(300)
  await page.touchscreen.tap(195, 300)
  await sleep(300)
  check('  tapping outside closes it', !(await sheetOpen()))

  // pill navigation by tap
  await page.tap('nav[aria-label="Sections"] [data-flip-id="nav-design"]')
  check('tap "design" -> /design', await waitPath(page, '/design'))
  await sleep(1200)
  // The board's cells, not the prints (which are tipped and nudged on purpose).
  const fz = await page.evaluate(() => {
    const ws = [...document.querySelectorAll('.fz-board__item')].map((b) => b.getBoundingClientRect())
    return { n: ws.length, cols: new Set(ws.map((r) => Math.round(r.left))).size, w: Math.round(ws[0]?.width ?? 0) }
  })
  check('  design board folds to 2 columns', fz.cols <= 2 && fz.n === 6, `${fz.n} prints, ${fz.cols} cols, ${fz.w}px`)
  const first = await page.$('button.fz-card')
  await first.tap()
  const open = await page.waitForFunction(() => document.querySelector('dialog.fz-pop')?.open, { timeout: 5000 }).then(() => true, () => false)
  const pop = await page.evaluate(() => {
    const r = document.querySelector('dialog.fz-pop .fz-pop__window')?.getBoundingClientRect()
    return r && { l: Math.round(r.left), r: Math.round(r.right), w: innerWidth }
  })
  check('  popup opens and fits the phone width', open && pop && pop.l >= 0 && pop.r <= pop.w, JSON.stringify(pop))
  await page.tap('dialog.fz-pop button[aria-label="Close"]')
  await sleep(400)

  await vinyl(page, 'phone', 'tap')

  // case study strip
  await page.goto(`${BASE}/works/heyso`, { waitUntil: 'networkidle2' })
  await sleep(1500)
  const strip = 'nav.cs-strip-band'
  const ids = await page.$$eval(`${strip} a[href^="#"]`, (as) => as.map((a) => a.getAttribute('href').slice(1)))
  check('/works/heyso: phone strip lists sections', ids.length >= 2, ids.join(', '))
  const scrolls = await page.evaluate((s) => {
    const el = document.querySelector(`${s} .cs-strip`)
    return { sw: el.scrollWidth, cw: el.clientWidth, doc: document.documentElement.scrollWidth, vw: innerWidth }
  }, strip)
  check('  strip scrolls sideways inside itself, page does not', scrolls.doc <= scrolls.vw, JSON.stringify(scrolls))
  const target = ids.at(Math.min(2, ids.length - 1))
  await page.$eval(`${strip} a[href="#${target}"]`, (a) => a.scrollIntoView({ inline: 'center', block: 'nearest' }))
  await page.tap(`${strip} a[href="#${target}"]`)
  const landed = await page
    .waitForFunction((id) => {
      const top = document.getElementById(id)?.getBoundingClientRect().top
      return top > -10 && top < innerHeight * 0.5
    }, { timeout: 6000, polling: 100 }, target)
    .then(() => true, () => false)
  await sleep(500)
  const after = await page.evaluate((id, s) => {
    const sec = document.getElementById(id).getBoundingClientRect()
    const band = document.querySelector(s).getBoundingClientRect()
    return { secTop: Math.round(sec.top), bandBottom: Math.round(band.bottom) }
  }, target, strip)
  check(`  tap "${target}" scrolls to it, clear of the sticky strip`, landed && after.secTop >= after.bandBottom - 8, JSON.stringify(after))

  // reduced motion still renders every route with no errors
  await page.close()
  for (const route of ['/', '/works', '/design', '/me', '/works/heyso']) {
    const { page: p, errors: e } = await openPage(browser, route, { w: 390, h: 844, reduced: true })
    await scrollThrough(p)
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    check(`reduced motion ${route}: renders, no overflow`, e.length === 0 && sw <= 0, [...e.slice(0, 2), sw > 0 ? `overflow +${sw}` : ''].join(' '))
    await p.close()
  }

  check('phone flows: no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
}

/* -------------------------------------------------------- contact sheets */

async function contactSheets() {
  for (const [w, list] of Object.entries(shots)) {
    const html = `<!doctype html><body style="margin:0;background:#888;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:8px;font:14px sans-serif">${list
      .map((s) => `<figure style="margin:0"><figcaption style="color:#fff;padding:2px 0">${s.route}</figcaption><img src="file://${s.file}" style="width:100%;display:block;border:1px solid #000"></figure>`)
      .join('')}</body>`
    const file = `${SHOTS}/sheet-${w}.html`
    await writeFile(file, html)
    const page = await browser.newPage()
    await page.setViewport({ width: 2000, height: 800 })
    await page.goto(`file://${file}`, { waitUntil: 'load' })
    await page.screenshot({ path: `${SHOTS}/sheet-${w}.png`, fullPage: true })
    await page.close()
  }
}

/* ------------------------------------------------------------------- run */

try {
  if (ONLY !== 'flows') await sizing()
  if (ONLY !== 'sizing') {
    await flowsDesktop().catch((e) => check('desktop flows ran to the end', false, e.message.slice(0, 200)))
    await flowsPhone().catch((e) => check('phone flows ran to the end', false, e.message.slice(0, 200)))
  }
  if (SHOTS) await contactSheets()
} finally {
  await browser.close()
}
done()
