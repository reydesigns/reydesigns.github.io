/**
 * The pixel side of the drawings' "designer toy" finish: pure array maths, no
 * three.js and no DOM, so it runs in drawing.worker.js off the main thread.
 *
 * The drawings have no separate parts — skin, hair and eyes are just colours
 * painted into one image — so each pixel of color.png is sorted into a region
 * by its colour, and the regions' gloss values from style_config.json are
 * painted into the maps a MeshPhysicalMaterial reads (toyStyle.js). The drawn
 * colours themselves are kept; only the blush is feathered into a soft
 * gradient.
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

/**
 * A '#rrggbb' colour as three's `new Color(hex)` holds it: converted from sRGB
 * into the linear working space. The maps were tuned with those values, so
 * they are kept.
 */
function linearRGB(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255
    return v < 0.04045 ? v * 0.0773993808 : Math.pow(v * 0.9478672986 + 0.0521327014, 2.4)
  })
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

/**
 * Builds the colour map plus the gloss maps from color.png's RGBA pixels
 * (`px`, modified in place: it becomes the colour map). Packing follows
 * three's conventions: roughnessMap reads green, clearcoatMap red,
 * clearcoatRoughnessMap green. Each map is RGBA, row 0 at the top.
 */
export function toyMapPixels(px, w, h, cfg) {
  const n = w * h
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

  const mk = () => new Uint8ClampedArray(n * 4)
  const coat = mk() // R clearcoat, G roughness
  const coatRough = mk() // G clearcoat roughness
  const sheen = mk() // sheen colour × strength
  const glow = mk() // emissive colour × strength
  const sheenCol = linearRGB(cfg.sheenColor)
  const glowCol = linearRGB(cfg.glowColor)
  const debugCols = DEBUG.map(linearRGB)

  for (let i = 0; i < n; i += 1) {
    const o = i * 4
    coat[o + 3] = coatRough[o + 3] = sheen[o + 3] = glow[o + 3] = 255
    const r = regions[region[i]]
    if (!r) continue
    coat[o] = (r.clearcoat ?? 0) * 255
    coat[o + 1] = (r.roughness ?? 0.5) * 255
    coatRough[o + 1] = (r.clearcoatRoughness ?? 0.1) * 255
    const sh = r.sheen ?? 0
    sheen[o] = sheenCol[0] * sh * 255
    sheen[o + 1] = sheenCol[1] * sh * 255
    sheen[o + 2] = sheenCol[2] * sh * 255
    const gl = r.glow ?? 0
    glow[o] = glowCol[0] * gl * 255
    glow[o + 1] = glowCol[1] * gl * 255
    glow[o + 2] = glowCol[2] * gl * 255
    if (cfg.debugRegions) {
      const dc = debugCols[region[i] % debugCols.length]
      px[o] = dc[0] * 255
      px[o + 1] = dc[1] * 255
      px[o + 2] = dc[2] * 255
    }
  }

  return { map: px, coat, coatRough, sheen, glow }
}
