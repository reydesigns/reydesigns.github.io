#!/usr/bin/env node
/**
 * Builds the isometric room and its stickers in Assets/funzies/web/room/ from
 * Shreya's drawing, "Assets/funzies/isometric room.jpeg" (a screenshot of the
 * Procreate canvas), plus the stickers drawn in code (scripts/lib/room-art.mjs).
 * Needs the dev server running, to read the JPEG same-origin.
 *
 *   node scripts/prep-room.mjs
 *
 * The screenshot shows the art at about 3 screen pixels per art pixel — a
 * hair over, so every hundred or so pixels one runs 4 wide. The grid lines are
 * found where colour changes cluster, column by column and row by row, and
 * each cell is read at its median, which strips the JPEG noise. Colours are
 * then snapped to the drawing's own palette and the white canvas round each
 * shape made clear: that leaves the room (the big shape) and the items drawn
 * beside it, which become stickers.
 *
 * A sticker gets a white die-cut edge, STICKER_EDGE art pixels wide, and the
 * room a white border, ROOM_EDGE wide. Output:
 *   room.png               the room, border included
 *   stickers/<id>.png      each sticker, edge included
 *   stickers.json          { id: { w, h, k } } — size, and k, the furthest
 *                          reach of x + y over its opaque pixels (for the
 *                          peel, which folds along a line x + y = constant)
 */
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import { drawStickers } from './lib/room-art.mjs'

const SRC = '/Assets/funzies/isometric%20room.jpeg'
const OUT = 'Assets/funzies/web/room/'
const BASE = 'http://localhost:5173/'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const STICKER_EDGE = 1
const ROOM_EDGE = 4

/* The drawn items, by their bounding box on the 499 x 499 art grid. A box
   takes in the shapes centred inside it (the two lamps are one sticker) —
   those not in a smaller box, that is. */
