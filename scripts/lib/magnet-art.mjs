/**
 * The three fridge magnets on the Me page — a strawberry, a Spider-Man head
 * and an orange cat head — drawn in code in the flat style of the landing
 * page's strawberry cat. Runs in the browser (page.evaluate), so it must be
 * self-contained.
 *
 * Every magnet is drawn twice by the same function: once in colour, and once
 * as a height paint, where each part is filled with a grey that says how far
 * it stands proud of the magnet's dome (eyes and leaves raised, web lines
 * pressed in). `p(colour, raise)` picks whichever the pass needs.
 */
export function drawMagnets() {
  const SIZE = 800

  const ART = {
    strawberry(c, p) {
      // body: a rounded heart-ish strawberry, point down
      const body = new Path2D()
      body.moveTo(400, 742)
      body.bezierCurveTo(250, 690, 110, 520, 120, 360)
      body.bezierCurveTo(128, 236, 240, 196, 316, 214)
      body.bezierCurveTo(360, 224, 382, 236, 400, 236)
      body.bezierCurveTo(418, 236, 440, 224, 484, 214)
      body.bezierCurveTo(560, 196, 672, 236, 680, 360)
      body.bezierCurveTo(690, 520, 550, 690, 400, 742)
      body.closePath()
      c.fillStyle = p('#c8213a', 0)
      c.fill(body)
      // a soft lighter cheek, painted in (no height)
      c.save()
      c.clip(body)
      c.fillStyle = p('#de4a58', 0)
      c.beginPath()
      c.ellipse(300, 380, 70, 110, -0.35, 0, Math.PI * 2)
      c.fill()
      c.restore()
      // seeds
      c.fillStyle = p('#f6d26b', 0.09)
      const seeds = [
        [250, 330], [340, 300], [460, 300], [550, 330], [610, 420],
        [200, 430], [300, 420], [400, 380], [500, 420], [580, 520],
        [240, 530], [340, 520], [460, 520], [520, 610], [300, 620],
        [400, 620], [400, 470], [470, 690], [340, 700],
      ]
      for (const [x, y] of seeds) {
        c.beginPath()
        c.ellipse(x, y, 11, 17, (x - 400) / 900, 0, Math.PI * 2)
        c.fill()
      }
      // leaves: a five-point star, rounded like the cat's
      c.fillStyle = p('#7a913a', 0.32)
      c.strokeStyle = p('#7a913a', 0.32)
      c.lineJoin = 'round'
      c.lineWidth = 34
      const leaf = new Path2D()
      for (let i = 0; i < 10; i += 1) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5 + Math.PI / 5
        const r = i % 2 ? 72 : 150
        const x = 400 + Math.cos(a) * r * 1.15
        const y = 205 + Math.sin(a) * r * 0.62
        if (i) leaf.lineTo(x, y)
        else leaf.moveTo(x, y)
      }
      leaf.closePath()
      c.fill(leaf)
      c.stroke(leaf)
      // stem
      c.lineCap = 'round'
      c.lineWidth = 30
      c.strokeStyle = p('#5f7428', 0.42)
      c.beginPath()
      c.moveTo(400, 190)
      c.quadraticCurveTo(404, 120, 440, 82)
      c.stroke()
    },

    spidey(c, p) {
      // head: a broad dome narrowing to the chin
      const head = new Path2D()
      head.moveTo(400, 762)
      head.bezierCurveTo(300, 760, 172, 640, 140, 470)
      head.bezierCurveTo(104, 280, 220, 50, 400, 46)
      head.bezierCurveTo(580, 50, 696, 280, 660, 470)
      head.bezierCurveTo(628, 640, 500, 760, 400, 762)
      head.closePath()
      c.fillStyle = p('#d0212d', 0)
      c.fill(head)

      // webbing: spokes out of a hub between the eyes, and sagging rings
      c.save()
      c.clip(head)
      c.strokeStyle = p('#3a0a10', -0.06)
      c.lineWidth = 7
      c.lineCap = 'round'
      const hub = [400, 430]
      const spokes = 16
      for (let i = 0; i < spokes; i += 1) {
        const a = (i / spokes) * Math.PI * 2
        c.beginPath()
        c.moveTo(...hub)
        c.lineTo(hub[0] + Math.cos(a) * 600, hub[1] + Math.sin(a) * 600)
        c.stroke()
      }
      for (let r = 70; r < 520; r += 72) {
        c.beginPath()
        for (let i = 0; i <= spokes; i += 1) {
          const a0 = (i / spokes) * Math.PI * 2
          const a1 = ((i + 1) / spokes) * Math.PI * 2
          const x0 = hub[0] + Math.cos(a0) * r
          const y0 = hub[1] + Math.sin(a0) * r
          const x1 = hub[0] + Math.cos(a1) * r
          const y1 = hub[1] + Math.sin(a1) * r
          // each ring segment sags toward the hub
          const am = (a0 + a1) / 2
          const sag = r * 0.86
          if (i === 0) c.moveTo(x0, y0)
          if (i < spokes) c.quadraticCurveTo(hub[0] + Math.cos(am) * sag, hub[1] + Math.sin(am) * sag, x1, y1)
        }
        c.stroke()
      }
      c.restore()

      // eyes: big angled lenses with thick black frames
      const eye = (s) => {
        const e = new Path2D()
        const X = (x) => 400 + s * x
        e.moveTo(X(50), 424)
        e.bezierCurveTo(X(60), 346, X(152), 296, X(222), 318)
        e.bezierCurveTo(X(248), 328, X(248), 368, X(226), 410)
        e.bezierCurveTo(X(194), 470, X(126), 504, X(86), 494)
        e.bezierCurveTo(X(58), 486, X(46), 456, X(50), 424)
        e.closePath()
        return e
      }
      for (const s of [-1, 1]) {
        const e = eye(s)
        c.lineJoin = 'round'
        c.lineWidth = 32
        c.strokeStyle = p('#140508', 0.2)
        c.stroke(e)
        c.fillStyle = p('#fbf7f2', 0.13)
        c.fill(e)
      }
    },

    cat(c, p) {
      const orange = '#e2913a'
      // head and ears as one outline, so each ear swells out of the head in
      // a smooth curve rather than sitting on it as a separate triangle
      const head = new Path2D()
      head.moveTo(400, 708)
      head.bezierCurveTo(230, 708, 100, 620, 100, 480)
      head.bezierCurveTo(100, 380, 125, 330, 150, 280)
      head.bezierCurveTo(165, 250, 160, 150, 175, 105)
      head.quadraticCurveTo(185, 72, 215, 92)
      head.bezierCurveTo(250, 120, 290, 215, 335, 224)
      head.bezierCurveTo(355, 218, 380, 216, 400, 216)
      head.bezierCurveTo(420, 216, 445, 218, 465, 224)
      head.bezierCurveTo(510, 215, 550, 120, 585, 92)
      head.quadraticCurveTo(615, 72, 625, 105)
      head.bezierCurveTo(640, 150, 635, 250, 650, 280)
      head.bezierCurveTo(675, 330, 700, 380, 700, 480)
      head.bezierCurveTo(700, 620, 570, 708, 400, 708)
      head.closePath()
      c.fillStyle = p(orange, 0)
      c.fill(head)
      // inner ears, rounded
      c.fillStyle = p('#a85f22', -0.04)
      for (const s of [-1, 1]) {
        const X = (x) => 400 + s * x
        c.beginPath()
        c.moveTo(X(222), 236)
        c.quadraticCurveTo(X(220), 160, X(200), 128)
        c.quadraticCurveTo(X(150), 165, X(110), 222)
        c.quadraticCurveTo(X(170), 212, X(222), 236)
        c.fill()
      }
      // tabby stripes on the forehead
      c.strokeStyle = p('#c8732a', -0.03)
      c.lineCap = 'round'
      c.lineWidth = 20
      for (const [x, len] of [[360, 70], [400, 92], [440, 70]]) {
        c.beginPath()
        c.moveTo(x, 250)
        c.lineTo(x + (x - 400) * 0.15, 250 + len)
        c.stroke()
      }
      // muzzle
      c.fillStyle = p('#f7dcb6', 0.08)
      for (const s of [-1, 1]) {
        c.beginPath()
        c.ellipse(400 + s * 46, 568, 66, 50, 0, 0, Math.PI * 2)
        c.fill()
      }
      // eyes: content, sleepy arcs (like the cat in the photo)
      c.strokeStyle = p('#2d0510', 0.1)
      c.lineWidth = 22
      for (const s of [-1, 1]) {
        c.beginPath()
        c.arc(400 + s * 128, 440, 50, Math.PI * 0.12, Math.PI * 0.88)
        c.stroke()
      }
      // blush
      c.fillStyle = p('#f08a7a', 0.02)
      for (const s of [-1, 1]) {
        c.beginPath()
        c.ellipse(400 + s * 200, 530, 40, 22, 0, 0, Math.PI * 2)
        c.fill()
      }
      // nose and mouth
      c.fillStyle = p('#c24a5a', 0.16)
      c.beginPath()
      c.moveTo(372, 520)
      c.quadraticCurveTo(400, 508, 428, 520)
      c.quadraticCurveTo(414, 548, 400, 550)
      c.quadraticCurveTo(386, 548, 372, 520)
      c.fill()
      c.strokeStyle = p('#2d0510', 0.1)
      c.lineWidth = 9
      c.beginPath()
      c.moveTo(400, 548)
      c.quadraticCurveTo(400, 584, 368, 584)
      c.moveTo(400, 548)
      c.quadraticCurveTo(400, 584, 432, 584)
      c.stroke()
      // whiskers
      c.lineWidth = 7
      for (const s of [-1, 1]) {
        for (const dy of [-16, 14]) {
          c.beginPath()
          c.moveTo(400 + s * 150, 560 + dy)
          c.lineTo(400 + s * 250, 552 + dy * 1.8)
          c.stroke()
        }
      }
    },
  }

  /** Main body colour, for the back face. */
  const BACK = { strawberry: '#c8213a', spidey: '#d0212d', cat: '#e2913a' }

  const canvas = (w = SIZE, h = SIZE) => {
    const el = document.createElement('canvas')
    el.width = w
    el.height = h
    return [el, el.getContext('2d', { willReadFrequently: true })]
  }

  /** Two-pass chamfer distance (px) from every opaque pixel to the outline. */
  function distance(alpha, w, h) {
    const d = new Float32Array(w * h)
    const INF = 1e9
    for (let i = 0; i < d.length; i += 1) d[i] = alpha[i] > 0.5 ? INF : 0
    const D1 = 1
    const D2 = Math.SQRT2
    for (let y = 0; y < h; y += 1)
      for (let x = 0; x < w; x += 1) {
        const i = y * w + x
        if (!d[i]) continue
        let v = d[i]
        if (x > 0) v = Math.min(v, d[i - 1] + D1)
        if (y > 0) {
          v = Math.min(v, d[i - w] + D1)
          if (x > 0) v = Math.min(v, d[i - w - 1] + D2)
          if (x < w - 1) v = Math.min(v, d[i - w + 1] + D2)
        }
        d[i] = v
      }
    for (let y = h - 1; y >= 0; y -= 1)
      for (let x = w - 1; x >= 0; x -= 1) {
        const i = y * w + x
        if (!d[i]) continue
        let v = d[i]
        if (x < w - 1) v = Math.min(v, d[i + 1] + D1)
        if (y < h - 1) {
          v = Math.min(v, d[i + w] + D1)
          if (x < w - 1) v = Math.min(v, d[i + w + 1] + D2)
          if (x > 0) v = Math.min(v, d[i + w - 1] + D2)
        }
        d[i] = v
      }
    return d
  }

  const out = {}
  for (const [id, draw] of Object.entries(ART)) {
    const [color, cc] = canvas()
    draw(cc, (col) => col)

    // Height paint: 0.5 grey is "flush with the dome", lighter is raised.
    const [paint, pc] = canvas()
    draw(pc, (_, raise) => {
      const g = Math.round(Math.max(0, Math.min(1, 0.5 + raise)) * 255)
      return `rgb(${g},${g},${g})`
    })
    pc.filter = 'blur(6px)'
    pc.drawImage(paint, 0, 0)

    const cpx = cc.getImageData(0, 0, SIZE, SIZE).data
    const ppx = pc.getImageData(0, 0, SIZE, SIZE).data
    const n = SIZE * SIZE
    const alpha = new Float32Array(n)
    for (let i = 0; i < n; i += 1) alpha[i] = cpx[i * 4 + 3] / 255
    const dist = distance(alpha, SIZE, SIZE)

    // A pillowy dome off the outline, plus the painted relief on top.
    const R = 130
    const hv = new Float32Array(n)
    let peak = 0
    for (let i = 0; i < n; i += 1) {
      if (alpha[i] < 0.5) continue
      const f = Math.min(1, dist[i] / R)
      const dome = Math.sqrt(1 - (1 - f) * (1 - f))
      const relief = ppx[i * 4 + 3] ? ppx[i * 4] / 255 - 0.5 : 0
      hv[i] = Math.max(0, dome * 0.78 + relief * 0.9 * Math.min(1, f * 3))
      peak = Math.max(peak, hv[i])
    }

    // 16-bit height packed into red (high) and green (low), opaque.
    const [hc, hcx] = canvas()
    const hd = hcx.createImageData(SIZE, SIZE)
    for (let i = 0; i < n; i += 1) {
      const v = Math.round((hv[i] / peak) * 65535)
      hd.data[i * 4] = v >> 8
      hd.data[i * 4 + 1] = v & 255
      hd.data[i * 4 + 3] = 255
    }
    hcx.putImageData(hd, 0, 0)

    // Back: the silhouette in the body colour, with the magnet disc on it.
    const [bc, bcx] = canvas()
    bcx.drawImage(color, 0, 0)
    bcx.globalCompositeOperation = 'source-in'
    bcx.fillStyle = BACK[id]
    bcx.fillRect(0, 0, SIZE, SIZE)
    bcx.globalCompositeOperation = 'source-atop'
    bcx.fillStyle = '#2b2627'
    bcx.beginPath()
    bcx.arc(400, 430, 120, 0, Math.PI * 2)
    bcx.fill()

    out[id] = {
      color: color.toDataURL('image/png'),
      height: hc.toDataURL('image/png'),
      back: bc.toDataURL('image/png'),
      meta: { w: SIZE, h: SIZE, maxH: 105 },
    }
  }
  return out
}
