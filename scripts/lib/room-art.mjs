/**
 * The stickers drawn in code for the isometric room (scripts/prep-room.mjs),
 * in the style of Shreya's own room drawing: its palette, its one dark-brown
 * outline, 2:1 isometric edges. Each is a Sprite, a grid of hex colours (or
 * null for clear), at the drawing's native size, one cell per art pixel.
 *
 * The rug, cat bed, TV and stand are built from shapes (ellipses on the floor
 * plane, iso boxes); the cats are drawn by hand as text grids. Either way the
 * dark outline round the outside is added last, by `outline`.
 */

/** The drawing's outline colour. */
export const OL = '#321703'

class Sprite {
  constructor(w, h) {
    this.w = w
    this.h = h
    this.px = new Array(w * h).fill(null)
  }
  get(x, y) {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.px[y * this.w + x]
  }
  set(x, y, c) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c
  }
  /** Copies `s` over this sprite at (ox, oy), skipping its clear cells. */
  stamp(s, ox, oy) {
    for (let y = 0; y < s.h; y += 1) for (let x = 0; x < s.w; x += 1) if (s.get(x, y)) this.set(ox + x, oy + y, s.get(x, y))
    return this
  }
}

/** A sprite from text rows; each character is a key of `pal` ('.' is clear). */
function rows(lines, pal) {
  const w = Math.max(...lines.map((l) => l.length))
  const s = new Sprite(w, lines.length)
  lines.forEach((l, y) => [...l].forEach((ch, x) => ch !== '.' && s.set(x, y, pal[ch] ?? OL)))
  return s
}

/** A one-pixel outline round the outside (4-neighbour), on a canvas grown by
    a pixel each side so it has room. */
function outline(s, color = OL) {
  const o = new Sprite(s.w + 2, s.h + 2).stamp(s, 1, 1)
  const solid = (x, y) => !!o.get(x, y)
  const add = []
  for (let y = 0; y < o.h; y += 1)
    for (let x = 0; x < o.w; x += 1)
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) add.push([x, y])
  for (const [x, y] of add) o.set(x, y, color)
  return o
}

/** Trims clear rows and columns from the edges. */
function trim(s) {
  let x0 = s.w, y0 = s.h, x1 = -1, y1 = -1
  for (let y = 0; y < s.h; y += 1)
    for (let x = 0; x < s.w; x += 1)
      if (s.get(x, y)) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
      }
  const t = new Sprite(x1 - x0 + 1, y1 - y0 + 1)
  for (let y = 0; y < t.h; y += 1) for (let x = 0; x < t.w; x += 1) t.set(x, y, s.get(x + x0, y + y0))
  return t
}

/* --- iso helpers ---------------------------------------------------------- */

/** Floor-plane point (a, b) at height h to screen: +a runs right-down, +b
    left-down, both at the drawing's 2:1. */
const iso = (ox, oy) => (a, b, h = 0) => [ox + 2 * (a - b), oy + (a + b) - h]

/** Fills a polygon (screen points) by pixel centres. */
function fillPoly(s, pts, c) {
  const ys = pts.map((p) => p[1])
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y += 1) {
    const cy = y + 0.5
    const xs = []
    for (let i = 0; i < pts.length; i += 1) {
      const [ax, ay] = pts[i]
      const [bx, by] = pts[(i + 1) % pts.length]
      if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax))
    }
    xs.sort((m, n) => m - n)
    for (let i = 0; i + 1 < xs.length; i += 2)
      for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] - 0.5); x += 1) s.set(x, y, c)
  }
}

/** A pixel line; iso edges (2 across, 1 down) come out as clean 2-pixel steps. */
function line(s, [x0, y0], [x1, y1], c = OL) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1)
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  for (;;) {
    s.set(x0, y0, c)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x0 += sx }
    if (e2 <= dx) { err += dx; y0 += sy }
  }
}

/** An iso box from (a0, b0, h0) to (a1, b1, h1): its top and its two
    front faces filled, every visible edge outlined. Returns the corners of the
    front-left face (the b = b1 plane) for drawing details on it. */
