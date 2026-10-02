import * as THREE from 'three'

/**
 * The "designer toy" finish for the landing-page drawings. The drawings have
 * no separate parts — skin, hair and eyes are just colours painted into one
 * image — so each pixel of color.png is sorted into a region by its colour,
 * and the regions' gloss values from style_config.json are painted into the
 * maps a MeshPhysicalMaterial reads. The drawn colours themselves are kept;
 * only the blush is feathered into a soft gradient.
 */

/** HSL with hue in degrees and saturation / lightness in 0..1. */
function hsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1))
  let h
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h *= 60
  if (h < 0) h += 360
  return [h, s, l]
}

const within = (v, [lo, hi]) => v >= lo && v <= hi

function matches(m, h, s, l) {
  if (m.lum && !within(l, m.lum)) return false
  if (m.sat && !within(s, m.sat)) return false
  if (m.hue && !m.hue.some((range) => within(h, range))) return false
  return true
}

/** Separable box blur, `passes` times (three passes is close to a Gaussian). */
export function boxBlur(a, w, h, R, passes) {
  if (R < 1) return a
  const tmp = new Float32Array(w * h)
  for (let pass = 0; pass < passes; pass += 1) {
    for (let y = 0; y < h; y += 1) {
      let s = 0
      let cnt = 0
      for (let x = -R; x < w + R; x += 1) {
        if (x + R < w) {
          s += a[y * w + x + R]
          cnt += 1
        }
        if (x - R - 1 >= 0) {
          s -= a[y * w + x - R - 1]
          cnt -= 1
        }
        if (x >= 0 && x < w) tmp[y * w + x] = s / cnt
      }
    }
    for (let x = 0; x < w; x += 1) {
      let s = 0
      let cnt = 0
      for (let y = -R; y < h + R; y += 1) {
        if (y + R < h) {
          s += tmp[(y + R) * w + x]
          cnt += 1
        }
        if (y - R - 1 >= 0) {
          s -= tmp[(y - R - 1) * w + x]
          cnt -= 1
        }
        if (y >= 0 && y < h) a[y * w + x] = s / cnt
      }
    }
  }
  return a
}

/** Debug tints for `debugRegions`, in region order. */
const DEBUG = ['#ffffff', '#0000ff', '#ff00ff', '#ffaa00', '#00cc66', '#888888', '#00ffff', '#ff0000']

const canvasTex = (canvas, colorSpace) => {
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = colorSpace
  return t
}

/**
 * Builds the colour map plus the gloss maps from the drawing's color.png.
 * Packing follows three's conventions: roughnessMap reads green,
 * clearcoatMap red, clearcoatRoughnessMap green.
 */
