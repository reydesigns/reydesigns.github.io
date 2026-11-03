import {
  UP,
  VEINS_FINE,
  VEINS_LEAF,
  VEINS_PETAL,
  add,
  arc,
  around,
  at,
  bezier,
  bump,
  comb,
  cross,
  jitter,
  mix,
  norm,
  perp,
  petal,
  revolve,
  scale,
  smoothstep,
  spine,
  stage,
  tube,
} from './geometry'

/* ---------------------------------------------------------------------------
   The four plants. Each carries `count` flowers that bloom one by one, under
   the pointer: a spider lily's five florets, a bunch of three tulips, three
   orchid flowers down a spike, eight lily of the valley bells.

   `build(scene, b)` lays out every part, with `b[k]` the bloom of flower k
   (0 a closed bud, 1 fully open). Within a flower the bloom still runs part
   by part, outer whorls first: a tulip's outer tepals lean out before its
   inner ones, an orchid's sepals part before its petals and lip.

   A build must make the same parts in the same order whatever `b` is: the
   scene pools them by call order, and the pollen holds on to them by index.
--------------------------------------------------------------------------- */

const TAU = Math.PI * 2

/* --- widths: the outline of each kind of blade ---------------------------- */

const wTulip = (u) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.72)), 0.62) * mix(0.32, 1, smoothstep(0, 0.32, u))
const wStrap = (u) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.5)), 0.75) * mix(0.45, 1, smoothstep(0, 0.2, u))
const wSepal = (u) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.85)), 0.7) * mix(0.4, 1, smoothstep(0, 0.2, u))
const wWing = (u) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.78)), 0.42) * mix(0.18, 1, smoothstep(0, 0.42, u))
const wLeaf = (u) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.62)), 1.1) * mix(0.35, 1, smoothstep(0, 0.18, u))
const wBroad = (u) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.85)), 0.8) * mix(0.3, 1, smoothstep(0, 0.22, u))
/** The orchid's lip: two raised side lobes, a waist, a pointed mid-lobe. */
const wLip = (u) =>
  Math.max(0.16, 1.0 * bump(u, 0.28, 0.24), 0.62 * bump(u, 0.7, 0.22)) * mix(0.5, 1, smoothstep(0, 0.12, u)) *
  (1 - smoothstep(0.86, 1, u) * 0.9)

/* --- tulip: a bunch of three ---------------------------------------------- */

/** Where each tulip's head sits, which way it leans, and how big it is. */
const TULIPS = [
  { head: [0.05, 0, 0.4], lean: [0.04, 0, 0.12], size: 1 },
  { head: [-1.2, -0.3, -0.5], lean: [-0.3, 0, -0.16], size: 0.9 },
  { head: [1.15, -0.55, -0.7], lean: [0.28, 0, -0.2], size: 0.84 },
]
const TULIP_BASE = [0.02, -3.5, 0.06]

/** One tulip head, opening from `origin` along `axis`. */
function tulipHead(scene, origin, axis, o, size, seed) {
  const outer = stage(o, 0, 0.72)
  const inner = stage(o, 0.16, 0.84)
  const frame = perp(axis)
  const at3 = (r, R, h) => add(origin, comb(R, r * size, axis, h * size))

  // pistil, with its three-lobed stigma, and six stamens: seen once it opens
  tube(scene, { path: (u) => at3(0, axis, u * 0.36), radius: () => 0.07 * size, nu: 3, nv: 10, capped: true })
  for (let k = 0; k < 3; k += 1) {
    petal(scene, {
      origin: at3(0, axis, 0.36),
      axis,
      radial: around(axis, (k * TAU) / 3 + 0.4, frame),
      len: 0.14 * size,
      wid: 0.075 * size,
      ang: (u) => 0.7 - 1.4 * u,
      width: wSepal,
      cup: 0.4,
      nu: 5,
      nv: 6,
      veins: [],
      pollen: 0,
    })
  }
  for (let k = 0; k < 6; k += 1) {
    const R = around(axis, (k * TAU) / 6 + 0.1, frame)
    const pts = spine(at3(0.06, R, 0.02), axis, R, 0.34 * size, (u) => 1.35 - 0.35 * u, 4)
    scene.line(pts)
    const tip = pts[pts.length - 1]
    scene.line([add(tip, scale(axis, -0.02 * size)), add(tip, scale(axis, 0.08 * size))], { ww: 0.034 * size })
  }

  // three outer tepals, then three inner, overlapping like a real tulip
  for (let whorl = 0; whorl < 2; whorl += 1) {
    const t = whorl ? inner : outer
    for (let k = 0; k < 3; k += 1) {
      const phi = (k * TAU) / 3 + (whorl ? Math.PI / 3 : 0) + 0.2 + seed
      const lean = jitter(k + whorl * 3 + seed * 10) * 0.08
      const R = around(axis, phi, frame)
      petal(scene, {
        origin: at3(whorl ? 0.05 : 0.09, R, whorl ? 0.03 : 0),
        axis,
        radial: R,
        len: (whorl ? 1.18 : 1.28) * size,
        wid: (whorl ? 0.5 : 0.58) * size * mix(0.52, 1, t),
        ang: (u) => mix((whorl ? 1.2 : 1.05) + lean * 0.5, whorl ? 0.72 : 0.5 + lean, t) + mix(whorl ? 1.0 : 1.15, 0.52, t) * u,
        width: wTulip,
        cup: mix(0.6, 0.5, t),
        twist: (whorl ? -0.12 : 0.1) * t,
        veins: VEINS_PETAL,
      })
    }
  }
}