function box(s, P, [a0, b0, h0], [a1, b1, h1], { top, left, right }) {
  fillPoly(s, [P(a0, b0, h1), P(a1, b0, h1), P(a1, b1, h1), P(a0, b1, h1)], top)
  fillPoly(s, [P(a0, b1, h1), P(a1, b1, h1), P(a1, b1, h0), P(a0, b1, h0)], left)
  fillPoly(s, [P(a1, b0, h1), P(a1, b1, h1), P(a1, b1, h0), P(a1, b0, h0)], right)
  const e = (p, q) => line(s, P(...p), P(...q))
  e([a0, b0, h1], [a1, b0, h1]); e([a1, b0, h1], [a1, b1, h1]); e([a1, b1, h1], [a0, b1, h1]); e([a0, b1, h1], [a0, b0, h1])
  e([a0, b1, h1], [a0, b1, h0]); e([a1, b1, h1], [a1, b1, h0]); e([a1, b0, h1], [a1, b0, h0])
  e([a0, b1, h0], [a1, b1, h0]); e([a1, b1, h0], [a1, b0, h0])
}

/* --- Spider-Man rug --------------------------------------------------------- */
/* A round rug on the floor: the mask's red, the web in dark lines — eight
   spokes, rings that run straight between them like a real web — and the
   two big white eyes, rimmed thick in black. */
function spiderRug() {
  const R = 26 // radius across; the floor squashes it to half that down
  const T = 2 // pile thickness
  const s = new Sprite(2 * R + 4, R + T + 4)
  const cx = R + 2, cy = R / 2 + 2
  const RED = '#de2624', RED_DK = '#b81c18', SIDE = '#882714', EYE = '#f6f1e9'
  const uv = (x, y) => [(x + 0.5 - cx) / R, (y + 0.5 - cy) / (R / 2)]
  const inRug = (x, y) => { const [u, v] = uv(x, y); return u * u + v * v <= 1 }
  // Eyes: almond ellipses, tilted so their outer corners lift.
  const eyes = [
    { c: [-0.37, -0.12], ang: 0.42 },
    { c: [0.37, -0.12], ang: -0.42 },
  ]
  const inEye = (u, v, grow = 0) =>
    eyes.some(({ c, ang }) => {
      const du = u - c[0], dv = v - c[1]
      const p = du * Math.cos(ang) + dv * Math.sin(ang)
      const q = -du * Math.sin(ang) + dv * Math.cos(ang)
      // Flatter on the inside edge: a teardrop rather than a plain oval.
      const a = 0.27 + grow, b = (q > 0 ? 0.13 : 0.17) + grow
      return (p * p) / (a * a) + (q * q) / (b * b) <= 1
    })
  // The web's "radius": straight chords between the eight spokes.
  const SECT = Math.PI / 4
  const webR = (u, v) => {
    const r = Math.hypot(u, v), th = Math.atan2(v, u)
    const off = ((th % SECT) + SECT) % SECT - SECT / 2
    return (r * Math.cos(off)) / Math.cos(SECT / 2)
  }
  for (let y = 0; y < s.h; y += 1)
    for (let x = 0; x < s.w; x += 1) {
      if (!inRug(x, y)) {
        for (let k = 1; k <= T; k += 1) if (inRug(x, y - k)) s.set(x, y, SIDE)
        continue
      }
      const [u, v] = uv(x, y)
      // A little shade toward the front edge, as on the room's floorboards.
      s.set(x, y, u * u + v * v > 0.78 && v > 0.15 ? RED_DK : RED)
      if (inEye(u, v)) { s.set(x, y, EYE); continue }
      if (inEye(u, v, 0.075)) { s.set(x, y, OL); continue }
      // Spokes, in screen space so they come out one pixel wide.
      const px = x + 0.5 - cx, py = y + 0.5 - cy
      for (let k = 0; k < 8; k += 1) {
        const dx = Math.cos(k * SECT), dy = Math.sin(k * SECT) / 2
        const n = Math.hypot(dx, dy)
        if (Math.abs(px * dy - py * dx) / n < 0.55 && px * dx + py * dy > 0) s.set(x, y, OL)
      }
      // Rings: the inner edge of each level of webR.
      for (const level of [0.3, 0.58, 0.84]) {
        const here = webR(u, v) < level
        const out = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => {
          const [u2, v2] = uv(x + ax, y + ay)
          return webR(u2, v2) >= level
        })
        if (here && out) s.set(x, y, OL)
      }
    }
  return trim(outline(s))
}

/* --- TV on a stand ---------------------------------------------------------- */
/* A chunky cream CRT with rabbit-ear antennas, on a low wooden stand with two
   doors, in the room's own wood tones. */
