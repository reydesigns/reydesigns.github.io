#!/usr/bin/env node
/** Measures the nav pill's resting rect on /works and at the end of the / sequence. */
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  protocolTimeout: 180000,
  args: ['--hide-scrollbars', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

const rect = () =>
  document.querySelector('nav[aria-label="Sections"]')?.getBoundingClientRect().toJSON() ?? null

async function measure(route, settle, scrollToEnd) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1728, height: 1117 })
  await page.goto(`http://localhost:5173${route}`, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 2500))
  if (scrollToEnd) {
    await page.evaluate(() => {
      const y = document.documentElement.scrollHeight - window.innerHeight
      if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true })
      else window.scrollTo(0, y)
    })
  }
  await new Promise((r) => setTimeout(r, settle))
  const r = await page.evaluate(rect)
  console.log(
    `${route}${scrollToEnd ? ' (scrolled to works)' : ''}  settle=${settle}ms  ` +
      (r ? `x=${Math.round(r.x)} y=${Math.round(r.y)} w=${Math.round(r.width)} h=${Math.round(r.height)}` : 'NO PILL'),
  )
  await page.close()
}

await measure('/works', 2500, false)
await measure('/', 3500, true)
await browser.close()
