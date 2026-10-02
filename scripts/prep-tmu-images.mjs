#!/usr/bin/env node
/**
 * Regenerates Assets/tmu-kpop/images/web/ from the client exports and the comp.
 * Needs the dev server running (it reads the sources over http so the canvas is
 * same-origin). Pass output names to rebuild only those:
 *   node scripts/prep-tmu-images.mjs about-macbook.webp
 */
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
const BASE = 'http://localhost:5173/Assets/tmu-kpop/'
const OUT = 'Assets/tmu-kpop/images/web/'
const COMP = BASE + 'tmukpop%20case%20study.png'
const I = (n) => BASE + 'images/' + encodeURIComponent(n)
const jobs = [
  { out: 'home-macbook.webp', src: I('TMU KPOP MacBook 2 (1).png'), alphaTrim: true, w: 2400 },
  { out: 'about-macbook.webp', src: I('TMU KPOP MacBook Edited (2).png'), alphaTrim: true, w: 2400 },
  { out: 'faq-macbook.webp', src: I('TMU KPOP MacBook Edited (3).png'), alphaTrim: true, w: 2400 },
  { out: 'events-performance-card.webp', src: I('Edited Image from Shreyardesign.png'), crop: [1060, 898, 880, 540], w: 880 },
  { out: 'events-browser.webp', src: I('Edited Image from Shreyardesign.png'), inpaint: [560, 810, 2440, 1460], w: 2400 },
  { out: 'about-page-long.webp', about: true, w: 1400 },
  { out: 'team-composite.webp', src: COMP, crop: [880, 15650, 3718, 2330], ground: true, trim: true, w: 2400 },
  { out: 'card-about.webp', src: COMP, crop: [4604, 10048, 1679, 2279], ground: true, w: 900 },
  { out: 'card-events.webp', src: COMP, crop: [4604, 12716, 1679, 2279], ground: true, w: 900 },
  { out: 'card-team.webp', src: COMP, crop: [4604, 15436, 1679, 2015], ground: true, w: 900 },
  { out: 'card-faq.webp', src: COMP, crop: [4604, 18272, 1679, 2015], ground: true, w: 900 },
]
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, protocolTimeout: 900000 })
const p = await b.newPage(); await p.goto('http://localhost:5173/favicon.svg')
const only = process.argv.slice(2)
for (const job of jobs.filter(j => !only.length || only.includes(j.out))) {
  const res = await p.evaluate(async (job, I1, I2) => {
    const NS = 'http://www.w3.org/1999/xhtml'
    const load = async (u) => { const im = document.createElementNS(NS, 'img'); im.src = u; await im.decode(); return im }
    const canvas = (w, h) => { const c = document.createElementNS(NS, 'canvas'); c.width = w; c.height = h; return c }
    let c
    if (job.about) {
      // Top of the About Us page (the MacBook screen, cut above the photo row)
      // followed by the lower half of the page, scaled to the same width.
      const top = await load(I2), low = await load(I1)
      const SX = 327, SY = 211, SW = 2378, CUT = 1350 - SY
      const lw = 1857, lh = 2951, k = SW / lw, LH = Math.round(lh * k)
      c = canvas(SW, CUT + LH); const x = c.getContext('2d')
      x.fillStyle = '#232323'; x.fillRect(0, 0, c.width, c.height)
      x.drawImage(top, SX, SY, SW, CUT, 0, 0, SW, CUT)
      x.drawImage(low, 25, 25, lw, lh, 0, CUT, SW, LH)
      job.meta = { cut: CUT, height: c.height, discordTop: CUT + Math.round((381 - 25) * k) }
    } else {
      const im = await load(job.src)
      const [cx, cy, cw, ch] = job.crop ?? [0, 0, im.width, im.height]
      c = canvas(cw, ch); const x = c.getContext('2d'); x.drawImage(im, cx, cy, cw, ch, 0, 0, cw, ch)
      if (job.inpaint) {
        const [x0, y0, x1, y1] = job.inpaint; const id = x.getImageData(0, 0, cw, ch), d = id.data
        for (let X = x0; X <= x1; X++) { const a = (y0 - 1) * cw + X, bb = (y1 + 1) * cw + X
          for (let Y = y0; Y <= y1; Y++) { const t = (Y - y0 + 1) / (y1 - y0 + 2), i = (Y * cw + X) * 4
            for (let k = 0; k < 3; k++) d[i + k] = Math.round(d[a * 4 + k] * (1 - t) + d[bb * 4 + k] * t); d[i + 3] = 255 } }
        x.putImageData(id, 0, 0)
      }
      if (job.alphaTrim) {
        const d = x.getImageData(0, 0, cw, ch).data; let mnx = cw, mny = ch, mxx = 0, mxy = 0
        for (let Y = 0; Y < ch; Y++) for (let X = 0; X < cw; X++) if (d[(Y * cw + X) * 4 + 3] > 8) { if (X < mnx) mnx = X; if (X > mxx) mxx = X; if (Y < mny) mny = Y; if (Y > mxy) mxy = Y }
        const t = canvas(mxx - mnx + 1, mxy - mny + 1); t.getContext('2d').drawImage(c, mnx, mny, t.width, t.height, 0, 0, t.width, t.height); c = t
        job.meta = { bbox: [mnx, mny, mxx, mxy], size: [t.width, t.height] }
      }
      if (job.ground) {
        const id = x.getImageData(0, 0, cw, ch), d = id.data, W = cw, H = ch
        const g = (i) => { const R = d[i*4], G = d[i*4+1], B = d[i*4+2]; return R >= 200 && R <= 237 && R - B >= 6 && R - B <= 24 && G <= R && G >= B }
        const cut = new Uint8Array(W * H), st = []
        const seed = (i) => { if (!cut[i] && g(i)) { cut[i] = 1; st.push(i) } }
        for (let X = 0; X < W; X++) { seed(X); seed((H - 1) * W + X) } for (let Y = 0; Y < H; Y++) { seed(Y * W); seed(Y * W + W - 1) }
        while (st.length) { const i = st.pop(), px = i % W, py = (i / W) | 0; if (px > 0) seed(i - 1); if (px < W - 1) seed(i + 1); if (py > 0) seed(i - W); if (py < H - 1) seed(i + W) }
        let mnx = W, mny = H, mxx = 0, mxy = 0
        for (let i = 0; i < W * H; i++) { if (cut[i]) { d[i*4+3] = 0; continue } const px = i % W, py = (i / W) | 0; if (px < mnx) mnx = px; if (px > mxx) mxx = px; if (py < mny) mny = py; if (py > mxy) mxy = py
          const nb = (px > 0 && cut[i-1]) || (px < W-1 && cut[i+1]) || (py > 0 && cut[i-W]) || (py < H-1 && cut[i+W]); if (nb) { const R = d[i*4]; if (R < 239 && R >= 200) d[i*4+3] = Math.round(255 * Math.min(1, Math.max(0.35, (R - 228) / 11))) } }
        x.putImageData(id, 0, 0)
        if (job.trim) { const t = canvas(mxx - mnx + 1, mxy - mny + 1); t.getContext('2d').drawImage(c, mnx, mny, t.width, t.height, 0, 0, t.width, t.height); c = t }
      }
    }
    const w = Math.min(job.w, c.width), h = Math.round(c.height * w / c.width)
    const o = canvas(w, h), ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high'; ox.drawImage(c, 0, 0, w, h)
    return { data: o.toDataURL('image/webp', 0.88).split(',')[1], w, h, meta: job.meta }
  }, job, I('TMU KPOP MacBook Edited (1).png'), I('TMU KPOP MacBook Edited (2).png'))
  fs.writeFileSync(OUT + job.out, Buffer.from(res.data, 'base64'))
  console.log(job.out, res.w + 'x' + res.h, Math.round(fs.statSync(OUT + job.out).size / 1024) + 'KB', res.meta ? JSON.stringify(res.meta) : '')
}
await b.close()
