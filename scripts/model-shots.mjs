#!/usr/bin/env node
/**
 * Close-up screenshots of the two landing-page drawings, for the toy restyle's
 * before/after comparison (restyle/comparison.html).
 *
 *   node scripts/model-shots.mjs <suffix>     e.g. before | after
 *
 * Writes restyle/renders/<model>-<suffix>.png for each drawing. Needs the dev
 * server on :5173. Uses the same Chrome + SwiftShader setup as shot.mjs.
 */
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const suffix = process.argv[2] ?? 'after'
const MODELS = { 'self-portrait': '.hero-drawing--self > div', 'strawberry-cat': '.hero-drawing--cat > div' }

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  protocolTimeout: 180000,
  args: ['--hide-scrollbars', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
// Reduced motion stills the sway and bob, so before and after are framed alike.
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 4000))
// The drawings overlap the headline; hide everything but them so each crop
// shows the model alone on the page background.
await page.addStyleTag({
  content: 'body * { visibility: hidden !important } .hero-drawing, .hero-drawing * { visibility: visible !important }',
})
await new Promise((r) => setTimeout(r, 300))
for (const [name, sel] of Object.entries(MODELS)) {
  const el = await page.$(sel)
  if (!el) {
    console.log('missing', sel)
    continue
  }
  const out = `restyle/renders/${name}-${suffix}.png`
  await el.screenshot({ path: out, omitBackground: false })
  console.log('wrote', out)
}
await browser.close()
