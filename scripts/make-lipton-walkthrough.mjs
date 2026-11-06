#!/usr/bin/env node
/**
 * Renders the Lipton case study's app walkthrough video (LiptonArticle,
 * "Walk through the app"), on white: the nine screens in the order a tea drinker meets
 * them, the one on show large in the middle on a Lipton-yellow disc, its
 * neighbours smaller to each side, the row gliding one screen along every
 * couple of seconds, with the screen's name, a step count and progress dots
 * underneath. It loops seamlessly: after Subscriptions, Dashboard comes round
 * again from the right.
 *
 *   FFMPEG=/path/to/ffmpeg node scripts/make-lipton-walkthrough.mjs
 *
 * Needs ffmpeg with libx264 (FFMPEG, else `ffmpeg` on the PATH; the
 * `ffmpeg-static` npm package has one) and Chrome, like the other asset
 * scripts. Frames are drawn on a canvas in headless Chrome, one at a time
 * at fixed times, so every run gives the same video. Writes
 * Assets/lipton/video/app-walkthrough.mp4 and its poster (the first frame),
 * app-walkthrough-poster.webp.
 */
import puppeteer from 'puppeteer-core'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg'
const OUT = 'Assets/lipton/video/'
const W = 1600
const H = 900
const FPS = 30
// Each screen holds, then the row glides on to the next.
const HOLD = 1.6
const MOVE = 0.7

const SCREENS = [
  ['walk-1.webp', 'Dashboard'],
  ['walk-2.webp', 'Your updates'],
  ['walk-3.webp', 'About our tea'],
  ['walk-4.webp', 'Monthly consumption'],
  ['walk-5.webp', 'Additives in your tea'],
  ['walk-6.webp', 'Shop'],
  ['walk-7.webp', 'Browse teas'],
  ['walk-8.webp', 'Your cart'],
  ['walk-9.webp', 'Subscriptions'],
]
const dataUrl = (file, type) => `data:${type};base64,${fs.readFileSync(file).toString('base64')}`
const screens = SCREENS.map(([file, name]) => ({ name, src: dataUrl(`Assets/lipton/Images/web/${file}`, 'image/webp') }))
const font = dataUrl('Assets/brand/fonts/inter/inter-latin.woff2', 'font/woff2')

const STEP = HOLD + MOVE
const DURATION = STEP * screens.length
const FRAMES = Math.round(DURATION * FPS)

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lipton-walk-'))
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  protocolTimeout: 600000,
})
const page = await browser.newPage()
await page.goto('about:blank')

