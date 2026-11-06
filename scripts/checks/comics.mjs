/**
 * Comic Hoarder: the Works card and its pop-up (ComicHoarder).
 *
 *   node scripts/checks/comics.mjs            (dev server on :5173)
 *   SHOTS=/some/dir node scripts/checks/comics.mjs   also saves screenshots
 *
 * Desktop: the card, My Comic Collection, sits directly under the Vinyl
 * Player and shows a clean wire rack (no sign) of its first three tiers with
 * every cover loaded. A click opens the pop-up: the rack on the left under
 * its "Comic Hoarder" sign (the window's title, no cats), one pocket per
 * comic in character order with the character on a black tag under each,
 * each tier in front of the one above, the column scrolling when the rack
 * is taller than the window; on the right the first comic, out of its
 * pocket, in full, with a "Completed" tag above five pixel stars. Clicking
 * another flies it over (a flyer crosses the sheet) and flies the last one
 * back; dragging one onto the stand does the same, and letting go of one
 * over the rack puts it back. Enter picks too. Every comic shows. Green
 * maximizes; Escape closes and focus goes back to the card. Then a phone
 * (the comic on show is a strip that stays at the top while the rack
 * scrolls; a tap picks; no hint) and reduced motion (no flights).
 */
import { launch, openPage, sleep, check, done } from '../lib/browser.mjs'