function tvStand() {
  const s = new Sprite(64, 64)
  const P = iso(30, 22)
  const WOOD = { top: '#bb7d44', left: '#975228', right: '#7c3d11' }
  // Stand: legs, then the cabinet on them.
  const LEG = { top: WOOD.right, left: WOOD.right, right: WOOD.right }
  box(s, P, [0.5, 6, 0], [1.5, 7, 2], LEG)
  box(s, P, [15, 6, 0], [16, 7, 2], LEG)
  box(s, P, [15, 0, 0], [16, 1, 2], LEG)
  box(s, P, [0, 0, 2], [16, 7, 10], WOOD)
  // Doors on the front: a seam down the middle, a frame inset round each,
  // a brass knob either side of the seam.
  const f = (a, h) => P(a, 7, h)
  line(s, f(8, 3), f(8, 9))
  line(s, f(1, 9), f(15, 9), '#682b16')
  for (const [a0, a1] of [[1, 7], [9, 15]]) {
    line(s, f(a0, 3.5), f(a1, 3.5), '#682b16')
    line(s, f(a0, 3.5), f(a0, 8), '#682b16')
  }
  for (const a of [7, 9]) s.set(...f(a, 6.5).map(Math.round), '#c67d16')
  // The TV: a near-cube, the screen filling most of its front, knobs and a
  // grille down its side.
  const CREAM = { top: '#e7d9bf', left: '#d7c8b3', right: '#aa9992' }
  box(s, P, [4, 1, 10], [12, 6, 18], CREAM)
  const g = (a, h) => P(a, 6, h)
  fillPoly(s, [g(4.75, 17.25), g(11.25, 17.25), g(11.25, 10.75), g(4.75, 10.75)], '#3f3734')
  fillPoly(s, [g(5.25, 16.75), g(10.75, 16.75), g(10.75, 11.25), g(5.25, 11.25)], '#516681')
  // Glare on the glass.
  line(s, g(6, 16), g(7.5, 16), '#aac0d6')
  line(s, g(6, 15), g(6, 15), '#aac0d6')
  const side = (b, h) => P(12, b, h).map(Math.round)
  s.set(...side(4.5, 16), '#682b16')
  s.set(...side(4.5, 14.5), '#682b16')
  for (const h of [12.5, 11.5]) line(s, side(2, h), side(5, h), '#847357')
  // Rabbit ears from the middle of the top, a bead on each tip.
  const [tx, ty] = P(8, 3.5, 18).map(Math.round)
  line(s, [tx - 1, ty], [tx - 7, ty - 9])
  line(s, [tx + 1, ty], [tx + 6, ty - 10])
  for (const [x, y] of [[tx - 8, ty - 10], [tx - 7, ty - 10], [tx - 8, ty - 9], [tx + 6, ty - 11], [tx + 7, ty - 11], [tx + 7, ty - 10]])
    s.set(x, y, OL)
  fillPoly(s, [[tx - 2, ty - 1], [tx + 3, ty - 1], [tx + 3, ty + 1], [tx - 2, ty + 1]], '#3f3734')
  return trim(outline(s))
}

/* --- couch ------------------------------------------------------------------- */
/* A sage-green couch on the room's own axes: its length runs along the left
   wall (up-right to down-left, like the wall with the window), so it can sit
   back against that wall facing into the room. Backrest along the far side,
   an arm at each end, three seat cushions, little wooden feet. */
function couch() {
  const s = new Sprite(72, 56)
  const P = iso(44, 14)
  const L = 18 // length, along b
  const D = 8 // depth, along a
  const GREEN = { top: '#8f9b91', left: '#6c7e70', right: '#55695b' }
  const FEET = { top: '#682b16', left: '#682b16', right: '#682b16' }
  for (const [a, b] of [[D - 1, L - 1], [D - 1, 0], [0, L - 1]]) box(s, P, [a, b, 0], [a + 1, b + 1, 1.5], FEET)
  // Base and seat, then the backrest on its far edge, then the arms, far one
  // first so the near one overlaps it.
  box(s, P, [0, 0, 1.5], [D, L, 5], GREEN)
  box(s, P, [0, 0, 5], [2.5, L, 12], GREEN)
  box(s, P, [0, 0, 5], [D, 2.5, 8.5], GREEN)
  box(s, P, [0, L - 2.5, 5], [D, L, 8.5], GREEN)
  // Cushion seams: across the seat and down its front, and up the backrest.
  for (const b of [7, 11]) {
    line(s, P(2.5, b, 5), P(D, b, 5), '#55695b')
    line(s, P(D, b, 5), P(D, b, 2.5), '#3f5245')
    line(s, P(2.5, b, 5.5), P(2.5, b, 11.5), '#55695b')
  }
  return trim(outline(s))
}

/* --- cats ------------------------------------------------------------------- */

