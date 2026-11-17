import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import style from '@/data/style_config.json'
import { DIGIT_COLS, DIGIT_ROWS, paintDigitSheet } from './calendarDigits'

/**
 * The strawberry cat's block calendar: MM YYYY on six little glazed blocks,
 * set into a window in the hood under the cat's chin, like a desk calendar of
 * clay cubes. Built from the cat's own mesh and maps (Drawing3D hands them
 * over), so it sits on the hood's curve and wears the hood's colour and
 * gloss, and added to the same group, so it turns and bobs with the cat.
 *
 * The cat itself is not touched. The window is laid over it: a rolled lip of
 * the hood's clay round a darker floor, both following the hood's surface,
 * and the blocks sunk into it to two thirds of their depth, so the hood hides
 * their backs. A block that flips turns inside the hood, as if in a slot.
 *
 * The blocks are one InstancedMesh: one shared rounded-box geometry, one
 * material, and the digits from one painted sheet (calendarDigits.js). Each
 * block has its own pivot (an Object3D at its centre) whose matrix is copied
 * into the mesh, so each turns on its own X axis. Which digit is painted on
 * each of a block's four faces round that axis (front, top, back, bottom) is
 * a per-block attribute the shader reads, so a flip only rewrites numbers.
 *
 * A change flips the blocks whose digit changed: one full turn forward over
 * the top, the new digit already on the faces coming round and swapped onto
 * the front while it faces away, landing with a small overshoot and settle.
 * Changed blocks go left to right, STAGGER_MS apart. Under reduced motion the
 * digit cross-fades instead.
 */

/** Model units per drawing pixel (drawing.worker.js's SC). */
const SC = 1 / 260

const SPIN_MS = 800
const FADE_MS = 220
const STAGGER_MS = 120
/** How far past a full turn a block swings before it settles, in turns. */
const OVERSHOOT = 7 / 360
/** The share of the spin spent getting to the overshoot; the rest settles. */
const SWING = 0.8

/* The window, in units of a block's size. */
const GAP = 0.08 // between two blocks
const GROUP_GAP = 0.32 // between the month and the year
const BEVEL = 0.15 // the blocks' rounded edges
const LIP_R = 0.16 // the lip's half-width across the hood
const LIP_RZ = 0.18 // its half-height out of the hood
const LIP_Z = 0.14 // its middle, above the hood's surface
const PAD_X = 0.1 // room between the end blocks and the lip
const PAD_Y = 0.12 // and above and below the blocks, which they turn in
const FACE_Z = 0.3 // a block's front, above the hood's surface (just under the lip's top)
const FLOOR_Z = 0.03 // the window's floor, above the hood's surface
const PAINT_SIZE = 1.12 // the digits' size on the faces

const CREAM = '#f1e6d0'
const INK = '#3a1d13'

const ease = {
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
}

/** A spin's progress in turns, 0 to 1, by its share of the time. */
function spinTurns(t) {
  if (t >= 1) return 1
  if (t < SWING) return ease.inOutCubic(t / SWING) * (1 + OVERSHOOT)
  return 1 + OVERSHOOT - ease.inOutSine((t - SWING) / (1 - SWING)) * OVERSHOOT
}

/** The gloss of one of style_config.json's regions. */
function gloss(name) {
  const r = style.regions.find((x) => x.name === name) ?? style.regions.at(-1)
  return { roughness: r.roughness, clearcoat: r.clearcoat, clearcoatRoughness: r.clearcoatRoughness }
}

/** A material in the drawing's own finish: glossy physical, or matte. */
function finish(color, region, extra = {}) {
  if (!style.enabled) return new THREE.MeshLambertMaterial({ color, ...extra })
  return new THREE.MeshPhysicalMaterial({ color, metalness: 0, ...gloss(region), ...extra })
}

/**
 * The cat's front surface, from the worker's mesh: its height at any point,
 * and the way from the drawing's pixels to model units. The mesh is a regular
 * grid, row by row from the top.
 */
