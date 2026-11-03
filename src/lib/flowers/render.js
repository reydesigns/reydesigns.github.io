import { Scene, clamp, mix, smooth } from './geometry'
import { speciesByKey } from './species'

/* ---------------------------------------------------------------------------
   Paints a flower from species.js onto a 2D canvas, as line art seen from
   above, with ASCII pollen drifting up off its petals.

   Each frame:
     1. the flower is rebuilt for the current bloom (Scene pools its parts);
     2. every point is projected through a perspective camera that looks down
        on the flower and sways a little (and leans after the pointer);
     3. every quad of every surface, every stamen segment and every dot goes
        into one list, sorted far to near, and is painted in that order: the
        quad filled white with a touch of grey where it turns from the light,
        then its outline — the petal's free edges, and a silhouette wherever
        the surface folds away from the eye — then its veins. Painting the
        outlines quad by quad, in depth order, is what lets a nearer petal
        hide the outline of one behind it;
     4. the pollen goes on top: characters that start on a petal, follow it
        as it opens, and drift up and away, some well past the outline.

   No WebGL: it is a few thousand small paths a frame, which a 2D canvas
   paints in a couple of milliseconds.
--------------------------------------------------------------------------- */

const OPEN_S = 1.7 // seconds for a bud to open fully
const CLOSE_S = 1.2 // and to close again
const ASCII = ['.', ':', '*', '+', "'", '~', '^', ',', '`', 'o']
const MAX_POLLEN = 240

