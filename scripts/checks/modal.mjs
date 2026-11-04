/**
 * The case-study pop-up (CaseStudyModal) and the works cards that open it.
 *
 *   node scripts/checks/modal.mjs            (dev server on :5173)
 *   SHOTS=/some/dir node scripts/checks/modal.mjs   also saves screenshots
 *
 * Desktop: a card opens its study in a window over `/` without changing the
 * address, the green dot maximizes and minimizes, the section nav and
 * "next case study" work inside it, Escape closes it and gives the page back.
 * Then: a reload with it open, resizing below 64rem, a phone (full screen,
 * back gesture), reduced motion, and the study's own route.
 */
import { launch, openPage, sleep, check, done } from '../lib/browser.mjs'

const SHOTS = process.env.SHOTS
const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/modal-${name}.png` })

const isOpen = (page) => page.evaluate(() => !!document.querySelector('dialog.cs-modal')?.open)
const size = (page) => page.evaluate(() => document.querySelector('dialog.cs-modal')?.dataset.size)
const title = (page) => page.evaluate(() => document.querySelector('.cs-modal__scroll h1')?.textContent.trim() ?? null)
const waitOpen = (page, ms = 8000) =>
  page.waitForFunction(() => document.querySelector('.cs-modal__scroll h1'), { timeout: ms }).then(() => true, () => false)
// Lenis owns the landing page's scroll position and undoes a plain
// scrollIntoView, so go through it when it is running.
const toWorks = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-stage="works"]')
    if (!el) return
    if (window.__lenis) window.__lenis.scrollTo(el, { immediate: true, force: true })
    else el.scrollIntoView()
  })

/* Each part runs in its own browser. Headless Chrome here renders in
   software (SwiftShader); after a while of video, blur and scripted scrolling
   a tab can stop producing frames, and then scroll events, :hover and even
   navigations stall. Fresh browsers keep one part's stall out of the next. */
async function part(name, fn) {
  const browser = await launch()
  try {
    await fn(browser)
  } catch (e) {
    check(`${name}: ran to the end`, false, e.message.split('\n')[0])
  } finally {
    // Closing a browser with a modal dialog still open can stall; never hang on it.
    await Promise.race([browser.close(), sleep(5000)])
  }
}

/* ---- the cards ---------------------------------------------------------- */
await part('cards', async (browser) => {
  const { page } = await openPage(browser, '/works')
  const cards = await page.$$eval('[data-card]', (els) =>
    els.map((el) => ({
      tag: el.tagName,
      ratio: el.getBoundingClientRect().width / el.getBoundingClientRect().height,
      // The description is the card link's next sibling (the card clips its
      // own contents), not inside it.
      blurb: el.nextElementSibling?.matches('[data-card-blurb]') ? Number(getComputedStyle(el.nextElementSibling).opacity) : null,
    })))
  // Four studies and two toys, the Vinyl Player and Binary Bloom (each opens
  // its own pop-up, not a study).
  check('six cards', cards.length === 6, cards.length)
  check('cards are 16:9', cards.every((c) => Math.abs(c.ratio - 16 / 9) < 0.02), cards.map((c) => c.ratio.toFixed(3)).join(' '))
  check('descriptions hidden by default', cards.filter((c) => c.tag === 'A').every((c) => c.blurb === 0))
  check('Shore-Up is a case study link', !!(await page.$('a[data-card][href$="/works/shore-up"]')))
  await page.hover('a[data-card][href$="/heyso"]')
  // It fades up a beat after the card is reached (75ms delay + 450ms), but
  // just after load the fade can start late, so wait for it rather than a
  // fixed time.
  const shown = await page
    .waitForFunction(() => getComputedStyle(document.querySelector('a[data-card][href$="/heyso"] + [data-card-blurb]')).opacity === '1', { timeout: 2000 })
    .then(() => true, () => false)
  check('description on hover', shown)
  await shot(page, 'cards-hover')
  await page.$eval('a[data-card][href$="/works/shore-up"]', (a) => a.scrollIntoView({ block: 'center' }))
  await sleep(300)
  await page.click('a[data-card][href$="/works/shore-up"]')
  await sleep(1200)
  const su = await page.evaluate(() => ({
    title: document.querySelector('dialog.cs-modal article h1')?.textContent,
    goals: document.querySelectorAll('dialog.cs-modal .su-goal').length,
    demo: !!document.querySelector('dialog.cs-modal .su-demo video'),
  }))
  check('Shore-Up opens its study', (await isOpen(page)) && su.title === 'Shore-Up' && su.goals === 4 && su.demo, JSON.stringify(su))
  await page.keyboard.press('Escape')
  await sleep(500)
})

/* ---- desktop, from / ------------------------------------------------------ */
await part('desktop', async (browser) => {
  const { page, errors } = await openPage(browser, '/')
  await toWorks(page)
  await sleep(600)

  await page.click('a[data-card][href$="/heyso"]')
  check('card opens the pop-up', await waitOpen(page))
  await sleep(500)
  const heysoTitle = await title(page)
  check('address unchanged', (await page.evaluate(() => location.pathname)) === '/')
  check('opens as a window', (await size(page)) === 'window')
  check('page behind is locked', await page.evaluate(() => !!window.__lenis?.isStopped))
  check('maximize sits top-left', await page.$eval('[data-cs-toggle]', (b) => {
    const r = b.getBoundingClientRect(), f = document.querySelector('.cs-modal__frame').getBoundingClientRect()
    return b.getAttribute('aria-label') === 'Maximize' && r.left - f.left < 80 && r.top - f.top < 40
  }))
  check('section nav pinned inside the window', await page.evaluate(() => {
    const nav = document.querySelector('.cs-modal nav[aria-label="Case study sections"]')
    const f = document.querySelector('.cs-modal__frame').getBoundingClientRect()
    const r = nav?.getBoundingClientRect()
    return !!r && r.width > 0 && Math.abs(r.left - f.left) < 2
  }))
  check('no sideways scroll in the window', await page.$eval('.cs-modal__scroll', (s) => s.scrollWidth <= s.clientWidth + 1))
  await shot(page, 'window')

  await page.click('[data-cs-toggle]')
  await sleep(600)
  check('maximizes to full screen', (await size(page)) === 'full' && await page.$eval('.cs-modal__frame', (f) => {
    const r = f.getBoundingClientRect()
    return Math.round(r.width) === innerWidth && Math.round(r.height) === innerHeight
  }))
  check('button becomes minimize', (await page.$eval('[data-cs-toggle]', (b) => b.getAttribute('aria-label'))) === 'Minimize')
  await shot(page, 'full')
  await page.click('[data-cs-toggle]')
  await sleep(600)
  check('minimizes back to a window', (await size(page)) === 'window')

  // Section nav inside the pop-up scrolls the pop-up and tracks the section.
  const before = await page.$eval('.cs-modal__scroll', (s) => s.scrollTop)
  await page.click('.cs-modal nav[aria-label="Case study sections"] a[data-section="research"]')
  await sleep(1200)
  const after = await page.evaluate(() => {
    const s = document.querySelector('.cs-modal__scroll')
    const t = document.getElementById('research').getBoundingClientRect().top - s.getBoundingClientRect().top
    return { top: s.scrollTop, targetTop: Math.round(t), current: document.querySelector('.cs-modal nav [aria-current="true"]')?.dataset.section }
  })
  check('section link scrolls the pop-up', after.top > before && Math.abs(after.targetTop) < 80, `scrollTop ${after.top} target at ${after.targetTop}`)
  check('section nav marks it current', after.current === 'research', after.current)
  check('page behind did not move', (await page.evaluate(() => Math.abs(scrollY - document.querySelector('[data-stage="works"]').offsetTop))) < 4)

  // "Next case study" swaps the study in place.
  await page.$eval('.cs-modal__scroll', (s) => s.scrollTo(0, s.scrollHeight))
  await sleep(500)
  await page.click('.cs-modal [data-cs-next]')
  await sleep(1200)
  const nextTitle = await title(page)
  check('next case study swaps in place', !!nextTitle && nextTitle !== heysoTitle && (await page.evaluate(() => location.pathname)) === '/', `${heysoTitle} -> ${nextTitle}`)
  check('swapped study starts at its top', (await page.$eval('.cs-modal__scroll', (s) => s.scrollTop)) < 5)

  await page.keyboard.press('Escape')
  await sleep(700)
  check('Escape closes', !(await isOpen(page)))
  check('page unlocked after close', await page.evaluate(() => !window.__lenis?.isStopped))
  check('focus back on the card', await page.evaluate(() => !!document.activeElement?.matches('a[data-card]')))
  check('history entry popped', (await page.evaluate(() => history.state?.usr?.caseStudy ?? null)) === null)

  // Backdrop click closes in window mode.
  await page.click('a[data-card][href$="/lipton"]')
  await waitOpen(page)
  await sleep(500)
  await page.mouse.click(8, 8)
  await sleep(700)
  check('backdrop click closes', !(await isOpen(page)))
  check('desktop: no console errors', errors.length === 0, errors.join(' | '))
})

/* ---- Lipton's scroll-linked motion runs against the pop-up ---------------- */
await part('motion', async (browser) => {
  const { page } = await openPage(browser, '/works')
  await page.click('a[data-card][href$="/lipton"]')
  await waitOpen(page)
  await sleep(600)
  const read = () => page.evaluate(() =>
    [...document.querySelectorAll('.cs-modal [style*="--p"]')].map((e) => e.style.getPropertyValue('--p')).join(','))
  const p0 = await read()
  // Real wheel input over the study: it scrolls the pop-up natively (Lenis is
  // stopped, and the dialog is data-lenis-prevent).
  await page.mouse.move(864, 600)
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel({ deltaY: 500 })
    await sleep(120)
  }
  await sleep(800)
  const p1 = await read()
  check('wheel scrolls the pop-up, not the page', (await page.$eval('.cs-modal__scroll', (s) => s.scrollTop)) > 1000 && (await page.evaluate(() => scrollY)) === 0)
  check('scroll-linked motion follows the pop-up', p0 !== '' && p0 !== p1, `${p0.slice(0, 40)} -> ${p1.slice(0, 40)}`)
})

/* ---- a reload with the pop-up open lands on the page without it ----------- */
await part('reload', async (browser) => {
  const { page } = await openPage(browser, '/works')
  await page.click('a[data-card][href$="/lipton"]')
  await waitOpen(page)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await sleep(2500)
  check('reload: no pop-up', !(await isOpen(page)))
  check('reload: state cleared', (await page.evaluate(() => history.state?.usr?.caseStudy ?? null)) === null)
})

/* ---- crossing 64rem with it open ------------------------------------------ */
await part('resize', async (browser) => {
  const { page } = await openPage(browser, '/works')
  await page.click('a[data-card][href$="/heyso"]')
  await waitOpen(page)
  await page.setViewport({ width: 900, height: 900 })
  await sleep(600)
  check('resized below 64rem: full + back', (await size(page)) === 'full' && !!(await page.$('[data-cs-back]')) && !(await page.$('[data-cs-toggle]')))
  await page.setViewport({ width: 1728, height: 1117 })
  await sleep(600)
  check('resized back: window + maximize', (await size(page)) === 'window' && !!(await page.$('[data-cs-toggle]')))
})

/* ---- phone ----------------------------------------------------------------- */
await part('phone', async (browser) => {
  const { page, errors } = await openPage(browser, '/works', { w: 390, h: 844 })
  await page.click('a[data-card][href$="/tmu-kpop"]')
  check('phone: opens', await waitOpen(page))
  await sleep(500)
  check('phone: full screen', (await size(page)) === 'full')
  check('phone: back button, no maximize', !!(await page.$('[data-cs-back]')) && !(await page.$('[data-cs-toggle]')))
  check('phone: no sideways scroll', await page.$eval('.cs-modal__scroll', (s) => s.scrollWidth <= s.clientWidth + 1))
  await shot(page, 'phone')
  await page.goBack()
  await sleep(700)
  check('phone: back gesture closes, stays put', !(await isOpen(page)) && (await page.evaluate(() => location.pathname)) === '/works')
  await page.click('a[data-card][href$="/heyso"]')
  await waitOpen(page)
  await page.click('[data-cs-back]')
  await sleep(700)
  check('phone: back button closes', !(await isOpen(page)))
  check('phone: no console errors', errors.length === 0, errors.join(' | '))
})

/* ---- reduced motion --------------------------------------------------------- */
await part('reduced', async (browser) => {
  const { page } = await openPage(browser, '/works', { reduced: true })
  await page.click('a[data-card][href$="/heyso"]')
  check('reduced: still opens the pop-up', await waitOpen(page))
  await page.keyboard.press('Escape')
  await sleep(300)
  check('reduced: closes', !(await isOpen(page)) && (await page.evaluate(() => location.pathname)) === '/works')
})

/* ---- the study's own route ------------------------------------------------- */
await part('direct', async (browser) => {
  const { page, errors } = await openPage(browser, '/works/heyso')
  check('/works/heyso is a full page', !!(await page.$('main h1')) && !(await isOpen(page)))
  check('/works/heyso HOME is a link', !!(await page.$('nav[aria-label="Case study sections"] a[href$="/works"]')))
  check('direct: no console errors', errors.length === 0, errors.join(' | '))
})

done()
