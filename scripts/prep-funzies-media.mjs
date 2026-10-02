#!/usr/bin/env node
/**
 * Regenerates Assets/funzies/web/ from the originals in Assets/funzies/.
 * Needs the dev server running (it reads the sources over http so the canvas is
 * same-origin). HEIC goes through `sips` first — Chrome can't decode it — and the
 * HEVC .MOV through `avconvert` to H.264, which every browser plays.
 *
 * Pass output names to rebuild only those:
 *   node scripts/prep-funzies-media.mjs sdz-cover.webp
 */
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const SRC = 'Assets/funzies/'
const OUT = 'Assets/funzies/web/'
const TMP = OUT + '.tmp/'
const BASE = 'http://localhost:5173/'

/* [output, source, max long edge, crop?, opts?]. Photos and posters are
   capped at 1600px — the popup frame is never wider than ~560 CSS px, so that
   is 2x and change. `crop` is [x, y, w, h] as fractions of the source.
   `opts.circle` masks round artwork to a circle of that fraction of its own
   radius and trims to it (the TMU K-pop icons carry a dashed ring and a drop
   shadow just inside / outside their edge). */
const NO_CROP = [0, 0, 1, 1]
const RING = { circle: 0.9 }
const jobs = [
  // Cropped in on the stack of magazines (bottom edge included).
  ['magazine-photo.webp', 'Magazine/IMG_9975.jpg', 1600, [0, 0.11, 1, 0.83]],
  ['magazine-spread-mockup.webp', 'Magazine/DOUBLE SPREAD MOCKUP PNG_edited.png', 1600],
  // Cover + spread mockup, trimmed to the magazines (the PNG is half empty).
  ['magazine-mockup.webp', 'Magazine/MAGAZINE MOCKUP PNG.png', 1600, [0.035, 0.215, 0.93, 0.565]],
  ['magazine-spread-1.webp', 'Magazine/GCM720-Sec03-DPS-Rudrapatna-Shreya.png', 1600],
  ['magazine-spread-2.webp', 'Magazine/GCM720-Sec03-DPS-Rudrapatna-Shreya2.png', 1600],
  ['sdz-cover.webp', 'sdz/THE SDZ COVER.png', 1600],
  ['sdz-ig-1.webp', 'sdz/IG posts sci888-01.png', 1200],
  ['sdz-ig-2.webp', 'sdz/IG posts sci888-02.png', 1200],
  ['sdz-ig-3.webp', 'sdz/IG posts sci888-03.png', 1200],
  ['sdz-ig-4.webp', 'sdz/IG posts sci888-04.png', 1200],
  ['sdz-stream-participate.webp', 'sdz/STREAM LOGOS-12_edited.png', 1200],
  ['sdz-stream-discover.webp', 'sdz/STREAM LOGOS-13_edited.png', 1200],
  ['sdz-stream-incubate.webp', 'sdz/STREAM LOGOS-14_edited.png', 1200],
  ['sdz-icon-1.webp', 'sdz/Group 1.png', 1000],
  ['sdz-icon-2.webp', 'sdz/Group 2.png', 1000],
  ['sdz-icon-3.webp', 'sdz/Group 3.png', 1000],
  ['sdz-icon-4.webp', 'sdz/Group 4.png', 1000],
  ['tk-icon-announce.webp', 'TMU KPOP/Mask group-1 (1).png', 1000, NO_CROP, RING],
  ['tk-icon-discord.webp', 'TMU KPOP/Mask group (1).png', 1000, NO_CROP, RING],
  ['tk-icon-faq.webp', 'TMU KPOP/Mask group-1.png', 1000, NO_CROP, RING],
  ['tk-icon-team.webp', 'TMU KPOP/Mask group-2 (1).png', 1000, NO_CROP, RING],
  ['tk-icon-cancelled.webp', 'TMU KPOP/Mask group-2.png', 1000, NO_CROP, RING],
  ['tk-icon-camera.webp', 'TMU KPOP/Mask group-3.png', 1000, NO_CROP, RING],
  ['tk-icon-website.webp', 'TMU KPOP/Mask group.png', 1000, NO_CROP, RING],
  ['tk-songs-1.webp', 'TMU KPOP/musicreccomendations_v1.png', 1600],
  ['tk-songs-2.webp', 'TMU KPOP/musicrecommendation_v2.png', 1600],
  ['tk-event-archive-text.webp', 'TMU KPOP/Events_Archive_Story_Text-01.png', 1600],
  ['tk-event-archive-photos.webp', 'TMU KPOP/Event_Archive_Story_Picture-01.png', 1600],
  ['tk-giveaway.webp', 'TMU KPOP/Giveaway_ClubNight.png', 1600],
  ['tk-dance-workshop.webp', 'TMU KPOP/dance_workshop_story-01.png', 1600],
  ['tk-hallyuween.webp', 'TMU KPOP/hallyuween_main_story.png', 1600],
  ['tk-mercy.webp', 'TMU KPOP/MercyCosmetics_story.png', 1600],
  ['tk-website-launch.webp', 'TMU KPOP/kpopwebsite.png', 1600],
  ['tk-newsletter-1.webp', 'TMU KPOP/NEWSLETTER DECEMBER-01.png', 1600],
  ['tk-newsletter-2.webp', 'TMU KPOP/NEWSLETTER DECEMBER-02.png', 1600],
  ['tk-newsletter-3.webp', 'TMU KPOP/NEWSLETTER DECEMBER-03.png', 1600],
  ['tk-newsletter-4.webp', 'TMU KPOP/NEWSLETTER DECEMBER-04.png', 1600],
  ['tk-banner-mockup.webp', 'TMU KPOP/TMU_KPOP_Banner_Mockup_V2 1.png', 1600],
  ['tk-banner-photo.webp', 'TMU KPOP/image 6.png', 1600],
  ['tk-lunar-1.webp', 'TMU KPOP/korean new year-01.png', 1600],
  ['tk-lunar-2.webp', 'TMU KPOP/korean new year-02.png', 1600],
  ['tk-lunar-3.webp', 'TMU KPOP/korean new year-03.png', 1600],
  // Print photos: cropped in on the piece, so it sits centred and large.
  ['print-cartridges.webp', 'print/IMG_3362.HEIC', 1600, [0, 0.2, 1, 0.75]],
  // Cropped off the empty wall above the monitor.
  ['pc-desk.webp', 'pcbuild/IMG_9245.heic', 1600, [0, 0.13, 1, 0.87]],
  // Cropped to keep the person sitting beside the build out of frame.
  ['pc-build.webp', 'pcbuild/IMG_8090.HEIC', 1600, [0, 0.2, 0.94, 0.8]],
  ['package-open.webp', 'PACKAGE/5A9163D0-049C-4E9A-823E-6C98DCEB10FF.JPG', 1600, [0.05, 0.21, 0.88, 0.6]],
  ['package-dieline.webp', 'PACKAGE/IMG_2713.HEIC', 1600],
  ['infographic-372-1.webp', 'infographics/INFOGRAPHICS 372-01.png', 1600],
  ['infographic-372-2.webp', 'infographics/INFOGRAPHICS 372-02.png', 1600],
  ['infographic-dam.webp', 'infographics/Rudrapatna_Sec#4_DAMCreative_edited.jpg', 1600],
  ['infographic-740.webp', 'infographics/redesign for 740-01.png', 1600],
]

