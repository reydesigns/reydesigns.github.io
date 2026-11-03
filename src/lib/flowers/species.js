import {
  UP,
  VEINS_FINE,
  VEINS_LEAF,
  VEINS_PETAL,
  add,
  arc,
  around,
  at,
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
   The four flowers. Each is a `build(scene, o)` that lays out every part for
   a bloom `o` (0 a closed bud, 1 fully open) and a camera that looks down on
   it from above and a little to the side.

   Every part has a closed pose and an open pose, and the bloom eases between
   them part by part, outer whorls first: a tulip's outer tepals lean out
   before the inner ones, a spider lily's florets open one after another,
   lily of the valley's bells open from the bottom of the stem up.

   A build must make the same parts in the same order whatever `o` is: the
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

/* --- tulip --------------------------------------------------------------- */

function tulip(scene, o) {
  const outer = stage(o, 0, 0.72)
  const inner = stage(o, 0.16, 0.84)
  const frame = perp(UP)

  // stem and two long, arching, keeled leaves
  tube(scene, {
    path: (u) => [0.16 * u * u, -0.06 - 3.2 * u, 0.1 * u],
    radius: (u) => 0.055 + 0.012 * u,
    nu: 8,
    nv: 10,
  })
  for (let k = 0; k < 2; k += 1) {
    const phi = k ? 0.35 : Math.PI + 0.55
    petal(scene, {
      origin: [0.14, -3.05, 0.08],
      axis: UP,
      radial: around(UP, phi, frame),
      len: k ? 2.5 : 2.85,
      wid: 0.36,
      ang: (u) => 1.42 - (k ? 1.75 : 1.5) * Math.pow(u, 1.35),
      width: wLeaf,
      cup: 0.6,
      twist: k ? 0.35 : -0.3,
      nu: 16,
      veins: VEINS_LEAF,
      pollen: 0,
    })
  }

  // pistil and six stamens, seen in the cup once it opens
  tube(scene, { path: (u) => [0, u * 0.36, 0], radius: () => 0.07, nu: 3, nv: 10, capped: true })
  for (let k = 0; k < 3; k += 1) {
    petal(scene, {
      origin: [0, 0.36, 0],
      axis: UP,
      radial: around(UP, (k * TAU) / 3 + 0.4, frame),
      len: 0.14,
      wid: 0.075,
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
    const R = around(UP, (k * TAU) / 6 + 0.1, frame)
    const pts = spine(comb(R, 0.06, UP, 0.02), UP, R, 0.34, (u) => 1.35 - 0.35 * u, 4)
    scene.line(pts, { w: 1 })
    const tip = pts[pts.length - 1]
    scene.line([add(tip, [0, -0.02, 0]), add(tip, [0, 0.08, 0])], { ww: 0.032, alpha: 0.85 })
  }

  // three outer tepals, then three inner, overlapping like a real tulip
  for (let whorl = 0; whorl < 2; whorl += 1) {
    const t = whorl ? inner : outer
    for (let k = 0; k < 3; k += 1) {
      const phi = (k * TAU) / 3 + (whorl ? Math.PI / 3 : 0) + 0.2
      const lean = jitter(k + whorl * 3) * 0.08
      petal(scene, {
        origin: comb(around(UP, phi, frame), whorl ? 0.05 : 0.09, UP, whorl ? 0.03 : 0),
        axis: UP,
        radial: around(UP, phi, frame),
        len: whorl ? 1.18 : 1.28,
        wid: (whorl ? 0.5 : 0.58) * mix(0.52, 1, t),
        ang: (u) => mix((whorl ? 1.2 : 1.05) + lean * 0.5, whorl ? 0.72 : 0.5 + lean, t) + mix(whorl ? 1.0 : 1.15, 0.52, t) * u,
        width: wTulip,
        cup: mix(0.6, 0.5, t),
        twist: (whorl ? -0.12 : 0.1) * t,
        veins: VEINS_PETAL,
      })
    }
  }
}

/* --- spider lily (Lycoris radiata) --------------------------------------- */

const FLORETS = 5

function spiderLily(scene, o) {
  // a bare scape: the leaves come after the flowers
  tube(scene, {
    path: (u) => [0.12 * Math.sin(u * 2), -3.6 + u * 3.55, 0.06 * u],
    radius: (u) => 0.06 - 0.012 * u,
    nu: 8,
    nv: 10,
  })
  const head = [0, 0, 0]
  for (let k = 0; k < FLORETS; k += 1) {
    const f = stage(o, (k % 3) * 0.1 + (k > 2 ? 0.05 : 0), 0.7)
    const phi = (k * TAU) / FLORETS + 0.3 + (jitter(k) - 0.5) * 0.35
    const tilt = 1.2 + (jitter(k + 9) - 0.5) * 0.3
    const out = [Math.cos(phi), 0, Math.sin(phi)]
    const A = norm(comb(out, Math.sin(tilt), UP, Math.cos(tilt)))
    const base = add(head, comb(out, 0.6, UP, 0.1))
    scene.line([head, comb(out, 0.3, UP, 0.12), base], { w: 1.1 })
    const frame = perp(A)

    // six narrow, wavy tepals that sweep out and curl right back
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
      scene.line(pts, { w: style ? 0.9 : 1 })
      if (!style) scene.dot(pts[pts.length - 1], 0.02)
    }
  }
}

/* --- orchid (Phalaenopsis) ----------------------------------------------- */

function orchid(scene, o) {
  const sep = stage(o, 0, 0.7)
  const pet = stage(o, 0.12, 0.75)
  const lip = stage(o, 0.25, 0.75)

  // the face of the flower looks up, and a little towards us
  const N0 = norm([0.05, 0.78, 0.62])
  const right = norm(cross(UP, N0))
  const up = norm(cross(N0, right))
  const C = [0, 0, 0]
  const dir = (phi) => norm(comb(right, Math.cos(phi), up, Math.sin(phi)))

  // two broad leaves at the foot, the arching spike, and buds at its tip
  for (let k = 0; k < 2; k += 1) {
    petal(scene, {
      origin: [-0.35, -2.75, -0.5],
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
  const spike = arc([-0.45, -2.75, -0.55], norm([1, 0, 0.2]), 4.6, (u) => 1.42 - 1.85 * Math.pow(u, 1.5))
  tube(scene, { path: spike, radius: (u) => 0.048 - 0.014 * u, nu: 14, nv: 10 })
  const node = spike(0.62)
  scene.line([node, comb(node, 0.6, C, 0.4), add(C, scale(N0, -0.12))], { w: 1.2 })
  for (let k = 0; k < 2; k += 1) {
    const p = spike(k ? 0.98 : 0.84)
    const size = k ? 0.13 : 0.19
    const hang = norm([0.4, -1, 0.3])
    revolve(scene, {
      origin: p,
      axis: hang,
      len: size * Math.PI,
      ang: (u) => -0.15 + Math.PI * 1.05 * u,
      nu: 8,
      nv: 14,
      pollen: 0.3,
    })
  }

  const blade = (phi, t, opts) =>
    petal(scene, {
      origin: add(C, scale(N0, opts.lift ?? 0)),
      axis: N0,
      radial: dir(phi),
      len: mix(0.42, opts.len, t),
      wid: mix(opts.wid * 0.85, opts.wid, t),
      ang: (u) => mix(0.95, opts.a0, t) + mix(1.7, opts.k1, t) * u,
      width: opts.width,
      cup: mix(1.15, opts.cup, t),
      twist: opts.twist ?? 0,
      veins: VEINS_FINE,
      spots: opts.spots,
    })

  // three sepals behind, two broad petals, then the lip in front
  blade(Math.PI / 2, sep, { len: 1.02, wid: 0.3, a0: 0.12, k1: -0.32, width: wSepal, cup: 0.2 })
  blade(-Math.PI / 2 + 0.62, sep, { len: 0.98, wid: 0.29, a0: 0.1, k1: -0.3, width: wSepal, cup: 0.2, twist: 0.15 })
  blade(-Math.PI / 2 - 0.62, sep, { len: 0.98, wid: 0.29, a0: 0.1, k1: -0.3, width: wSepal, cup: 0.2, twist: -0.15 })
  blade(0.2, pet, { len: 1.1, wid: 0.64, a0: 0.2, k1: -0.36, width: wWing, cup: 0.12, lift: 0.02, twist: 0.12 })
  blade(Math.PI - 0.2, pet, { len: 1.1, wid: 0.64, a0: 0.2, k1: -0.36, width: wWing, cup: 0.12, lift: 0.02, twist: -0.12 })

  const lipS = petal(scene, {
    origin: add(C, scale(N0, 0.08)),
    axis: N0,
    radial: dir(-Math.PI / 2),
    len: mix(0.25, 0.74, lip),
    wid: mix(0.15, 0.4, lip),
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
      pts.push(add(tip, comb(right, side * 0.15 * t * lip, N0, 0.09 * t * t * lip, up, -0.05 * Math.sin(t * 2.4) * lip)))
    }
    scene.line(pts, { w: 1 })
  }
  scene.dot(add(at(lipS, 2, 3), scale(N0, 0.03)), 0.05 * lip, { fill: 'paper', ring: true })

  // the column, standing out of the middle
  tube(scene, {
    path: (u) => add(C, comb(N0, 0.04 + u * 0.24, up, 0.06 + u * 0.02)),
    radius: (u) => 0.065 - 0.015 * u,
    nu: 4,
    nv: 10,
    capped: true,
  })
}

/** Freckles in the lip's throat: [i, j, fu, fv, r]. */
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

/* --- lily of the valley (Convallaria majalis) ---------------------------- */

const BELLS = 8

function lilyOfTheValley(scene, o) {
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
    const size = mix(1, 0.42, Math.pow(k / (BELLS - 1), 1.2))
    // the last two never open: buds at the tip
    const f = k >= BELLS - 2 ? 0.12 * stage(o, 0.5, 0.5) : stage(o, k * 0.07, 0.6)
    const sd = k % 2 ? 1 : -1
    const out = norm(comb(side, sd, h, 0.25))
    const end = add(p, comb(out, 0.22 * size, UP, -0.16 * size))
    scene.line([p, add(p, comb(out, 0.14 * size, UP, 0.02)), end], { w: 1 })
    const axis = norm(comb(UP, -1, out, 0.35 + 0.25 * f))
    const r = 0.21 * size
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
      veins: f > 0.2 ? BELL_RIBS : null,
      pollen: f,
    })
  }
}

/** Faint ribs down the middle of each of a bell's six lobes. */
const BELL_RIBS = [0, 4, 8, 12, 16, 20].map((j) => ({ j: j + 0.5, from: 0.3, to: 0.92, alpha: 0.18 }))

/* --- the catalogue ------------------------------------------------------- */

/**
 * `camera`: `pitch` is how far above the horizon the eye is (radians, π/2 is
 * straight down), `yaw` turns the flower, `dist` is in world units. The view
 * is framed to the flower's full bloom, so it never outgrows its box.
 */
export const SPECIES = [
  {
    key: 'spider-lily',
    name: 'Spider Lily',
    latin: 'Lycoris radiata',
    build: spiderLily,
    camera: { pitch: 1.1, yaw: 0.2, dist: 12 },
  },
  {
    key: 'tulip',
    name: 'Tulip',
    latin: 'Tulipa gesneriana',
    build: tulip,
    camera: { pitch: 1.1, yaw: -0.35, dist: 12 },
  },
  {
    key: 'orchid',
    name: 'Orchid',
    latin: 'Phalaenopsis amabilis',
    build: orchid,
    camera: { pitch: 0.78, yaw: 0.1, dist: 12 },
  },
  {
    key: 'lily-of-the-valley',
    name: 'Lily of the Valley',
    latin: 'Convallaria majalis',
    build: lilyOfTheValley,
    camera: { pitch: 0.86, yaw: 0.05, dist: 12 },
  },
]

export const speciesByKey = (key) => SPECIES.find((s) => s.key === key) ?? SPECIES[0]
