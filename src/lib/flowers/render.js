import { Scene, clamp, mix, smooth } from './geometry'
import { speciesByKey } from './species'

/* ---------------------------------------------------------------------------
   Paints a plant from species.js onto a 2D canvas as a faint bitmap line
   drawing on a dark ground, covered in glitching binary digits, glowing where
   it blooms.

   Each frame:
     1. every flower's bloom moves towards where it should be: open while the
        pointer is on it (and for a moment after), or while it has been tapped
        open; otherwise back to its resting bud;
     2. the plant is rebuilt for those blooms (Scene pools its parts) and
        projected through a perspective camera that sways a little and leans
        after the pointer;
     3. the drawing: every quad, stamen segment and anther goes into one list,
        sorted far to near, and is painted in that order onto a small bitmap
        (one pixel to every two or three of the screen's): the quad filled
        with the ground, to hide what is behind it, then its outline (free
        edges, and a silhouette wherever the surface folds away from the eye)
        and its veins. Every other pixel of the bitmap is knocked back, a
        checker dither, and it is scaled up without smoothing: a faint
        pixel-textured line;
     4. the digits, on a grid fixed to the canvas: every cell the plant covers
        (petals, stem, leaves) can hold a 0 or a 1, and at an uneven beat the
        grid glitches: runs of digits are written in along a row, others are
        deleted, some flip, and now and then a row slips a cell sideways. An
        open flower holds more digits, brighter. Each digit clears its own
        gap in the line beneath. A second grid, offset half a cell, holds
        fainter digits where the plant turns from the light, overlapping the
        first like a shadow;
     5. the glow: the outlines and digits of the flowers that are opening are
        drawn again onto two small canvases, scaled up soft, and added on
        top, so a bloom lights up.

   No WebGL: a few thousand small paths a frame on a small bitmap, a few
   thousand tiny glyphs, and three scaled copies.
--------------------------------------------------------------------------- */

const OPEN_S = 1.5 // seconds for a bud to open fully
const CLOSE_S = 1.1 // and to close again
const LINGER_S = 1.4 // a flower stays open this long after the pointer leaves it
const STAGGER_S = 0.16 // between flowers when they open or close together

const LINE_BITS = 0.9 // the outline, in bitmap pixels
const LINE_A = 0.8 // and its strength, before the dither
const DITHER = 0.5 // how far every other bitmap pixel is knocked back

const BEAT = [0.05, 0.12] // seconds between glitches, at random within
const DENSITY = 0.5 // share of the plant's cells holding a digit, in bud
const DENSITY_BLOOM = 0.35 // more, in full bloom
const DIGIT_A = 0.38 // a digit's strength, in bud
const DIGIT_A_BLOOM = 0.45 // more, in full bloom
const SHADOW_A = 0.2 // the shadow digits, in the deepest shade
const SHADE_FROM = 0.56 // how turned from the light a cell must be to take a shadow digit
const GLOW = 0.55 // the glow's strength at full bloom

/** Light from the upper left, a little in front. */
const LIGHT = (() => {
  const l = [-0.45, 0.8, 0.4]
  const n = Math.hypot(...l)
  return l.map((x) => x / n)
})()

/** '#rgb', '#rrggbb' or 'rgb(a)(r, g, b…)' → [r, g, b]. */
export function parseColor(str, fallback = [255, 255, 255]) {
  const s = String(str ?? '').trim()
  if (s.startsWith('#')) {
    const h = s.slice(1)
    const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16)
    return Number.isNaN(n) ? fallback : [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const m = s.match(/rgba?\(([^)]+)\)/)
  if (!m) return fallback
  const [r, g, b, a] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
  // a transparent background has nothing to paint with
  if (a === 0) return fallback
  return [r, g, b]
}

const offscreen = () => document.createElement('canvas')

