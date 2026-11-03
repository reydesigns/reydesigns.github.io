/* ---------------------------------------------------------------------------
   The flower generator's geometry kit (ASCII Flowers on the Works page).

   Everything is built from three kinds of part, all in world units with y up:

     surface  a grid of points, `nu` along the part (base to tip) by `nv`
              across it. A petal, a leaf, a sepal, a bell, a stem. The
              renderer fills each little quad, outlines the grid's free edges
              and draws a silhouette wherever the surface turns away from the
              eye, so a curled petal shows its fold.
     line     a polyline: a stamen's filament, an orchid lip's tendril.
     dot      a small round mark: an anther, a callus.

   The builders here are pure maths; species.js composes them into flowers,
   and render.js projects and paints them. Surfaces are pooled by call order
   (see Scene), so a flower rebuilt every frame as it blooms allocates nothing
   after its first frame.
--------------------------------------------------------------------------- */

export const clamp = (x, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x)
export const mix = (a, b, t) => a + (b - a) * t
export const smooth = (x) => {
  const t = clamp(x)
  return t * t * (3 - 2 * t)
}
export const smoothstep = (e0, e1, x) => smooth((x - e0) / (e1 - e0))
/** A stage of the bloom: 0 before `delay`, eased up to 1 over `span`. */
export const stage = (o, delay, span) => smooth((o - delay) / span)
/** A soft bump centred on `c`, `w` wide either side. */
export const bump = (u, c, w) => {
  const d = (u - c) / w
  return d <= -1 || d >= 1 ? 0 : (1 - d * d) * (1 - d * d)
}

/* --- vectors (plain arrays: these are few and short-lived) --------------- */

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s]
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
/** a·s + b·t + c·r, the frame combinations every builder needs. */
export const comb = (a, s, b, t, c = null, r = 0) =>
  c
    ? [a[0] * s + b[0] * t + c[0] * r, a[1] * s + b[1] * t + c[1] * r, a[2] * s + b[2] * t + c[2] * r]
    : [a[0] * s + b[0] * t, a[1] * s + b[1] * t, a[2] * s + b[2] * t]

export const UP = [0, 1, 0]

/** Two unit vectors at right angles to `axis` and to each other. */
export function perp(axis) {
  const ref = Math.abs(axis[1]) < 0.92 ? UP : [1, 0, 0]
  const e1 = norm(cross(ref, axis))
  return [e1, cross(axis, e1)]
}

/** The direction at angle `phi` round `axis`, in the plane at right angles to it. */
export function around(axis, phi, frame = perp(axis)) {
  return norm(comb(frame[0], Math.cos(phi), frame[1], Math.sin(phi)))
}

/** A deterministic 0..1 jitter, so a flower looks hand-made but the same every frame. */
export function jitter(seed) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/* --- the scene: a pool of parts, rebuilt in the same order every frame --- */

export class Scene {
  constructor() {
    this.surfaces = []
    this.lines = []
    this.dots = []
    this.ns = 0
    this.nl = 0
    this.nd = 0
  }

  begin() {
    this.ns = 0
    this.nl = 0
    this.nd = 0
  }

  /** The next pooled surface, sized nu × nv (re-made only if its size changes). */
  surface(nu, nv, closed) {
    let s = this.surfaces[this.ns]
    if (!s || s.nu !== nu || s.nv !== nv) {
      s = {
        nu,
        nv,
        P: new Float32Array(nu * nv * 3),
        // filled in by the renderer each frame
        sx: new Float32Array(nu * nv),
        sy: new Float32Array(nu * nv),
        sd: new Float32Array(nu * nv),
        // one per quad; a closed surface has nv quads round, an open one nv - 1
        face: new Int8Array((nu - 1) * nv),
        tone: new Uint8Array((nu - 1) * nv),
      }
      this.surfaces[this.ns] = s
    }
    s.closed = Boolean(closed)
    s.edges = EDGES_PETAL
    s.veins = null
    s.spots = null
    s.pollen = 0
    s.shade = 1
    this.ns += 1
    return s
  }

  line(points, { w = 1, ww = 0, alpha = 1 } = {}) {
    const l = this.lines[this.nl] || (this.lines[this.nl] = {})
    l.points = points
    l.w = w
    l.ww = ww
    l.alpha = alpha
    this.nl += 1
    return l
  }

  dot(p, r, { fill = 'ink', ring = false } = {}) {
    const d = this.dots[this.nd] || (this.dots[this.nd] = {})
    d.p = p
    d.r = r
    d.fill = fill
    d.ring = ring
    this.nd += 1
    return d
  }
}