export function surfaceOf(position, meta) {
  let cw = 1
  while (cw * 3 < position.length && position[cw * 3] > position[(cw - 1) * 3]) cw += 1
  const ch = position.length / 3 / cw
  const W = meta.w * SC
  const H = meta.h * SC
  const z = (ix, iy) => position[(iy * cw + ix) * 3 + 2]
  return {
    /** Model x, y of the drawing's pixel (px, py). */
    fromPx: (px, py) => [(px / meta.w - 0.5) * W, (0.5 - py / meta.h) * H],
    /** The front's height (z) at model x, y, between the grid's points. */
    heightAt(x, y) {
      const gx = Math.min(cw - 1.001, Math.max(0, ((x + W / 2) / W) * (cw - 1)))
      const gy = Math.min(ch - 1.001, Math.max(0, ((H / 2 - y) / H) * (ch - 1)))
      const x0 = Math.floor(gx)
      const y0 = Math.floor(gy)
      const fx = gx - x0
      const fy = gy - y0
      const top = z(x0, y0) + (z(x0 + 1, y0) - z(x0, y0)) * fx
      const bot = z(x0, y0 + 1) + (z(x0 + 1, y0 + 1) - z(x0, y0 + 1)) * fx
      return top + (bot - top) * fy
    },
  }
}

/** The median colour of the drawing's map over a box, as a three.js colour. */
function colourUnder({ data, w }, x0, y0, x1, y1) {
  const ch = [[], [], []]
  for (let y = Math.round(y0); y < y1; y += 2) {
    for (let x = Math.round(x0); x < x1; x += 2) {
      const i = (y * w + x) * 4
      if (data[i + 3] < 128) continue
      for (let k = 0; k < 3; k += 1) ch[k].push(data[i + k])
    }
  }
  const mid = (a) => (a.length ? a.sort((p, q) => p - q)[a.length >> 1] : 0)
  return new THREE.Color().setRGB(mid(ch[0]) / 255, mid(ch[1]) / 255, mid(ch[2]) / 255, THREE.SRGBColorSpace)
}

/** Points round a rounded rectangle (centre 0, 0), evenly spaced, each with
    its outward normal. */
function roundedRectPath(w, h, r, n) {
  const sx = w / 2 - r
  const sy = h / 2 - r
  const perim = 4 * (sx + sy) + 2 * Math.PI * r
  const pts = []
  for (let k = 0; k < n; k += 1) {
    let s = (k / n) * perim
    // Walk: right side up, top-right arc, top leftwards, ... (anticlockwise).
    const segs = [
      [2 * sy, (u) => [sx + r, -sy + u, 1, 0]],
      [(Math.PI / 2) * r, (u) => arc(sx, sy, u / r)],
      [2 * sx, (u) => [sx - u, sy + r, 0, 1]],
      [(Math.PI / 2) * r, (u) => arc(-sx, sy, Math.PI / 2 + u / r)],
      [2 * sy, (u) => [-sx - r, sy - u, -1, 0]],
      [(Math.PI / 2) * r, (u) => arc(-sx, -sy, Math.PI + u / r)],
      [2 * sx, (u) => [-sx + u, -sy - r, 0, -1]],
      [(Math.PI / 2) * r, (u) => arc(sx, -sy, (3 * Math.PI) / 2 + u / r)],
    ]
    for (const [len, at] of segs) {
      if (s <= len) {
        pts.push(at(s))
        break
      }
      s -= len
    }
  }
  function arc(cx, cy, a) {
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.cos(a), Math.sin(a)]
  }
  return pts
}

/** The lip: a soft roll of clay round the window, laid on the hood. */
function lipGeometry({ w, h, r, cx, cy, c, heightAt }) {
  const path = roundedRectPath(w, h, r, 180)
  const M = 18
  const n = path.length
  const pos = new Float32Array(n * M * 3)
  for (let i = 0; i < n; i += 1) {
    const [px, py, nx, ny] = path[i]
    for (let j = 0; j < M; j += 1) {
      const a = (j / M) * Math.PI * 2
      const x = cx + px + nx * Math.cos(a) * LIP_R * c
      const y = cy + py + ny * Math.cos(a) * LIP_R * c
      const k = (i * M + j) * 3
      pos[k] = x
      pos[k + 1] = y
      pos[k + 2] = heightAt(x, y) + (LIP_Z + Math.sin(a) * LIP_RZ) * c
    }
  }
  const index = []
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < M; j += 1) {
      const a = i * M + j
      const b = ((i + 1) % n) * M + j
      const d = i * M + ((j + 1) % M)
      const e = ((i + 1) % n) * M + ((j + 1) % M)
      index.push(a, b, d, b, e, d)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  return g
}