const ITEMS = {
  room: [149, 95, 450, 470],
  'lights-1': [21, 4, 70, 49],
  'wall-shelf': [148, 12, 168, 31],
  books: [115, 29, 138, 53],
  plant: [68, 30, 101, 65],
  lamps: [146, 41, 167, 68],
  table: [25, 62, 64, 93],
  'flower-rug': [82, 74, 159, 128],
  'lights-2': [172, 80, 221, 125],
  bookshelf: [32, 103, 61, 183],
  bed: [76, 131, 125, 176],
  cabinet: [152, 124, 172, 171],
  tree: [182, 131, 214, 190],
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
const page = await browser.newPage()
await page.goto(BASE)

const drawn = Object.fromEntries(Object.entries(drawStickers()).map(([id, s]) => [id, { w: s.w, h: s.h, px: s.px }]))

const out = await page.evaluate(
  async ({ SRC, ITEMS, drawn, EDGE, ROOM_EDGE }) => {
    const img = new Image()
    img.src = SRC
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    const W = c.width
    const at = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]] }
    const diff = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
    const white = (p) => p[0] > 235 && p[1] > 235 && p[2] > 235

    // The white canvas within the dark app chrome.
    let X0 = 0; while (!white(at(X0, c.height >> 1))) X0++
    let X1 = W - 1; while (!white(at(X1, c.height >> 1))) X1--
    let Y0 = 0; while (!white(at(W >> 1, Y0))) Y0++
    let Y1 = c.height - 1; while (!white(at(X1 - 5, Y1))) Y1--
    X1++; Y1++

    // Grid lines: walk 3 or 4 pixels at a time, to wherever edges pile up.
    const cx = new Float64Array(W), cy = new Float64Array(c.height)
    for (let y = Y0; y < Y1; y++)
      for (let x = X0 + 1; x < X1; x++) {
        const p = at(x, y)
        if (diff(p, at(x - 1, y)) > 60) cx[x]++
        if (y > Y0 && diff(p, at(x, y - 1)) > 60) cy[y]++
      }
    const lines = (arr, a, b) => {
      const L = [a]
      for (let p = a; ; ) {
        const n = arr[p + 4] > arr[p + 3] * 1.5 ? p + 4 : p + 3
        if (n > b) break
        L.push(n)
        p = n
      }
      return L
    }
    const lx = lines(cx, X0, X1), ly = lines(cy, Y0, Y1)
    const GW = lx.length - 1, GH = ly.length - 1

    // Each cell's median colour (its inner pixels, clear of the edges).
    const med = (a) => a.sort((m, n) => m - n)[a.length >> 1]
    const cell = []
    for (let j = 0; j < GH; j++)
      for (let i = 0; i < GW; i++) {
        const r = [], gg = [], b = []
        for (let y = ly[j] + 1; y < ly[j + 1]; y++)
          for (let x = lx[i] + 1; x < lx[i + 1]; x++) { const p = at(x, y); r.push(p[0]); gg.push(p[1]); b.push(p[2]) }
        cell.push([med(r), med(gg), med(b)])
      }

    // Snap to the palette: the commonest colours, each standing for the
    // near-duplicates (JPEG drift) around it.
    const counts = new Map()
    for (const p of cell) { const k = p.join(); counts.set(k, (counts.get(k) || 0) + 1) }
    const pal = []
    for (const [k] of [...counts].sort((a, b) => b[1] - a[1])) {
      const col = k.split(',').map(Number)
      if (!pal.some((q) => diff(q, col) < 30)) pal.push(col)
    }
    const snap = cell.map((p) => pal.reduce((best, q) => (diff(q, p) < diff(best, p) ? q : best)))

    // Clear: the white connected to the canvas edge.
    const clear = new Uint8Array(GW * GH)
    const stack = []
    for (let i = 0; i < GW; i++) stack.push(i, (GH - 1) * GW + i)
    for (let j = 0; j < GH; j++) stack.push(j * GW, j * GW + GW - 1)
    while (stack.length) {
      const k = stack.pop()
      if (clear[k] || !(snap[k][0] > 225 && snap[k][1] > 225 && snap[k][2] > 225)) continue
      clear[k] = 1
      const i = k % GW
      if (i > 0) stack.push(k - 1)
      if (i < GW - 1) stack.push(k + 1)
      if (k >= GW) stack.push(k - GW)
      if (k < GW * (GH - 1)) stack.push(k + GW)
    }

    // Shapes (8-connected); specks under 4 pixels are JPEG noise, dropped.
    const label = new Int32Array(GW * GH).fill(-1)
    const shapes = []
    for (let k0 = 0; k0 < GW * GH; k0++) {
      if (clear[k0] || label[k0] >= 0) continue
      const s = { id: shapes.length, n: 0, cx: 0, cy: 0 }
      const todo = [k0]
      label[k0] = s.id
      while (todo.length) {
        const k = todo.pop()
        const i = k % GW, j = (k - i) / GW
        s.n++; s.cx += i; s.cy += j
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const ii = i + dx, jj = j + dy, r = jj * GW + ii
            if (ii < 0 || jj < 0 || ii >= GW || jj >= GH || clear[r] || label[r] >= 0) continue
            label[r] = s.id
            todo.push(r)
          }
      }
      s.cx /= s.n; s.cy /= s.n
      shapes.push(s)
    }

    const area = ([x0, y0, x1, y1]) => (x1 - x0) * (y1 - y0)
    for (const s of shapes) {
      const boxes = Object.entries(ITEMS).filter(([, [x0, y0, x1, y1]]) => s.cx >= x0 && s.cx <= x1 && s.cy >= y0 && s.cy <= y1)
      s.owner = boxes.sort((a, b) => area(a[1]) - area(b[1]))[0]?.[0]
    }

    const hex = (p) => '#' + p.map((v) => v.toString(16).padStart(2, '0')).join('')
    const sprites = {}
    for (const [id, [x0, y0, x1, y1]] of Object.entries(ITEMS)) {
      const w = x1 - x0 + 1, h = y1 - y0 + 1
      // Only this item's own shapes: a shape belongs to the smallest box it
      // is centred in (the room's box takes in a few items drawn beside it).
      const mine = (k) => {
        const s = shapes[label[k]]
        return s && s.n >= 4 && s.owner === id
      }
      const px = []
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px.push(mine(y * GW + x) ? hex(snap[y * GW + x]) : null)
      sprites[id] = { w, h, px }
    }
    Object.assign(sprites, drawn)

    // The die-cut edge: white wherever a clear pixel is within EDGE of art.
    const withEdge = ({ w, h, px }, EDGE) => {
      const W2 = w + 2 * EDGE, H2 = h + 2 * EDGE
      const o = new Array(W2 * H2).fill(null)
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[(y + EDGE) * W2 + x + EDGE] = px[y * w + x]
      const solid = o.map(Boolean)
      for (let y = 0; y < H2; y++)
        for (let x = 0; x < W2; x++) {
          if (solid[y * W2 + x]) continue
          let near = false
          for (let dy = -EDGE; dy <= EDGE && !near; dy++)
            for (let dx = -EDGE; dx <= EDGE && !near; dx++) {
              const xx = x + dx, yy = y + dy
              near = dx * dx + dy * dy <= EDGE * EDGE + 1 && xx >= 0 && yy >= 0 && xx < W2 && yy < H2 && solid[yy * W2 + xx]
            }
          if (near) o[y * W2 + x] = '#ffffff'
        }
      return { w: W2, h: H2, px: o }
    }

    const png = ({ w, h, px }) => {
      const cv = document.createElement('canvas')
      cv.width = w
      cv.height = h
      const cg = cv.getContext('2d')
      const id = cg.createImageData(w, h)
      px.forEach((col, i) => {
        if (!col) return
        id.data.set([parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16), 255], i * 4)
      })
      cg.putImageData(id, 0, 0)
      return cv.toDataURL('image/png').split(',')[1]
    }

    const room = withEdge(sprites.room, ROOM_EDGE)
    const files = { 'room.png': png(room) }
    const meta = {}
    for (const [id, s] of Object.entries(sprites)) {
      if (id === 'room') continue
      const e = withEdge(s, EDGE)
      let k = 0
      e.px.forEach((col, i) => { if (col) k = Math.max(k, (i % e.w) + Math.floor(i / e.w) + 2) })
      files[`stickers/${id}.png`] = png(e)
      meta[id] = { w: e.w, h: e.h, k }
    }
    return { files, meta, grid: [GW, GH], room: [room.w, room.h] }
  },
  { SRC, ITEMS, drawn, EDGE: STICKER_EDGE, ROOM_EDGE },
)
await browser.close()

fs.mkdirSync(OUT + 'stickers', { recursive: true })
for (const [name, b64] of Object.entries(out.files)) fs.writeFileSync(OUT + name, Buffer.from(b64, 'base64'))
fs.writeFileSync(OUT + 'stickers.json', JSON.stringify(out.meta, null, 2) + '\n')
console.log(`grid ${out.grid.join('x')}, room ${out.room.join('x')}, ${Object.keys(out.meta).length} stickers`)
