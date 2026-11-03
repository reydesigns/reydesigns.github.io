import { Scene, clamp, mix, smooth } from './geometry'
import { speciesByKey } from './species'

/* ---------------------------------------------------------------------------
   Paints a plant from species.js onto a 2D canvas as a hairline drawing seen
   from above, with ASCII pollen drifting up off its petals.

   Each frame:
     1. every flower's bloom moves towards where it should be: open while the
        pointer is on it (and for a moment after), or while it has been tapped
        open; otherwise back to its resting bud;
     2. the plant is rebuilt for those blooms (Scene pools its parts);
     3. every point is projected through a perspective camera that looks down
        on the plant and sways a little (and leans after the pointer);
     4. every quad of every surface, every stamen segment and every anther
        goes into one list, sorted far to near, and is painted in that order:
        the quad filled with the background, so it hides whatever is behind it
        without showing a fill of its own, then its outline (the petal's free
        edges, and a silhouette wherever the surface folds away from the eye)
        and its veins, all in the one thin line of the chosen colour;
     5. the pollen goes on top: ASCII codes (the decimal numbers of the
        letters of the flower's name) that start on a petal, follow it as it
        opens, and drift up and away.

   No WebGL: it is a few thousand small paths a frame, which a 2D canvas
   paints in a few milliseconds.
--------------------------------------------------------------------------- */

