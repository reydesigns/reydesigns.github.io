/**
 * The hand-painted digits for the strawberry cat's block calendar
 * (catCalendar.js): 0-9 on one small canvas, five to a row, painted as brush
 * strokes rather than set in a font, so they look the same on every machine
 * and a little uneven, as a person would paint them on clay.
 *
 * Each digit is drawn in a cell's own 100 x 100 space, the face of a block,
 * and stays inside its middle two thirds, clear of the rounded edges. A
 * stroke is laid down twice, a hair apart and the second a little thinner,
 * so its edge wavers like a loaded brush, and the whole sheet then gets a
 * faint mottle, the paint thicker in some places than others.
 *
 * The sheet is a mask: ink is white on black, read from the red channel.
 * Kept free of three.js; the caller wraps it in a texture.
 */

export const DIGIT_COLS = 5
export const DIGIT_ROWS = 2

/** Strokes for each digit: a list of paths in the cell's 100 x 100 space. */
const STROKES = {
  0: (p) => p.ellipse(50, 50, 18.5, 27, 0.06, 0, Math.PI * 2),
  1: (p) => {
    p.moveTo(39, 30)
    p.quadraticCurveTo(48, 25, 54, 16)
    p.lineTo(53.5, 84)
  },
  2: (p) => {
    p.moveTo(32, 33)
    p.bezierCurveTo(32, 13, 68, 11, 67.5, 33)
    p.bezierCurveTo(67, 48, 45, 62, 31, 84)
    p.lineTo(70, 83)
  },
  3: (p) => {
    p.moveTo(33, 24)
    p.bezierCurveTo(44, 11, 69, 15, 65, 33)
    p.bezierCurveTo(63, 44, 52, 48, 45, 48.5)
    p.bezierCurveTo(59, 48, 71, 56, 68.5, 70)
    p.bezierCurveTo(66, 87, 40, 90, 31, 76)
  },
  4: (p) => {
    p.moveTo(56, 16)
    p.lineTo(30, 61)
    p.lineTo(72, 60)
    p.moveTo(60.5, 37)
    p.lineTo(60, 85)
  },
  5: (p) => {
    p.moveTo(66, 17)
    p.lineTo(38.5, 17.5)
    p.lineTo(35.5, 47)
    p.bezierCurveTo(47, 38, 69, 42, 68.5, 62)
    p.bezierCurveTo(68, 85, 41, 89, 31, 75)
  },
  6: (p) => {
    p.moveTo(64, 20)
    p.bezierCurveTo(49, 9, 31, 24, 31.5, 53)
    p.bezierCurveTo(32, 75, 42, 85, 51.5, 85)
    p.bezierCurveTo(63, 85, 69.5, 75, 69.5, 64)
    p.bezierCurveTo(69.5, 52, 61, 45, 51, 45)
    p.bezierCurveTo(42, 45, 34, 51, 32, 59)
  },
  7: (p) => {
    p.moveTo(30.5, 18)
    p.lineTo(69.5, 17)
    p.quadraticCurveTo(52, 46, 44, 84)
  },
  8: (p) => {
    p.ellipse(50, 32, 15.5, 15.5, 0.08, 0, Math.PI * 2)
    p.moveTo(68.5 , 65)
    p.ellipse(50, 65.5, 18.5, 19.5, -0.05, 0, Math.PI * 2)
  },
  9: (p) => {
    p.moveTo(67.5, 36)
    p.ellipse(50, 35.5, 17.5, 18.5, 0, 0, Math.PI * 2)
    p.moveTo(67.5, 36)
    p.bezierCurveTo(68.5, 61, 63, 80, 42, 85)
  },
}

/** A small seeded random, so the sheet paints the same every time. */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Paints the ten digits on a new canvas, `cell` pixels a digit, and returns
 * it. Digit d sits in column d % 5, row floor(d / 5), counted from the top.
 */
export function paintDigitSheet(cell = 160) {
  const canvas = document.createElement('canvas')
  canvas.width = cell * DIGIT_COLS
  canvas.height = cell * DIGIT_ROWS
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const rand = rng(7)
  const k = cell / 100

  for (let d = 0; d < 10; d += 1) {
    const ox = (d % DIGIT_COLS) * cell
    const oy = Math.floor(d / DIGIT_COLS) * cell
    // Each digit leans and sits a touch differently.
    const lean = (rand() - 0.5) * 0.07
    const dx = (rand() - 0.5) * 2.5
    const dy = (rand() - 0.5) * 2
    for (const [width, alpha, jx, jy] of [
      [14, 1, 0, 0],
      [12.5, 0.85, 0.7, -0.5],
    ]) {
      ctx.save()
      ctx.translate(ox + 50 * k, oy + 50 * k)
      ctx.rotate(lean)
      ctx.translate((-50 + dx + jx) * k, (-50 + dy + jy) * k)
      ctx.scale(k, k)
      ctx.beginPath()
      STROKES[d](ctx)
      ctx.lineWidth = width
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`
      ctx.stroke()
      ctx.restore()
    }
  }

  // The mottle: the paint a little thinner in soft patches. Two octaves of
  // smoothed noise, multiplied into the ink.
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = img.data
  const W = canvas.width
  const H = canvas.height
  const grid = (n) => {
    const g = new Float32Array((n + 1) * (n + 1))
    for (let i = 0; i < g.length; i += 1) g[i] = rand()
    return (u, v) => {
      const x = u * n
      const y = v * n
      const x0 = Math.floor(x)
      const y0 = Math.floor(y)
      const fx = x - x0
      const fy = y - y0
      const sx = fx * fx * (3 - 2 * fx)
      const sy = fy * fy * (3 - 2 * fy)
      const at = (a, b) => g[Math.min(n, b) * (n + 1) + Math.min(n, a)]
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx
      const bot = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx
      return top + (bot - top) * sy
    }
  }
  const coarse = grid(24)
  const fine = grid(90)
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = (y * W + x) * 4
      if (px[i] === 0) continue
      const m = 0.8 + 0.14 * coarse(x / W, y / H) + 0.06 * fine(x / W, y / H)
      const v = Math.round(px[i] * m)
      px[i] = v
      px[i + 1] = v
      px[i + 2] = v
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}