/** Which of a surface's free edges get an outline. */
const EDGES_PETAL = { left: true, right: true, tip: true, base: false }
export const EDGES_TUBE = { left: false, right: false, tip: false, base: false }
export const EDGES_RIM = { left: false, right: false, tip: true, base: false }

const put = (s, i, j, p) => {
  const k = (i * s.nv + j) * 3
  s.P[k] = p[0]
  s.P[k + 1] = p[1]
  s.P[k + 2] = p[2]
}

/** A point on a surface's grid, as a fresh vector. */
export function at(s, i, j) {
  const k = (i * s.nv + j) * 3
  return [s.P[k], s.P[k + 1], s.P[k + 2]]
}

/* --- petal: a curved blade growing out from a base -------------------------

   The spine lies in the plane of the axis `A` and the outward direction `R`.
   `ang(u)` is the spine's angle at u (0 base, 1 tip), measured from R towards
   A: π/2 grows straight along the axis, 0 straight out, past π/2 curls back
   in over the centre, below 0 curls back down (a recurved spider lily).
   `width(u)` (0..1) shapes the outline; `cup(u)` bows the blade towards its
   inner side, more towards the edges, the way a real petal is hollowed;
   `ruffle` waves the edges; `twist` turns the blade about its spine. */
export function petal(scene, o) {
  const nu = o.nu ?? 13
  const nv = o.nv ?? 8
  const s = scene.surface(nu, nv, false)
  const A = o.axis
  const R = o.radial
  const B = cross(A, R)
  const len = o.len
  const wid = o.wid
  const cup = typeof o.cup === 'function' ? o.cup : () => o.cup ?? 0
  const ruf = o.ruffle
  const tw = o.twist ?? 0
  let pr = 0
  let pa = 0
  const du = 1 / (nu - 1)
  for (let i = 0; i < nu; i += 1) {
    const u = i * du
    if (i > 0) {
      const am = o.ang(u - du / 2)
      pr += Math.cos(am) * len * du
      pa += Math.sin(am) * len * du
    }
    const a = o.ang(u)
    // inner normal: the blade's side that faces the axis (or up)
    const N = comb(R, -Math.sin(a), A, Math.cos(a))
    const t = tw * u
    const Bt = comb(B, Math.cos(t), N, Math.sin(t))
    const Nt = comb(N, Math.cos(t), B, -Math.sin(t))
    const w = wid * o.width(u)
    const c = cup(u)
    const base = comb(R, pr, A, pa)
    for (let j = 0; j < nv; j += 1) {
      const v = -1 + (2 * j) / (nv - 1)
      let n = c * v * v * w
      if (ruf) n += ruf.amp * wid * Math.sin((u * ruf.freq + (v < 0 ? ruf.phase ?? 0 : 0)) * Math.PI * 2) * v * v * Math.min(1, u * 4)
      put(s, i, j, [
        o.origin[0] + base[0] + Bt[0] * v * w + Nt[0] * n,
        o.origin[1] + base[1] + Bt[1] * v * w + Nt[1] * n,
        o.origin[2] + base[2] + Bt[2] * v * w + Nt[2] * n,
      ])
    }
  }
  s.veins = o.veins ?? VEINS_PETAL
  s.pollen = o.pollen ?? 1
  if (o.spots) s.spots = o.spots
  return s
}

/** Veins as fractional column positions (quad centres) and a strength. */
export const VEINS_PETAL = [
  { j: 3.5, from: 0.04, to: 0.86, alpha: 0.5 },
  { j: 1.5, from: 0.12, to: 0.66, alpha: 0.22 },
  { j: 5.5, from: 0.12, to: 0.66, alpha: 0.22 },
]
export const VEINS_FINE = [
  { j: 3.5, from: 0.03, to: 0.9, alpha: 0.45 },
  { j: 2.5, from: 0.08, to: 0.8, alpha: 0.26 },
  { j: 4.5, from: 0.08, to: 0.8, alpha: 0.26 },
  { j: 1.5, from: 0.14, to: 0.7, alpha: 0.2 },
  { j: 5.5, from: 0.14, to: 0.7, alpha: 0.2 },
  { j: 0.5, from: 0.24, to: 0.56, alpha: 0.14 },
  { j: 6.5, from: 0.24, to: 0.56, alpha: 0.14 },
]
export const VEINS_LEAF = [
  { j: 3.5, from: 0.02, to: 0.92, alpha: 0.45 },
  { j: 2.5, from: 0.06, to: 0.86, alpha: 0.16 },
  { j: 4.5, from: 0.06, to: 0.86, alpha: 0.16 },
  { j: 1.5, from: 0.1, to: 0.78, alpha: 0.14 },
  { j: 5.5, from: 0.1, to: 0.78, alpha: 0.14 },
]

