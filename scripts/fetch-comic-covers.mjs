#!/usr/bin/env node
/**
 * Downloads the Comic Hoarder covers (src/data/comics.js) and saves each as a
 * small WebP in Assets/comics/covers/. Run it again after adding a comic to
 * COVERS below; pass names to fetch only those:
 *
 *   node scripts/fetch-comic-covers.mjs
 *   node scripts/fetch-comic-covers.mjs nightwing-135
 *
 * Sources are the publishers' own listings: Marvel's issue pages
 * (marvel.com/comics/issue/<id>) carry the main cover at full size as
 * `<image path>/clean.jpg`; DC's site has no issue pages for current books,
 * so Nightwing comes from a comic shop's listing of the main (A) cover.
 * Each is scaled to 360px wide (about twice its size in the window)
 * and encoded in headless Chrome, so nothing beyond puppeteer is needed: the
 * image goes in as a data URL, which keeps the canvas untainted.
 */
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'

const OUT = 'Assets/comics/covers/'
const WIDTH = 360
const MARVEL = 'https://cdn.marvel.com/u/prod/marvel/i/mg/'

const COVERS = {
  // The Amazing Spider-Man (2025) #1 — marvel.com/comics/issue/119343
  'amazing-spider-man-2025': `${MARVEL}6/70/67f52630b9c1d/clean.jpg`,
  // Ultimate Spider-Man (2024) #1 — 112985
  'ultimate-spider-man-2024': `${MARVEL}4/10/6596e0f7d0718/clean.jpg`,
  // Spider-Man: Long Way Home (2026) #4 — 134750
  'long-way-home-4': `${MARVEL}3/40/01a16957cde9/clean.jpg`,
  // Punisher Vs. Spider-Man (2026) #5 — 133693
  'punisher-vs-spider-man-5': `${MARVEL}7/03/01a1896af849/clean.jpg`,
  // Amazing Spider-Man: Halloween Special (2026) #1 — 139120
  'halloween-special-1': `${MARVEL}f/90/01a0f9642a37/clean.jpg`,
  // Black Cat (2025) #1 — 126682
  'black-cat-2025': `${MARVEL}1/04/689cdb5b8bbe8/clean.jpg`,
  // Friendly Neighborhood Mary Jane (2026) #1 — 136933
  'mary-jane-1': `${MARVEL}4/e0/01a1403af4fb/clean.jpg`,
  // Miles Morales: Spider-Man (2022) #42 — 122634
  'miles-morales-42': `${MARVEL}7/60/6965560b9c9ed/clean.jpg`,
  // Nightwing #135, Cover A (Dexter Soy) — comicpreviews.com
  'nightwing-135': 'https://geekfetch.s3.ca-central-1.amazonaws.com/product_images/202511-0000516976.jpg',
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'
const only = process.argv.slice(2)
fs.mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const page = await browser.newPage()
await page.goto('about:blank')

for (const [name, url] of Object.entries(COVERS)) {
  if (only.length && !only.includes(name)) continue
  const res = await fetch(url, { headers: { 'user-agent': UA } })
  if (!res.ok) throw new Error(`${name}: ${res.status} from ${url}`)
  const type = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg'
  const src = `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`
  const { data, w, h } = await page.evaluate(async (src, width) => {
    const img = new Image()
    img.src = src
    await img.decode()
    const w = width
    const h = Math.round((img.naturalHeight * w) / img.naturalWidth)
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const x = c.getContext('2d')
    x.imageSmoothingQuality = 'high'
    x.drawImage(img, 0, 0, w, h)
    return { data: c.toDataURL('image/webp', 0.74).split(',')[1], w, h }
  }, src, WIDTH)
  const file = `${OUT}${name}.webp`
  fs.writeFileSync(file, Buffer.from(data, 'base64'))
  console.log(`${file}  ${w}x${h}  ${Math.round(fs.statSync(file).size / 1024)} KB`)
}

await browser.close()