const SHOTS = process.env.SHOTS
const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/comics-${name}.png` })

const CARD = '[data-card]:has(.ch-card)'
const COMIC = (id) => `.ch-frame button.ch-comic[data-comic="${id}"]`
const isOpen = (page) => page.evaluate(() => !!document.querySelector('dialog.ch-pop')?.open)

/* The rack, in order (src/data/comics.js): each character and how many comics. */
const STACKS = [
  ['spider-man', 'Spider-Man', 6],
  ['black-cat', 'Black Cat', 1],
  ['mary-jane', 'Mary Jane', 1],
  ['miles-morales', 'Miles Morales', 1],
  ['nightwing', 'Nightwing', 4],
  ['batman', 'Batman', 8],
  ['daredevil', 'Daredevil', 3],
  ['scarlet-witch', 'Scarlet Witch', 3],
  ['thanos', 'Thanos', 3],
]
const ORDER = STACKS.flatMap(([key, , n]) => Array(n).fill(key))
const TAGS = STACKS.flatMap(([, name, n]) => Array(n).fill(name))
const COUNT = ORDER.length
const TIERS = Math.max(3, Math.ceil(COUNT / 3))

/** The comic on the stand, and which pocket is empty. */
const stand = (page) =>
  page.evaluate(() => {
    const cover = document.querySelector('.ch-display__cover')
    return {
      title: document.querySelector('.ch-display__title')?.textContent,
      who: document.querySelector('.ch-display__who')?.textContent,
      tag: document.querySelector('.ch-display__tag')?.textContent,
      stars: document.querySelector('.ch-display .ch-stars')?.getAttribute('aria-label'),
      cover: !!cover && cover.complete && cover.naturalWidth > 0 && getComputedStyle(cover).visibility === 'visible',
      out: [...document.querySelectorAll('.ch-frame button.ch-comic[aria-pressed="true"]')].map((b) => b.dataset.comic),
      flyers: document.querySelectorAll('.ch-flyer').length,
    }
  })

const openComics = async (page) => {
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), CARD)
  await sleep(800)
  await page.click(`${CARD} button`)
  await sleep(800)
  await restPointer(page)
}

/* The pointer, left where the card was clicked, may now be over a comic in
   the window, which lifts it over the bottom of the one above; rest it on
   the stand instead, so every comic sits in its pocket. */
async function restPointer(page) {
  const d = await (await page.$('.ch-display'))?.boundingBox()
  if (d) await page.mouse.move(d.x + d.width / 2, d.y + d.height - 4)
  // and give a lifted comic time to settle back into its pocket
  await sleep(600)
}

/** Drags a comic by its top to (x, y) in steps, then lets go. */
async function dragTo(page, id, x, y) {
  const b = await (await page.$(COMIC(id))).boundingBox()
  const x0 = b.x + b.width / 2
  const y0 = b.y + b.height * 0.2
  await page.mouse.move(x0, y0)
  await page.mouse.down()
  for (let k = 1; k <= 16; k += 1) {
    await page.mouse.move(x0 + ((x - x0) * k) / 16, y0 + ((y - y0) * k) / 16)
    await sleep(16)
  }
  const held = await page.evaluate(() => ({
    flyer: document.querySelectorAll('.ch-flyer--held').length,
    dragging: document.querySelector('.ch-frame')?.dataset.dragging,
  }))
  await page.mouse.up()
  return held
}

// Nothing here needs WebGL; the GPU keeps the flights' frames coming.
const browser = await launch({ gpu: true })

/* --- desktop --------------------------------------------------------------- */
{
  const { page, errors } = await openPage(browser, '/')
  const place = await page.evaluate(() => {
    const name = (t) => [...document.querySelectorAll('[data-card-name]')].find((n) => n.textContent === t)?.closest('li')
    const v = name('Vinyl Player')?.getBoundingClientRect()
    const c = name('My Comic Collection')
    const cb = c?.getBoundingClientRect()
    return v && cb ? { dx: Math.round(cb.left - v.left), below: cb.top > v.bottom, last: !c.nextElementSibling } : null
  })
  check('card sits under the Vinyl Player, last in the grid', place && place.dx === 0 && place.below && place.last, JSON.stringify(place))

  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), CARD)
  await sleep(1200)
  const thumb = await page.evaluate((s) => {
    const card = document.querySelector(s)
    const imgs = [...card.querySelectorAll('.ch-rack img')]
    return {
      comics: card.querySelectorAll('.ch-comic').length,
      loaded: imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0),
      sign: !!card.querySelector('.ch-sign'),
      hidden: card.querySelector('.ch-rack')?.getAttribute('aria-hidden') === 'true',
      buttons: card.querySelectorAll('button').length,
      name: card.querySelector('button')?.getAttribute('aria-label'),
    }
  }, CARD)
  check('card shows a clean rack, no sign, its first nine covers loaded', thumb.comics === 9 && thumb.loaded && !thumb.sign, JSON.stringify(thumb))
  check('the card is one button named My Comic Collection, its rack a picture', thumb.buttons === 1 && thumb.name === 'My Comic Collection' && thumb.hidden, JSON.stringify(thumb))
  if (SHOTS) await (await page.$(CARD)).screenshot({ path: `${SHOTS}/comics-card.png` })

  await page.click(`${CARD} button`)
  await sleep(800)
  check('click opens the pop-up', await isOpen(page))
  await restPointer(page)
  const head = await page.evaluate(() => ({
    title: document.querySelector('#ch-title')?.textContent,
    inSign: !!document.querySelector('.ch-sign > #ch-title'),
    labelled: document.querySelector('dialog.ch-pop')?.getAttribute('aria-labelledby'),
    cats: document.querySelectorAll('.ch-sign__cat').length,
    hint: !!document.querySelector('.ch-hint'),
    dots: [...document.querySelectorAll('.ch-window > .vp-bar .vp-dot')].map((b) => b.getAttribute('aria-label')).join(' '),
  }))
  check('titled by the rack\'s sign, under the red and green dots', head.title === 'Comic Hoarder' && head.inSign && head.labelled === 'ch-title' && head.dots === 'Close Maximize', JSON.stringify(head))
  check('the sign is just the name, no cats; no hint under the rack', head.cats === 0 && !head.hint, JSON.stringify(head))

  const rack = await page.evaluate(() => {
    const r = document.querySelector('.ch-frame .ch-rack')
    const rb = r.getBoundingClientRect()
    const shelf = document.querySelector('.ch-shelf').getBoundingClientRect()
    const display = document.querySelector('.ch-display').getBoundingClientRect()
    const tiers = [...r.querySelectorAll('.ch-tier')]
    const z = tiers.map((t) => Number(getComputedStyle(t).zIndex))
    const comics = [...r.querySelectorAll('button.ch-comic')]
    return {
      tiers: tiers.length,
      frontInFront: z.every((v, k) => k === 0 || v > z[k - 1]),
      order: comics.map((b) => b.dataset.comic.replace(/-\d+$/, '')),
      tags: tiers.flatMap((t) => [...t.querySelectorAll('.ch-tag')].map((g) => g.textContent)),
      wire: getComputedStyle(r.querySelector('.ch-wire')).stroke,
      tag: (() => {
        const g = getComputedStyle(r.querySelector('.ch-tag'))
        return [g.backgroundColor, g.color]
      })(),
      across: rb.left >= shelf.left - 1 && rb.right <= shelf.right + 1,
      scrolls: (() => {
        const el = document.querySelector('.ch-shelf')
        return rb.height <= shelf.height || (getComputedStyle(el).overflowY === 'auto' && el.scrollHeight > el.clientHeight)
      })(),
      leftOfStand: rb.right <= display.left + 1,
    }
  })
  check(`a wire rack, ${TIERS} tiers, each in front of the one above`, rack.tiers === TIERS && rack.frontInFront && /rgb\((\d|[12]\d), (\d|[12]\d), (\d|[12]\d)\)/.test(rack.wire), JSON.stringify({ ...rack, order: undefined, tags: undefined }))
  check('one pocket a comic, sorted by character', rack.order.join() === ORDER.join(), rack.order.join(' '))
  check('a tag naming the character under every comic', rack.tags.join() === TAGS.join(), rack.tags.join(' | '))
  check('the tags are black with white lettering', /rgb\((\d|[12]\d), (\d|[12]\d), (\d|[12]\d)\)/.test(rack.tag[0]) && rack.tag[1] === 'rgb(255, 255, 255)', rack.tag.join(' / '))
  check('the rack fits its column across, left of the stand; the column scrolls for the rest', rack.across && rack.scrolls && rack.leftOfStand, JSON.stringify({ ...rack, order: undefined, tags: undefined }))

  const first = await stand(page)
  check('opens with the first comic out, Coming Home, on the stand in full', first.title === 'Amazing Spider-Man Modern Era Epic Collection: Coming Home (2025)' && first.out.join() === 'spider-man-0' && first.cover, JSON.stringify(first))
  check('"Completed" above the pixel stars', first.tag === 'Completed' && first.stars === 'Rated 5 out of 5 stars', JSON.stringify(first))
  const order = await page.evaluate(() => {
    const tag = document.querySelector('.ch-display__tag').getBoundingClientRect()
    const stars = document.querySelector('.ch-display .ch-stars')
    return { above: tag.bottom <= stars.getBoundingClientRect().top, crisp: stars.getAttribute('shape-rendering') === 'crispEdges' }
  })
  check('the tag sits above the stars, which are pixels', order.above && order.crisp, JSON.stringify(order))
  await shot(page, 'window')

  // a click flies it over, and the last one back
  await page.click(COMIC('black-cat-0'))
  await sleep(180)
  const mid = await stand(page)
  await shot(page, 'flight')
  await sleep(800)
  const cat = await stand(page)
  check('a click flies the comic across', mid.flyers >= 1, `${mid.flyers} flyer(s) mid-flight`)
  check('and it lands on the stand; the last one goes back', cat.title === 'Black Cat (2025)' && cat.out.join() === 'black-cat-0' && cat.cover && cat.flyers === 0 && cat.stars === 'Rated 4.5 out of 5 stars', JSON.stringify(cat))
  const back = await page.evaluate((s) => getComputedStyle(document.querySelector(`${s} img`)).visibility, COMIC('spider-man-0'))
  check('Coming Home is back in its pocket', back === 'visible', back)

  // a drag onto the stand
  const sb = await (await page.$('.ch-display__stage')).boundingBox()
  const held = await dragTo(page, 'nightwing-0', sb.x + sb.width / 2, sb.y + sb.height / 2)
  await sleep(900)
  const nw = await stand(page)
  check('dragging lifts a copy in hand, the stand marked to drop on', held.flyer === 1 && held.dragging === 'over', JSON.stringify(held))
  check('dropped on the stand, it is the one on show', nw.title === 'Nightwing (2016)' && nw.out.join() === 'nightwing-0' && nw.cover && nw.flyers === 0, JSON.stringify(nw))

  // a drag let go over the rack puts it back
  const rb = await (await page.$('.ch-frame .ch-rack')).boundingBox()
  await dragTo(page, 'mary-jane-0', rb.x + rb.width * 0.5, rb.y + rb.height * 0.3)
  await sleep(900)
  const still = await stand(page)
  const mj = await page.evaluate((s) => getComputedStyle(document.querySelector(`${s} img`)).visibility, COMIC('mary-jane-0'))
  check('let go over the rack, it goes back to its pocket', still.title === 'Nightwing (2016)' && mj === 'visible' && still.flyers === 0, JSON.stringify({ ...still, mj }))

  // Out past the window's edge, the comic in hand stays in sight: nothing
  // round it clips it. Letting go there is not a drop on the stand; it goes
  // back. And letting go never makes it jump: the flight starts exactly
  // where the comic in hand was.
  {
    const win = await (await page.$('.ch-window')).boundingBox()
    const c = await (await page.$(COMIC('mary-jane-0'))).boundingBox()
    const x0 = c.x + c.width / 2
    const y0 = c.y + c.height * 0.2
    await page.mouse.move(x0, y0)
    await page.mouse.down()
    const tx = win.x - 60
    const ty = win.y + win.height - 20
    for (let k = 1; k <= 16; k += 1) {
      await page.mouse.move(x0 + ((tx - x0) * k) / 16, y0 + ((ty - y0) * k) / 16)
      await sleep(16)
    }
    const out = await page.evaluate(() => {
      const g = document.querySelector('.ch-flyer--held')
      const w = document.querySelector('.ch-window').getBoundingClientRect()
      const r = g?.getBoundingClientRect()
      // Every box the comic sits in, up to the dialog, that would clip it.
      const clips = []
      for (let el = g?.parentElement; el && el.tagName !== 'DIALOG'; el = el.parentElement) {
        if (getComputedStyle(el).overflow !== 'visible') clips.push(el.className)
      }
      return { past: !!r && r.left < w.left, clips, box: r && [r.left, r.top, r.width, r.height].map(Math.round) }
    })
    check('the comic in hand stays in sight past the window\'s edge', out.past && out.clips.length === 0, JSON.stringify(out))
    // The comic as drawn: its centre, its width on screen and its tilt.
    const drawn = () =>
      page.evaluate(() => {
        const f = document.querySelector('.ch-flyer')
        if (!f) return null
        const m = new DOMMatrix(getComputedStyle(f).transform)
        const r = f.getBoundingClientRect()
        return [r.left + r.width / 2, r.top + r.height / 2, f.offsetWidth * Math.hypot(m.a, m.b), (Math.atan2(m.b, m.a) * 180) / Math.PI]
      })
    const before = await drawn()
    await page.mouse.up()
    const after = await drawn()
    const jump = after ? before.map((v, k) => Math.abs(v - after[k])) : null
    check('letting go does not make it jump', !!jump && jump[0] < 4 && jump[1] < 4 && jump[2] < 4 && jump[3] < 1.5,
      jump ? `centre ${Math.round(jump[0])},${Math.round(jump[1])}px, width ${Math.round(jump[2])}px, tilt ${jump[3].toFixed(1)}deg` : 'no flyer')
    await sleep(900)
    const back = await stand(page)
    const mjShown = await page.evaluate((s) => getComputedStyle(document.querySelector(`${s} img`)).visibility, COMIC('mary-jane-0'))
    check('let go outside the window, it goes back to its pocket', back.title === 'Nightwing (2016)' && mjShown === 'visible' && back.flyers === 0, JSON.stringify({ ...back, mjShown }))
  }

  // the keyboard
  await page.focus(COMIC('miles-morales-0'))
  await page.keyboard.press('Enter')
  await sleep(900)
  check('Enter picks a comic too', (await stand(page)).title === 'Miles Morales: Spider-Man (2022)')

  // every comic shows, with its tag and stars
  const all = await page.evaluate(async () => {
    const out = []
    for (const b of document.querySelectorAll('.ch-frame button.ch-comic')) {
      b.click()
      await new Promise((r) => setTimeout(r, 700))
      const cover = document.querySelector('.ch-display__cover')
      await cover.decode().catch(() => {})
      out.push({
        id: b.dataset.comic,
        ok:
          b.getAttribute('aria-pressed') === 'true' &&
          cover.naturalWidth > 0 &&
          document.querySelector('.ch-display__tag').textContent === 'Completed' &&
          /^Rated [0-5](\.5)? out of 5 stars$/.test(document.querySelector('.ch-display .ch-stars').getAttribute('aria-label')),
      })
    }
    return out
  })
  check('every comic comes out with its cover, tag and rating', all.length === COUNT && all.every((c) => c.ok), all.filter((c) => !c.ok).map((c) => c.id).join() || `${all.length} ok`)

  await page.click('.ch-window [data-ch-toggle]')
  await sleep(500)
  const full = await page.evaluate(() => {
    const w = document.querySelector('.ch-window').getBoundingClientRect()
    return { size: document.querySelector('dialog.ch-pop').dataset.size, w: Math.round(w.width), h: Math.round(w.height) }
  })
  check('green maximizes the window to the screen', full.size === 'full' && full.w === 1728 && full.h === 1117, JSON.stringify(full))
  await page.click('.ch-window [data-ch-toggle]')
  await sleep(500)

  await page.keyboard.press('Escape')
  await sleep(400)
  check('Escape closes it', !(await isOpen(page)))
  const focused = await page.evaluate((s) => document.activeElement === document.querySelector(`${s} button`), CARD)
  check('focus goes back to the card', focused)
  check('desktop: no errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  await page.close()
}

/* --- a phone --------------------------------------------------------------- */
{
  const { page, errors } = await openPage(browser, '/', { w: 390, h: 844 })
  await page.emulate({
    viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  await page.reload({ waitUntil: 'networkidle2' })
  await sleep(1200)
  await openComics(page)
  check('phone: it opens', await isOpen(page))
  const fit = await page.evaluate(() => {
    const frame = document.querySelector('.ch-frame')
    const f = frame.getBoundingClientRect()
    const rack = document.querySelector('.ch-frame .ch-rack').getBoundingClientRect()
    const display = document.querySelector('.ch-display').getBoundingClientRect()
    return {
      inFrame: rack.left >= f.left && rack.right <= f.right,
      standOnTop: Math.abs(display.top - f.top) < 1 && display.bottom <= rack.top,
      sideways: frame.scrollWidth > frame.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth,
      dots: document.querySelectorAll('.ch-window > .vp-bar .vp-dot').length,
      hint: document.querySelector('.ch-hint')?.textContent,
    }
  })
  check('phone: the comic on show across the top, the rack the width of the screen', fit.inFrame && fit.standOnTop, JSON.stringify(fit))
  check('phone: nothing scrolls sideways; only the red dot; no hint', !fit.sideways && fit.dots === 1 && fit.hint === undefined, JSON.stringify(fit))
  await page.evaluate(() => document.querySelector('.ch-frame').scrollTo(0, 400))
  await sleep(200)
  const pinned = await page.evaluate(() => {
    const f = document.querySelector('.ch-frame').getBoundingClientRect()
    return Math.round(document.querySelector('.ch-display').getBoundingClientRect().top - f.top)
  })
  check('phone: the strip stays at the top while the rack scrolls', pinned === 0, `${pinned}px from the top`)
  // Bring Mary Jane to the middle of what shows under the strip, then tap.
  await page.evaluate((s) => {
    const frame = document.querySelector('.ch-frame')
    const strip = document.querySelector('.ch-display').getBoundingClientRect().height
    const c = document.querySelector(s).getBoundingClientRect()
    const f = frame.getBoundingClientRect()
    frame.scrollTop += c.top - f.top - strip - (f.height - strip - c.height) / 2
  }, COMIC('mary-jane-0'))
  await sleep(300)
  await page.tap(COMIC('mary-jane-0'))
  await sleep(900)
  const mj = await stand(page)
  check('phone: a tap takes a comic out', mj.title === 'Friendly Neighborhood Mary Jane (2026)' && mj.cover && mj.flyers === 0, JSON.stringify(mj))
  await shot(page, 'phone')
  await page.tap('.ch-window .vp-dot--close')
  await sleep(500)
  check('phone: the red dot closes it', !(await isOpen(page)))
  check('phone: no errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  await page.close()
}

/* --- reduced motion -------------------------------------------------------- */
{
  const { page, errors } = await openPage(browser, '/', { reduced: true })
  await openComics(page)
  await page.click(COMIC('black-cat-0'))
  await sleep(60)
  const now = await stand(page)
  check('reduced motion: it swaps at once, no flight', now.title === 'Black Cat (2025)' && now.flyers === 0 && now.cover, JSON.stringify(now))
  check('reduced motion: no errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  await page.close()
}

await browser.close()
done()