/** A grey tabby, standing side-on and facing left, tail up. */
function catStanding() {
  return trim(
    outline(
      rows(
        [
          '.b...b.................',
          '.pb.bp...............b.',
          'bbbbbbb..............bb',
          'bbbbbbbb..............b',
          'bebbebbb..............b',
          'bbwpwbbb.............bb',
          '.wwwwbbbbbbbbbbbbbbbbb.',
          '..wwbbbbsbbbsbbbsbbbbb.',
          '...bbbbbsbbbsbbbsbbbbb.',
          '...bbbbbbbbbbbbbbbbbbb.',
          '...sbbbsssssssssbbbbbs.',
          '...bbobb........bbobb..',
          '...bbobb........bbobb..',
          '...wwoww........wwoww..',
        ],
        { b: '#8a8a80', s: '#6b6b63', w: '#e4dfdc', p: '#e0846f', e: OL },
      ),
    ),
  )
}

/** A black cat sitting up, three-quarters to the front, tail round its paws. */
function catSitting() {
  return trim(
    outline(
      rows(
        [
          '.b....b.......',
          '.bb..bb.......',
          '.bpbbpb.......',
          'bbbbbbbb......',
          'bebbbebb......',
          'bbbpbbbb......',
          '.bbbbbb.......',
          '..bbbbbb......',
          '.bbbbbbbb.....',
          '.blbbbbbbb....',
          'bblbbbbbbbb...',
          'bblbbbbbbbbb..',
          'bblbbbbbbbbb..',
          'bbbbbbbbbbbbb.',
          'bobbobbbbbbbbb',
          'bobbobbbbbbbbl',
          'bbbbbbllllllll',
        ],
        { b: '#3f3734', l: '#5d524c', p: '#e0846f', e: '#e3c45a' },
      ),
    ),
  )
}

/** An orange cat curled up asleep, nose tucked by its tail. */
const SLEEPER = rows(
  [
    '..b..b..............',
    '..pbbp..bbbbbbb.....',
    '.bbbbbbbbbbbbbbbb...',
    '.bbbbbbbbsbbbbbbbb..',
    'bbbbbbbbbbsbbbbbbbb.',
    'bboobooobbbsbbbbbbb.',
    'bbbbpbbbbbbsbbbbbbb.',
    '.wwwwbbbbbbbsbbbbbb.',
    '..wwoooooooooooobbs.',
    '.bbbbbbbbbbbbbbbsss.',
    '..ssssssssssssssss..',
  ],
  { b: '#c67d16', s: '#9b5d10', w: '#e7d9bf', p: '#e0846f' },
)

/** The orange cat asleep in a round, padded pet bed. */
function catBed() {
  const R = 18, r = 12, H = 4 // outer and inner radius, rim height
  const s = new Sprite(2 * R + 4, R + H + 8)
  const cx = R + 2, cy = R / 2 + 2
  const inE = (x, y, rad) => {
    const u = (x + 0.5 - cx) / rad, v = (y + 0.5 - cy) / (rad / 2)
    return u * u + v * v <= 1
  }
  const RIM = '#6d84a3', RIM_DK = '#516681', SIDE = '#3c4d63', BED = '#e7d9bf', BED_DK = '#d2ab8e'
  const rimTop = []
  for (let y = 0; y < s.h; y += 1)
    for (let x = 0; x < s.w; x += 1) {
      if (inE(x, y, R)) {
        if (!inE(x, y, r)) { s.set(x, y, RIM); rimTop.push([x, y]) }
        else if (!inE(x, y - 3, r)) s.set(x, y, RIM_DK) // the rim's inside, at the back
        else s.set(x, y, inE(x, y - 3, r - 3) ? BED : BED_DK)
      } else {
        for (let k = 1; k <= H; k += 1) if (inE(x, y - k, R)) s.set(x, y, SIDE)
      }
    }
  // The cat lies in the well, and the front of the rim comes up over it.
  s.stamp(outline(SLEEPER), cx - 11, cy - 7)
  for (const [x, y] of rimTop) if (y + 0.5 > cy) s.set(x, y, RIM)
  // The rim's inner edge along the front, so it reads as a lip.
  for (let x = 0; x < s.w; x += 1)
    for (let y = Math.ceil(cy); y < s.h; y += 1)
      if (inE(x, y, r + 0.6) && !inE(x, y, r - 0.6) && y + 0.5 > cy + 1) { s.set(x, y, RIM_DK); break }
  return trim(outline(s))
}

/** id → Sprite, for every sticker drawn in code. */
export function drawStickers() {
  return {
    'spider-rug': spiderRug(),
    tv: tvStand(),
    couch: couch(),
    'cat-bed': catBed(),
    'cat-standing': catStanding(),
    'cat-sitting': catSitting(),
  }
}