const only = process.argv.slice(2)
fs.mkdirSync(TMP, { recursive: true })

// Video: one clip, re-encoded rather than drawn.
if (!only.length || only.includes('print-video.mp4')) {
  execFileSync('avconvert', [
    '-s', SRC + 'print/IMG_3061.MOV', '-p', 'Preset1920x1080', '-o', OUT + 'print-video.mp4', '--replace',
  ])
  console.log('print-video.mp4')
}

const b = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  protocolTimeout: 900000,
})
const p = await b.newPage()
await p.goto(BASE + 'favicon.svg')

for (const [out, src, max, crop = NO_CROP, opts = {}] of jobs.filter(([o]) => !only.length || only.includes(o))) {
  let path = SRC + src
  if (/\.heic$/i.test(src)) {
    // JPEG keeps the EXIF orientation, which the canvas then honours.
    const jpg = TMP + out.replace(/\.webp$/, '.jpg')
    execFileSync('sips', ['-s', 'format', 'jpeg', path, '--out', jpg], { stdio: 'ignore' })
    path = jpg
  } else if (src.includes('#')) {
    // Vite's dev server can't serve a '#' in a file name, even escaped.
    const copy = TMP + out + '.src'
    fs.copyFileSync(path, copy)
    path = copy
  }
  const url = BASE + path.split('/').map(encodeURIComponent).join('/')
  const data = await p.evaluate(async (url, max, [cx, cy, cw, ch], opts) => {
    const img = document.createElementNS('http://www.w3.org/1999/xhtml', 'img')
    img.src = url
    await img.decode()
    const sx = img.naturalWidth * cx
    const sy = img.naturalHeight * cy
    const sw = img.naturalWidth * cw
    const sh = img.naturalHeight * ch
    const k = Math.min(1, max / Math.max(sw, sh))
    const c = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas')
    c.width = Math.round(sw * k)
    c.height = Math.round(sh * k)
    const ctx = c.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height)
    if (opts.circle) {
      // The disc is the bounding box of its dark fill (the shadow is pale).
      const px = ctx.getImageData(0, 0, c.width, c.height).data
      let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4
          if (px[i + 3] > 200 && px[i] + px[i + 1] + px[i + 2] < 240) {
            if (x < x0) x0 = x
            if (x > x1) x1 = x
            if (y < y0) y0 = y
            if (y > y1) y1 = y
          }
        }
      }
      const r = (Math.max(x1 - x0, y1 - y0) / 2) * opts.circle
      const mx = (x0 + x1) / 2
      const my = (y0 + y1) / 2
      const d = Math.ceil(r * 2)
      const o = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas')
      o.width = d
      o.height = d
      const oc = o.getContext('2d')
      oc.beginPath()
      oc.arc(d / 2, d / 2, r, 0, Math.PI * 2)
      oc.clip()
      oc.drawImage(c, mx - d / 2, my - d / 2, d, d, 0, 0, d, d)
      return o.toDataURL('image/webp', 0.9)
    }
    return c.toDataURL('image/webp', 0.86)
  }, url, max, crop, opts)
  fs.writeFileSync(OUT + out, Buffer.from(data.split(',')[1], 'base64'))
  console.log(out)
}