function tulip(scene, b) {
  const frame = perp(UP)
  // three long, arching, keeled leaves from the foot of the bunch
  for (let k = 0; k < 3; k += 1) {
    petal(scene, {
      origin: TULIP_BASE,
      axis: UP,
      radial: around(UP, [Math.PI + 0.55, 0.35, 2.3][k], frame),
      len: [2.85, 2.5, 2.3][k],
      wid: 0.36,
      ang: (u) => 1.42 - [1.5, 1.75, 1.6][k] * Math.pow(u, 1.35),
      width: wLeaf,
      cup: 0.6,
      twist: [-0.3, 0.35, 0.2][k],
      nu: 16,
      veins: VEINS_LEAF,
      pollen: 0,
    })
  }
  // a stem to each head, leaving the foot upright and curving into the head
  const axes = TULIPS.map((t) => norm(add(UP, t.lean)))
  TULIPS.forEach((t, k) => {
    const top = add(t.head, scale(axes[k], -0.04))
    const pull = add(top, scale(axes[k], -(top[1] - TULIP_BASE[1]) * 0.55))
    tube(scene, { path: bezier(TULIP_BASE, pull, top), radius: (u) => (0.05 + 0.012 * u) * t.size, nu: 10, nv: 8 })
  })
  TULIPS.forEach((t, k) => {
    scene.group(k)
    tulipHead(scene, t.head, axes[k], b[k], t.size, k * 0.7)
    scene.head(k, add(t.head, scale(axes[k], 0.6 * t.size)), 0.95 * t.size)
  })
  scene.group(-1)
}

/* --- spider lily (Lycoris radiata): an umbel of five florets --------------- */

const FLORETS = 5

