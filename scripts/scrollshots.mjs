#!/usr/bin/env node
/**
 * Capture a route at several scroll positions.
 *   node scripts/scrollshots.mjs <route> <outPrefix> <fraction,fraction,...> [w] [h]
 */
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const [, , route = '/', prefix = '/tmp/s', fracs = '0', w = '1728', h = '1117'] = process.argv

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  protocolTimeout: 180000,
  args: ['--hide-scrollbars', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: Number(w), height: Number(h) })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.goto(`http://localhost:5173${route}`, { waitUntil: 'networkidle2', timeout: 30000 })
await new Promise((r) => setTimeout(r, 3500))

for (const f of fracs.split(',')) {
  const frac = Number(f)
  await page.evaluate((fr) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    const y = max * fr
    if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true })
    else window.scrollTo(0, y)
  }, frac)
  await new Promise((r) => setTimeout(r, 1800))
  const out = `${prefix}-${String(frac).replace('.', '')}.png`
  await page.screenshot({ path: out })
  const y = await page.evaluate(() => Math.round(window.scrollY))
  console.log(`${out}  scrollY=${y}`)
}
console.log('errors:', errors.length ? errors.slice(0, 5) : 'none')
await browser.close()
