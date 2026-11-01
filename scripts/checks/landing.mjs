#!/usr/bin/env node
/**
 * Landing-page checks: the hero status line.
 *
 *   node scripts/checks/landing.mjs
 */
import { launch, openPage, check, done } from '../lib/browser.mjs'

const browser = await launch()

const { page } = await openPage(browser, '/')
const status = await page.evaluate(() => {
  const p = [...document.querySelectorAll('p')].find((el) => el.textContent.includes('Master of Information'))
  if (!p) return null
  const cs = getComputedStyle(p)
  return { text: p.textContent.trim(), weight: Number(cs.fontWeight), opacity: Number(cs.opacity),
           align: cs.textAlign, bg: cs.backgroundColor, dot: !!document.querySelector('.status-dot') }
})
check('status text', status?.text === 'Master of Information @ UofT', status?.text)
check('status bold', status?.weight >= 700, status?.weight)
check('status muted', status?.opacity > 0 && status?.opacity < 1, status?.opacity)
check('status centred', status?.align === 'center', status?.align)
check('no pill background', status?.bg === 'rgba(0, 0, 0, 0)', status?.bg)
check('no dot', status?.dot === false)

await browser.close()
done()