function spiderLily(scene, b) {
  // a bare scape: the leaves come after the flowers
  tube(scene, {
    path: (u) => [0.12 * Math.sin(u * 2), -3.6 + u * 3.55, 0.06 * u],
    radius: (u) => 0.06 - 0.012 * u,
    nu: 8,
    nv: 10,
  })
  const head = [0, 0, 0]
  for (let k = 0; k < FLORETS; k += 1) {
    const f = b[k]
    const phi = (k * TAU) / FLORETS + 0.3 + (jitter(k) - 0.5) * 0.35
    const tilt = 1.2 + (jitter(k + 9) - 0.5) * 0.3
    const out = [Math.cos(phi), 0, Math.sin(phi)]
    const A = norm(comb(out, Math.sin(tilt), UP, Math.cos(tilt)))
    const base = add(head, comb(out, 0.6, UP, 0.1))
    scene.line([head, comb(out, 0.3, UP, 0.12), base])
    const frame = perp(A)
    scene.group(k)

    // six narrow, wavy tepals that sweep out and curl back
    for (let m = 0; m < 6; m += 1) {
      const psi = (m * TAU) / 6 + k * 0.5
      const j = jitter(k * 7 + m)
      petal(scene, {
        origin: base,
        axis: A,
        radial: around(A, psi, frame),
        len: mix(0.42, 1.02 + j * 0.14, f),
        wid: mix(0.1, 0.125, f),
        ang: (u) => mix(1.42, 0.7 + j * 0.15, f) + mix(0.12, -1.75 - j * 0.25, f) * Math.pow(u, 1.5),
        width: wStrap,
        cup: mix(0.7, 0.3, f),
        ruffle: { amp: 0.14 * f, freq: 2.4 + j, phase: 0.3 },
        twist: (j - 0.5) * 0.25 * f,
        nu: 14,
        nv: 6,
        veins: [{ j: 2.5, from: 0.05, to: 0.8, alpha: 0.4 }],
      })
    }

    // six long stamens and a style, arcing out and turning up at the tips
    for (let m = 0; m < 7; m += 1) {
      const psi = (m * TAU) / 7 + k * 0.5 + 0.2
      const j = jitter(k * 11 + m)
      const style = m === 6
      const len = mix(0.3, (style ? 1.95 : 1.62) + j * 0.2, f)
      const pts = spine(base, A, around(A, style ? psi + 0.4 : psi, frame), len, (u) => mix(1.5, 0.42 + j * 0.2 + 1.05 * u * u, f), 9)
      scene.line(pts)
      if (!style) scene.dot(pts[pts.length - 1], 0.022)
    }
    scene.head(k, add(base, scale(A, 0.3)), 0.75)
    scene.group(-1)
  }
}

/* --- orchid (Phalaenopsis): three flowers down an arching spike ------------ */

/** One flower: its centre `C`, the way its face looks `N0`, its size. */
function orchidFlower(scene, C, N0, size, o) {
  const sep = stage(o, 0, 0.7)
  const pet = stage(o, 0.12, 0.75)
  const lip = stage(o, 0.25, 0.75)
  const right = norm(cross(UP, N0))
  const up = norm(cross(N0, right))
  const dir = (phi) => norm(comb(right, Math.cos(phi), up, Math.sin(phi)))

  const blade = (phi, t, opts) =>
    petal(scene, {
      origin: add(C, scale(N0, (opts.lift ?? 0) * size)),
      axis: N0,
      radial: dir(phi),
      len: mix(0.42, opts.len, t) * size,
      wid: mix(opts.wid * 0.85, opts.wid, t) * size,
      ang: (u) => mix(0.95, opts.a0, t) + mix(1.7, opts.k1, t) * u,
      width: opts.width,
      cup: mix(1.15, opts.cup, t),
      twist: opts.twist ?? 0,
      veins: VEINS_FINE,
    })

  // three sepals behind, two broad petals, then the lip in front
  blade(Math.PI / 2, sep, { len: 1.02, wid: 0.3, a0: 0.12, k1: -0.32, width: wSepal, cup: 0.2 })
  blade(-Math.PI / 2 + 0.62, sep, { len: 0.98, wid: 0.29, a0: 0.1, k1: -0.3, width: wSepal, cup: 0.2, twist: 0.15 })
  blade(-Math.PI / 2 - 0.62, sep, { len: 0.98, wid: 0.29, a0: 0.1, k1: -0.3, width: wSepal, cup: 0.2, twist: -0.15 })
  blade(0.2, pet, { len: 1.1, wid: 0.64, a0: 0.2, k1: -0.36, width: wWing, cup: 0.12, lift: 0.02, twist: 0.12 })
  blade(Math.PI - 0.2, pet, { len: 1.1, wid: 0.64, a0: 0.2, k1: -0.36, width: wWing, cup: 0.12, lift: 0.02, twist: -0.12 })

  const lipS = petal(scene, {
    origin: add(C, scale(N0, 0.08 * size)),
    axis: N0,
    radial: dir(-Math.PI / 2),
    len: mix(0.25, 0.74, lip) * size,
    wid: mix(0.15, 0.4, lip) * size,
    ang: (u) => mix(1.2, 0.62, lip) - mix(0, 0.95, lip) * u,
    width: wLip,
    cup: (u) => mix(1.2, 1.55 * (1 - smoothstep(0.12, 0.55, u)) + 0.15, lip),
    nu: 13,
    nv: 8,
    veins: [{ j: 3.5, from: 0.05, to: 0.9, alpha: 0.35 }],
    spots: LIP_SPOTS,
  })
  // the two tendrils at the tip of the lip, and the callus at its throat
  const tip = at(lipS, lipS.nu - 1, 3)
  for (const side of [-1, 1]) {
    const pts = []
    for (let k = 0; k <= 6; k += 1) {
      const t = k / 6
      pts.push(add(tip, comb(right, side * 0.15 * t * lip * size, N0, 0.09 * t * t * lip * size, up, -0.05 * Math.sin(t * 2.4) * lip * size)))
    }
    scene.line(pts)
  }
  scene.dot(add(at(lipS, 2, 3), scale(N0, 0.03 * size)), 0.05 * lip * size, { ring: true })

  // the column, standing out of the middle
  tube(scene, {
    path: (u) => add(C, comb(N0, (0.04 + u * 0.24) * size, up, (0.06 + u * 0.02) * size)),
    radius: (u) => (0.065 - 0.015 * u) * size,
    nu: 4,
    nv: 10,
    capped: true,
  })
}