/* --- revolve: a closed shell turned about an axis --------------------------

   The profile is a spine like a petal's (angle `ang(u)` from straight out
   towards the axis, arc length `len`), swept all the way round `axis` from
   `origin`. A bell, a bud, a cap. `lobes` scallops the rim: the profile is cut
   short between lobes, so the rim ends in `lobes` points. */
export function revolve(scene, o) {
  const nu = o.nu ?? 12
  const nv = o.nv ?? 24
  const s = scene.surface(nu, nv, true)
  const A = o.axis
  const frame = perp(A)
  const du = 1 / (nu - 1)
  // the profile once, at full length and at a finer step for the scallops
  const steps = (nu - 1) * 4
  const pr = new Float32Array(steps + 1)
  const pa = new Float32Array(steps + 1)
  for (let k = 1; k <= steps; k += 1) {
    const am = o.ang((k - 0.5) / steps)
    pr[k] = pr[k - 1] + (Math.cos(am) * o.len) / steps
    pa[k] = pa[k - 1] + (Math.sin(am) * o.len) / steps
  }
  const lobes = o.lobes ?? 0
  const depth = o.lobeDepth ?? 0
  for (let j = 0; j < nv; j += 1) {
    const th = (j / nv) * Math.PI * 2
    const R = comb(frame[0], Math.cos(th), frame[1], Math.sin(th))
    const cut = lobes ? 1 - depth * Math.pow(1 - Math.abs(Math.cos((lobes / 2) * (th + (o.lobePhase ?? 0)))), 1.5) : 1
    for (let i = 0; i < nu; i += 1) {
      const u = i * du
      const f = clamp(u * mix(1, cut, Math.pow(u, 3))) * steps
      const k = Math.floor(f)
      const t = f - k
      const r = k >= steps ? pr[steps] : mix(pr[k], pr[k + 1], t)
      const a = k >= steps ? pa[steps] : mix(pa[k], pa[k + 1], t)
      put(s, i, j, [o.origin[0] + R[0] * r + A[0] * a, o.origin[1] + R[1] * r + A[1] * a, o.origin[2] + R[2] * r + A[2] * a])
    }
  }
  s.edges = EDGES_RIM
  s.veins = o.veins ?? null
  s.pollen = o.pollen ?? 1
  return s
}

/* --- tube: a stem along a curve ------------------------------------------- */

/** `path(u)` gives the centre line, `radius(u)` its thickness. */
export function tube(scene, o) {
  const nu = o.nu ?? 10
  const nv = o.nv ?? 10
  const s = scene.surface(nu, nv, true)
  let n1 = null
  for (let i = 0; i < nu; i += 1) {
    const u = i / (nu - 1)
    const p = o.path(u)
    const q = o.path(Math.min(1, u + 0.01))
    const p0 = o.path(Math.max(0, u - 0.01))
    const T = norm(sub(q, p0))
    // parallel transport: keep the cross-section from spinning along the stem
    n1 = n1 ? norm(sub(n1, scale(T, dot(n1, T)))) : perp(T)[0]
    const n2 = cross(T, n1)
    const r = o.radius(u)
    for (let j = 0; j < nv; j += 1) {
      const th = (j / nv) * Math.PI * 2
      put(s, i, j, add(p, comb(n1, Math.cos(th) * r, n2, Math.sin(th) * r)))
    }
  }
  s.edges = o.capped ? EDGES_RIM : EDGES_TUBE
  s.shade = 0.8
  return s
}

/** A curve given by its turning: `ang(u)` from the horizontal direction `h`
 *  towards up, integrated from `origin` over `len`. Returns path(u). */
export function arc(origin, h, len, ang, steps = 48) {
  const pts = [origin]
  let p = origin
  for (let k = 1; k <= steps; k += 1) {
    const a = ang((k - 0.5) / steps)
    p = add(p, comb(h, (Math.cos(a) * len) / steps, UP, (Math.sin(a) * len) / steps))
    pts.push(p)
  }
  const path = (u) => {
    const f = clamp(u) * steps
    const k = Math.min(steps - 1, Math.floor(f))
    const t = f - k
    const a = pts[k]
    const b = pts[k + 1]
    return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]
  }
  return path
}

/** Points along a spine in the plane of `R` and `A` (like a petal's midline). */
export function spine(origin, A, R, len, ang, n = 10) {
  const pts = [origin]
  let p = origin
  for (let k = 1; k <= n; k += 1) {
    const a = ang((k - 0.5) / n)
    p = add(p, comb(R, (Math.cos(a) * len) / n, A, (Math.sin(a) * len) / n))
    pts.push(p)
  }
  return pts
}