await page.evaluate(
  async ({ screens, font, W, H, HOLD, MOVE }) => {
    const face = new FontFace('Inter', `url(${font})`, { weight: '100 900' })
    await face.load()
    document.fonts.add(face)

    const BG = '#ffffff' // a white card, like the brand board under it (--color-surface)
    const YELLOW = '#ffe70e' // Lipton's yellow, from the brand board
    const INK = '#2d0510' // --color-ink
    const GREY = '#67676c' // --card-blurb-ink
    const DOT = '#c9c9cc'
    const PHONE_W = 330 // the phone on show, edge to edge of its bezel
    const TOP = 64
    const CX = W / 2

    // Each screen trimmed to its phone (the exports carry uneven empty
    // margins), scaled so every phone is the same width, and faded out at
    // the bottom, where the exports stop mid-screen.
    const phones = []
    for (const s of screens) {
      const img = new Image()
      img.src = s.src
      await img.decode()
      const c0 = document.createElement('canvas')
      c0.width = img.naturalWidth
      c0.height = img.naturalHeight
      const x0 = c0.getContext('2d')
      x0.drawImage(img, 0, 0)
      const d = x0.getImageData(0, 0, c0.width, c0.height).data
      let l = c0.width, r = 0, t = c0.height, b = 0
      for (let y = 0; y < c0.height; y += 1) {
        for (let x = 0; x < c0.width; x += 1) {
          if (d[(y * c0.width + x) * 4 + 3] > 24) {
            if (x < l) l = x
            if (x > r) r = x
            if (y < t) t = y
            if (y > b) b = y
          }
        }
      }
      const k = PHONE_W / (r - l + 1)
      const c = document.createElement('canvas')
      c.width = Math.round((r - l + 1) * k)
      c.height = Math.round((b - t + 1) * k)
      const x = c.getContext('2d')
      x.imageSmoothingQuality = 'high'
      x.drawImage(img, l, t, r - l + 1, b - t + 1, 0, 0, c.width, c.height)
      x.globalCompositeOperation = 'destination-in'
      const g = x.createLinearGradient(0, 0, 0, c.height)
      g.addColorStop(0, '#000')
      g.addColorStop(0.74, '#000')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      x.fillStyle = g
      x.fillRect(0, 0, c.width, c.height)
      phones.push({ canvas: c, name: s.name })
    }

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    document.body.append(canvas)
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    const n = phones.length
    const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2)
    // Piecewise-linear lookup over |d| = 0, 1, 2, 3.
    const lerp = (stops, a) => {
      const i = Math.min(stops.length - 2, Math.floor(a))
      return stops[i] + (stops[i + 1] - stops[i]) * Math.min(1, a - i)
    }
    const OFFSET = [0, 360, 640, 860]
    const SCALE = [1, 0.8, 0.66, 0.6]
    const ALPHA = [1, 0.6, 0.26, 0]

    window.drawAt = (t) => {
      const step = Math.floor(t / (HOLD + MOVE))
      const into = t - step * (HOLD + MOVE)
      const u = into <= HOLD ? 0 : ease((into - HOLD) / MOVE)
      const p = step + u // the row's position, in screens

      ctx.fillStyle = BG
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = YELLOW
      ctx.beginPath()
      ctx.arc(CX, TOP + 300, 270, 0, Math.PI * 2)
      ctx.fill()

      const placed = phones.map((ph, i) => {
        let d = (((i - p) % n) + n) % n
        if (d > n / 2) d -= n
        return { ph, d, a: Math.abs(d) }
      })
      placed.sort((m, q) => q.a - m.a)
      for (const { ph, d, a } of placed) {
        if (a >= 3) continue
        const s = lerp(SCALE, a)
        const w = ph.canvas.width * s
        const h = ph.canvas.height * s
        const x = CX + Math.sign(d) * lerp(OFFSET, a) - w / 2
        const y = TOP + (1 - s) * 150
        ctx.globalAlpha = lerp(ALPHA, a)
        ctx.drawImage(ph.canvas, x, y, w, h)
      }
      ctx.globalAlpha = 1

      // The name and count of the screen on show: the old one fades out over
      // the first half of the glide, the new one in over the second.
      const cur = step % n
      const showing = u < 0.5 ? cur : (cur + 1) % n
      const fade = u < 0.5 ? 1 - u * 2 : (u - 0.5) * 2
      ctx.globalAlpha = fade
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = GREY
      ctx.font = '600 17px Inter'
      ctx.letterSpacing = '2px'
      ctx.fillText(`${String(showing + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`, CX, 786)
      ctx.fillStyle = INK
      ctx.font = '800 34px Inter'
      ctx.letterSpacing = '0px'
      ctx.fillText(phones[showing].name, CX, 830)
      ctx.globalAlpha = 1

      // Progress: a dot per screen, the one on show a wider pill that slides.
      const gap = 18
      const left = CX - ((n - 1) * gap) / 2
      ctx.fillStyle = DOT
      for (let i = 0; i < n; i += 1) {
        ctx.beginPath()
        ctx.arc(left + i * gap, 866, 3.5, 0, Math.PI * 2)
        ctx.fill()
      }
      const at = (p % n) * gap
      const wrap = p % n > n - 1 // gliding from the last back to the first
      ctx.fillStyle = INK
      const pill = (cx) => {
        ctx.beginPath()
        ctx.roundRect(cx - 9, 862.5, 18, 7, 3.5)
        ctx.fill()
      }
      if (wrap) {
        ctx.globalAlpha = 1 - (p % n - (n - 1))
        pill(left + (n - 1) * gap)
        ctx.globalAlpha = p % n - (n - 1)
        pill(left)
        ctx.globalAlpha = 1
      } else {
        pill(left + at)
      }
    }
    window.frame = (t) => {
      window.drawAt(t)
      return canvas.toDataURL('image/png').split(',')[1]
    }
  },
  { screens, font, W, H, HOLD, MOVE },
)

for (let f = 0; f < FRAMES; f += 1) {
  const png = await page.evaluate((t) => window.frame(t), f / FPS)
  fs.writeFileSync(path.join(tmp, `${String(f).padStart(4, '0')}.png`), Buffer.from(png, 'base64'))
  if (f % 60 === 0) process.stdout.write(`frame ${f}/${FRAMES}\r`)
}
const poster = await page.evaluate(() => {
  window.drawAt(0)
  return document.querySelector('canvas').toDataURL('image/webp', 0.86).split(',')[1]
})
await browser.close()
fs.writeFileSync(`${OUT}app-walkthrough-poster.webp`, Buffer.from(poster, 'base64'))

execFileSync(FFMPEG, [
  '-y', '-loglevel', 'error',
  '-framerate', String(FPS),
  '-i', path.join(tmp, '%04d.png'),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-tune', 'animation',
  '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
  '-movflags', '+faststart', '-an',
  `${OUT}app-walkthrough.mp4`,
])
fs.rmSync(tmp, { recursive: true, force: true })
for (const f of ['app-walkthrough.mp4', 'app-walkthrough-poster.webp']) {
  console.log(`${OUT}${f}  ${Math.round(fs.statSync(OUT + f).size / 1024)} KB`)
}
console.log(`${FRAMES} frames, ${DURATION.toFixed(1)}s at ${FPS} fps`)