/** Along the spike, the size, and the way each flower faces. */
const ORCHIDS = [
  { s: 0.48, size: 1, face: [0.02, 0.78, 0.62], drop: [0, -0.22, 0.5] },
  { s: 0.66, size: 0.84, face: [0.2, 0.8, 0.56], drop: [0.05, -0.24, 0.42] },
  { s: 0.81, size: 0.7, face: [0.36, 0.78, 0.5], drop: [0.08, -0.22, 0.34] },
]

function orchid(scene, b) {
  // two broad leaves at the foot, and the spike arching up and over
  for (let k = 0; k < 2; k += 1) {
    petal(scene, {
      origin: [-0.85, -2.75, -0.5],
      axis: UP,
      radial: norm(k ? [1, 0, 0.55] : [-1, 0, 0.35]),
      len: k ? 2.2 : 1.9,
      wid: 0.62,
      ang: (u) => 0.55 - 0.85 * u,
      width: wBroad,
      cup: 0.32,
      twist: k ? 0.2 : -0.2,
      nu: 14,
      veins: VEINS_LEAF,
      pollen: 0,
    })
  }
  const spike = arc([-0.95, -2.75, -0.55], norm([1, 0, 0.22]), 5.8, (u) => 1.42 - 1.95 * Math.pow(u, 1.4))
  tube(scene, { path: spike, radius: (u) => 0.048 - 0.016 * u, nu: 16, nv: 10 })
  // two buds still closed at the tip
  for (let k = 0; k < 2; k += 1) {
    const size = k ? 0.12 : 0.17
    revolve(scene, {
      origin: spike(k ? 0.99 : 0.92),
      axis: norm([0.4, -1, 0.3]),
      len: size * Math.PI,
      ang: (u) => -0.15 + Math.PI * 1.05 * u,
      nu: 8,
      nv: 14,
      pollen: 0.3,
    })
  }
  ORCHIDS.forEach((f, k) => {
    const node = spike(f.s)
    const C = add(node, scale(f.drop, f.size))
    const N0 = norm(f.face)
    scene.line([node, add(node, scale(f.drop, 0.5 * f.size)), add(C, scale(N0, -0.12 * f.size))])
    scene.group(k)
    orchidFlower(scene, C, N0, f.size, b[k])
    scene.head(k, C, 1.0 * f.size)
    scene.group(-1)
  })
}

/** Freckles in the lip's throat: [i, j, fu, fv, r], r in world units (specks, so never scaled). */
const LIP_SPOTS = [
  [3, 2, 0.4, 0.6, 0.016],
  [3, 4, 0.3, 0.3, 0.014],
  [4, 3, 0.6, 0.5, 0.018],
  [5, 2, 0.2, 0.7, 0.012],
  [5, 4, 0.5, 0.2, 0.015],
  [6, 3, 0.4, 0.4, 0.013],
  [7, 3, 0.7, 0.6, 0.011],
  [2, 3, 0.5, 0.5, 0.012],
].map(([i, j, fu, fv, r]) => ({ i, j, fu, fv, r }))

/* --- lily of the valley (Convallaria majalis): eight bells ---------------- */

const BELLS = 8