export function createFlowerView(canvas, opts = {}) {
  const ctx = canvas.getContext('2d')
  // the bitmap the drawing is made on, and the two soft layers of glow
  const bits = offscreen()
  const bctx = bits.getContext('2d')
  const glow1 = offscreen()
  const g1 = glow1.getContext('2d')
  const glow2 = offscreen()
  const g2 = glow2.getContext('2d')
  // the dither: a 2 x 2 checker, one pixel of it solid
  const checker = (() => {
    const c = offscreen()
    c.width = 2
    c.height = 2
    const x = c.getContext('2d')
    x.fillStyle = '#000'
    x.fillRect(0, 0, 1, 1)
    x.fillRect(1, 1, 1, 1)
    return bctx.createPattern(c, 'repeat')
  })()

  const scene = new Scene()
  let species = speciesByKey(opts.species)
  let ink = parseColor(opts.color, [180, 86, 106])
  let paper = parseColor(opts.paper, [28, 20, 17])
  let inkCss = ''
  let paperCss = ''
  const setInk = () => {
    inkCss = `rgb(${ink[0]},${ink[1]},${ink[2]})`
    paperCss = `rgb(${paper[0]},${paper[1]},${paper[2]})`
  }
  setInk()
  const inkA = (a) => `rgba(${ink[0]},${ink[1]},${ink[2]},${a})`

  // view state
  let w = 0
  let h = 0
  let dpr = 1
  let pxd = 2 // screen pixels to a bitmap pixel
  let px = 1 // CSS pixels to a bitmap pixel
  let fit = null // { F, ox, oy } for the current species and size
  let reduced = Boolean(opts.reduced)
  let rest = opts.rest ?? 0 // how open a flower is when nothing is asking it to bloom
  let lean = [0, 0] // pointer parallax, -1..1
  let leanTo = [0, 0]
  let pointer = null // [x, y] over the canvas, CSS pixels
  let time = 0
  let raf = 0
  let last = 0
  let running = false
  let openCount = -1
  const framing = opts.framing ?? 0.86
  const sway = opts.sway ?? 1
  const onOpen = opts.onOpen

  // one entry per flower
  let prog // bloom progress, linear in time
  let blooms // eased, what the build sees
  let pinned // tapped (or switched) open
  let hoverUntil // open until this time, for the pointer
  let pinAt // a pending change to `pinned`, and when
  let pinTo
  let heads // [x, y, r] on screen, for finding the flower under the pointer
  const resetFlowers = () => {
    const n = species.count
    prog = new Float32Array(n).fill(rest)
    blooms = new Float32Array(n)
    pinned = new Uint8Array(n)
    hoverUntil = new Float64Array(n)
    pinAt = new Float64Array(n)
    pinTo = new Uint8Array(n)
    heads = new Float32Array(n * 3)
    openCount = -1
  }
  resetFlowers()

  // camera, recomputed each frame
  const cam = { F: 1, ox: 0, oy: 0, dist: 12, cy: 1, sy: 0, cp: 1, sp: 0, ex: 0, ey: 0, ez: 0 }
  const setCamera = (yaw, pitch) => {
    cam.cy = Math.cos(yaw)
    cam.sy = Math.sin(yaw)
    cam.cp = Math.cos(pitch)
    cam.sp = Math.sin(pitch)
    // the eye, in world space, for facing tests (the camera looks at the origin)
    cam.ex = cam.dist * cam.cp * cam.sy
    cam.ey = cam.dist * cam.sp
    cam.ez = cam.dist * cam.cp * cam.cy
  }
  /** World → screen x, y and depth, into out.sx/sy/sd[k]. */
  const project = (x, y, z, out, k) => {
    const x1 = x * cam.cy - z * cam.sy
    const z1 = x * cam.sy + z * cam.cy
    const up = y * cam.cp - z1 * cam.sp
    const d = cam.dist - (y * cam.sp + z1 * cam.cp)
    const s = cam.F / d
    out.sx[k] = cam.ox + x1 * s
    out.sy[k] = cam.oy - up * s
    out.sd[k] = d
  }
  const proj1 = { sx: [0], sy: [0], sd: [0] }
  const projectPoint = (p) => {
    project(p[0], p[1], p[2], proj1, 0)
    return [proj1.sx[0], proj1.sy[0], proj1.sd[0]]
  }

  /* --- framing: fit the plant, in bud and in full bloom, into the canvas -- */

  function frame() {
    if (!w || !h) return
    const c = species.camera
    cam.dist = c.dist
    cam.F = 1
    cam.ox = 0
    cam.oy = 0
    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    const grow = (x, y) => {
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      y0 = Math.min(y0, y)
      y1 = Math.max(y1, y)
    }
    // with `focus`, only the flowers count: the stem and leaves may run out
    const counts = (part) => !c.focus || part.group >= 0
    for (const o of [0, 1]) {
      scene.begin()
      species.build(scene, new Float32Array(species.count).fill(o))
      // the camera at both ends of its sway
      for (const yaw of [c.yaw - 0.12 * sway, c.yaw + 0.12 * sway]) {
        setCamera(yaw, c.pitch)
        for (let n = 0; n < scene.ns; n += 1) {
          const s = scene.surfaces[n]
          if (!counts(s)) continue
          const P = s.P
          for (let k = 0; k < s.nu * s.nv; k += 1) {
            project(P[k * 3], P[k * 3 + 1], P[k * 3 + 2], s, k)
            grow(s.sx[k], s.sy[k])
          }
        }
        for (let n = 0; n < scene.nl; n += 1) {
          const l = scene.lines[n]
          if (!counts(l)) continue
          for (const p of l.points) {
            const q = projectPoint(p)
            grow(q[0], q[1])
          }
        }
      }
    }
    const F = Math.min((w * framing) / (x1 - x0), (h * framing) / (y1 - y0))
    fit = { F, ox: w / 2 - ((x0 + x1) / 2) * F, oy: h / 2 - ((y0 + y1) / 2) * F }
  }

  /** The flower whose head is nearest (x, y), if (x, y) is on it; else -1. */
  function flowerAt(x, y) {
    let best = -1
    let score = 1
    for (let k = 0; k < species.count; k += 1) {
      const r = heads[k * 3 + 2]
      if (!r) continue
      const d = Math.hypot(x - heads[k * 3], y - heads[k * 3 + 1]) / r
      if (d < score) {
        score = d
        best = k
      }
    }
    return best
  }

  /* --- the grid ----------------------------------------------------------- */

  let font = 9 // the digits' size, CSS pixels
  let cw = 8 // a cell, across and down
  let ch = 11
  let cols = 0
  let rows = 0
  let cover = new Int32Array(0) // the frame the plant last covered each cell
  let cellZ = new Float32Array(0) // the nearest surface there: its depth,
  let cellG = new Int8Array(0) // which flower it belongs to (-1: stem or leaf),
  let cellD = new Float32Array(0) // and how turned from the light it is
  let digit = new Int8Array(0) // -1, or the 0 / 1 in the cell
  let born = new Float32Array(0) // when it was written, for its flash
  let shade = new Int8Array(0) // the shadow digit, offset half a cell
  const covered = [] // the cells the plant covers this frame
  let frameNo = 1
  let nextBeat = 0
  let slipRow = -1 // a row slipped sideways for a moment
  let slipBy = 0
  let slipUntil = 0

  function layout() {
    dpr = Math.min(2, window.devicePixelRatio || 1)
    pxd = dpr >= 2 ? 3 : 2
    px = pxd / dpr
    bits.width = Math.max(1, Math.ceil(canvas.width / pxd))
    bits.height = Math.max(1, Math.ceil(canvas.height / pxd))
    glow1.width = Math.max(1, Math.ceil(w / 3))
    glow1.height = Math.max(1, Math.ceil(h / 3))
    glow2.width = Math.max(1, Math.ceil(w / 8))
    glow2.height = Math.max(1, Math.ceil(h / 8))

    // tiny digits, many of them: the grid snapped to device pixels so each
    // glyph lands crisp. A 1x screen cannot draw a digit in under five or so
    // pixels, so there they stay a touch bigger
    font = dpr >= 1.5 ? clamp(Math.min(w, h) / 150, 3.5, 4.5) : clamp(Math.min(w, h) / 110, 5.5, 6)
    const snap = (v) => Math.max(1, Math.round(v * dpr)) / dpr
    cw = snap(font * 0.92)
    ch = snap(font * 1.2)
    cols = Math.ceil(w / cw) + 1
    rows = Math.ceil(h / ch) + 1
    const n = cols * rows
    cover = new Int32Array(n)
    cellZ = new Float32Array(n)
    cellG = new Int8Array(n)
    cellD = new Float32Array(n)
    digit = new Int8Array(n).fill(-1)
    born = new Float32Array(n)
    shade = new Int8Array(n).fill(-1)
  }

  /** The plant covers the point (x, y): mark its cell, keeping the nearest surface. */
  function touch(x, y, depth, group, dark) {
    const c = Math.floor(x / cw)
    const r = Math.floor(y / ch)
    if (c < 0 || r < 0 || c >= cols || r >= rows) return
    const i = r * cols + c
    if (cover[i] !== frameNo) {
      cover[i] = frameNo
      covered.push(i)
      cellZ[i] = Infinity
    }
    if (depth < cellZ[i]) {
      cellZ[i] = depth
      cellG[i] = group
      cellD[i] = dark
    }
  }

  /* --- one frame --------------------------------------------------------- */

  const items = []
  let itemCount = 0
  const item = () => {
    let it = items[itemCount]
    if (!it) it = items[itemCount] = { d: 0, kind: 0, s: null, q: 0, i: 0, j: 0, a: null, b: null, l: null }
    itemCount += 1
    return it
  }
  const order = []
  const byDepth = (a, b) => b.d - a.d
  // the outlines of opening flowers, to glow: x0, y0, x1, y1, strength
  let glowSegs = new Float32Array(4096 * 5)
  let glowCount = 0
  const glowSeg = (x0, y0, x1, y1, a) => {
    if (glowCount * 5 + 5 > glowSegs.length) {
      const more = new Float32Array(glowSegs.length * 2)
      more.set(glowSegs)
      glowSegs = more
    }
    const k = glowCount * 5
    glowSegs[k] = x0
    glowSegs[k + 1] = y0
    glowSegs[k + 2] = x1
    glowSegs[k + 3] = y1
    glowSegs[k + 4] = a
    glowCount += 1
  }
  let reseed = true // reduced motion: lay the still digits out again

  function bloomStep(elapsed) {
    let open = 0
    for (let k = 0; k < species.count; k += 1) {
      if (pinAt[k] && time >= pinAt[k]) {
        pinned[k] = pinTo[k]
        pinAt[k] = 0
      }
      const want = pinned[k] || time < hoverUntil[k] ? 1 : rest
      if (want === 1) open += 1
      const p = prog[k]
      // by the clock, not by frames: a slow frame still finds the bloom where it should be
      if (reduced) {
        if (p !== want) reseed = true
        prog[k] = want
      } else if (p < want) prog[k] = Math.min(want, p + elapsed / OPEN_S)
      else if (p > want) prog[k] = Math.max(want, p - elapsed / CLOSE_S)
      blooms[k] = smooth(prog[k])
    }
    if (open !== openCount) {
      openCount = open
      onOpen?.(open, species.count)
    }
  }

  function draw(dt, elapsed = dt) {
    if (!fit) frame()
    if (!fit) return
    const c = species.camera
    bloomStep(elapsed)
    frameNo += 1
    covered.length = 0
    glowCount = 0

    // camera: a slow sway, and a lean after the pointer
    if (!reduced) {
      lean[0] += (leanTo[0] - lean[0]) * Math.min(1, dt * 3)
      lean[1] += (leanTo[1] - lean[1]) * Math.min(1, dt * 3)
    }
    const swayNow = reduced ? 0 : Math.sin(time * 0.35) * 0.07 * sway
    cam.dist = c.dist
    cam.F = fit.F
    cam.ox = fit.ox
    cam.oy = fit.oy
    setCamera(c.yaw + swayNow + lean[0] * 0.12 * sway, c.pitch - lean[1] * 0.06 * sway)

    scene.begin()
    species.build(scene, blooms)

    // where each flower is on screen now, and whether the pointer is on one
    for (let k = 0; k < species.count; k += 1) {
      const hd = scene.heads[k]
      if (!hd) continue
      const p = projectPoint(hd.p)
      heads[k * 3] = p[0]
      heads[k * 3 + 1] = p[1]
      heads[k * 3 + 2] = (hd.r * cam.F) / p[2]
    }
    if (pointer) {
      const k = flowerAt(pointer[0], pointer[1])
      if (k >= 0) hoverUntil[k] = time + LINGER_S
    }

    itemCount = 0
    // surfaces: project, then one item per quad, and mark the cells it covers
    for (let n = 0; n < scene.ns; n += 1) {
      const s = scene.surfaces[n]
      const { nu, nv, P } = s
      for (let k = 0; k < nu * nv; k += 1) project(P[k * 3], P[k * 3 + 1], P[k * 3 + 2], s, k)
      const qc = s.closed ? nv : nv - 1
      for (let i = 0; i < nu - 1; i += 1) {
        for (let j = 0; j < qc; j += 1) {
          const j1 = (j + 1) % nv
          const a = i * nv + j
          const b = (i + 1) * nv + j
          const cc = (i + 1) * nv + j1
          const d = i * nv + j1
          // which side of the quad faces the eye (the normal, from the diagonals)
          const ux = P[cc * 3] - P[a * 3]
          const uy = P[cc * 3 + 1] - P[a * 3 + 1]
          const uz = P[cc * 3 + 2] - P[a * 3 + 2]
          const vx = P[d * 3] - P[b * 3]
          const vy = P[d * 3 + 1] - P[b * 3 + 1]
          const vz = P[d * 3 + 2] - P[b * 3 + 2]
          const nx = uy * vz - uz * vy
          const ny = uz * vx - ux * vz
          const nz = ux * vy - uy * vx
          const mx = (P[a * 3] + P[cc * 3]) / 2
          const my = (P[a * 3 + 1] + P[cc * 3 + 1]) / 2
          const mz = (P[a * 3 + 2] + P[cc * 3 + 2]) / 2
          const facing = nx * (cam.ex - mx) + ny * (cam.ey - my) + nz * (cam.ez - mz) >= 0 ? 1 : -1
          const q = i * qc + j
          s.face[q] = facing
          const depth = (s.sd[a] + s.sd[b] + s.sd[cc] + s.sd[d]) / 4
          const it = item()
          it.kind = 0
          it.s = s
          it.q = q
          it.i = i
          it.j = j
          it.d = depth

          // the cells under the quad, sampled finely enough across it that a
          // big quad on the small grid leaves no cell out
          const nl = Math.hypot(nx, ny, nz) || 1
          const lit = clamp(((nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / nl) * facing)
          const dark = clamp((1 - lit) * 0.85 + (facing < 0 ? 0.25 : 0))
          const step = Math.min(cw, ch) * 0.7
          const along = Math.max(Math.hypot(s.sx[b] - s.sx[a], s.sy[b] - s.sy[a]), Math.hypot(s.sx[cc] - s.sx[d], s.sy[cc] - s.sy[d]))
          const across = Math.max(Math.hypot(s.sx[d] - s.sx[a], s.sy[d] - s.sy[a]), Math.hypot(s.sx[cc] - s.sx[b], s.sy[cc] - s.sy[b]))
          const nu_ = clamp(Math.ceil(along / step), 3, 24)
          const nv_ = clamp(Math.ceil(across / step), 3, 24)
          for (let su = 0; su < nu_; su += 1) {
            const fu = (su + 0.5) / nu_
            const lx = mix(s.sx[a], s.sx[b], fu)
            const ly = mix(s.sy[a], s.sy[b], fu)
            const rx = mix(s.sx[d], s.sx[cc], fu)
            const ry = mix(s.sy[d], s.sy[cc], fu)
            for (let sv = 0; sv < nv_; sv += 1) {
              const fv = (sv + 0.5) / nv_
              touch(mix(lx, rx, fv), mix(ly, ry, fv), depth, s.group, dark)
            }
          }
        }
      }
    }
    // lines: one item per segment
    for (let n = 0; n < scene.nl; n += 1) {
      const l = scene.lines[n]
      const pts = l.points
      let prev = projectPoint(pts[0])
      for (let k = 1; k < pts.length; k += 1) {
        const cur = projectPoint(pts[k])
        const it = item()
        it.kind = 1
        it.a = prev
        it.b = cur
        it.l = l
        it.d = (prev[2] + cur[2]) / 2
        if (!l.ww) {
          // the cells along a stamen
          const steps = Math.max(1, Math.ceil(Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) / (cw * 0.6)))
          for (let t = 0; t <= steps; t += 1) {
            touch(mix(prev[0], cur[0], t / steps), mix(prev[1], cur[1], t / steps), it.d, l.group, 0.3)
          }
        }
        prev = cur
      }
    }
    for (let n = 0; n < scene.nd; n += 1) {
      const dd = scene.dots[n]
      const p = projectPoint(dd.p)
      const it = item()
      it.kind = 2
      it.a = p
      it.l = dd
      it.d = p[2] - 0.02
    }

    order.length = 0
    for (let k = 0; k < itemCount; k += 1) order.push(items[k])
    order.sort(byDepth)

    // the drawing, onto the bitmap
    bctx.setTransform(1, 0, 0, 1, 0, 0)
    bctx.globalCompositeOperation = 'source-over'
    bctx.clearRect(0, 0, bits.width, bits.height)
    bctx.setTransform(dpr / pxd, 0, 0, dpr / pxd, 0, 0)
    bctx.lineJoin = 'round'
    bctx.lineCap = 'round'
    for (let k = 0; k < order.length; k += 1) {
      const it = order[k]
      if (it.kind === 0) paintQuad(it)
      else if (it.kind === 1) paintSegment(it)
      else paintDot(it)
    }
    // the dither: every other pixel knocked back
    bctx.setTransform(1, 0, 0, 1, 0, 0)
    bctx.globalCompositeOperation = 'destination-out'
    bctx.globalAlpha = DITHER
    bctx.fillStyle = checker
    bctx.fillRect(0, 0, bits.width, bits.height)
    bctx.globalAlpha = 1
    bctx.globalCompositeOperation = 'source-over'

    // onto the canvas, scaled up hard
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(bits, 0, 0, bits.width * pxd, bits.height * pxd)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    paintDigits(dt)
    paintGlow()
  }

  function paintQuad(it) {
    const g = bctx
    const s = it.s
    const { nv, sx, sy } = s
    const i = it.i
    const j = it.j
    const j1 = (j + 1) % nv
    const a = i * nv + j
    const b = (i + 1) * nv + j
    const c = (i + 1) * nv + j1
    const d = i * nv + j1
    // the ground, to hide what is behind: no fill of its own
    g.beginPath()
    g.moveTo(sx[a], sy[a])
    g.lineTo(sx[b], sy[b])
    g.lineTo(sx[c], sy[c])
    g.lineTo(sx[d], sy[d])
    g.closePath()
    g.fillStyle = paperCss
    g.fill()

    // outline: free edges, and silhouettes where the neighbour faces away
    const face = s.face[it.q]
    const qc = s.closed ? nv : nv - 1
    const last = s.nu - 2
    const E = s.edges
    const glowA = s.group >= 0 ? blooms[s.group] : 0
    g.beginPath()
    let any = false
    const seg = (p, q) => {
      g.moveTo(sx[p], sy[p])
      g.lineTo(sx[q], sy[q])
      if (glowA > 0.04) glowSeg(sx[p], sy[p], sx[q], sy[q], glowA)
      any = true
    }
    if (j === 0 && !s.closed) {
      if (E.left) seg(a, b)
    } else if (s.face[i * qc + (j === 0 ? qc - 1 : j - 1)] !== face) seg(a, b)
    if (j === nv - 2 && !s.closed) {
      if (E.right) seg(d, c)
    } else if (s.face[i * qc + ((j + 1) % qc)] !== face) seg(d, c)
    if (i === 0) {
      if (E.base) seg(a, d)
    } else if (s.face[(i - 1) * qc + j] !== face) seg(a, d)
    if (i === last) {
      if (E.tip) seg(b, c)
    } else if (s.face[(i + 1) * qc + j] !== face) seg(b, c)
    if (any) {
      g.strokeStyle = inkA(LINE_A)
      g.lineWidth = LINE_BITS * px
      g.stroke()
    }

    // veins through this quad, fading in from the base and out towards the tip
    if (s.veins) {
      const nu1 = s.nu - 1
      const u0 = i / nu1
      const u1 = (i + 1) / nu1
      for (const v of s.veins) {
        if (Math.floor(v.j) !== j || u1 <= v.from || u0 >= v.to) continue
        const t = v.j - j
        const fade = Math.min(clamp((u0 - v.from) / 0.12) + 0.3, clamp((v.to - u1) / 0.18) + 0.3, 1)
        g.beginPath()
        g.moveTo(mix(sx[a], sx[d], t), mix(sy[a], sy[d], t))
        g.lineTo(mix(sx[b], sx[c], t), mix(sy[b], sy[c], t))
        g.strokeStyle = inkA(LINE_A * Math.min(0.8, v.alpha * 1.4) * Math.max(0.15, fade))
        g.lineWidth = LINE_BITS * px
        g.stroke()
      }
    }
    // freckles, as tiny rings
    if (s.spots) {
      for (const sp of s.spots) {
        if (sp.i !== i || sp.j !== j) continue
        const x = mix(mix(sx[a], sx[d], sp.fv), mix(sx[b], sx[c], sp.fv), sp.fu)
        const y = mix(mix(sy[a], sy[d], sp.fv), mix(sy[b], sy[c], sp.fv), sp.fu)
        g.beginPath()
        g.arc(x, y, Math.max(px, (sp.r * cam.F) / s.sd[a]), 0, Math.PI * 2)
        g.strokeStyle = inkA(LINE_A)
        g.lineWidth = LINE_BITS * px
        g.stroke()
      }
    }
  }

  function paintSegment(it) {
    const g = bctx
    const l = it.l
    g.beginPath()
    g.moveTo(it.a[0], it.a[1])
    g.lineTo(it.b[0], it.b[1])
    if (l.ww) {
      // a bar with some body (a tulip's anther): drawn as an outline, a line
      // of ink with the ground laid down its middle
      const width = Math.max(px * 3, (l.ww * cam.F) / it.d)
      g.strokeStyle = inkA(LINE_A)
      g.lineWidth = width
      g.stroke()
      g.strokeStyle = paperCss
      g.lineWidth = width - LINE_BITS * px * 2
      g.stroke()
    } else {
      g.strokeStyle = inkA(LINE_A)
      g.lineWidth = LINE_BITS * px
      g.stroke()
      const glowA = l.group >= 0 ? blooms[l.group] : 0
      if (glowA > 0.04) glowSeg(it.a[0], it.a[1], it.b[0], it.b[1], glowA)
    }
  }

  function paintDot(it) {
    const g = bctx
    const d = it.l
    const r = Math.max(px, (d.r * cam.F) / it.d)
    g.beginPath()
    g.arc(it.a[0], it.a[1], r, 0, Math.PI * 2)
    g.fillStyle = paperCss
    g.fill()
    g.strokeStyle = inkA(LINE_A)
    g.lineWidth = LINE_BITS * px
    g.stroke()
  }

  /* --- the digits ---------------------------------------------------------- */

  let seed = 1
  const rand = () => {
    // a small LCG: the digits do not need to be secure, only cheap
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  const bloomAt = (i) => (cellG[i] >= 0 ? blooms[cellG[i]] : 0)
  const density = (i) => DENSITY + DENSITY_BLOOM * bloomAt(i)
  const shadeDepth = (i) => (cellD[i] - SHADE_FROM) / (1 - SHADE_FROM)

  /** One glitch: digits deleted, runs written in, some flipped, perhaps a row slipped. */
  function glitch() {
    let count = 0
    let target = 0
    let shadows = 0
    let shadowTarget = 0
    // the plant moved off these: they go
    for (let i = 0; i < digit.length; i += 1) {
      if (cover[i] !== frameNo) {
        digit[i] = -1
        shade[i] = -1
      } else if (shade[i] >= 0 && cellD[i] < SHADE_FROM - 0.06) shade[i] = -1
    }
    for (const i of covered) {
      target += density(i)
      if (digit[i] >= 0) count += 1
      if (cellD[i] > SHADE_FROM) shadowTarget += 0.1 + 0.7 * shadeDepth(i)
      if (shade[i] >= 0) shadows += 1
    }
    if (!covered.length) return
    // how hard each pass looks for a cell, in step with how many there are
    const tries = Math.max(400, covered.length >> 1)

    // delete some, a few at a time along a row
    let cut = Math.round(count * (0.04 + rand() * 0.08))
    for (let t = 0; cut > 0 && t < tries; t += 1) {
      const i = covered[Math.floor(rand() * covered.length)]
      if (digit[i] < 0) continue
      const run = 1 + Math.floor(rand() * rand() * 5)
      for (let k = 0; k < run && (i % cols) + k < cols; k += 1) {
        if (digit[i + k] >= 0) {
          digit[i + k] = -1
          count -= 1
          cut -= 1
        }
      }
    }
    // write some in, in runs along a row, until the plant is as full as it should be
    // (a third of what is missing at most, so an empty plant fills in a few beats)
    let budget = Math.ceil(Math.max(6, count * 0.14, (target - count) * 0.35))
    for (let t = 0; count < target && budget > 0 && t < tries; t += 1) {
      const i = covered[Math.floor(rand() * covered.length)]
      if (rand() > density(i) * 1.6) continue
      const run = 1 + Math.floor(rand() * rand() * 7)
      for (let k = 0; k < run && (i % cols) + k < cols; k += 1) {
        const c = i + k
        if (cover[c] === frameNo && digit[c] < 0) {
          digit[c] = rand() < 0.5 ? 0 : 1
          born[c] = time
          count += 1
          budget -= 1
        }
      }
    }
    // flip a few
    for (let k = Math.round(count * 0.05); k > 0; k -= 1) {
      const i = covered[Math.floor(rand() * covered.length)]
      if (digit[i] >= 0) digit[i] = 1 - digit[i]
    }
    // the shadow grid: fewer, slower
    for (let k = Math.round(shadows * 0.06); k > 0; k -= 1) {
      const i = covered[Math.floor(rand() * covered.length)]
      if (shade[i] >= 0) shade[i] = -1
    }
    for (let t = 0; shadows < shadowTarget && t < tries; t += 1) {
      const i = covered[Math.floor(rand() * covered.length)]
      if (shade[i] >= 0 || cellD[i] <= SHADE_FROM || rand() > shadeDepth(i)) continue
      shade[i] = rand() < 0.5 ? 0 : 1
      shadows += 1
    }
    // and now and then a row slips a cell sideways
    if (rand() < 0.14) {
      slipRow = Math.floor(covered[Math.floor(rand() * covered.length)] / cols)
      slipBy = rand() < 0.5 ? -1 : 1
      slipUntil = time + 0.06 + rand() * 0.1
    }
  }

  /** Reduced motion: the digits laid out once, still. */
  function settle() {
    digit.fill(-1)
    shade.fill(-1)
    for (const i of covered) {
      if (rand() < density(i)) digit[i] = rand() < 0.5 ? 0 : 1
      if (cellD[i] > SHADE_FROM && rand() < 0.1 + 0.7 * shadeDepth(i)) shade[i] = rand() < 0.5 ? 0 : 1
    }
  }

  function paintDigits() {
    if (!cols) return
    if (reduced) {
      if (reseed) {
        reseed = false
        settle()
      }
    } else if (time >= nextBeat) {
      nextBeat = time + mix(BEAT[0], BEAT[1], rand())
      glitch()
    }

    ctx.font = `500 ${font}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const slipping = time < slipUntil
    const xOf = (i) => ((i % cols) + 0.5 + (slipping && Math.floor(i / cols) === slipRow ? slipBy : 0)) * cw
    const yOf = (i) => (Math.floor(i / cols) + 0.5) * ch

    // shadows first, half a cell down and to the right, under the rest
    ctx.fillStyle = inkCss
    for (const i of covered) {
      if (shade[i] < 0) continue
      ctx.globalAlpha = SHADOW_A * (0.35 + 0.65 * clamp(shadeDepth(i)))
      ctx.fillText(shade[i] ? '1' : '0', xOf(i) + cw / 2, yOf(i) + ch / 2)
    }

    // each digit clears its gap in the line, then sits in it
    ctx.globalAlpha = 1
    ctx.beginPath()
    const gw = font * 0.62
    const gh = font * 0.92
    for (const i of covered) {
      if (digit[i] >= 0) ctx.rect(xOf(i) - gw / 2, yOf(i) - gh / 2, gw, gh)
    }
    ctx.fillStyle = paperCss
    ctx.fill()

    ctx.fillStyle = inkCss
    for (const i of covered) {
      if (digit[i] < 0) continue
      // a digit flashes as it is written
      const fresh = !reduced && time - born[i] < 0.06
      ctx.globalAlpha = fresh ? 1 : DIGIT_A + DIGIT_A_BLOOM * bloomAt(i)
      ctx.fillText(digit[i] ? '1' : '0', xOf(i), yOf(i))
    }
    ctx.globalAlpha = 1
  }

  /* --- the glow ------------------------------------------------------------ */

  function paintGlow() {
    let any = glowCount > 0
    for (let k = 0; k < species.count && !any; k += 1) any = blooms[k] > 0.04
    if (!any) return

    // the opening flowers' outlines and digits, a third of the size
    g1.setTransform(1, 0, 0, 1, 0, 0)
    g1.clearRect(0, 0, glow1.width, glow1.height)
    g1.setTransform(1 / 3, 0, 0, 1 / 3, 0, 0)
    g1.lineCap = 'round'
    g1.lineWidth = 1.8
    for (const level of [0.25, 0.5, 0.75, 1]) {
      g1.beginPath()
      for (let k = 0; k < glowCount; k += 1) {
        const a = glowSegs[k * 5 + 4]
        if (a > level || a <= level - 0.25) continue
        g1.moveTo(glowSegs[k * 5], glowSegs[k * 5 + 1])
        g1.lineTo(glowSegs[k * 5 + 2], glowSegs[k * 5 + 3])
      }
      g1.strokeStyle = inkA(level)
      g1.stroke()
    }
    for (const i of covered) {
      const b = bloomAt(i)
      if (digit[i] < 0 || b < 0.05) continue
      g1.fillStyle = inkA(b * 0.3)
      g1.fillRect((i % cols) * cw + cw * 0.2, Math.floor(i / cols) * ch + ch * 0.15, cw * 0.6, ch * 0.7)
    }
    // and again, smaller still, for the wide soft halo
    g2.setTransform(1, 0, 0, 1, 0, 0)
    g2.clearRect(0, 0, glow2.width, glow2.height)
    g2.imageSmoothingEnabled = true
    g2.drawImage(glow1, 0, 0, glow2.width, glow2.height)

    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.imageSmoothingEnabled = true
    ctx.globalAlpha = GLOW * 0.6
    ctx.drawImage(glow1, 0, 0, w, h)
    ctx.globalAlpha = GLOW
    ctx.drawImage(glow2, 0, 0, w, h)
    ctx.restore()
  }

  /* --- loop and controls ------------------------------------------------- */

  function tick(now) {
    raf = 0
    if (!running) return
    const elapsed = last ? Math.min(0.5, (now - last) / 1000) : 0
    // motion steps stay small, so a stalled tab does not lurch
    const dt = Math.min(0.05, elapsed)
    last = now
    time += elapsed
    draw(dt, elapsed)
    raf = requestAnimationFrame(tick)
  }

  /** Paint once now, if the loop is not running to do it. */
  const still = () => {
    if (!running) draw(0)
  }

  function resize() {
    const r = canvas.getBoundingClientRect()
    w = r.width
    h = r.height
    const ratio = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.max(1, Math.round(w * ratio))
    canvas.height = Math.max(1, Math.round(h * ratio))
    fit = null
    layout()
    reseed = true
    still()
  }

  const clearDigits = () => {
    digit.fill(-1)
    shade.fill(-1)
    reseed = true
  }

  return {
    resize,
    start() {
      if (running) return
      running = true
      last = 0
      raf = requestAnimationFrame(tick)
    },
    stop() {
      running = false
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    },
    setSpecies(key) {
      const next = speciesByKey(key)
      if (next === species) return
      species = next
      scene.surfaces.length = 0
      scene.lines.length = 0
      scene.dots.length = 0
      scene.heads.length = 0
      fit = null
      resetFlowers()
      clearDigits()
      still()
    },
    /** How open the flowers rest when nothing asks them to bloom (0 a bud). */
    setRest(v) {
      rest = clamp(v)
      still()
    },
    /** Open (or close) every flower, one after another. */
    setAll(on) {
      for (let k = 0; k < species.count; k += 1) {
        // without the loop (or without motion) there is nothing to stagger
        if (!running || reduced) {
          pinned[k] = on ? 1 : 0
          pinAt[k] = 0
        } else {
          pinAt[k] = time + k * STAGGER_S + 1e-3
          pinTo[k] = on ? 1 : 0
        }
      }
      still()
    },
    /** A tap at (x, y): opens the flower there, or closes it. */
    tap(x, y) {
      const k = flowerAt(x, y)
      if (k < 0) return -1
      pinned[k] = pinned[k] ? 0 : 1
      pinAt[k] = 0
      hoverUntil[k] = 0
      still()
      return k
    },
    /** The pointer over the canvas in CSS pixels, or null once it leaves. */
    pointer(x, y) {
      if (x == null) {
        pointer = null
        leanTo = [0, 0]
        return
      }
      pointer = [x, y]
      leanTo = [clamp((x / w) * 2 - 1, -1, 1), clamp((y / h) * 2 - 1, -1, 1)]
    },
    setColor(color) {
      ink = parseColor(color, ink)
      setInk()
      still()
    },
    setPaper(color) {
      paper = parseColor(color, paper)
      setInk()
      still()
    },
    setReduced(on) {
      reduced = Boolean(on)
      clearDigits()
      still()
    },
    destroy() {
      this.stop()
    },
  }
}
