#!/usr/bin/env node
/**
 * Builds the Me page's media in Assets/me/web/:
 *
 *   photos/<name>.jpg        the photos in "Assets/me page/" (iPhone HEICs),
 *                            upright and cut down to 1000 px on the long edge
 *   magnets/<id>/color.png   the fridge magnets, drawn in code
 *   magnets/<id>/height.png  (scripts/lib/magnet-art.mjs), in the same three
 *   magnets/<id>/back.png    textures the landing page's 3D drawings use
 *   magnets/meta.json        { id: { w, h, maxH } }
 *
 *   node scripts/prep-me.mjs
 *
 * macOS only: the HEICs go through `sips`, and the magnets are drawn in Chrome.
 */
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { drawMagnets } from './lib/magnet-art.mjs'

const SRC = 'Assets/me page/'
const OUT = 'Assets/me/web/'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

/** Source file → web name. */
const PHOTOS = {
  'IMG_1847.HEIC': 'cat-desk',
  'IMG_9021.HEIC': 'helmet',
  'IMG_9599.HEIC': 'waterfall',
}

fs.mkdirSync(`${OUT}photos`, { recursive: true })
for (const [src, name] of Object.entries(PHOTOS)) {
  execFileSync('sips', [
    '-s', 'format', 'jpeg',
    '-s', 'formatOptions', '78',
    '-Z', '1000',
    `${SRC}${src}`,
    '--out', `${OUT}photos/${name}.jpg`,
  ], { stdio: 'ignore' })
  console.log(`photos/${name}.jpg`)
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
const page = await browser.newPage()
const magnets = await page.evaluate(`(${drawMagnets.toString()})()`)
await browser.close()

const meta = {}
for (const [id, m] of Object.entries(magnets)) {
  const dir = `${OUT}magnets/${id}/`
  fs.mkdirSync(dir, { recursive: true })
  for (const k of ['color', 'height', 'back'])
    fs.writeFileSync(`${dir}${k}.png`, Buffer.from(m[k].split(',')[1], 'base64'))
  meta[id] = m.meta
  console.log(`magnets/${id}/`)
}
fs.writeFileSync(`${OUT}magnets/meta.json`, `${JSON.stringify(meta, null, 2)}\n`)