function lilyOfTheValley(scene, b) {
  const frame = perp(UP)
  // two broad leaves sheathing the stem
  for (let k = 0; k < 2; k += 1) {
    petal(scene, {
      origin: [0, -2.9, 0],
      axis: UP,
      radial: around(UP, k ? Math.PI / 2 + 0.6 : -Math.PI / 2 - 0.5, frame),
      len: k ? 2.45 : 2.2,
      wid: 0.56,
      ang: (u) => 1.22 - (k ? 1.0 : 1.15) * Math.pow(u, 1.25),
      width: wBroad,
      cup: 0.72,
      twist: k ? -0.25 : 0.3,
      nu: 16,
      veins: VEINS_LEAF,
      pollen: 0,
    })
  }

  // the raceme: up out of the leaves, then arching over
  const h = norm([1, 0, 0.32])
  const side = norm(cross(h, UP))
  const stem = arc([0.02, -2.9, 0.02], h, 4.5, (u) => 1.5 - 1.95 * Math.pow(u, 1.5))
  tube(scene, { path: stem, radius: (u) => 0.042 - 0.018 * u, nu: 16, nv: 8 })

  for (let k = 0; k < BELLS; k += 1) {
    const s = mix(0.36, 0.97, k / (BELLS - 1))
    const p = stem(s)
    const size = mix(1, 0.5, Math.pow(k / (BELLS - 1), 1.2))
    const f = b[k]
    const sd = k % 2 ? 1 : -1
    const out = norm(comb(side, sd, h, 0.25))
    const end = add(p, comb(out, 0.22 * size, UP, -0.16 * size))
    scene.line([p, add(p, comb(out, 0.14 * size, UP, 0.02)), end])
    const axis = norm(comb(UP, -1, out, 0.35 + 0.25 * f))
    const r = 0.21 * size
    scene.group(k)
    revolve(scene, {
      origin: end,
      axis,
      len: mix(Math.PI * r * 0.98, r * 2.9, f),
      ang: (u) =>
        mix(-0.08 + Math.PI * u, 0.02 + 1.42 * smoothstep(0, 0.46, u) - 2.15 * Math.pow(smoothstep(0.66, 1, u), 1.15), f),
      lobes: 6,
      lobeDepth: 0.16 * f,
      lobePhase: k * 0.3,
      nu: 12,
      nv: 24,
      veins: BELL_RIBS,
      pollen: 1,
    })
    scene.head(k, add(end, scale(axis, 0.3 * size)), 0.42 * size)
    scene.group(-1)
  }
}

/** Faint ribs down the middle of each of a bell's six lobes. */
const BELL_RIBS = [0, 4, 8, 12, 16, 20].map((j) => ({ j: j + 0.5, from: 0.3, to: 0.92, alpha: 0.18 }))

/* --- the catalogue ------------------------------------------------------- */

/**
 * `count`: how many flowers bloom one by one. `camera`: `pitch` is how far
 * above the horizon the eye is (radians, π/2 is straight down), `yaw` turns
 * the plant, `dist` is in world units. The view is framed to the plant in
 * full bloom, so it never outgrows its box.
 */
export const SPECIES = [
  {
    key: 'spider-lily',
    name: 'Spider Lily',
    latin: 'Lycoris radiata',
    count: FLORETS,
    build: spiderLily,
    camera: { pitch: 1.1, yaw: 0.2, dist: 12 },
  },
  {
    key: 'tulip',
    name: 'Tulip',
    latin: 'Tulipa gesneriana',
    count: TULIPS.length,
    build: tulip,
    camera: { pitch: 1.05, yaw: -0.35, dist: 12 },
  },
  {
    key: 'orchid',
    name: 'Orchid',
    latin: 'Phalaenopsis amabilis',
    count: ORCHIDS.length,
    build: orchid,
    camera: { pitch: 0.82, yaw: 0.1, dist: 12 },
  },
  {
    key: 'lily-of-the-valley',
    name: 'Lily of the Valley',
    latin: 'Convallaria majalis',
    count: BELLS,
    build: lilyOfTheValley,
    camera: { pitch: 0.86, yaw: 0.05, dist: 12 },
  },
]

export const speciesByKey = (key) => SPECIES.find((s) => s.key === key) ?? SPECIES[0]