/** '#rrggbb' → [r, g, b]. */
function rgb(hex) {
  const h = hex.trim().replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Light from the upper left, a little in front. */
const LIGHT = (() => {
  const l = [-0.45, 0.8, 0.4]
  const n = Math.hypot(...l)
  return l.map((x) => x / n)
})()

export function createFlowerView(canvas, opts = {}) {
  const ctx = canvas.getContext('2d')
  const scene = new Scene()
  let species = speciesByKey(opts.species)
  let ink = rgb(opts.ink ?? '#161314')
  let paper = rgb(opts.paper ?? '#ffffff')
  let pollenRgb = rgb(opts.color ?? '#440000')
  let tones = []
  let paperStr = ''
  const makeTones = () => {
    paperStr = `rgb(${paper[0]},${paper[1]},${paper[2]})`
    tones = []
    for (let k = 0; k <= 32; k += 1) {
      const t = (k / 32) * 0.2
      tones.push(`rgb(${Math.round(mix(paper[0], ink[0], t))},${Math.round(mix(paper[1], ink[1], t))},${Math.round(mix(paper[2], ink[2], t))})`)
    }
  }
  makeTones()
  const inkStr = (a = 1) => `rgba(${ink[0]},${ink[1]},${ink[2]},${a})`

  // view state
  let w = 0
  let h = 0
  let dpr = 1
  let fit = null // { F, ox, oy } for the current species and size
  let progress = opts.bloom ?? 0 // 0..1, linear in time
  let target = progress
  let reduced = Boolean(opts.reduced)
  let lean = [0, 0] // pointer parallax, -1..1
  let leanTo = [0, 0]
  let time = 0
  let raf = 0
  let last = 0
  let running = false
  const framing = opts.framing ?? 0.86
  const sway = opts.sway ?? 1

  // camera, recomputed each frame
  const cam = { yaw: 0, pitch: 1, dist: 12, cy: 0, sy: 0, cp: 0, sp: 0, F: 1, ox: 0, oy: 0, tx: 0, ty: 0, tz: 0 }
  const setCamera = (yaw, pitch) => {
    cam.yaw = yaw
    cam.pitch = pitch
    cam.cy = Math.cos(yaw)
    cam.sy = Math.sin(yaw)
    cam.cp = Math.cos(pitch)
    cam.sp = Math.sin(pitch)
    // the eye, in world space, for facing tests
    const r = cam.dist
    cam.ex = cam.tx + r * cam.cp * cam.sy
    cam.ey = cam.ty + r * cam.sp
    cam.ez = cam.tz + r * cam.cp * cam.cy
  }
  /** World → [screen x, screen y, depth]. */
  const project = (x, y, z, out, k) => {
    const px = x - cam.tx
    const py = y - cam.ty
    const pz = z - cam.tz
    const x1 = px * cam.cy - pz * cam.sy
    const z1 = px * cam.sy + pz * cam.cy
    const up = py * cam.cp - z1 * cam.sp
    const d = cam.dist - (py * cam.sp + z1 * cam.cp)
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

  /* --- framing: fit the open flower (and the bud) into the canvas ------- */

  function frame() {
    if (!w || !h) return
    const c = species.camera
    cam.dist = c.dist
    cam.tx = 0
    cam.ty = 0
    cam.tz = 0
    cam.F = 1
    cam.ox = 0
    cam.oy = 0
    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    // the bloom and the bud, and the camera at both ends of its sway
    for (const o of [0, 1]) {
      scene.begin()
      species.build(scene, o)
      for (const yaw of [c.yaw - 0.12 * sway, c.yaw + 0.12 * sway]) {
        setCamera(yaw, c.pitch)
        for (let n = 0; n < scene.ns; n += 1) {
          const s = scene.surfaces[n]
          const P = s.P
          for (let k = 0; k < s.nu * s.nv; k += 1) {
            project(P[k * 3], P[k * 3 + 1], P[k * 3 + 2], s, k)
            x0 = Math.min(x0, s.sx[k])
            x1 = Math.max(x1, s.sx[k])
            y0 = Math.min(y0, s.sy[k])
            y1 = Math.max(y1, s.sy[k])
          }
        }
        for (let n = 0; n < scene.nl; n += 1) {
          for (const p of scene.lines[n].points) {
            const q = projectPoint(p)
            x0 = Math.min(x0, q[0])
            x1 = Math.max(x1, q[0])
            y0 = Math.min(y0, q[1])
            y1 = Math.max(y1, q[1])
          }
        }
      }
    }
    // room at the top for pollen to drift into
    const F = Math.min((w * framing) / (x1 - x0), (h * framing) / (y1 - y0))
    fit = {
      F,
      ox: w / 2 - ((x0 + x1) / 2) * F,
      oy: h / 2 - ((y0 + y1) / 2) * F + h * (1 - framing) * 0.12,
    }
  }

  /* --- one frame --------------------------------------------------------- */

  const items = []
  let itemCount = 0
  const item = () => {
    let it = items[itemCount]
    if (!it) it = items[itemCount] = { d: 0, kind: 0, s: null, q: 0, a: null, b: null, l: null }
    itemCount += 1
    return it
  }
  const order = []
  const byDepth = (a, b) => b.d - a.d

  function draw(dt, elapsed = dt) {
    if (!fit) frame()
    if (!fit) return
    const c = species.camera
    // bloom
    if (reduced) progress = target
    // by the clock, not by frames: a slow frame still finds the bloom where it should be
    else if (progress < target) progress = Math.min(target, progress + elapsed / OPEN_S)
    else if (progress > target) progress = Math.max(target, progress - elapsed / CLOSE_S)
    const o = smooth(progress)
    // camera: a slow sway, and a lean after the pointer
    if (!reduced) {
      lean[0] += (leanTo[0] - lean[0]) * Math.min(1, dt * 3)
      lean[1] += (leanTo[1] - lean[1]) * Math.min(1, dt * 3)
    }
    const swayNow = reduced ? 0 : Math.sin(time * 0.35) * 0.07 * sway
    cam.dist = c.dist
    cam.tx = 0
    cam.ty = 0
    cam.tz = 0
    cam.F = fit.F
    cam.ox = fit.ox
    cam.oy = fit.oy
    setCamera(c.yaw + swayNow + lean[0] * 0.12 * sway, c.pitch - lean[1] * 0.06 * sway)

    scene.begin()
    species.build(scene, o)

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
      const qv = nv - 1
      const cols = s.closed ? nv : nv - 1
      for (let i = 0; i < nu - 1; i += 1) {
        for (let j = 0; j < cols; j += 1) {
          const j1 = (j + 1) % nv
          const a = (i * nv + j) * 3
          const b = ((i + 1) * nv + j) * 3
          const cc = ((i + 1) * nv + j1) * 3
          const d = (i * nv + j1) * 3
          // normal from the diagonals
          const ux = P[cc] - P[a]
          const uy = P[cc + 1] - P[a + 1]
          const uz = P[cc + 2] - P[a + 2]
          const vx = P[d] - P[b]
          const vy = P[d + 1] - P[b + 1]
          const vz = P[d + 2] - P[b + 2]
          let nx = uy * vz - uz * vy
          let ny = uz * vx - ux * vz
          let nz = ux * vy - uy * vx
          const nl = Math.hypot(nx, ny, nz) || 1
          nx /= nl
          ny /= nl
          nz /= nl
          const mx = (P[a] + P[cc]) / 2
          const my = (P[a + 1] + P[cc + 1]) / 2
          const mz = (P[a + 2] + P[cc + 2]) / 2
          const facing = nx * (cam.ex - mx) + ny * (cam.ey - my) + nz * (cam.ez - mz)
          const q = i * (s.closed ? nv : qv) + j
          s.face[q] = facing >= 0 ? 1 : -1
          const f = facing >= 0 ? 1 : -1
          const lit = clamp((nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) * f)
          const dark = (1 - lit) * 0.8 * s.shade + (f < 0 ? 0.12 : 0)
          s.tone[q] = Math.round(clamp(dark) * 32)
          const it = item()
          it.kind = 0
          it.s = s
          it.q = q
          it.i = i
          it.j = j
          const ia = a / 3
          const ib = b / 3
          const ic = cc / 3
          const id = d / 3
          it.d = (s.sd[ia] + s.sd[ib] + s.sd[ic] + s.sd[id]) / 4
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

    const lw = Math.max(0.9, Math.min(1.6, Math.min(w, h) / 420))
    const ref = cam.dist
    for (let k = 0; k < order.length; k += 1) {
      const it = order[k]
      if (it.kind === 0) paintQuad(it, lw, ref)
      else if (it.kind === 1) paintSegment(it, lw, ref)
      else paintDot(it, lw)
    }

    paintPollen(dt, o)
  }

  function paintQuad(it, lw, ref) {
    const s = it.s
    const { nv, sx, sy } = s
    const i = it.i
    const j = it.j
    const j1 = (j + 1) % nv
    const a = i * nv + j
    const b = (i + 1) * nv + j
    const c = (i + 1) * nv + j1
    const d = i * nv + j1
    ctx.beginPath()
    ctx.moveTo(sx[a], sy[a])
    ctx.lineTo(sx[b], sy[b])
    ctx.lineTo(sx[c], sy[c])
    ctx.lineTo(sx[d], sy[d])
    ctx.closePath()
    const tone = tones[s.tone[it.q]]
    ctx.fillStyle = tone
    ctx.fill()
    // the same colour round the edge closes the hairline gaps between quads
    ctx.strokeStyle = tone
    ctx.lineWidth = 0.9
    ctx.stroke()

    // outline: free edges, and silhouettes where the neighbour faces away
    const persp = Math.min(1.35, Math.max(0.75, ref / s.sd[a]))
    const face = s.face[it.q]
    const qv = s.closed ? nv : nv - 1
    const nu1 = s.nu - 1
    const E = s.edges
    ctx.beginPath()
    let any = false
    const seg = (p, q) => {
      ctx.moveTo(sx[p], sy[p])
      ctx.lineTo(sx[q], sy[q])
      any = true
    }
    // left edge (j side)
    if (j === 0 && !s.closed) {
      if (E.left) seg(a, b)
    } else {
      const nq = i * qv + (j === 0 ? qv - 1 : j - 1)
      if (s.face[nq] !== face) seg(a, b)
    }
    // right edge
    if (j === nv - 2 && !s.closed) {
      if (E.right) seg(d, c)
    } else {
      const nq = i * qv + ((j + 1) % qv)
      if (s.face[nq] !== face) seg(d, c)
    }
    // base edge
    if (i === 0) {
      if (E.base) seg(a, d)
    } else if (s.face[(i - 1) * qv + j] !== face) seg(a, d)
    // tip edge
    if (i === nu1 - 1) {
      if (E.tip) seg(b, c)
    } else if (s.face[(i + 1) * qv + j] !== face) seg(b, c)
    if (any) {
      ctx.strokeStyle = inkStr(1)
      ctx.lineWidth = lw * persp
      ctx.stroke()
    }

    // veins through this quad
    if (s.veins) {
      const u0 = i / nu1
      const u1 = (i + 1) / nu1
      for (const v of s.veins) {
        if (Math.floor(v.j) !== j || u1 <= v.from || u0 >= v.to) continue
        const t = v.j - j
        const fadeIn = clamp((u0 - v.from) / 0.12)
        const fadeOut = clamp((v.to - u1) / 0.18)
        const alpha = v.alpha * Math.max(0.15, Math.min(fadeIn + 0.3, fadeOut + 0.3, 1))
        ctx.beginPath()
        ctx.moveTo(mix(sx[a], sx[d], t), mix(sy[a], sy[d], t))
        ctx.lineTo(mix(sx[b], sx[c], t), mix(sy[b], sy[c], t))
        ctx.strokeStyle = inkStr(alpha)
        ctx.lineWidth = lw * 0.7 * persp
        ctx.stroke()
      }
    }
    // freckles
    if (s.spots) {
      for (const sp of s.spots) {
        if (sp.i !== i || sp.j !== j) continue
        const x = mix(mix(sx[a], sx[d], sp.fv), mix(sx[b], sx[c], sp.fv), sp.fu)
        const y = mix(mix(sy[a], sy[d], sp.fv), mix(sy[b], sy[c], sp.fv), sp.fu)
        ctx.beginPath()
        ctx.arc(x, y, Math.max(0.6, (sp.r * cam.F) / s.sd[a]), 0, Math.PI * 2)
        ctx.fillStyle = inkStr(0.75)
        ctx.fill()
      }
    }
  }

  function paintSegment(it, lw, ref) {
    const l = it.l
    const persp = Math.min(1.35, Math.max(0.75, ref / it.d))
    ctx.beginPath()
    ctx.moveTo(it.a[0], it.a[1])
    ctx.lineTo(it.b[0], it.b[1])
    if (l.ww) {
      // a solid world-sized bar (an anther): outlined, filled with ink
      ctx.strokeStyle = inkStr(l.alpha)
      ctx.lineWidth = Math.max(lw * 1.6, (l.ww * cam.F) / it.d)
    } else {
      ctx.strokeStyle = inkStr(l.alpha)
      ctx.lineWidth = lw * l.w * persp
    }
    ctx.stroke()
  }

  function paintDot(it, lw) {
    const d = it.l
    const r = Math.max(1, (d.r * cam.F) / it.d)
    ctx.beginPath()
    ctx.arc(it.a[0], it.a[1], r, 0, Math.PI * 2)
    if (d.fill === 'paper') {
      ctx.fillStyle = paperStr
      ctx.fill()
    } else {
      ctx.fillStyle = inkStr(1)
      ctx.fill()
    }
    if (d.ring) {
      ctx.strokeStyle = inkStr(1)
      ctx.lineWidth = lw * 0.9
      ctx.stroke()
    }
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

  function spawn() {
    // pick a petal, weighted by how much pollen it gives (leaves give none)
    let total = 0
    for (let n = 0; n < scene.ns; n += 1) total += scene.surfaces[n].pollen
    if (total <= 0) return
    let r = rand() * total
    let n = 0
    for (; n < scene.ns; n += 1) {
      r -= scene.surfaces[n].pollen
      if (r <= 0) break
    }
    n = Math.min(n, scene.ns - 1)
    const s = scene.surfaces[n]
    // favour the outer half of the petal, where it has opened
    const fu = 0.25 + 0.75 * Math.sqrt(rand())
    pollen.push({
      n,
      fu,
      fv: rand(),
      age: 0,
      life: 2.2 + rand() * 2.6,
      vy: 10 + rand() * 22,
      wob: rand() * Math.PI * 2,
      wobA: 3 + rand() * 7,
      g: ASCII[Math.floor(rand() * ASCII.length)],
      next: 0.15 + rand() * 0.5,
      size: 0.8 + rand() * 0.5,
      dx: 0,
      dy: 0,
      nv: s.nv,
      nu: s.nu,
    })
  }

  function paintPollen(dt, o) {
    const rate = reduced ? 0 : 5 + 46 * o
    if (!reduced) {
      spawnDebt += rate * dt
      while (spawnDebt >= 1 && pollen.length < MAX_POLLEN) {
        spawn()
        spawnDebt -= 1
      }
      if (spawnDebt > 1) spawnDebt = 0
    } else if (pollen.length === 0) {
      // a still scatter, so reduced motion still shows the ASCII
      for (let k = 0; k < 60; k += 1) {
        spawn()
        const p = pollen[pollen.length - 1]
        p.age = p.life * (0.2 + rand() * 0.5)
        p.dy = -p.vy * p.age
      }
    }
    const base = Math.max(8.5, Math.min(12.5, Math.min(w, h) / 54))
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
          p.g = ASCII[Math.floor(rand() * ASCII.length)]
          p.next = 0.2 + rand() * 0.6
        }
      }
      // where its spot on the petal is now
      const fi = p.fu * (s.nu - 1)
      const i = Math.min(s.nu - 2, Math.floor(fi))
      const ti = fi - i
      const fj = p.fv * (s.nv - 1)
      const j = Math.min(s.nv - 2, Math.floor(fj))
      const tj = fj - j
      const a = i * s.nv + j
      const b = (i + 1) * s.nv + j
      const x = mix(mix(s.sx[a], s.sx[a + 1], tj), mix(s.sx[b], s.sx[b + 1], tj), ti) + p.dx
      const y = mix(mix(s.sy[a], s.sy[a + 1], tj), mix(s.sy[b], s.sy[b + 1], tj), ti) + p.dy
      const t = p.age / p.life
      const alpha = Math.min(1, t / 0.12) * (1 - smooth((t - 0.6) / 0.4))
      ctx.font = `500 ${Math.round(base * p.size)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`
      ctx.fillStyle = `rgba(${pollenRgb[0]},${pollenRgb[1]},${pollenRgb[2]},${alpha})`
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
    time += dt
    draw(dt, elapsed)
    raf = requestAnimationFrame(tick)
  }

  function resize() {
    const r = canvas.getBoundingClientRect()
    dpr = Math.min(2, window.devicePixelRatio || 1)
    w = r.width
    h = r.height
    canvas.width = Math.max(1, Math.round(w * dpr))
    canvas.height = Math.max(1, Math.round(h * dpr))
    fit = null
    if (!running) draw(0)
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
      pollen.length = 0
      fit = null
      if (!running) draw(0)
    },
    setBloom(on) {
      target = typeof on === 'number' ? on : on ? 1 : 0
      if (!running) draw(0)
    },
    setColor(hex) {
      pollenRgb = rgb(hex)
      if (!running) draw(0)
    },
    setInk(inkHex, paperHex) {
      ink = rgb(inkHex)
      if (paperHex) paper = rgb(paperHex)
      makeTones()
    },
    setReduced(on) {
      reduced = Boolean(on)
      pollen.length = 0
      if (!running) draw(0)
    },
    /** Pointer position over the stage, -1..1 each way (0, 0 at rest). */
    lean(x, y) {
      leanTo = [clamp(x, -1, 1), clamp(y, -1, 1)]
    },
    destroy() {
      this.stop()
    },
  }
}
