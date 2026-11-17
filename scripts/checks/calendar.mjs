/**
 * The strawberry cat's block calendar (lib/catCalendar.js, calendarClock.js),
 * on the landing page.
 *
 *   node scripts/checks/calendar.mjs            (dev server on :5173)
 *   SHOTS=/some/dir node scripts/checks/calendar.mjs   also saves screenshots
 *
 * The digits are the visitor's local MM YYYY, from the first frame, with
 * nothing moving; in a timezone where it is already next year (UTC+14) they
 * are that year, not UTC's. With the dev-only ?mockDate clock: Dec 31 ->
 * Jan 1 flips the two month blocks and the last year block, and nothing
 * else, landing on 01 2027; Nov 30 -> Dec 1 flips only the second month
 * block; an ordinary midnight flips nothing. A midnight that passes while
 * the tab is hidden waits for the tab to come back, then flips. Under reduced
 * motion the change fades instead. No console errors.
 *
 * Reads window.__catCalendar (dev only): digits(), busy(), moving().
 */
import { launch, sleep, check, done, BASE } from '../lib/browser.mjs'

const SHOTS = process.env.SHOTS

const browser = await launch({ gpu: true })

/** Opens the landing page with the given clock and waits for the calendar. */
async function open({ mock = null, tz = null, reduced = false, hidden = false } = {}) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
  if (tz) await page.emulateTimezone(tz)
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  if (hidden) {
    // A tab the visitor has left: hidden until the check says otherwise.
    await page.evaluateOnNewDocument(() => {
      window.__hidden = true
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__hidden })
    })
  }
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  await page.goto(`${BASE}/${mock ? `?mockDate=${mock}` : ''}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => window.__catCalendar, { timeout: 30000 })
  return { page, errors }
}

const digits = (page) => page.evaluate(() => window.__catCalendar.digits().join(''))
const moving = (page) => page.evaluate(() => window.__catCalendar.moving().join(','))

/** Waits for the next change to start, and reports which blocks moved. */
async function nextFlip(page, within = 20000) {
  const started = await page
    .waitForFunction(() => window.__catCalendar.busy(), { timeout: within, polling: 10 })
    .then(() => true, () => false)
  if (!started) return { started, moved: '' }
  // The last of a staggered set starts up to ~250 ms in; collect them all.
  const seen = new Set()
  const until = Date.now() + 600
  while (Date.now() < until) {
    for (const i of (await moving(page)).split(',').filter(Boolean)) seen.add(Number(i))
    await sleep(30)
  }
  await page.waitForFunction(() => !window.__catCalendar.busy(), { timeout: 5000 })
  return { started, moved: [...seen].sort().join(',') }
}

/* --- on load ------------------------------------------------------------- */
{
  const { page, errors } = await open()
  const want = await page.evaluate(() => {
    const d = new Date()
    return String(d.getMonth() + 1).padStart(2, '0') + d.getFullYear()
  })
  check('shows the local MM YYYY on load', (await digits(page)) === want, `${await digits(page)} / ${want}`)
  await sleep(500)
  check('nothing moves on load', !(await page.evaluate(() => window.__catCalendar.busy())))
  if (SHOTS) await (await page.$('.hero-drawing--cat canvas')).screenshot({ path: `${SHOTS}/calendar-cat.png` })
  check('no console errors (load)', errors.length === 0, errors.join(' | '))
  await page.close()
}

/* --- local time, not UTC ------------------------------------------------- */
{
  // 5 am on New Year's Day at UTC+14 is still the 31st of December in UTC.
  const { page } = await open({ tz: 'Pacific/Kiritimati', mock: '2027-01-01T05:00:00' })
  check('uses local time, not UTC (UTC+14, New Year)', (await digits(page)) === '012027', await digits(page))
  await page.close()
}

/* --- Dec 31 -> Jan 1 ----------------------------------------------------- */
{
  const { page, errors } = await open({ mock: '2026-12-31T23:59:52' })
  check('Dec 31: 12 2026', (await digits(page)) === '122026', await digits(page))
  const flip = await nextFlip(page)
  check('midnight flips the month blocks and the last year block only', flip.moved === '0,1,5', JSON.stringify(flip))
  check('and lands on 01 2027', (await digits(page)) === '012027', await digits(page))
  check('no console errors (new year)', errors.length === 0, errors.join(' | '))
  await page.close()
}

/* --- Nov 30 -> Dec 1 ----------------------------------------------------- */
{
  const { page } = await open({ mock: '2026-11-30T23:59:54' })
  const flip = await nextFlip(page)
  check('Nov 30 -> Dec 1 flips only the second month block', flip.moved === '1', JSON.stringify(flip))
  check('and lands on 12 2026', (await digits(page)) === '122026', await digits(page))
  await page.close()
}

/* --- an ordinary midnight ------------------------------------------------ */
{
  const { page } = await open({ mock: '2026-11-15T23:59:56' })
  const flip = await nextFlip(page, 7000)
  check('an ordinary midnight flips nothing', !flip.started && (await digits(page)) === '112026', await digits(page))
  await page.close()
}

/* --- a hidden tab -------------------------------------------------------- */
{
  const { page } = await open({ mock: '2026-12-31T23:59:58', hidden: true })
  await sleep(4000)
  check('a midnight passed in a hidden tab waits', (await digits(page)) === '122026', await digits(page))
  await page.evaluate(() => {
    window.__hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
  })
  const flip = await nextFlip(page, 3000)
  check('and flips when the tab comes back', flip.moved === '0,1,5' && (await digits(page)) === '012027', JSON.stringify(flip))
  await page.close()
}

/* --- reduced motion ------------------------------------------------------ */
{
  const { page, errors } = await open({ mock: '2026-12-31T23:59:54', reduced: true })
  const flip = await nextFlip(page)
  check('reduced motion: the changed digits fade over', flip.moved === '0,1,5' && (await digits(page)) === '012027', JSON.stringify(flip))
  check('no console errors (reduced)', errors.length === 0, errors.join(' | '))
  await page.close()
}

await browser.close()
done()