const OPEN_S = 1.5 // seconds for a bud to open fully
const CLOSE_S = 1.1 // and to close again
const LINGER_S = 1.4 // a flower stays open this long after the pointer leaves it
const STAGGER_S = 0.16 // between flowers when they open or close together
const LINE = 0.25 // the drawing's line, in CSS pixels
const MAX_POLLEN = 110
const ROOM_X = 22 // a new number starts at least this far from the others, across
const ROOM_Y = 12 // and down (CSS pixels): numbers are wide, and pile up into smudges

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
  const cam = { yaw: 0, pitch: 1, dist: 12, cy: 0, sy: 0, cp: 0, sp: 0, F: 1, ox: 0, oy: 0, ex: 0, ey: 0, ez: 0 }
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
    for (const o of [0, 1]) {
      scene.begin()
      species.build(scene, new Float32Array(species.count).fill(o))
      // the camera at both ends of its sway
      for (const yaw of [c.yaw - 0.12 * sway, c.yaw + 0.12 * sway]) {
        setCamera(yaw, c.pitch)
        for (let n = 0; n < scene.ns; n += 1) {
          const s = scene.surfaces[n]
          const P = s.P
          for (let k = 0; k < s.nu * s.nv; k += 1) {
            project(P[k * 3], P[k * 3 + 1], P[k * 3 + 2], s, k)
            grow(s.sx[k], s.sy[k])
          }
        }
        for (let n = 0; n < scene.nl; n += 1) {
          for (const p of scene.lines[n].points) {
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
      // a little low in the box: the pollen drifts up into the space above
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
      if (reduced) prog[k] = want
      else if (p < want) prog[k] = Math.min(want, p + elapsed / OPEN_S)
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
      const cols = s.closed ? nv : nv - 1
      for (let i = 0; i < nu - 1; i += 1) {
        for (let j = 0; j < cols; j += 1) {
          const j1 = (j + 1) % nv
          const a = (i * nv + j) * 3
          const b = ((i + 1) * nv + j) * 3
          const cc = ((i + 1) * nv + j1) * 3
          const d = (i * nv + j1) * 3
          // which side of the quad faces the eye (the normal, from the diagonals)
          const ux = P[cc] - P[a]
          const uy = P[cc + 1] - P[a + 1]
          const uz = P[cc + 2] - P[a + 2]
          const vx = P[d] - P[b]
          const vy = P[d + 1] - P[b + 1]
          const vz = P[d + 2] - P[b + 2]
          const nx = uy * vz - uz * vy
          const ny = uz * vx - ux * vz
          const nz = ux * vy - uy * vx
          const mx = (P[a] + P[cc]) / 2
          const my = (P[a + 1] + P[cc + 1]) / 2
          const mz = (P[a + 2] + P[cc + 2]) / 2
          const q = i * cols + j
          s.face[q] = nx * (cam.ex - mx) + ny * (cam.ey - my) + nz * (cam.ez - mz) >= 0 ? 1 : -1
          const it = item()
          it.kind = 0
          it.s = s
          it.q = q
          it.i = i
          it.j = j
          it.d = (s.sd[a / 3] + s.sd[b / 3] + s.sd[cc / 3] + s.sd[d / 3]) / 4
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

    paintPollen(dt)
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
    const cols = s.closed ? nv : nv - 1
    const last = s.nu - 2
    const E = s.edges
    ctx.beginPath()
    let any = false
    const seg = (p, q) => {
      ctx.moveTo(sx[p], sy[p])
      ctx.lineTo(sx[q], sy[q])
      any = true
    }
    if (j === 0 && !s.closed) {
      if (E.left) seg(a, b)
    } else if (s.face[i * cols + (j === 0 ? cols - 1 : j - 1)] !== face) seg(a, b)
    if (j === nv - 2 && !s.closed) {
      if (E.right) seg(d, c)
    } else if (s.face[i * cols + ((j + 1) % cols)] !== face) seg(d, c)
    if (i === 0) {
      if (E.base) seg(a, d)
    } else if (s.face[(i - 1) * cols + j] !== face) seg(a, d)
    if (i === last) {
      if (E.tip) seg(b, c)
    } else if (s.face[(i + 1) * cols + j] !== face) seg(b, c)
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

  /* --- pollen ------------------------------------------------------------ */

  const pollen = []
  let spawnDebt = 0
  let seed = 1
  const rand = () => {
    // a small LCG: the pollen does not need to be secure, only cheap
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

  /** Screen position of the point (fu, fv) on surface s, as last projected. */
  function onSurface(s, fu, fv) {
    const fi = fu * (s.nu - 1)
    const i = Math.min(s.nu - 2, Math.floor(fi))
    const ti = fi - i
    const fj = fv * (s.nv - 1)
    const j = Math.min(s.nv - 2, Math.floor(fj))
    const tj = fj - j
    const a = i * s.nv + j
    const b = (i + 1) * s.nv + j
    return [
      mix(mix(s.sx[a], s.sx[a + 1], tj), mix(s.sx[b], s.sx[b + 1], tj), ti),
      mix(mix(s.sy[a], s.sy[a + 1], tj), mix(s.sy[b], s.sy[b + 1], tj), ti),
    ]
  }

  function spawn() {
    // pick a petal, weighted by how open its flower is (leaves give none)
    let total = 0
    const weight = (s) => (s.group >= 0 ? s.pollen * (0.12 + blooms[s.group]) : 0)
    for (let n = 0; n < scene.ns; n += 1) total += weight(scene.surfaces[n])
    if (total <= 0) return
    // a few tries for a spot clear of the numbers already drifting
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let r = rand() * total
      let n = 0
      for (; n < scene.ns - 1; n += 1) {
        r -= weight(scene.surfaces[n])
        if (r <= 0) break
      }
      const s = scene.surfaces[n]
      // the outer part of the petal, where it has opened
      const fu = 0.25 + 0.75 * Math.sqrt(rand())
      const fv = rand()
      const [x, y] = onSurface(s, fu, fv)
      if (pollen.some((p) => Math.abs(p.x - x) < ROOM_X && Math.abs(p.y - y) < ROOM_Y)) continue
      pollen.push(particle(n, s, fu, fv, x, y))
      return
    }
  }

  function particle(n, s, fu, fv, x, y) {
    return {
      n,
      fu,
      fv,
      x,
      y,
      age: 0,
      life: 2.2 + rand() * 2.6,
      vy: 10 + rand() * 22,
      wob: rand() * Math.PI * 2,
      wobA: 3 + rand() * 7,
      g: code(),
      next: 0.25 + rand() * 0.6,
      size: 0.85 + rand() * 0.4,
      dx: 0,
      dy: 0,
      nu: s.nu,
      nv: s.nv,
    }
  }

  function paintPollen(dt) {
    let mean = 0
    for (let k = 0; k < species.count; k += 1) mean += blooms[k] / species.count
    if (!reduced) {
      spawnDebt += (2 + 18 * mean) * dt
      while (spawnDebt >= 1 && pollen.length < MAX_POLLEN) {
        spawn()
        spawnDebt -= 1
      }
      if (spawnDebt > 1) spawnDebt = 0
    } else if (pollen.length === 0) {
      // a still scatter, so reduced motion still shows the ASCII
      for (let k = 0; k < 40; k += 1) {
        const before = pollen.length
        spawn()
        if (pollen.length === before) continue
        const p = pollen[pollen.length - 1]
        p.age = p.life * (0.2 + rand() * 0.4)
        p.dy = -p.vy * p.age
      }
    }
    const base = Math.max(8, Math.min(11, Math.min(w, h) / 62))
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let k = pollen.length - 1; k >= 0; k -= 1) {
      const p = pollen[k]
      const s = scene.surfaces[p.n]
      if (!s || s.nu !== p.nu || s.nv !== p.nv) {
        pollen.splice(k, 1)
        continue
      }
      if (!reduced) {
        p.age += dt
        if (p.age >= p.life) {
          pollen.splice(k, 1)
          continue
        }
        p.dy -= p.vy * dt
        p.dx = Math.sin(p.wob + p.age * 1.6) * p.wobA
        p.next -= dt
        if (p.next <= 0) {
          p.g = code()
          p.next = 0.3 + rand() * 0.7
        }
      }
      // where its spot on the petal is now, plus how far it has drifted
      const [sx, sy] = onSurface(s, p.fu, p.fv)
      const x = sx + p.dx
      const y = sy + p.dy
      p.x = x
      p.y = y
      const t = p.age / p.life
      const alpha = reduced ? 0.85 : Math.min(1, t / 0.12) * (1 - smooth((t - 0.6) / 0.4))
      ctx.font = `500 ${Math.round(base * p.size)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`
      ctx.fillStyle = inkA(alpha)
      ctx.fillText(p.g, x, y)
    }
  }

  /* --- loop and controls ------------------------------------------------- */

  function tick(now) {
    raf = 0
    if (!running) return
    const elapsed = last ? Math.min(0.5, (now - last) / 1000) : 0
    // motion steps stay small, so a stalled tab does not fling the pollen
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
    still()
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
      pollen.length = 0
      fit = null
      resetFlowers()
      setCodes()
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
      pollen.length = 0
      still()
    },
    destroy() {
      this.stop()
    },
  }
}