export function buildToyMaps(img, cfg) {
  const w = img.width
  const h = img.height
  const n = w * h
  const src = document.createElement('canvas')
  src.width = w
  src.height = h
  const sx = src.getContext('2d', { willReadFrequently: true })
  sx.drawImage(img, 0, 0)
  const color = sx.getImageData(0, 0, w, h)
  const px = color.data

  const regions = cfg.regions
  const blushIdx = regions.findIndex((r) => r.name === 'blush')
  const skinIdx = regions.findIndex((r) => r.name === 'skin')
  const region = new Int8Array(n).fill(-1)
  for (let i = 0; i < n; i += 1) {
    if (px[i * 4 + 3] < 128) continue
    const [hh, ss, ll] = hsl(px[i * 4], px[i * 4 + 1], px[i * 4 + 2])
    region[i] = regions.findIndex((r) => matches(r.match, hh, ss, ll))
  }

  // Feather the drawn blush out over the surrounding skin, in the blush's own
  // average colour, so the cheeks glow like the reference rather than ending
  // in a hard edge.
  if (cfg.blush.enabled && blushIdx >= 0 && skinIdx >= 0) {
    const mask = new Float32Array(n)
    let br = 0
    let bg = 0
    let bb = 0
    let bn = 0
    for (let i = 0; i < n; i += 1) {
      if (region[i] !== blushIdx) continue
      mask[i] = 1
      br += px[i * 4]
      bg += px[i * 4 + 1]
      bb += px[i * 4 + 2]
      bn += 1
    }
    if (bn > 0) {
      br /= bn
      bg /= bn
      bb /= bn
      boxBlur(mask, w, h, Math.round(cfg.blush.feather * (w / 800)), 3)
      for (let i = 0; i < n; i += 1) {
        if (region[i] !== skinIdx || mask[i] <= 0) continue
        const k = Math.min(1, mask[i] * 2) * cfg.blush.strength
        px[i * 4] += (br - px[i * 4]) * k
        px[i * 4 + 1] += (bg - px[i * 4 + 1]) * k
        px[i * 4 + 2] += (bb - px[i * 4 + 2]) * k
      }
    }
  }

  const mk = () => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const x = c.getContext('2d')
    return { c, x, d: x.createImageData(w, h) }
  }
  const coat = mk() // R clearcoat, G roughness
  const coatRough = mk() // G clearcoat roughness
  const sheen = mk() // sheen colour × strength
  const glow = mk() // emissive colour × strength
  const sheenCol = new THREE.Color(cfg.sheenColor)
  const glowCol = new THREE.Color(cfg.glowColor)
  const debugCols = DEBUG.map((c) => new THREE.Color(c))

  for (let i = 0; i < n; i += 1) {
    const o = i * 4
    coat.d.data[o + 3] = coatRough.d.data[o + 3] = sheen.d.data[o + 3] = glow.d.data[o + 3] = 255
    const r = regions[region[i]]
    if (!r) continue
    coat.d.data[o] = (r.clearcoat ?? 0) * 255
    coat.d.data[o + 1] = (r.roughness ?? 0.5) * 255
    coatRough.d.data[o + 1] = (r.clearcoatRoughness ?? 0.1) * 255
    const sh = r.sheen ?? 0
    sheen.d.data[o] = sheenCol.r * sh * 255
    sheen.d.data[o + 1] = sheenCol.g * sh * 255
    sheen.d.data[o + 2] = sheenCol.b * sh * 255
    const gl = r.glow ?? 0
    glow.d.data[o] = glowCol.r * gl * 255
    glow.d.data[o + 1] = glowCol.g * gl * 255
    glow.d.data[o + 2] = glowCol.b * gl * 255
    if (cfg.debugRegions) {
      const dc = debugCols[region[i] % debugCols.length]
      px[o] = dc.r * 255
      px[o + 1] = dc.g * 255
      px[o + 2] = dc.b * 255
    }
  }

  sx.putImageData(color, 0, 0)
  for (const m of [coat, coatRough, sheen, glow]) m.x.putImageData(m.d, 0, 0)
  return {
    map: canvasTex(src, THREE.SRGBColorSpace),
    coat: canvasTex(coat.c, THREE.NoColorSpace),
    coatRough: canvasTex(coatRough.c, THREE.NoColorSpace),
    sheen: canvasTex(sheen.c, THREE.SRGBColorSpace),
    glow: canvasTex(glow.c, THREE.SRGBColorSpace),
  }
}

/** The glossy front material, from the maps above. */
export function toyMaterial(maps) {
  return new THREE.MeshPhysicalMaterial({
    map: maps.map,
    roughness: 1,
    roughnessMap: maps.coat,
    metalness: 0,
    clearcoat: 1,
    clearcoatMap: maps.coat,
    clearcoatRoughness: 1,
    clearcoatRoughnessMap: maps.coatRough,
    sheen: 1,
    sheenColor: 0xffffff,
    sheenColorMap: maps.sheen,
    sheenRoughness: 0.5,
    emissive: 0xffffff,
    emissiveMap: maps.glow,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  })
}
