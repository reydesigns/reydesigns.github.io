#!/usr/bin/env node
/**
 * Cuts the Shore-Up case study's hero clip (ShoreUpArticle, at the top) from
 * the phone recording of the pitch, Assets/shore-up/video/IMG_7546.MOV (six
 * minutes, 740 MB, kept out of git). Three moments from the big screen: the
 * Shore Up title giving way to the ocean-trash statistic, the app's map of
 * a beach with its clean-ups, and the globe turning. Each is cropped in on
 * the screen and the stage, the shots dissolve into one another, and the
 * last dissolves back into the first, so the loop has no seam.
 *
 * Silent: the clip has no audio track at all. The phone's metadata (its
 * location among it) is left behind.
 *
 *   FFMPEG=/path/to/ffmpeg node scripts/make-shore-up-pitch.mjs
 *
 * Needs ffmpeg with libvpx and libwebp (FFMPEG, else `ffmpeg` on the PATH;
 * the `ffmpeg-static` npm package has one). Writes
 * Assets/shore-up/video/pitch-720p.webm and pitch-poster.webp, the frame at
 * 0.5 s, where CaseHero comes to rest under reduced motion.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg'
const DIR = 'Assets/shore-up/video/'
const SOURCE = `${DIR}IMG_7546.MOV`
const FPS = 30
const FADE = 0.4
// The crop, in the 1920 x 1080 source: 70% of the frame, scaled to 720p.
const CW = 1344
const CH = 756

/* [start s, length s, crop left, crop top]. The phone moves between shots,
   so each has its own crop, centred on the screen. */
const SHOTS = [
  [8.0, 4.6, 430, 110], // the title, then the statistic
  [156.5, 5.0, 358, 230], // the map of a beach and its clean-ups
  [175.0, 6.5, 358, 220], // the globe turning
]

const inputs = SHOTS.flatMap(([start, len]) => ['-ss', String(start), '-t', String(len), '-i', SOURCE])
const shot = ([, , x, y], i) =>
  `[${i}:v]crop=${CW}:${CH}:${x}:${y},scale=1280:720:flags=lanczos,fps=${FPS},setpts=PTS-STARTPTS,format=yuv420p[s${i}]`

// The first shot is split: its opening FADE seconds are what the last shot
// dissolves into, and the clip itself starts just after them.
const lens = SHOTS.map(([, len]) => len)
const parts = [
  ...SHOTS.map(shot),
  `[s0]split[s0a][s0b]`,
  `[s0a]trim=start=${FADE},setpts=PTS-STARTPTS[head]`,
  `[s0b]trim=end=${FADE},setpts=PTS-STARTPTS[tail]`,
]
let label = 'head'
let length = lens[0] - FADE
const next = ['s1', 's2', 'tail']
const nextLen = [lens[1], lens[2], FADE]
next.forEach((into, i) => {
  const out = `x${i}`
  parts.push(`[${label}][${into}]xfade=transition=fade:duration=${FADE}:offset=${(length - FADE).toFixed(3)}[${out}]`)
  length += nextLen[i] - FADE
  label = out
})

execFileSync(FFMPEG, [
  '-y', '-loglevel', 'error',
  ...inputs,
  '-filter_complex', parts.join(';'),
  '-map', `[${label}]`,
  '-an', '-map_metadata', '-1', '-map_chapters', '-1',
  '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2',
  // 4:2:0 (VP9 profile 0), which every browser decodes; the dissolves
  // otherwise hand the encoder 4:4:4.
  '-pix_fmt', 'yuv420p',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
  `${DIR}pitch-720p.webm`,
])

execFileSync(FFMPEG, [
  '-y', '-loglevel', 'error',
  '-ss', '0.5', '-i', `${DIR}pitch-720p.webm`,
  '-frames:v', '1', '-map_metadata', '-1', '-c:v', 'libwebp', '-quality', '82',
  `${DIR}pitch-poster.webp`,
])

for (const f of ['pitch-720p.webm', 'pitch-poster.webp']) {
  console.log(`${DIR}${f}  ${Math.round(fs.statSync(DIR + f).size / 1024)} KB`)
}
console.log(`${length.toFixed(1)}s at ${FPS} fps`)
