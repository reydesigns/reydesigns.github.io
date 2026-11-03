import { Scene, clamp, mix, smooth } from './geometry'
import { speciesByKey } from './species'

/* ---------------------------------------------------------------------------
   Paints a plant from species.js onto a 2D canvas as a hairline drawing, with
   ASCII numbers set into it on a grid.

   Each frame:
     1. every flower's bloom moves towards where it should be: open while the
        pointer is on it (and for a moment after), or while it has been tapped
        open; otherwise back to its resting bud;
     2. the plant is rebuilt for those blooms (Scene pools its parts);
     3. every point is projected through a perspective camera that sways a
        little (and leans after the pointer);
     4. every quad of every surface, every stamen segment and every anther
        goes into one list, sorted far to near, and is painted in that order:
        the quad filled with the background, so it hides whatever is behind it
        without showing a fill of its own, then its outline (the free edges,
        and a silhouette wherever the surface folds away from the eye) and its
        veins, all in the one hairline of the chosen colour;
     5. the numbers go on top, on two grids fixed to the canvas:
          line      one number to a cell, born in a cell the drawing's line
                    runs through. It cuts its gap in the line and fills it,
                    holds there a moment, then climbs a cell at a time and
                    fades, and the line closes up behind it;
          shadow    a second grid, offset half a cell each way, of fainter
                    numbers in the cells where the plant turns from the light.
                    They overlap the line numbers like a shadow cast down and
                    to the right, and still keep to their own grid.
        The numbers are the flower's name in decimal ASCII: "Tulip" is 84,
        117, 108, 105, 112.

   No WebGL: it is a few thousand small paths a frame, which a 2D canvas
   paints in a few milliseconds.
--------------------------------------------------------------------------- */

const OPEN_S = 1.5 // seconds for a bud to open fully
const CLOSE_S = 1.1 // and to close again
const LINGER_S = 1.4 // a flower stays open this long after the pointer leaves it
const STAGGER_S = 0.16 // between flowers when they open or close together
const LINE = 0.35 // the drawing's line, in CSS pixels

const LINE_ALPHA = 0.55 // the numbers in the line, at their strongest
const SHADOW_ALPHA = 0.22 // the shadow numbers, in the deepest shade
const MAX_LINE = 110
const MAX_SHADOW = 140
const SHADE_FROM = 0.56 // how turned from the light a cell must be to take a shadow number

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

