/**
 * ASCII Flowers: the Works card and its pop-up (FlowerGenerator).
 *
 *   node scripts/checks/flowers.mjs            (dev server on :5173)
 *   SHOTS=/some/dir node scripts/checks/flowers.mjs   also saves screenshots
 *
 * Desktop: the card sits beside Shore-Up and draws; a click opens the
 * pop-up; hovering the flower blooms it (the canvas changes); each flower and
 * each colour can be picked; Escape closes it and focus goes back to the
 * card. Then a phone (tap to bloom) and reduced motion.
 */
import { launch, openPage, sleep, check, done } from '../lib/browser.mjs'

const SHOTS = process.env.SHOTS
const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/flowers-${name}.png` })

const CARD = '[data-card]:has(.fl-card)'
const isOpen = (page) => page.evaluate(() => !!document.querySelector('dialog.fl-pop')?.open)
// A cheap fingerprint of what the canvas shows: how much ink there is.
const ink = (page, sel) =>
  page.evaluate((s) => {
    const c = document.querySelector(s)
    if (!c) return -1
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    let n = 0
    for (let k = 3; k < d.length; k += 16) if (d[k] > 40) n += 1
    return n
  }, sel)

// The GPU, not SwiftShader: the flower is a 2D canvas that has to animate.
const browser = await launch({ gpu: true })

/* --- desktop --------------------------------------------------------------- */
{
  const { page, errors } = await openPage(browser, '/works')
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('[data-card-name]')].map((n) => n.textContent.trim()),
  )
  check('card sits beside Shore-Up', order.at(-1) === 'ASCII Flowers' && order.at(-2) === 'Shore-Up', order.join(' | '))

  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), CARD)
  await sleep(1200)
  const cardInk = await ink(page, `${CARD} canvas`)
  check('card draws a flower', cardInk > 200, `${cardInk} inked samples`)
  await page.hover(CARD)
  await sleep(1400)
  const cardHot = await ink(page, `${CARD} canvas`)
  check('hovering the card opens its flower further', cardHot > cardInk, `${cardInk} -> ${cardHot}`)
  const card = await page.$(CARD)
  if (SHOTS) await card.screenshot({ path: `${SHOTS}/flowers-card.png` })

  await page.click(`${CARD} button`)
  await sleep(700)
  check('click opens the pop-up', await isOpen(page))
  const names = await page.evaluate(() => [...document.querySelectorAll('.fl-option span')].map((n) => n.textContent))
  check('four flowers to pick from', names.join() === 'Spider Lily,Tulip,Orchid,Lily of the Valley', names.join())
  const swatches = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.fl-swatch')]
    const r = els.map((e) => e.getBoundingClientRect())
    const rows = new Set(r.map((b) => Math.round(b.top))).size
    const cols = new Set(r.map((b) => Math.round(b.left))).size
    return { n: els.length, rows, cols, square: r.every((b) => Math.abs(b.width - b.height) < 1), radius: getComputedStyle(els[0]).borderRadius }
  })
  check('a 3 x 3 grid of square swatches', swatches.n === 9 && swatches.rows === 3 && swatches.cols === 3 && swatches.square, JSON.stringify(swatches))
  const layout = await page.evaluate(() => {
    const side = document.querySelector('.fl-controls').getBoundingClientRect()
    const stage = document.querySelector('.fl-stage').getBoundingClientRect()
    return { controlsLeftOfStage: side.right <= stage.left + 1, stageW: Math.round(stage.width) }
  })
  check('controls on the left, flower on the right', layout.controlsLeftOfStage, JSON.stringify(layout))
  await page.mouse.move(5, 5)
  await sleep(500)
  const bud = await ink(page, '.fl-stage canvas')
  await shot(page, 'bud')

  const stage = await page.$('.fl-stage')
  const box = await stage.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 })
  await sleep(2200)
  const bloom = await ink(page, '.fl-stage canvas')
  check('hovering the flower blooms it', bloom > bud * 1.15, `${bud} -> ${bloom}`)
  await shot(page, 'bloom')

  for (const [k, key] of ['tulip', 'orchid', 'lily-of-the-valley'].entries()) {
    await page.click(`.fl-option input[value="${key}"]`)
    await page.click(`.fl-swatch:nth-child(${[5, 3, 7][k]}) input`)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 2 })
    await sleep(2200)
    const n = await ink(page, '.fl-stage canvas')
    check(`${key} draws`, n > 200, `${n} inked samples`)
    await shot(page, key)
  }

  await page.mouse.move(5, 5)
  await page.keyboard.press('Escape')
  await sleep(500)
  check('Escape closes it', !(await isOpen(page)))
  const focused = await page.evaluate((s) => document.activeElement === document.querySelector(`${s} button`), CARD)
  check('focus goes back to the card', focused)
  check('no console errors (desktop)', errors.length === 0, errors.join(' | '))
  await page.close()
}

/* --- phone ------------------------------------------------------------------ */
{
  const { page, errors } = await openPage(browser, '/works', { w: 390, h: 844 })
  await page.emulate({
    viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  await page.reload({ waitUntil: 'networkidle2' })
  await sleep(1500)
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), CARD)
  await sleep(600)
  await page.tap(`${CARD} button`)
  await sleep(700)
  check('phone: tap opens the pop-up', await isOpen(page))
  const fits = await page.evaluate(() => {
    const f = document.querySelector('.fl-frame').getBoundingClientRect()
    const c = document.querySelector('.fl-controls').getBoundingClientRect()
    return f.bottom <= innerHeight + 1 && c.bottom <= f.bottom + 1 && f.width <= innerWidth
  })
  check('phone: everything fits on screen', fits)
  const bud = await ink(page, '.fl-stage canvas')
  await page.tap('.fl-stage')
  await sleep(2200)
  const bloom = await ink(page, '.fl-stage canvas')
  check('phone: a tap blooms the flower', bloom > bud * 1.15, `${bud} -> ${bloom}`)
  const pressed = await page.evaluate(() => document.querySelector('.fl-stage').getAttribute('aria-pressed'))
  check('phone: the flower reports it is open', pressed === 'true')
  await shot(page, 'phone')
  check('no console errors (phone)', errors.length === 0, errors.join(' | '))
  await page.close()
}

/* --- reduced motion ---------------------------------------------------------- */
{
  const { page, errors } = await openPage(browser, '/works', { reduced: true })
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), CARD)
  await sleep(600)
  await page.click(`${CARD} button`)
  await sleep(400)
  const box = await (await page.$('.fl-stage')).boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await sleep(300)
  const a = await ink(page, '.fl-stage canvas')
  await sleep(600)
  const b = await ink(page, '.fl-stage canvas')
  check('reduced motion: blooms at once, then holds still', a > 200 && a === b, `${a} / ${b}`)
  await shot(page, 'reduced')
  check('no console errors (reduced)', errors.length === 0, errors.join(' | '))
  await page.close()
}

await browser.close()
done()
