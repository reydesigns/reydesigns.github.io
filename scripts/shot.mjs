#!/usr/bin/env node
/**
 * Screenshot helper for QA.
 *
 *   node scripts/shot.mjs <url-path> <out.png> [width] [height] [waitMs] [reducedMotion]
 *
 * Drives the installed Chrome over the DevTools protocol rather than using
 * `chrome --headless --screenshot`, because that path throttles
 * requestAnimationFrame and IntersectionObserver to nothing — scramble text
 * never resolves and lazy WebGL never initialises, so the capture lies.
 */
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const [, , path = '/', out = 'shot.png', w = '1728', h = '1000', waitMs = '3500', reduced = ''] =
  process.argv

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
  ],
})

const page = await browser.newPage()
await page.setViewport({ width: Number(w), height: Number(h), deviceScaleFactor: 2 })
if (reduced === 'reduced') {
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
}

const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`))

await page.goto(`http://localhost:5173${path}`, { waitUntil: 'networkidle2', timeout: 30000 })
await new Promise((r) => setTimeout(r, Number(waitMs)))

const probe = await page.evaluate(() => ({
  h1: document.querySelector('h1')?.getAttribute('aria-label') ?? null,
  h1text: document.querySelector('h1')?.textContent?.slice(0, 70) ?? null,
  canvases: document.querySelectorAll('canvas').length,
  sparkles: document.querySelectorAll('[aria-hidden="true"] img[src*="sparkle"]').length,
  scrollW: document.documentElement.scrollWidth,
  clientW: document.documentElement.clientWidth,
}))

await page.screenshot({ path: out })
console.log(JSON.stringify({ probe, errors }, null, 2))
await browser.close()
