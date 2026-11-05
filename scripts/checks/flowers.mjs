/**
 * Binary Bloom: the Works card and its pop-up (FlowerGenerator).
 *
 *   node scripts/checks/flowers.mjs            (dev server on :5173)
 *   SHOTS=/some/dir node scripts/checks/flowers.mjs   also saves screenshots
 *
 * Desktop: the card sits beside the Vinyl Player, under the case studies,
 * and draws; a click opens the pop-up, titled Binary Bloom under a title bar
 * with red and green dots, the flower on a dark square with its botanical
 * name in the top corner, and a plain list of plants (the chosen one
 * burgundy); hovering one flower blooms that flower alone, and it closes
 * again after the pointer leaves; Enter opens them all, one after another;
 * the digits keep changing; picking one of the three swatches recolours the
 * drawing; every plant draws; Escape closes and focus goes back to the card.
 * Then a phone (a tap blooms the flower under it) and reduced motion
 * (nothing moves).
 */
import { launch, openPage, sleep, check, done } from '../lib/browser.mjs'

const SHOTS = process.env.SHOTS
const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/flowers-${name}.png` })

const CARD = '[data-card]:has(.fl-card)'
const isOpen = (page) => page.evaluate(() => !!document.querySelector('dialog.fl-pop')?.open)
const opened = (page) => page.evaluate(() => Number(document.querySelector('.fl-stage')?.dataset.open ?? -1))
const flowerCount = { 'spider-lily': 5, tulip: 3, orchid: 3, 'lily-of-the-valley': 8 }

/** How much of the canvas is drawn on: samples that differ from its background. */
const ink = (page, sel) =>
  page.evaluate((s) => {
    const c = document.querySelector(s)
    if (!c) return -1
    const bg = getComputedStyle(c.parentElement).backgroundColor.match(/\d+/g).map(Number)
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    let n = 0
    for (let k = 0; k < d.length; k += 16) {
      if (d[k + 3] > 40 && Math.abs(d[k] - bg[0]) + Math.abs(d[k + 1] - bg[1]) + Math.abs(d[k + 2] - bg[2]) > 24) n += 1
    }
    return n
  }, sel)

/** Which of the three swatches the drawing's strongest pixels are nearest, by hue. */
const tint = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('.fl-stage canvas')
    const bg = getComputedStyle(c.parentElement).backgroundColor.match(/\d+/g).map(Number)
    const swatches = [1, 2, 3].map((n) =>
      getComputedStyle(document.documentElement).getPropertyValue(`--fl-swatch-${n}`).trim(),
    )
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    // the average colour the drawing adds to the ground, where it adds the most
    const sum = [0, 0, 0]
    let n = 0
    for (let k = 0; k < d.length; k += 8) {
      const a = d[k + 3] / 255
      const px = [0, 1, 2].map((i) => d[k + i] * a + bg[i] * (1 - a))
      const add = px.map((v, i) => v - bg[i])
      if (add[0] + add[1] + add[2] < 120) continue
      add.forEach((v, i) => (sum[i] += v))
      n += 1
    }
    const mean = sum.map((v) => v / Math.max(1, n))
    const unit = (v) => {
      const l = Math.hypot(...v) || 1
      return v.map((x) => x / l)
    }
    const m = unit(mean)
    const scores = swatches.map((hex) => {
      const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
      const u = unit(rgb.map((v, i) => v - bg[i]))
      return u[0] * m[0] + u[1] * m[1] + u[2] * m[2]
    })
    return { nearest: scores.indexOf(Math.max(...scores)) + 1, samples: n, mean: mean.map(Math.round) }
  })

/** Moves (or taps) across the drawing until a flower opens; returns where. */
async function findFlower(page, how = 'move') {
  const box = await (await page.$('.fl-stage')).boundingBox()
  for (let fy = 0.25; fy <= 0.8; fy += 0.06) {
    for (let fx = 0.15; fx <= 0.85; fx += 0.05) {
      const x = box.x + box.width * fx
      const y = box.y + box.height * fy
      if (how === 'move') await page.mouse.move(x, y)
      else await page.touchscreen.tap(x, y)
      await sleep(how === 'move' ? 40 : 120)
      if ((await opened(page)) > 0) return [x, y]
    }
  }
  return null
}

// The GPU, not SwiftShader: the drawing is a 2D canvas that has to animate.
const browser = await launch({ gpu: true })

/* --- desktop --------------------------------------------------------------- */
{
  const { page, errors } = await openPage(browser, '/works')
  await page.setViewport({ width: 1728, height: 1117, deviceScaleFactor: 2 })
  await sleep(800)
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('[data-card-name]')].map((n) => n.textContent.trim()),
  )
  const at = order.indexOf('Binary Bloom')
  check('card sits beside the Vinyl Player, under the case studies', at > 1 && order[at - 1] === 'Vinyl Player' && order[at - 2] === 'Shore-Up', order.join(' | '))

  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), CARD)
  await sleep(1200)
  const cardInk = await ink(page, `${CARD} canvas`)
  check('card draws a flower', cardInk > 200, `${cardInk} drawn samples`)
  await page.hover(CARD)
  await sleep(2200)
  const cardHot = await ink(page, `${CARD} canvas`)
  check('hovering the card opens its florets', cardHot > cardInk, `${cardInk} -> ${cardHot}`)
  const card = await page.$(CARD)
  if (SHOTS) await card.screenshot({ path: `${SHOTS}/flowers-card.png` })

  await page.click(`${CARD} button`)
  await sleep(700)
  check('click opens the pop-up', await isOpen(page))
  const names = await page.evaluate(() => [...document.querySelectorAll('.fl-option span')].map((n) => n.textContent))
  check('four plants to pick from', names.join() === 'Spider Lily,Tulip,Orchid,Lily of the Valley', names.join())
  const swatches = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.fl-swatch')]
    const r = els.map((e) => e.getBoundingClientRect())
    const rows = new Set(r.map((b) => Math.round(b.top))).size
    const cols = new Set(r.map((b) => Math.round(b.left))).size
    return { n: els.length, rows, cols, square: r.every((b) => Math.abs(b.width - b.height) < 1) }
  })
  check('three square swatches in a row', swatches.n === 3 && swatches.rows === 1 && swatches.square, JSON.stringify(swatches))
  const layout = await page.evaluate(() => {
    const side = document.querySelector('.fl-controls').getBoundingClientRect()
    const stage = document.querySelector('.fl-stage').getBoundingClientRect()
    return { controlsLeftOfStage: side.right <= stage.left + 1 }
  })
  check('controls on the left, drawing on the right', layout.controlsLeftOfStage)
  const square = await page.evaluate(() => {
    const r = document.querySelector('.fl-stage .fl-square').getBoundingClientRect()
    const bg = getComputedStyle(document.querySelector('.fl-stage .fl-square')).backgroundColor
    return { w: Math.round(r.width), h: Math.round(r.height), bg }
  })
  const dark = square.bg.match(/\d+/g).map(Number).every((v) => v < 48)
  check('the flower sits on a dark square', square.w === square.h && square.w > 300 && dark, JSON.stringify(square))
  const room = await page.evaluate(() => {
    const st = document.querySelector('.fl-stage').getBoundingClientRect()
    const sq = document.querySelector('.fl-stage .fl-square').getBoundingClientRect()
    return [sq.left - st.left, st.right - sq.right, sq.top - st.top, st.bottom - sq.bottom].map(Math.round)
  })
  check('white space on all four sides, centred', room.every((v) => v >= 28) && Math.abs(room[0] - room[1]) <= 2 && Math.abs(room[2] - room[3]) <= 2, room.join(' '))
  const head = await page.evaluate(() => ({
    title: document.querySelector('#fl-title')?.textContent,
    hint: document.querySelector('.fl-hint')?.textContent,
    // The title bar, as on the Vinyl Player: red and green dots on top.
    dots: [...document.querySelectorAll('.fl-window > .vp-bar .vp-dot')].map((b) => {
      const r = b.getBoundingClientRect()
      return `${b.getAttribute('aria-label')}:${r.width > 8 && r.height > 8}`
    }),
    barOnTop: (() => {
      const bar = document.querySelector('.fl-window > .vp-bar')?.getBoundingClientRect()
      const frame = document.querySelector('.fl-frame')?.getBoundingClientRect()
      return !!bar && !!frame && bar.bottom <= frame.top + 1
    })(),
  }))
  check('titled Binary Bloom, with the new hint', head.title === 'Binary Bloom' && head.hint === 'Hover to bring it to life', JSON.stringify(head))
  check('a title bar with the red and green dots', head.barOnTop && head.dots.join(' ') === 'Close:true Maximize:true', JSON.stringify(head))
  const label = await page.evaluate(() => {
    const sq = document.querySelector('.fl-stage .fl-square').getBoundingClientRect()
    const el = document.querySelector('.fl-latin')
    const r = el.getBoundingClientRect()
    return {
      topRight: r.top - sq.top < 30 && sq.right - r.right < 30,
      font: getComputedStyle(el).fontFamily,
      loaded: document.fonts.check('italic 500 16px "Cormorant Garamond"'),
    }
  })
  check('the botanical name sits top right, in Cormorant italic', label.topRight && /Cormorant/.test(label.font) && label.loaded, JSON.stringify(label))
  const options = await page.evaluate(() =>
    [...document.querySelectorAll('.fl-option')].map((o) => ({
      on: o.querySelector('input').checked,
      color: getComputedStyle(o).color,
      bg: getComputedStyle(o).backgroundColor,
    })),
  )
  const chosen = options.find((o) => o.on)
  const others = options.filter((o) => !o.on)
  check(
    'the chosen plant is burgundy, the rest cool brown, with no highlight',
    chosen?.color === 'rgb(122, 26, 48)' && others.every((o) => o.color === 'rgb(34, 30, 31)') && options.every((o) => o.bg === 'rgba(0, 0, 0, 0)'),
    JSON.stringify(options),
  )
  await page.mouse.move(5, 5)
  await sleep(600)
  check('every flower starts in bud', (await opened(page)) === 0)
  const bud = await ink(page, '.fl-stage canvas')
  await shot(page, 'bud')

  // one flower at a time
  const spot = await findFlower(page)
  check('hovering a flower finds one', !!spot)
  await sleep(1600)
  const one = await opened(page)
  const bloom = await ink(page, '.fl-stage canvas')
  check('only the flower under the pointer blooms', one === 1, `${one} of ${flowerCount['spider-lily']} open`)
  check('and the drawing opens out', bloom > bud * 1.1, `${bud} -> ${bloom}`)
  await shot(page, 'one-flower')
  const stageBox = await (await page.$('.fl-stage')).boundingBox()
  await page.mouse.move(stageBox.x + 12, stageBox.y + stageBox.height - 12)
  await sleep(2000)
  check('it closes again once the pointer has left it', (await opened(page)) === 0)

  // the keyboard opens them all, one after another
  await page.focus('.fl-stage')
  await page.keyboard.press('Enter')
  await sleep(250)
  const early = await opened(page)
  await sleep(1600)
  const all = await opened(page)
  check('Enter opens the flowers one after another', early > 0 && early < flowerCount['spider-lily'] && all === flowerCount['spider-lily'], `${early} then ${all}`)
  await sleep(1200)
  await shot(page, 'all-open')

  // the digits glitch: the drawing never sits still for long
  const g0 = await ink(page, '.fl-stage canvas')
  await sleep(180)
  const g1 = await ink(page, '.fl-stage canvas')
  check('the digits keep changing', g0 !== g1, `${g0} -> ${g1}`)

  // the colour, which the swatches change
  const burgundy = await tint(page)
  check('drawn in burgundy to begin with', burgundy.nearest === 1, JSON.stringify(burgundy))
  await page.click('.fl-swatch:nth-child(3) input')
  await sleep(300)
  const brown = await tint(page)
  check('a swatch recolours the drawing, digits and glow', brown.nearest === 3, JSON.stringify(brown))

  await page.keyboard.press('Enter') // close them again before switching
  for (const [k, key] of ['tulip', 'orchid', 'lily-of-the-valley'].entries()) {
    await page.click(`.fl-option input[value="${key}"]`)
    await page.click(`.fl-swatch:nth-child(${[2, 1, 3][k]}) input`)
    await sleep(400)
    check(`${key}: starts in bud`, (await opened(page)) === 0)
    const found = await findFlower(page)
    await sleep(1600)
    const n = await opened(page)
    check(`${key}: one flower blooms on its own`, !!found && n === 1, `${n} of ${flowerCount[key]}`)
    await shot(page, key)
    await page.mouse.move(stageBox.x + 12, stageBox.y + stageBox.height - 12)
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
  const spot = await findFlower(page, 'tap')
  await sleep(1800)
  check('phone: a tap blooms the flower under it, alone', !!spot && (await opened(page)) === 1, String(await opened(page)))
  await shot(page, 'phone')
  await page.touchscreen.tap(...spot)
  await sleep(300)
  check('phone: a second tap closes it', (await opened(page)) === 0)
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
  const spot = await findFlower(page)
  await sleep(200)
  const a = await ink(page, '.fl-stage canvas')
  await sleep(600)
  const b = await ink(page, '.fl-stage canvas')
  check('reduced motion: a flower blooms at once, then holds still', !!spot && a > 200 && a === b, `${a} / ${b}`)
  await shot(page, 'reduced')
  check('no console errors (reduced)', errors.length === 0, errors.join(' | '))
  await page.close()
}

await browser.close()
done()
