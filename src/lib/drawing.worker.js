/**
 * Builds everything a 3D drawing needs from its PNGs, off the main thread:
 * the mesh (positions, normals, uvs, index for the front and back shells) and
 * the texture pixels (colour + gloss maps, back). Drawing3D only wraps the
 * arrays in three.js objects.
 *
 * All of this used to run on the main thread when the drawing started (~100
 * ms a drawing), freezing the landing page's typing headline for a beat just
 * as the drawings appeared. Here it overlaps the three.js download instead.
 *
 * In:  { color, height, back, meta, depth, maxSegments }  (absolute URLs)
 * Out: { ok: true, mesh, tex } with every array transferred, or { ok: false }
 *
 * The geometry is three's PlaneGeometry and computeVertexNormals, written out
 * (same vertex order, same winding, same area-weighted normals), so the
 * worker doesn't carry three.js.
 */
import style from '@/data/style_config.json'
import { boxBlur, toyMapPixels } from './toyPixels'

/** Model units per source pixel (the originals' scale). */
const SC = 1 / 260

async function decode(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return createImageBitmap(await res.blob())
}

/** RGBA pixels of `bmp`, drawn at w x h (canvas smoothing, as before). */
function pixels(bmp, w = bmp.width, h = bmp.height) {
  const c = new OffscreenCanvas(w, h)
  const x = c.getContext('2d', { willReadFrequently: true })
  x.drawImage(bmp, 0, 0, w, h)
  return x.getImageData(0, 0, w, h).data
}

/** PlaneGeometry(width, height, cw - 1, ch - 1): xy positions, uvs, index. */
function plane(width, height, cw, ch) {
  const gx = cw - 1
  const gy = ch - 1
  const position = new Float32Array(cw * ch * 3)
  const uv = new Float32Array(cw * ch * 2)
  for (let iy = 0; iy < ch; iy += 1) {
    const y = iy * (height / gy) - height / 2
    for (let ix = 0; ix < cw; ix += 1) {
      const i = iy * cw + ix
      position[i * 3] = ix * (width / gx) - width / 2
      position[i * 3 + 1] = -y
      uv[i * 2] = ix / gx
      uv[i * 2 + 1] = 1 - iy / gy
    }
  }
  const index = new Uint32Array(gx * gy * 6)
  let k = 0
  for (let iy = 0; iy < gy; iy += 1) {
    for (let ix = 0; ix < gx; ix += 1) {
      const a = ix + cw * iy
      const b = ix + cw * (iy + 1)
      const c = ix + 1 + cw * (iy + 1)
      const d = ix + 1 + cw * iy
      index[k++] = a
      index[k++] = b
      index[k++] = d
      index[k++] = b
      index[k++] = c
      index[k++] = d
    }
  }
  return { position, uv, index }
}

/** BufferGeometry.computeVertexNormals for an indexed mesh. */
function vertexNormals(p, index) {
  const nm = new Float32Array(p.length)
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t] * 3
    const b = index[t + 1] * 3
    const c = index[t + 2] * 3
    // (C - B) x (A - B)
    const cbx = p[c] - p[b]
    const cby = p[c + 1] - p[b + 1]
    const cbz = p[c + 2] - p[b + 2]
    const abx = p[a] - p[b]
    const aby = p[a + 1] - p[b + 1]
    const abz = p[a + 2] - p[b + 2]
    const nx = cby * abz - cbz * aby
    const ny = cbz * abx - cbx * abz
    const nz = cbx * aby - cby * abx
    for (const v of [a, b, c]) {
      nm[v] += nx
      nm[v + 1] += ny
      nm[v + 2] += nz
    }
  }
  for (let v = 0; v < nm.length; v += 3) {
    const len = Math.hypot(nm[v], nm[v + 1], nm[v + 2]) || 1
    nm[v] /= len
    nm[v + 1] /= len
    nm[v + 2] /= len
  }
  return nm
}

