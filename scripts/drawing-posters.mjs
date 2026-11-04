#!/usr/bin/env node
/**
 * Renders the stills the landing page shows while its two 3D drawings load.
 *
 *   node scripts/drawing-posters.mjs            writes Assets/.../textures/<model>/poster.webp
 *   node scripts/drawing-posters.mjs <dir>      writes <dir>/<model>.png instead (for comparing)
 *
 * Each still is the live drawing itself, at rest, screenshotted off the page:
 * reduced motion stills the sway and the bob, so the model sits in exactly the
 * pose it starts in, and the box is at its largest size (1920px wide at 2x)
 * so the still is sharp on a retina screen. Everything but the canvases is
 * hidden and the page made transparent, so the still keeps its alpha.
 *
 * Re-run it whenever the drawings' look changes (src/data/style_config.json,
 * the textures, the lights): the live canvas fades in over its still, and the
 * two must match. Needs the dev server on :5173 (or BASE_URL). Uses the GPU.
 */
import { writeFile } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const OUT_DIR = process.argv[2]
const MODELS = {
  'self-portrait': '.hero-drawing--self',
  'strawberry-cat': '.hero-drawing--cat',
}
const ASSETS = new URL('../Assets/experiments/3d-drawing/textures/', import.meta.url).pathname

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  protocolTimeout: 180000,
  args: ['--hide-scrollbars', '--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 })
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
// Live once each canvas has drawn its first frame (Drawing3DLazy sets it);
// a version without the attribute just gets a few seconds.
await page
  .waitForFunction(() => document.querySelectorAll('.hero-drawing [data-live="true"]').length === 2, { timeout: 20000 })
  .catch(() => new Promise((r) => setTimeout(r, 4000)))
// Two more frames, so the spring has nothing left to settle.
await new Promise((r) => setTimeout(r, 500))
await page.addStyleTag({
  content: `html, body, body * { background: transparent !important; box-shadow: none !important }
    body * { visibility: hidden !important }
    .hero-drawing canvas { visibility: visible !important; opacity: 1 !important; transition: none !important }`,
})
await new Promise((r) => setTimeout(r, 300))
for (const [name, sel] of Object.entries(MODELS)) {
  const canvas = await page.$(`${sel} canvas`)
  if (!canvas) throw new Error(`no canvas in ${sel}`)
  const png = await canvas.screenshot({ omitBackground: true })
  if (OUT_DIR) {
    await writeFile(`${OUT_DIR}/${name}.png`, png)
    console.log(`${OUT_DIR}/${name}.png`)
    continue
  }
  // PNG -> WebP (lossy, with alpha) in the page: Chrome's own encoder.
  const webp = await page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    c.getContext('2d').drawImage(img, 0, 0)
    const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.92))
    const buf = new Uint8Array(await blob.arrayBuffer())
    let s = ''
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return [btoa(s), c.width, c.height]
  }, Buffer.from(png).toString('base64'))
  const file = `${ASSETS}${name}/poster.webp`
  await writeFile(file, Buffer.from(webp[0], 'base64'))
  console.log(file, `${webp[1]}x${webp[2]}`, `${Math.round(Buffer.from(webp[0], 'base64').length / 1024)} kB`)
}
// Chrome on the GPU sometimes hangs on close; the files are written by now.
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))])
browser.process()?.kill()