export function createFlowerView(canvas, opts = {}) {
  const ctx = canvas.getContext('2d')
  const scene = new Scene()
  let species = speciesByKey(opts.species)
  let ink = parseColor(opts.color, [68, 0, 0])
  let paper = parseColor(opts.paper)
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
    fit = {
      F,
      ox: w / 2 - ((x0 + x1) / 2) * F,
      // a little low in the box: the numbers climb into the space above
      oy: h / 2 - ((y0 + y1) / 2) * F + h * (1 - framing) * 0.12,
    }
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

  /* --- the grids ---------------------------------------------------------- */

  let font = 9 // the numbers' size, CSS pixels
  let cw = 18 // a cell, across and down
  let ch = 12
  let cols = 0
  let rows = 0
  let occ = new Int32Array(0) // line grid: which number holds each cell (index + 1)
  let lineCell = new Int32Array(0) // line grid: the frame the drawing last crossed each cell
  let lineGroup = new Int8Array(0) // and which flower it was
  const lineCells = [] // the cells crossed this frame
  let shadeZ = new Float32Array(0) // shadow grid: nearest surface's depth
  let shadeD = new Float32Array(0) // and how turned from the light it is
  let shadeOcc = new Uint8Array(0)
  const darkCells = [] // shadow cells deep enough for a number
  let frameNo = 1
  const widths = new Map() // number → its width at `font`

  const nums = [] // line grid: { i, age, life, hold, step, next, v }
  const shades = [] // shadow grid: { i, age, life, next, v, depth }

  function layoutGrid() {
    font = clamp(Math.min(w, h) / 72, 7.5, 10)
    // three digits wide, with a little air, and a line high
    cw = Math.round(font * 2.1)
    ch = Math.round(font * 1.35)
    cols = Math.ceil(w / cw) + 1
    rows = Math.ceil(h / ch) + 1
    occ = new Int32Array(cols * rows)
    lineCell = new Int32Array(cols * rows)
    lineGroup = new Int8Array(cols * rows)
    shadeZ = new Float32Array(cols * rows)
    shadeD = new Float32Array(cols * rows)
    shadeOcc = new Uint8Array(cols * rows)
    widths.clear()
    nums.length = 0
    shades.length = 0
  }

  /** Marks the line-grid cells that the segment (x0, y0)–(x1, y1) runs through. */
  function crossCells(x0, y0, x1, y1, group) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (cw * 0.5)))
    for (let k = 0; k <= steps; k += 1) {
      const t = (k + 0.5) / (steps + 1)
      const c = Math.floor(mix(x0, x1, t) / cw)
      const r = Math.floor(mix(y0, y1, t) / ch)
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue
      const i = r * cols + c
      if (lineCell[i] !== frameNo) {
        lineCell[i] = frameNo
        lineGroup[i] = group
        lineCells.push(i)
      }
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
  let reseed = true // reduced motion: lay the still numbers out again

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
    lineCells.length = 0
    darkCells.length = 0
    shadeZ.fill(Infinity)

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

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    itemCount = 0
    // surfaces: project, then one item per quad
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

          // how turned from the light the nearest surface in this shadow cell is
          const gc = Math.round((s.sx[a] + s.sx[b] + s.sx[cc] + s.sx[d]) / 4 / cw)
          const gr = Math.round((s.sy[a] + s.sy[b] + s.sy[cc] + s.sy[d]) / 4 / ch)
          if (gc >= 0 && gr >= 0 && gc < cols && gr < rows) {
            const gi = gr * cols + gc
            if (depth < shadeZ[gi]) {
              const nl = Math.hypot(nx, ny, nz) || 1
              const lit = clamp(((nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / nl) * facing)
              shadeZ[gi] = depth
              shadeD[gi] = clamp((1 - lit) * 0.85 + (facing < 0 ? 0.25 : 0))
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

    for (let k = 0; k < order.length; k += 1) {
      const it = order[k]
      if (it.kind === 0) paintQuad(it)
      else if (it.kind === 1) paintSegment(it)
      else paintDot(it)
    }

    for (let i = 0; i < shadeZ.length; i += 1) {
      if (shadeZ[i] < Infinity && shadeD[i] > SHADE_FROM) darkCells.push(i)
    }
    paintNumbers(dt)
  }

  function paintQuad(it) {
    const s = it.s
    const { nv, sx, sy } = s
    const i = it.i
    const j = it.j
    const j1 = (j + 1) % nv
    const a = i * nv + j
    const b = (i + 1) * nv + j
    const c = (i + 1) * nv + j1
    const d = i * nv + j1
    // the background, to hide what is behind: no fill of its own
    ctx.beginPath()
    ctx.moveTo(sx[a], sy[a])
    ctx.lineTo(sx[b], sy[b])
    ctx.lineTo(sx[c], sy[c])
    ctx.lineTo(sx[d], sy[d])
    ctx.closePath()
    ctx.fillStyle = paperCss
    ctx.fill()

    // outline: free edges, and silhouettes where the neighbour faces away
    const face = s.face[it.q]
    const qc = s.closed ? nv : nv - 1
    const last = s.nu - 2
    const E = s.edges
    ctx.beginPath()
    let any = false
    const seg = (p, q) => {
      ctx.moveTo(sx[p], sy[p])
      ctx.lineTo(sx[q], sy[q])
      crossCells(sx[p], sy[p], sx[q], sy[q], s.group)
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
      ctx.strokeStyle = inkCss
      ctx.lineWidth = LINE
      ctx.stroke()
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
        ctx.beginPath()
        ctx.moveTo(mix(sx[a], sx[d], t), mix(sy[a], sy[d], t))
        ctx.lineTo(mix(sx[b], sx[c], t), mix(sy[b], sy[c], t))
        ctx.strokeStyle = inkA(Math.min(0.8, v.alpha * 1.6) * Math.max(0.15, fade))
        ctx.lineWidth = LINE
        ctx.stroke()
      }
    }
    // freckles, as tiny rings
    if (s.spots) {
      for (const sp of s.spots) {
        if (sp.i !== i || sp.j !== j) continue
        const x = mix(mix(sx[a], sx[d], sp.fv), mix(sx[b], sx[c], sp.fv), sp.fu)
        const y = mix(mix(sy[a], sy[d], sp.fv), mix(sy[b], sy[c], sp.fv), sp.fu)
        ctx.beginPath()
        ctx.arc(x, y, Math.max(0.7, (sp.r * cam.F) / s.sd[a]), 0, Math.PI * 2)
        ctx.strokeStyle = inkCss
        ctx.lineWidth = LINE
        ctx.stroke()
      }
    }
  }

  function paintSegment(it) {
    const l = it.l
    ctx.beginPath()
    ctx.moveTo(it.a[0], it.a[1])
    ctx.lineTo(it.b[0], it.b[1])
    ctx.strokeStyle = inkCss
    if (l.ww) {
      // a bar with some body (a tulip's anther): drawn as an outline, a line
      // of ink with the background laid down its middle
      const width = Math.max(LINE * 6, (l.ww * cam.F) / it.d)
      ctx.lineWidth = width
      ctx.stroke()
      ctx.strokeStyle = paperCss
      ctx.lineWidth = width - LINE * 2
      ctx.stroke()
    } else {
      ctx.lineWidth = LINE
      ctx.stroke()
      crossCells(it.a[0], it.a[1], it.b[0], it.b[1], l.group)
    }
  }

  function paintDot(it) {
    const d = it.l
    const r = Math.max(0.9, (d.r * cam.F) / it.d)
    ctx.beginPath()
    ctx.arc(it.a[0], it.a[1], r, 0, Math.PI * 2)
    ctx.fillStyle = paperCss
    ctx.fill()
    ctx.strokeStyle = inkCss
    ctx.lineWidth = LINE
    ctx.stroke()
  }

  /* --- the numbers ------------------------------------------------------- */

  let lineDebt = 0
  let shadeDebt = 0
  let seed = 1
  const rand = () => {
    // a small LCG: the numbers do not need to be secure, only cheap
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  // the flower's name in ASCII: "Tulip" sheds 84, 117, 108, 105, 112
  let codes = []
  const setCodes = () => {
    codes = [...species.name.replace(/\s+/g, '')].map((ch) => String(ch.charCodeAt(0)))
  }
  setCodes()
  const code = () => codes[Math.floor(rand() * codes.length)]
  const widthOf = (v) => {
    let x = widths.get(v)
    if (x == null) {
      x = ctx.measureText(v).width
      widths.set(v, x)
    }
    return x
  }

  /** A number into a cell the drawing runs through, if one is free. */
  function spawnLine() {
    for (let attempt = 0; attempt < 6 && lineCells.length; attempt += 1) {
      const i = lineCells[Math.floor(rand() * lineCells.length)]
      if (occ[i]) continue
      const g = lineGroup[i]
      // most come from the open flowers; stems and leaves give the odd one
      if (rand() > (g >= 0 ? 0.2 + 0.8 * blooms[g] : 0.08)) continue
      nums.push({ i, age: 0, life: 2.6 + rand() * 2.8, hold: 0.5 + rand() * 1.1, step: 0, next: 0.3 + rand() * 0.6, v: code() })
      occ[i] = nums.length
      return
    }
  }

  /** A faint number into a shadow cell, as deep as the shade there. */
  function spawnShade() {
    for (let attempt = 0; attempt < 6 && darkCells.length; attempt += 1) {
      const i = darkCells[Math.floor(rand() * darkCells.length)]
      if (shadeOcc[i]) continue
      const depth = (shadeD[i] - SHADE_FROM) / (1 - SHADE_FROM)
      if (rand() > 0.08 + 0.8 * depth) continue
      shades.push({ i, age: 0, life: 1.4 + rand() * 2.2, next: 0.3 + rand() * 0.7, v: code(), depth })
      shadeOcc[i] = 1
      return
    }
  }

  /** Re-points occ at the numbers after some have gone. */
  function reindex() {
    occ.fill(0)
    for (let k = 0; k < nums.length; k += 1) occ[nums[k].i] = k + 1
  }

  function paintNumbers(dt) {
    if (!cols) return
    let mean = 0
    for (let k = 0; k < species.count; k += 1) mean += blooms[k] / species.count

    if (reduced) {
      // still numbers, laid out afresh whenever the drawing changes
      if (reseed) {
        reseed = false
        nums.length = 0
        shades.length = 0
        occ.fill(0)
        shadeOcc.fill(0)
        for (let k = 0; k < 24 + 50 * mean; k += 1) spawnLine()
        for (let k = 0; k < 60; k += 1) spawnShade()
        for (const n of nums) n.age = n.life * 0.3
        for (const s of shades) s.age = s.life * 0.4
      }
    } else {
      lineDebt += (2 + 16 * mean) * dt
      while (lineDebt >= 1) {
        if (nums.length < MAX_LINE) spawnLine()
        lineDebt -= 1
      }
      shadeDebt += 32 * dt
      while (shadeDebt >= 1) {
        if (shades.length < MAX_SHADOW) spawnShade()
        shadeDebt -= 1
      }
    }

    ctx.font = `500 ${font}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // shadows first, so the line numbers sit on top of them
    for (let k = shades.length - 1; k >= 0; k -= 1) {
      const s = shades[k]
      if (!reduced) {
        s.age += dt
        // the shade moved on (a petal opened, the plant swayed): let it go
        if (shadeZ[s.i] === Infinity || shadeD[s.i] < SHADE_FROM - 0.08) s.age = Math.max(s.age, s.life * 0.7)
        if (s.age >= s.life) {
          shadeOcc[s.i] = 0
          shades.splice(k, 1)
          continue
        }
        s.next -= dt
        if (s.next <= 0) {
          s.v = code()
          s.next = 0.4 + rand() * 0.8
        }
      }
      const t = s.age / s.life
      const env = Math.min(1, t / 0.2) * (1 - smooth((t - 0.7) / 0.3))
      ctx.fillStyle = inkA(SHADOW_ALPHA * (0.35 + 0.65 * s.depth) * env)
      ctx.fillText(s.v, (s.i % cols) * cw, Math.floor(s.i / cols) * ch)
    }

    let gone = false
    for (let k = nums.length - 1; k >= 0; k -= 1) {
      const n = nums[k]
      if (!reduced) {
        n.age += dt
        if (n.age >= n.life) {
          nums.splice(k, 1)
          gone = true
          continue
        }
        n.next -= dt
        if (n.next <= 0) {
          n.v = code()
          n.next = 0.3 + rand() * 0.6
        }
        // after holding its place in the line, climb a cell at a time
        if (n.age > n.hold) {
          n.step -= dt
          if (n.step <= 0) {
            n.step = 0.32 + rand() * 0.4
            const up = n.i - cols
            if (up < 0) {
              n.life = Math.min(n.life, n.age + 0.25)
            } else if (!occ[up]) {
              occ[n.i] = 0
              n.i = up
              occ[up] = 1
            }
          }
        }
      }
      const t = n.age / n.life
      const env = Math.min(1, t / 0.12) * (1 - smooth((t - 0.65) / 0.35))
      const x = ((n.i % cols) + 0.5) * cw
      const y = (Math.floor(n.i / cols) + 0.5) * ch
      // cut the gap: clear the line under the number, then set the number in it
      const tw = widthOf(n.v) + 3
      ctx.globalAlpha = env
      ctx.fillStyle = paperCss
      ctx.fillRect(x - tw / 2, y - font * 0.58, tw, font * 1.16)
      ctx.globalAlpha = 1
      ctx.fillStyle = inkA(LINE_ALPHA * env)
      ctx.fillText(n.v, x, y)
    }
    if (gone) reindex()
  }

  /* --- loop and controls ------------------------------------------------- */

  function tick(now) {
    raf = 0
    if (!running) return
    const elapsed = last ? Math.min(0.5, (now - last) / 1000) : 0
    // motion steps stay small, so a stalled tab does not jump the numbers
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
    dpr = Math.min(2, window.devicePixelRatio || 1)
    w = r.width
    h = r.height
    canvas.width = Math.max(1, Math.round(w * dpr))
    canvas.height = Math.max(1, Math.round(h * dpr))
    fit = null
    layoutGrid()
    reseed = true
    still()
  }

  const clearNumbers = () => {
    nums.length = 0
    shades.length = 0
    occ.fill(0)
    shadeOcc.fill(0)
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
      setCodes()
      clearNumbers()
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
      clearNumbers()
      still()
    },
    destroy() {
      this.stop()
    },
  }
}