/** The floor inside the lip: the hood's surface, raised a little and darker,
    shaded deeper towards its edges as a recess would be. */
function floorGeometry({ w, h, r, cx, cy, c, heightAt }) {
  const g = new THREE.PlaneGeometry(w, h, 72, 12)
  const pos = g.attributes.position
  const col = new Float32Array(pos.count * 3)
  const sx = w / 2 - r
  const sy = h / 2 - r
  for (let i = 0; i < pos.count; i += 1) {
    let x = pos.getX(i)
    let y = pos.getY(i)
    // Round the corners off.
    const kx = Math.max(0, Math.abs(x) - sx)
    const ky = Math.max(0, Math.abs(y) - sy)
    const d = Math.hypot(kx, ky)
    if (d > r) {
      x = Math.sign(x) * (sx + (kx * r) / d)
      y = Math.sign(y) * (sy + (ky * r) / d)
    }
    // How far in from the edge, in block sizes: darker near the lip, and
    // darkest under the top one.
    const edge = Math.min(w / 2 - Math.abs(x), h / 2 - Math.abs(y)) / c
    const top = (h / 2 - y) / c
    const shade = 0.55 + 0.45 * Math.min(1, edge / 0.35) - 0.12 * Math.max(0, 1 - top / 0.4)
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = Math.max(0.3, shade)
    pos.setXYZ(i, cx + x, cy + y, heightAt(cx + x, cy + y) + FLOOR_Z * c)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

/** The block material: the cat's plastic glaze in cream, with the digit
    painted on whichever face is which (see the file comment). */
function blockMaterial(sheet, size) {
  const m = finish(new THREE.Color(CREAM), 'plastic')
  const uniforms = {
    uSheet: { value: sheet },
    uInk: { value: new THREE.Color(INK) },
    uSize: { value: size },
  }
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec4 aDigits;
        attribute vec4 aPaint;
        varying vec3 vBlock;
        varying vec4 vDigits;
        varying vec4 vPaint;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vBlock = position;
        vDigits = aDigits;
        vPaint = aPaint;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uSheet;
        uniform vec3 uInk;
        uniform float uSize;
        varying vec3 vBlock;
        varying vec4 vDigits;
        varying vec4 vPaint;

        // Digit d's paint at (uv) on a face, 0..1 across it, up the digit.
        float digitInk(float d, vec2 uv, vec2 gx, vec2 gy) {
          if (d < 0.0) return 0.0;
          vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
          vec2 cell = vec2(mod(d, ${DIGIT_COLS}.0), floor(d / ${DIGIT_COLS}.0));
          vec2 at = vec2((cell.x + uv.x) / ${DIGIT_COLS}.0, 1.0 - (cell.y + 1.0 - uv.y) / ${DIGIT_ROWS}.0);
          vec2 k = vec2(1.0 / ${DIGIT_COLS}.0, 1.0 / ${DIGIT_ROWS}.0);
          return inside.x * inside.y * textureGrad(uSheet, at, gx * k, gy * k).r;
        }

        // The paint on this point of the block. Its faces round the X axis
        // are in turn front (+z), top (+y), back (-z) and bottom (-y); each
        // face's own up is the way that is up once it has turned to the front,
        // so a digit always lands upright and never mirrored.
        float blockInk(vec3 p) {
          vec3 a = abs(p);
          vec3 dx = dFdx(p) / uSize;
          vec3 dy = dFdy(p) / uSize;
          vec2 uv;
          vec2 gx;
          vec2 gy;
          float d;
          bool front = false;
          if (a.z >= a.x && a.z >= a.y) {
            if (p.z > 0.0) { uv = p.xy; gx = dx.xy; gy = dy.xy; d = vDigits.x; front = true; }
            else { uv = vec2(p.x, -p.y); gx = vec2(dx.x, -dx.y); gy = vec2(dy.x, -dy.y); d = vDigits.z; }
          } else if (a.y >= a.x) {
            if (p.y > 0.0) { uv = vec2(p.x, -p.z); gx = vec2(dx.x, -dx.z); gy = vec2(dy.x, -dy.z); d = vDigits.y; }
            else { uv = p.xz; gx = dx.xz; gy = dy.xz; d = vDigits.w; }
          } else {
            return 0.0;
          }
          // Painted by hand: each block's digit leans and sits its own way.
          float c = cos(vPaint.z);
          float s = sin(vPaint.z);
          mat2 lean = mat2(c, -s, s, c) / vPaint.w;
          uv = lean * (uv / uSize) + 0.5;
          gx = lean * gx;
          gy = lean * gy;
          float ink = digitInk(d, uv, gx, gy);
          // A cross-fade on the front (reduced motion): from vPaint.x to d.
          if (front && vPaint.x >= 0.0) ink = mix(digitInk(vPaint.x, uv, gx, gy), ink, vPaint.y);
          return ink;
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, uInk, clamp(blockInk(vBlock), 0.0, 1.0));`,
      )
  }
  m.customProgramCacheKey = () => 'cat-calendar-block'
  return m
}

/**
 * Builds the calendar for a drawing. `place` is where it goes, in the
 * drawing's pixels: its centre (x, y) and a block's size (cube). `surface` is
 * surfaceOf(the front mesh's positions), `map` the colour map's pixels
 * ({ data, w, h }), `maxAniso` the renderer's anisotropy.
 *
 * Returns the group to add to the drawing, and:
 *   show(digits)          set at once (on load)
 *   change(digits, now)   flip (or fade) the blocks whose digit changed
 *   update(now)           every frame, before rendering
 *   hide(on)              take it off the cat (the poster still, scripts)
 *   digits()              what the blocks show (or are landing on)
 *   busy()                whether any block is moving
 *   moving()              which blocks are
 *   dispose()
 */
export function createCatCalendar({ place, surface, map, reduced = false, maxAniso = 1 }) {
  const { heightAt, fromPx } = surface
  const c = place.cube * SC
  const [cx, cy] = fromPx(place.x, place.y)

  // The blocks' centres along the row, the month then the year.
  const xs = []
  let x = 0
  for (let i = 0; i < 6; i += 1) {
    xs.push(x)
    x += c * (1 + (i === 1 ? GROUP_GAP : GAP))
  }
  const span = xs[5] + c
  const left = cx - span / 2 + c / 2

  // The window (the lip's middle line) round them.
  const ww = span + 2 * (LIP_R + PAD_X) * c
  const wh = c + 2 * (LIP_R + PAD_Y) * c
  const wr = wh * 0.42

  // The hood's colour, from under the window.
  const halfPx = { x: ww / SC / 2, y: wh / SC / 2 }
  const hood = colourUnder(map, place.x - halfPx.x, place.y - halfPx.y, place.x + halfPx.x, place.y + halfPx.y)

  const group = new THREE.Group()
  group.name = 'cat-calendar'
  const owned = []
  const own = (x) => (owned.push(x), x)

  const lipMat = own(finish(hood, 'dark-gloss'))
  const lip = new THREE.Mesh(own(lipGeometry({ w: ww, h: wh, r: wr, cx, cy, c, heightAt })), lipMat)
  const floorMat = own(
    finish(hood.clone().multiplyScalar(0.62), 'dark-gloss', style.enabled ? { vertexColors: true, clearcoat: 0.3 } : { vertexColors: true }),
  )
  const floor = new THREE.Mesh(own(floorGeometry({ w: ww, h: wh, r: wr, cx, cy, c, heightAt })), floorMat)

  // A slim post of the same clay between the month and the year, standing
  // as far out as the blocks, so the window reads as two.
  const postX = left + xs[1] + c / 2 + (GROUP_GAP * c) / 2
  const postR = 0.085 * c
  const post = new THREE.Mesh(own(new THREE.CapsuleGeometry(postR, c * 0.78, 6, 14)), lipMat)
  post.position.set(postX, cy, heightAt(postX, cy) + (FACE_Z + 0.02) * c - postR)

  // The blocks.
  const sheet = own(new THREE.CanvasTexture(paintDigitSheet(160)))
  sheet.colorSpace = THREE.NoColorSpace
  sheet.anisotropy = maxAniso
  const blockMat = own(blockMaterial(sheet, c))
  const blockGeo = own(new RoundedBoxGeometry(c, c, c, 4, BEVEL * c))
  const digitsAttr = new THREE.InstancedBufferAttribute(new Float32Array(6 * 4).fill(-1), 4)
  const paintAttr = new THREE.InstancedBufferAttribute(new Float32Array(6 * 4), 4)
  digitsAttr.setUsage(THREE.DynamicDrawUsage)
  paintAttr.setUsage(THREE.DynamicDrawUsage)
  blockGeo.setAttribute('aDigits', digitsAttr)
  blockGeo.setAttribute('aPaint', paintAttr)
  const blocks = own(new THREE.InstancedMesh(blockGeo, blockMat, 6))
  blocks.frustumCulled = false
  blocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

  // Each block's pivot: at its centre, sunk into the hood, turned to follow
  // the hood's curve across the row. Its X rotation is the flip.
  const pivots = xs.map((bx, i) => {
    const px = left + bx
    const p = new THREE.Object3D()
    p.rotation.order = 'YXZ'
    const slope = (heightAt(px + c / 2, cy) - heightAt(px - c / 2, cy)) / c
    p.rotation.y = -Math.atan(slope) * 0.6
    // Sunk so only its front stands out of the hood, and turning inside it.
    p.position.set(px, cy, heightAt(px, cy) + FACE_Z * c - c / 2)
    // The hand that painted it: a slight lean and size of its own.
    const lean = [-0.035, 0.028, 0.02, -0.03, 0.04, -0.015][i]
    paintAttr.setXYZW(i, -1, 1, lean, PAINT_SIZE * (1 + [0.01, -0.02, 0.015, 0, -0.015, 0.02][i]))
    return p
  })
  const place6 = () => {
    pivots.forEach((p, i) => {
      p.updateMatrix()
      blocks.setMatrixAt(i, p.matrix)
    })
    blocks.instanceMatrix.needsUpdate = true
  }
  place6()

  group.add(floor, lip, post, blocks)

  // What each block shows, or is on its way to.
  let shown = [-1, -1, -1, -1, -1, -1]
  const anims = new Map()

  // At rest only the front is painted: the camera sees a sliver of the top.
  const setFaces = (i, front, rest = -1) => {
    digitsAttr.setXYZW(i, front, rest, rest, rest)
    digitsAttr.needsUpdate = true
  }

  const show = (digits) => {
    anims.clear()
    shown = [...digits]
    pivots.forEach((p) => (p.rotation.x = 0))
    place6()
    shown.forEach((d, i) => {
      setFaces(i, d)
      paintAttr.setX(i, -1)
    })
    paintAttr.needsUpdate = true
  }

  const change = (digits, now) => {
    let k = 0
    digits.forEach((d, i) => {
      if (d === shown[i]) return
      anims.set(i, { from: shown[i], to: d, start: now + k * STAGGER_MS, begun: false, swapped: false })
      shown[i] = d
      k += 1
    })
  }

  const update = (now) => {
    if (!anims.size) return
    let moved = false
    for (const [i, a] of anims) {
      const t = (now - a.start) / (reduced ? FADE_MS : SPIN_MS)
      if (t < 0) continue
      if (reduced) {
        paintAttr.setX(i, a.from)
        paintAttr.setY(i, ease.inOutSine(Math.min(1, t)))
        if (!a.begun) setFaces(i, a.to)
        a.begun = true
        if (t >= 1) {
          paintAttr.setX(i, -1)
          anims.delete(i)
        }
        paintAttr.needsUpdate = true
        continue
      }
      // The new digit goes on the faces coming round as the spin starts, and
      // on the front once that faces away, half a turn in.
      if (!a.begun) {
        setFaces(i, a.from, a.to)
        a.begun = true
      }
      const turns = spinTurns(t)
      if (!a.swapped && turns >= 0.5) {
        setFaces(i, a.to, a.to)
        a.swapped = true
      }
      pivots[i].rotation.x = t >= 1 ? 0 : turns * Math.PI * 2
      moved = true
      if (t >= 1) {
        setFaces(i, a.to)
        anims.delete(i)
      }
    }
    if (moved) place6()
  }

  return {
    group,
    show,
    change,
    update,
    hide(on) {
      group.visible = !on
    },
    digits: () => [...shown],
    busy: () => anims.size > 0,
    /** Which blocks are flipping (or fading), left to right. */
    moving: () => [...anims.keys()].sort((p, q) => p - q),
    dispose() {
      owned.forEach((o) => o.dispose())
    },
  }
}