async function build({ color, height, back, meta, depth, maxSegments }) {
  const [colorImg, heightImg, backImg] = await Promise.all([decode(color), decode(height), decode(back)])

  // The source height maps are ~800x820. Meshing one vertex per pixel would
  // be ~650k vertices per model — the originals could afford that as a
  // fullscreen showcase, but these are small corner decorations and there are
  // two of them. Downsample to `maxSegments` on the long edge.
  const scale = Math.min(1, maxSegments / Math.max(heightImg.width, heightImg.height))
  const cw = Math.max(2, Math.round(heightImg.width * scale))
  const ch = Math.max(2, Math.round(heightImg.height * scale))
  const px = pixels(heightImg, cw, ch)
  const n = cw * ch

  // 16-bit height packed across the red and green channels
  const hv = new Float32Array(n)
  for (let i = 0; i < n; i += 1) hv[i] = (px[i * 4] * 256 + px[i * 4 + 1]) / 65535
  const G = style.geometry
  if (style.enabled) {
    // Rounder, softer forms: blur the relief so no step in the height map
    // shows as a facet, and optionally puff it up (`chunky`).
    boxBlur(hv, cw, ch, G.smoothRadius, G.smoothPasses)
    if (G.chunky) for (let i = 0; i < n; i += 1) hv[i] = hv[i] ** G.chunkyGamma * G.chunkyDepth
  }
  // Close the seam. The front and back are separate shells, and along the
  // outline they used to stop at different depths, leaving a slit you could
  // see through when the drawing turned. Taper the height to zero at the
  // outline (where alphaTest cuts) with a round profile, so both shells meet
  // there and the edge reads as a puffy rim.
  const apx = pixels(colorImg, cw, ch)
  const am = new Float32Array(n)
  for (let i = 0; i < n; i += 1) am[i] = apx[i * 4 + 3] / 255
  boxBlur(am, cw, ch, G.edgeRadius, 2)
  for (let i = 0; i < n; i += 1) {
    const f = Math.min(1, Math.max(0, (am[i] - 0.55) / 0.45))
    hv[i] *= Math.sqrt(1 - (1 - f) * (1 - f))
  }

  const { position, uv, index } = plane(meta.w * SC, meta.h * SC, cw, ch)
  const hz = new Float32Array(n)
  for (let i = 0; i < n; i += 1) hz[i] = hv[i] * meta.maxH * SC * depth
  const front = Float32Array.from(position)
  for (let i = 0; i < n; i += 1) front[i * 3 + 2] = hz[i]

  // Back face: a blurred copy of the height field, so the front artwork
  // doesn't read through from behind.
  const a = boxBlur(Float32Array.from(hz), cw, ch, Math.max(2, Math.round(10 * (cw / 795))), 3)
  const backPos = position
  for (let i = 0; i < n; i += 1) backPos[i * 3 + 2] = -0.35 * Math.min(a[i], hz[i] * 2)

  const mesh = {
    uv,
    index,
    front: { position: front, normal: vertexNormals(front, index) },
    back: { position: backPos, normal: vertexNormals(backPos, index) },
  }

  // Textures, full size. With the toy look off, the colour map is the drawing
  // as drawn.
  const cpx = pixels(colorImg)
  const cwFull = colorImg.width
  const chFull = colorImg.height
  const maps = style.enabled ? toyMapPixels(cpx, cwFull, chFull, style) : { map: cpx }
  const tex = { w: cwFull, h: chFull, maps, back: { w: backImg.width, h: backImg.height, data: pixels(backImg) } }
  for (const b of [colorImg, heightImg, backImg]) b.close()
  return { mesh, tex }
}

self.onmessage = async ({ data }) => {
  try {
    const { mesh, tex } = await build(data)
    const transfer = [
      mesh.uv.buffer,
      mesh.index.buffer,
      mesh.front.position.buffer,
      mesh.front.normal.buffer,
      mesh.back.position.buffer,
      mesh.back.normal.buffer,
      tex.back.data.buffer,
      ...Object.values(tex.maps).map((m) => m.buffer),
    ]
    self.postMessage({ ok: true, mesh, tex }, transfer)
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) })
  }
}
