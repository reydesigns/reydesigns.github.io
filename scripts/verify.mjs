#!/usr/bin/env node
/**
 * Route-level smoke check. Loads every route in a real browser and reports
 * console errors, page errors, failed requests and horizontal overflow.
 *
 *   node scripts/verify.mjs [width] [height]
 */
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const W = Number(process.argv[2] ?? 1728)
const H = Number(process.argv[3] ?? 1117)

const ROUTES = ['/', '/works', '/works/heyso', '/works/tmu-kpop', '/funzies', '/me']

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  protocolTimeout: 180000,
  args: [
    '--hide-scrollbars',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
})

let failures = 0

for (const route of ROUTES) {
  const page = await browser.newPage()
  await page.setViewport({ width: W, height: H })
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('requestfailed', (r) =>
    errors.push(`requestfailed: ${r.url().slice(-60)} ${r.failure()?.errorText}`),
  )

  try {
    await page.goto(`http://localhost:5173${route}`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    })
    await new Promise((r) => setTimeout(r, 3000))

    const probe = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      scrollH: document.documentElement.scrollHeight,
      navs: document.querySelectorAll('nav[aria-label="Sections"]').length,
      canvases: document.querySelectorAll('canvas').length,
      videos: document.querySelectorAll('video').length,
      // is the page scroll-locked right now?
      locked: getComputedStyle(document.documentElement).overflow === 'hidden',
    }))

    const overflow = probe.scrollW !== probe.clientW
    const bad = overflow || errors.length
    if (bad) failures += 1
    console.log(
      `${bad ? 'FAIL' : 'ok  '}  ${route.padEnd(18)} ` +
        `h=${String(probe.scrollH).padStart(6)} navs=${probe.navs} ` +
        `canvas=${probe.canvases} video=${probe.videos}` +
        `${overflow ? `  OVERFLOW ${probe.scrollW}>${probe.clientW}` : ''}` +
        `${probe.locked ? '  SCROLL-LOCKED' : ''}`,
    )
    errors.slice(0, 4).forEach((e) => console.log(`        ${e}`))
  } catch (e) {
    failures += 1
    console.log(`FAIL  ${route.padEnd(18)} ${e.message.slice(0, 100)}`)
  }
  await page.close()
}

await browser.close()
console.log(failures ? `\n${failures} route(s) with problems` : '\nall routes clean')
process.exit(failures ? 1 : 0)
