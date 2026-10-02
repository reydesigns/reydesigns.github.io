#!/usr/bin/env node
/**
 * Builds the transparent PC-part cut-outs in Assets/funzies/web/pc-parts/ from
 * downloaded product images, kept in Assets/funzies/pcbuild/parts-src/ (pass
 * that folder as the first argument).
 *
 *   node scripts/prep-pc-parts.mjs Assets/funzies/pcbuild/parts-src [output names...]
 *
 * Per job, in headless Chrome:
 *  - optionally blank out rectangles (`clear`, fractions of the image), or drop
 *    whole opaque blobs that sit inside a rectangle (`dropIn`) — for badges or
 *    logos baked into a transparent product shot (unused by the current jobs);
 *  - optionally flood-fill from the image edges, turning connected near-white
 *    pixels transparent. Only background reachable from the border is removed,
 *    so white parts enclosed by the product survive. The 1px ring next to the
 *    removed area gets a white "colour-to-alpha" pass so no light halo shows on
 *    dark backgrounds;
 *  - trim to the alpha bounding box, downscale so the long edge is <= MAX, and
 *    write a PNG.
 */
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'

const OUT = 'Assets/funzies/web/pc-parts/'
const MAX = 900
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

/* [output, source file, options]
   flood: tolerance per channel (0-255 distance from pure white), or false for
   sources that already have a transparent background. */
const jobs = [
  // NVIDIA GeForce RTX 5070 Founders Edition — Best Buy SKU 6614154, angled view
  ['gpu.png', 'bby-5070-cv13d.jpg', { flood: 22 }],
  // AMD Ryzen 7 9700X, top view of the chip (Amazon listing B0HCW62DRF)
  ['cpu.png', 'amz-71rTssBbQ4L.jpg', { flood: 22 }],
  // ARCTIC Liquid Freezer III 360 (black), arctic.de gallery shot G02 (the
  // transparent G01 hero has award badges overlapping the radiator)
  ['cooler.png', 'Liquid_Freezer_III_360_Black_G02_2.jpg', { flood: 22 }],
  // NZXT H5 Flow (2024) black — nzxt.com transparent PNG
  ['case.png', 'nzxt-h5-flow_black_01_hero.png', { flood: false }],
  // Samsung 990 PRO 2TB M.2 NVMe — samsung.com (opaque white background)
  ['ssd.png', 'ssd-990pro-2tb.png', { flood: 22 }],
  // MSI MAG B650 TOMAHAWK WIFI — msi.com transparent PNG
  ['motherboard.png', 'msi-hero.png', { flood: false }],
]

const [srcDir, ...only] = process.argv.slice(2)
if (!srcDir) {
  console.error('usage: node scripts/prep-pc-parts.mjs <source-dir> [output names...]')
  process.exit(1)
}
fs.mkdirSync(OUT, { recursive: true })

const mime = (f) => ({ '.png': 'image/png', '.webp': 'image/webp' })[path.extname(f).toLowerCase()] || 'image/jpeg'

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
const page = await browser.newPage()
await page.setContent('<!doctype html><html><body></body></html>')