/* The magazine collage: the spread mockup, trimmed to the magazine and set
   large across the top, with its two flat pages side by side underneath,
   nudged right. Built from the outputs above, on white. */
if (!only.length || only.includes('magazine-collage.webp')) {
  const W = (n) => BASE + OUT + n
  const data = await p.evaluate(async (mock, a, b) => {
    const load = async (u) => {
      const i = document.createElementNS('http://www.w3.org/1999/xhtml', 'img')
      i.src = u
      await i.decode()
      return i
    }
    const [m, p1, p2] = await Promise.all([load(mock), load(a), load(b)])
    const canvas = () => document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas')

    // Trim the mockup's white surround to the magazine itself.
    const t = canvas()
    t.width = m.naturalWidth
    t.height = m.naturalHeight
    const tc = t.getContext('2d')
    tc.drawImage(m, 0, 0)
    const px = tc.getImageData(0, 0, t.width, t.height).data
    let x0 = t.width, y0 = t.height, x1 = 0, y1 = 0
    for (let y = 0; y < t.height; y++) {
      for (let x = 0; x < t.width; x++) {
        const i = (y * t.width + x) * 4
        if (px[i + 3] > 20 && (px[i] < 235 || px[i + 1] < 235 || px[i + 2] < 235)) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
      }
    }
    const mw = x1 - x0
    const mh = y1 - y0

    const S = 1600
    const H = 1760
    const pad = 70
    const c = canvas()
    c.width = S
    c.height = H
    const ctx = c.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, S, H)

    // Mockup: full width, top.
    const topW = S - pad * 2
    const topH = (topW * mh) / mw
    ctx.drawImage(m, x0, y0, mw, mh, pad, pad, topW, topH)

    // Pages: side by side below, shifted right of centre, with a soft shadow.
    const gap = 36
    const pageH = H - pad * 2 - topH - 60
    const pageW = (pageH * p1.naturalWidth) / p1.naturalHeight
    const left = S - pad - (pageW * 2 + gap) - 40
    const top = H - pad - pageH
    ctx.shadowColor = 'rgba(45, 5, 16, 0.22)'
    ctx.shadowBlur = 28
    ctx.shadowOffsetY = 10
    ctx.drawImage(p1, left, top, pageW, pageH)
    ctx.drawImage(p2, left + pageW + gap, top, pageW, pageH)
    return c.toDataURL('image/webp', 0.88)
  }, W('magazine-spread-mockup.webp'), W('magazine-spread-1.webp'), W('magazine-spread-2.webp'))
  fs.writeFileSync(OUT + 'magazine-collage.webp', Buffer.from(data.split(',')[1], 'base64'))
  console.log('magazine-collage.webp')
}

/* The club banner: the design above a photo of it printed and hung, on
   one slide. */
if (!only.length || only.includes('tk-banner.webp')) {
  const W = (n) => BASE + OUT + n
  const data = await p.evaluate(async (a, b) => {
    const load = async (u) => {
      const i = document.createElementNS('http://www.w3.org/1999/xhtml', 'img')
      i.src = u
      await i.decode()
      return i
    }
    const [g, ph] = await Promise.all([load(a), load(b)])
    const S = 1600
    const pad = 60
    const gap = 50
    const w = S - pad * 2
    const gh = (w * g.naturalHeight) / g.naturalWidth
    const phh = (w * ph.naturalHeight) / ph.naturalWidth
    const c = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas')
    c.width = S
    c.height = Math.round(pad * 2 + gh + gap + phh)
    const ctx = c.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(g, pad, pad, w, gh)
    ctx.drawImage(ph, pad, pad + gh + gap, w, phh)
    return c.toDataURL('image/webp', 0.88)
  }, W('tk-banner-mockup.webp'), W('tk-banner-photo.webp'))
  fs.writeFileSync(OUT + 'tk-banner.webp', Buffer.from(data.split(',')[1], 'base64'))
  console.log('tk-banner.webp')
}

await b.close()
fs.rmSync(TMP, { recursive: true, force: true })
