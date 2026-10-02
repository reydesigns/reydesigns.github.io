#!/usr/bin/env node
/**
 * Builds the square "Tools:" icons in Assets/funzies/web/tools/ from the
 * sources in Assets/funzies/tools-src/ (credits in its CREDITS.md).
 *
 *   node scripts/prep-tool-icons.mjs
 *
 * Each tile is SIZE px square: a background colour, then the source drawn
 * either to cover the tile (`cover`, photos) or fitted inside it with a margin
 * (`pad`, a fraction of the tile), optionally rotated. `trim` first crops a
 * product shot to the object, ignoring transparent and near-white pixels. The page rounds the
 * corners (5px), so the tiles themselves stay square.
 */
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'

const SRC = 'Assets/funzies/tools-src/'
const OUT = 'Assets/funzies/web/tools/'
const SIZE = 128
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

/* [output, source, options]. The app icons carry their own rounded corners;
   filling the tile with the icon's background colour first squares them off. */
const jobs = [
  ['illustrator.png', 'illustrator.png', { bg: '#330000', pad: 0 }],
  ['photoshop.png', 'photoshop.png', { bg: '#001e36', pad: 0 }],
  // Figma's own app icon: the logo on near-black.
  ['figma.png', 'figma.png', { bg: '#1e1e1e', pad: 0.2 }],
  ['screwdriver.png', 'screwdriver.png', { bg: '#ffffff', pad: 0.06, rotate: -45, trim: true }],
  ['screws.png', 'screws.png', { cover: true, zoom: 1.25 }],
  ['offset-printer.png', 'offset-printer.jpg', { cover: true, zoom: 1.1 }],
  ['3d-printer.png', '3d-printer.png', { bg: '#ffffff', pad: 0.1, trim: true }],
]

fs.mkdirSync(OUT, { recursive: true })
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
const page = await browser.newPage()
await page.setContent('<!doctype html><html><body></body></html>')

for (const [out, src, opts] of jobs) {
  const type = src.endsWith('.jpg') ? 'image/jpeg' : 'image/png'
  const dataUrl = `data:${type};base64,${fs.readFileSync(SRC + src).toString('base64')}`
  const png = await page.evaluate(
    async (dataUrl, opts, S) => {
      const img = new Image()
      img.src = dataUrl
      await img.decode()
      const c = document.createElement('canvas')
      c.width = c.height = S
      const ctx = c.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      if (opts.bg) {
        ctx.fillStyle = opts.bg
        ctx.fillRect(0, 0, S, S)
      }
      ctx.translate(S / 2, S / 2)
      ctx.rotate(((opts.rotate || 0) * Math.PI) / 180)
      let sx = 0
      let sy = 0
      let w = img.naturalWidth
      let h = img.naturalHeight
      if (opts.trim) {
        const t = document.createElement('canvas')
        t.width = w
        t.height = h
        const tx = t.getContext('2d', { willReadFrequently: true })
        tx.drawImage(img, 0, 0)
        const d = tx.getImageData(0, 0, w, h).data
        let x0 = w, y0 = h, x1 = -1, y1 = -1
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4
          if (d[i + 3] < 16 || (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240)) continue
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
        if (x1 >= 0) {
          sx = x0
          sy = y0
          w = x1 - x0 + 1
          h = y1 - y0 + 1
        }
      }
      // A rotated source is fitted along the tile's diagonal.
      const room = S * (1 - 2 * (opts.pad || 0)) * (opts.rotate ? Math.SQRT2 : 1)
      const k = opts.cover ? (Math.max(S / w, S / h) * (opts.zoom || 1)) : Math.min(room / w, room / h)
      ctx.drawImage(img, sx, sy, w, h, (-w * k) / 2, (-h * k) / 2, w * k, h * k)
      return c.toDataURL('image/png').split(',')[1]
    },
    dataUrl,
    opts,
    SIZE,
  )
  fs.writeFileSync(OUT + out, Buffer.from(png, 'base64'))
  console.log('wrote', OUT + out)
}
await browser.close()