for (const [out, src, opts] of jobs) {
  if (only.length && !only.includes(out)) continue
  const dataUrl = `data:${mime(src)};base64,${fs.readFileSync(path.join(srcDir, src)).toString('base64')}`
  const result = await page.evaluate(async (dataUrl, opts, MAX) => {
    const img = new Image()
    img.src = dataUrl
    await img.decode()
    const W = img.naturalWidth, H = img.naturalHeight
    const c = document.createElement('canvas')
    c.width = W; c.height = H
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    for (const [x0, y0, x1, y1] of opts.clear || []) {
      ctx.clearRect(Math.round(x0 * W), Math.round(y0 * H), Math.round((x1 - x0) * W), Math.round((y1 - y0) * H))
    }
    const id = ctx.getImageData(0, 0, W, H)
    const d = id.data

    if (opts.flood !== false) {
      const lim = 255 - opts.flood
      const isBg = (i) => d[i + 3] < 16 || (d[i] >= lim && d[i + 1] >= lim && d[i + 2] >= lim)
      const bg = new Uint8Array(W * H)
      const stack = []
      const push = (p) => { if (!bg[p] && isBg(p * 4)) { bg[p] = 1; stack.push(p) } }
      for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x) }
      for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1) }
      while (stack.length) {
        const p = stack.pop(), x = p % W, y = (p - x) / W
        if (x > 0) push(p - 1)
        if (x < W - 1) push(p + 1)
        if (y > 0) push(p - W)
        if (y < H - 1) push(p + W)
      }
      for (let p = 0; p < W * H; p++) if (bg[p]) d[p * 4 + 3] = 0
      // 1px ring: colour-to-alpha against white, so anti-aliased edge pixels
      // lose their white component instead of showing as a light fringe.
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const p = y * W + x
        if (bg[p]) continue
        let edge = false
        for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy
          if (xx >= 0 && yy >= 0 && xx < W && yy < H && bg[yy * W + xx]) { edge = true; break }
        }
        if (!edge) continue
        const i = p * 4
        const a = Math.max(255 - d[i], 255 - d[i + 1], 255 - d[i + 2]) / 255
        const alpha = Math.max(a, 0.35) // keep light edges from vanishing
        for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, Math.round((d[i + k] - 255 * (1 - alpha)) / alpha)))
        d[i + 3] = Math.round(d[i + 3] * alpha)
      }
    }
    // Drop every opaque blob (8-connected) whose bounding box lies entirely
    // inside one of the dropIn rectangles — removes badges sitting beside the
    // product without cutting into the product itself.
    if (opts.dropIn) {
      const rects = opts.dropIn.map(([x0, y0, x1, y1]) => [x0 * W, y0 * H, x1 * W, y1 * H])
      const seen = new Uint8Array(W * H)
      for (let s = 0; s < W * H; s++) {
        if (seen[s] || d[s * 4 + 3] <= 8) continue
        const blob = [s]; seen[s] = 1
        let bx0 = W, by0 = H, bx1 = 0, by1 = 0
        for (let k = 0; k < blob.length; k++) {
          const p = blob[k], x = p % W, y = (p - x) / W
          if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy, q = yy * W + xx
            if (xx >= 0 && yy >= 0 && xx < W && yy < H && !seen[q] && d[q * 4 + 3] > 8) { seen[q] = 1; blob.push(q) }
          }
        }
        if (rects.some(([x0, y0, x1, y1]) => bx0 >= x0 && by0 >= y0 && bx1 <= x1 && by1 <= y1)) {
          // also clear the faint (alpha <= 8) fringe around it
          for (const p of blob) d[p * 4 + 3] = 0
          for (let y = Math.max(0, by0 - 2); y <= Math.min(H - 1, by1 + 2); y++)
            for (let x = Math.max(0, bx0 - 2); x <= Math.min(W - 1, bx1 + 2); x++)
              if (d[(y * W + x) * 4 + 3] <= 8) d[(y * W + x) * 4 + 3] = 0
        }
      }
    }
    ctx.putImageData(id, 0, 0)

    // Trim to the alpha bounding box.
    let minX = W, minY = H, maxX = -1, maxY = -1
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
    let cw = maxX - minX + 1, ch = maxY - minY + 1
    let cur = document.createElement('canvas')
    cur.width = cw; cur.height = ch
    cur.getContext('2d').drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch)

    // Downscale in halving steps for quality, then to the exact size.
    const scale = Math.min(1, MAX / Math.max(cw, ch))
    const tw = Math.round(cw * scale), th = Math.round(ch * scale)
    while (cur.width / 2 >= tw && cur.height / 2 >= th) {
      const n = document.createElement('canvas')
      n.width = Math.round(cur.width / 2); n.height = Math.round(cur.height / 2)
      const nc = n.getContext('2d'); nc.imageSmoothingQuality = 'high'
      nc.drawImage(cur, 0, 0, n.width, n.height)
      cur = n
    }
    if (cur.width !== tw || cur.height !== th) {
      const n = document.createElement('canvas')
      n.width = tw; n.height = th
      const nc = n.getContext('2d'); nc.imageSmoothingQuality = 'high'
      nc.drawImage(cur, 0, 0, tw, th)
      cur = n
    }
    return { url: cur.toDataURL('image/png'), w: tw, h: th, src: `${W}x${H}` }
  }, dataUrl, opts, MAX)
  fs.writeFileSync(OUT + out, Buffer.from(result.url.split(',')[1], 'base64'))
  console.log(`${out}  ${result.w}x${result.h}  (from ${src}, ${result.src})`)
}

await browser.close()
