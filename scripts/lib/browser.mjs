/**
 * Shared puppeteer helpers for the scripts/checks/*.mjs QA scripts.
 *
 *   import { launch, openPage, waitBoot, sleep, check, done } from '../lib/browser.mjs'
 *
 *   const browser = await launch()
 *   const { page, errors } = await openPage(browser, '/')
 *   check('something', cond, 'detail shown next to the PASS/FAIL line')
 *   await browser.close()
 *   done()           // exits 1 if any check failed
 *
 * BASE_URL picks the server (dev on :5173 by default; use :4173 for a
 * `npm run preview` build).
 */
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
export const BASE = process.env.BASE_URL ?? 'http://localhost:5173'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* A failed request that is not a fault: a <video> download the browser itself
   cut short. A card video with `preload="metadata"` (WorkCard, whenever the
   grid is near the viewport but not on it — `/` on load) fetches until it can
   start, then Chrome's media loader suspends and cancels the rest; a reload or
   tab close cuts a playing video's stream the same way. Puppeteer reports both
   as net::ERR_ABORTED. A missing or broken file fails differently (an error
   response, or another error text), so it is still caught. */
export const isMediaAbort = (r) =>
  r.resourceType() === 'media' && r.failure()?.errorText === 'net::ERR_ABORTED'

/* SwiftShader (software GL) is what lets the landing page's WebGL drawings
   start in a headless browser, but it rasterises everything in software: a
   pop-up over the Works grid paints at well under 1 fps. A check that needs
   no WebGL and does need frames (the Binary Bloom canvas) passes
   `{ gpu: true }` to use the machine's GPU instead. */
export function launch({ gpu = false } = {}) {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    protocolTimeout: 180000,
    args: gpu
      ? ['--hide-scrollbars']
      : ['--hide-scrollbars', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
}

/* Resolves once the page is ready to be inspected. There is no boot overlay
   yet, so this is a short settle after networkidle2; the overlay task makes it
   wait for window.__bootLog to report 'boot-end' (or for [data-boot-loader] to
   leave the DOM) instead. Every check goes through this so that change only
   has to be made here. */
export async function waitBoot(page) {
  await sleep(1500)
}

/* Opens `path` in a fresh tab. `wait: false` returns right after
   domcontentloaded (for checks that inspect the very first frames) and skips
   waitBoot. `reduced` emulates prefers-reduced-motion: reduce. Console
   errors, page errors and failed requests are collected into `errors`. */
export async function openPage(browser, path, { w = 1728, h = 1117, reduced = false, wait = true } = {}) {
  const page = await browser.newPage()
  await page.setViewport({ width: w, height: h })
  if (reduced) {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  }
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('requestfailed', (r) => {
    if (!isMediaAbort(r)) errors.push(`requestfailed: ${r.url().slice(-60)} ${r.failure()?.errorText}`)
  })
  await page.goto(`${BASE}${path}`, {
    waitUntil: wait ? 'networkidle2' : 'domcontentloaded',
    timeout: 30000,
  })
  if (wait) await waitBoot(page)
  return { page, errors }
}

let failures = 0

export function check(name, cond, detail = '') {
  if (!cond) failures++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail !== '' && detail != null ? `  (${detail})` : ''}`)
}

export function done() {
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
  process.exit(failures ? 1 : 0)
}
