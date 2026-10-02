#!/usr/bin/env node
/**
 * Regenerates Assets/lipton/Images/web/ from the comp and the client exports.
 * Needs the dev server running. Pass output names to rebuild only those.
 */
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
const COMP = 'http://localhost:5173/Assets/lipton/lipton%20tea%20case%20study.png'
const I = (n) => 'http://localhost:5173/Assets/lipton/Images/' + encodeURIComponent(n)
const OUT = 'Assets/lipton/Images/web/'
// Phones are cut from the comp (4x a 1728pt frame). Each crop is generous; the
// comp's ground, the maroon feature tab and the sunken card colour are flood-
// filled away from the crop's edges, then the result is trimmed to the phone.
const phone = (out, x0, y0, x1, y1) => ({ out, src: COMP, crop: [x0, y0, x1 - x0, y1 - y0], clean: true, w: 760 })
const jobs = [
  phone('f1-a.webp', 2365, 5700, 3180, 7350),
  phone('f1-b.webp', 3180, 5700, 4010, 7350),
  phone('f2-l.webp', 2300, 7740, 2924, 9340),
  phone('f2-c.webp', 2926, 7720, 3694, 9420),
  phone('f2-r.webp', 3695, 7740, 4420, 9340),
  phone('p-1.webp', 2356, 9780, 3060, 11420),
  phone('p-2.webp', 3060, 9780, 3820, 11420),
  phone('p-3.webp', 3820, 9780, 4590, 11420),
  phone('p-4.webp', 4590, 9780, 5320, 11420),
  { out: 'brand-identity.webp', src: I('Brand Identity.jpg'), w: 2400 },
  ...['Image preview from Shreyardesign (2).png', 'Image preview from Shreyardesign (3).png', 'Image preview from Shreyardesign (4).png',
      'Image Preview from Shreyardesign.png', 'Image Preview from Shreyardesign (1).png', 'Image Preview from Shreyardesign (6).png',
      'Image Preview from Shreyardesign (8).png', 'Image Preview from Shreyardesign (7).png', 'Image Preview from Shreyardesign (5).png']
    .map((n, i) => ({ out: `walk-${i + 1}.webp`, src: I(n), w: 820 })),
]
const only = process.argv.slice(2)
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, protocolTimeout: 900000 })
const p = await b.newPage(); await p.goto('http://localhost:5173/favicon.svg')
for (const job of jobs.filter((j) => !only.length || only.includes(j.out))) {
  const r = await p.evaluate(async (job) => {
    const NS = 'http://www.w3.org/1999/xhtml'
    const im = document.createElementNS(NS, 'img'); im.src = job.src; await im.decode()
    const [cx, cy, cw, ch] = job.crop ?? [0, 0, im.width, im.height]
    let c = document.createElementNS(NS, 'canvas'); c.width = cw; c.height = ch; const x = c.getContext('2d'); x.drawImage(im, cx, cy, cw, ch, 0, 0, cw, ch)
    if (job.clean) {
      const id = x.getImageData(0, 0, cw, ch), d = id.data, W = cw, H = ch
      const g = (i) => { const R = d[i*4], G = d[i*4+1], B = d[i*4+2]
        const ground = R >= 200 && R <= 237 && R - B >= 6 && R - B <= 24 && G <= R && G >= B
        const card = Math.abs(R - 239) <= 4 && Math.abs(G - 238) <= 4 && Math.abs(B - 230) <= 5
        const tab = R >= 40 && R <= 100 && G <= 20 && B <= 25
        return ground || card || tab }
      const cut = new Uint8Array(W*H), st = []; const seed = (i) => { if (!cut[i] && g(i)) { cut[i] = 1; st.push(i) } }
      for (let X = 0; X < W; X++) { seed(X); seed((H-1)*W+X) } for (let Y = 0; Y < H; Y++) { seed(Y*W); seed(Y*W+W-1) }
      while (st.length) { const i = st.pop(), px = i % W, py = (i / W) | 0; if (px > 0) seed(i-1); if (px < W-1) seed(i+1); if (py > 0) seed(i-W); if (py < H-1) seed(i+W) }
      // Keep only the phone: the largest connected shape left after the cut.
      // Speckles of the comp's textured ground that escaped the colour test
      // would otherwise survive as a faint box behind the drop shadow.
      const lab = new Int32Array(W*H).fill(-1); let best = -1, bestN = 0
      for (let s0 = 0; s0 < W*H; s0++) { if (cut[s0] || lab[s0] !== -1) continue
        const id = s0, q = [s0]; lab[s0] = id; let n = 0
        while (q.length) { const i = q.pop(); n++; const px = i % W, py = (i / W) | 0
          for (const j of [px > 0 ? i-1 : -1, px < W-1 ? i+1 : -1, py > 0 ? i-W : -1, py < H-1 ? i+W : -1]) if (j >= 0 && !cut[j] && lab[j] === -1) { lab[j] = id; q.push(j) } }
        if (n > bestN) { bestN = n; best = id } }
      for (let i = 0; i < W*H; i++) if (!cut[i] && lab[i] !== best) cut[i] = 1
      let a = [W, H, 0, 0]
      for (let i = 0; i < W*H; i++) { if (cut[i]) { d[i*4+3] = 0; continue } const px = i % W, py = (i / W) | 0; a = [Math.min(a[0], px), Math.min(a[1], py), Math.max(a[2], px), Math.max(a[3], py)]
        const nb = (px > 0 && cut[i-1]) || (px < W-1 && cut[i+1]) || (py > 0 && cut[i-W]) || (py < H-1 && cut[i+W]); if (nb) d[i*4+3] = Math.round(d[i*4+3] * 0.6) }
      x.putImageData(id, 0, 0)
      const t = document.createElementNS(NS, 'canvas'); t.width = a[2]-a[0]+1; t.height = a[3]-a[1]+1; t.getContext('2d').drawImage(c, a[0], a[1], t.width, t.height, 0, 0, t.width, t.height)
      job.meta = { at: [cx + a[0], cy + a[1], cx + a[2], cy + a[3]] }; c = t
    }
    const w = Math.min(job.w, c.width), h = Math.round(c.height * w / c.width)
    const o = document.createElementNS(NS, 'canvas'); o.width = w; o.height = h; const ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high'; ox.drawImage(c, 0, 0, w, h)
    return { d: o.toDataURL('image/webp', 0.9).split(',')[1], w, h, meta: job.meta }
  }, job)
  fs.writeFileSync(OUT + job.out, Buffer.from(r.d, 'base64'))
  console.log(job.out, `${r.w}x${r.h}`, Math.round(fs.statSync(OUT + job.out).size / 1024) + 'KB', r.meta ? 'comp ' + r.meta.at.join(',') : '')
}
await b.close()
