import { useId } from 'react'

/* ---------------------------------------------------------------------------
   The Vinyl Player's turntable, seen from straight above.

   Faceted SVG in the --vp-* tokens (coloured through the .vpf-* classes in
   global.css), black, white and greys only. The light is up and to the
   left, so a facet is lit, base or shaded by which way it faces
   (facetClass), and every solid casts a hard, offset shadow down and to the
   right.

   Two things break the flat shading, by design. The body (Case) is a frosted,
   clear acrylic top over a black floor, the electronics inside showing
   through it, blurred, all held in a brushed-metal bezel. And the metal
   parts (bezel, platter rim, tonearm, hinges, controls) are chrome: SVG
   gradients (MetalDefs) whose stops are the --vp-chrome-* greys.

   The layout is a classic deck: the platter on the left half, the tonearm
   pivoting at the top right and swinging in from the right, and the controls
   (power light, speed buttons, pitch slider, start/stop) down the right edge,
   so the player faces right, towards nothing but the edge of the table.

   All coordinates are in the plinth's own units (PLINTH), and the scene
   places and scales the whole player with one transform. Nothing in here
   animates by itself. A still render (the Works card thumbnail) passes the
   pose as props; the live one (VinylPlayerModal) passes `parts`, a plain
   object this fills with the DOM nodes the modal then moves every frame:
   the arm, its shadow and cue lever, the drop ring, the power light, and one
   spinning slot per record.
--------------------------------------------------------------------------- */

export const PLINTH = { w: 940, h: 680, chamfer: 46, bevel: 24 }
export const PLATTER = { x: 340, y: 340, r: 262 }
/** The radius of a record lying on the platter. */
export const RECORD_R = 250
/** Records are drawn at this radius, and scaled to wherever they are. */
export const DISC = 100

/* The tonearm, pointing along +x from its pivot before it is rotated. The
   headshell is bent in towards the record, so the stylus sits off the arm's
   axis; armAngleAt() allows for that. */
export const ARM = { x: 760, y: 138, len: 426 }
const HEAD = { at: ARM.len - 54, bend: 24, reach: 60 }
const STYLUS = {
  x: HEAD.at + HEAD.reach * Math.cos(rad(HEAD.bend)),
  y: HEAD.reach * Math.sin(rad(HEAD.bend)),
}
export const ARM_REST = 90

/** The arm angle (degrees, clockwise from +x) that puts the stylus `dist`
    from the platter's centre, on the near side of the record. */
export function armAngleAt(dist) {
  const reach = Math.hypot(STYLUS.x, STYLUS.y)
  const dx = PLATTER.x - ARM.x
  const dy = PLATTER.y - ARM.y
  const span = Math.hypot(dx, dy)
  const inward = Math.acos((reach ** 2 + span ** 2 - dist ** 2) / (2 * reach * span))
  return deg(Math.atan2(dy, dx) - inward - Math.atan2(STYLUS.y, STYLUS.x))
}
/** Where the stylus drops (the lead-in groove), and where ten seconds of
    tracking carry it (exaggerated, so the creep inwards can be seen). */
export const ARM_PLAY = armAngleAt(RECORD_R * 0.9)
export const ARM_DRIFT = armAngleAt(RECORD_R * 0.82)

/* --- geometry ------------------------------------------------------------ */

function rad(d) {
  return (d * Math.PI) / 180
}
function deg(r) {
  return (r * 180) / Math.PI
}
const fmt = (n) => Math.round(n * 100) / 100

/** Points of a regular n-gon, as an SVG `points` string. */
export function ngon(n, r, cx = 0, cy = 0, turn = 0) {
  let out = ''
  for (let k = 0; k < n; k += 1) {
    const a = ((k + turn) / n) * Math.PI * 2
    out += `${fmt(cx + r * Math.cos(a))},${fmt(cy + r * Math.sin(a))} `
  }
  return out.trim()
}

/** An annulus sector, approximated with straight segments (a facet band). */
export function arcBand(r0, r1, a0, a1, cx = 0, cy = 0, steps = 6) {
  const outer = []
  const inner = []
  for (let k = 0; k <= steps; k += 1) {
    const a = rad(a0 + ((a1 - a0) * k) / steps)
    outer.push(`${fmt(cx + r1 * Math.cos(a))},${fmt(cy + r1 * Math.sin(a))}`)
    inner.unshift(`${fmt(cx + r0 * Math.cos(a))},${fmt(cy + r0 * Math.sin(a))}`)
  }
  return [...outer, ...inner].join(' ')
}

/* The light comes from the upper left. */
const LIGHT = { x: -0.62, y: -0.78 }
/** Which of a material's three facets a face with outward normal (nx, ny)
    gets: 'light', '' (base) or 'dark'. */
export function facetOf(nx, ny) {
  const d = nx * LIGHT.x + ny * LIGHT.y
  if (d > 0.36) return 'light'
  if (d < -0.36) return 'dark'
  return ''
}
const tone = (material, nx, ny) => {
  const f = facetOf(nx, ny)
  return f ? `vpf-${material}-${f}` : `vpf-${material}`
}

/** A bevelled octagon: the top face plus one facet per edge, each shaded by
    the way it faces. Corners are 45 degree chamfers. */
function bevelled({ x = 0, y = 0, w, h, c, b }) {
  const k = b * (Math.SQRT2 - 1)
  const outer = [
    [c, 0], [w - c, 0], [w, c], [w, h - c], [w - c, h], [c, h], [0, h - c], [0, c],
  ]
  const inner = [
    [c + k, b], [w - c - k, b], [w - b, c + k], [w - b, h - c - k],
    [w - c - k, h - b], [c + k, h - b], [b, h - c - k], [b, c + k],
  ]
  const s = Math.SQRT1_2
  const normals = [[0, -1], [s, -s], [1, 0], [s, s], [0, 1], [-s, s], [-1, 0], [-s, -s]]
  const p = ([px, py]) => `${fmt(x + px)},${fmt(y + py)}`
  const faces = outer.map((pt, i) => {
    const next = (i + 1) % 8
    return { points: [p(pt), p(outer[next]), p(inner[next]), p(inner[i])].join(' '), n: normals[i] }
  })
  return { outline: outer.map(p).join(' '), top: inner.map(p).join(' '), faces }
}

/** A faceted dome: n triangles from the centre, each shaded by its edge. */
function Dome({ n = 8, r, cx, cy, material, turn = 0.5 }) {
  const out = []
  for (let k = 0; k < n; k += 1) {
    const a0 = ((k + turn) / n) * Math.PI * 2
    const a1 = ((k + 1 + turn) / n) * Math.PI * 2
    const mid = (a0 + a1) / 2
    out.push(
      <polygon
        key={k}
        className={tone(material, Math.cos(mid), Math.sin(mid))}
        points={`${fmt(cx)},${fmt(cy)} ${fmt(cx + r * Math.cos(a0))},${fmt(cy + r * Math.sin(a0))} ${fmt(cx + r * Math.cos(a1))},${fmt(cy + r * Math.sin(a1))}`}
      />,
    )
  }
  return out
}

/* --- the record ------------------------------------------------------------ */

const DISC_SIDES = 40
const RECORD = {
  edge: ngon(DISC_SIDES, DISC),
  lip: ngon(DISC_SIDES, 96.5, 0, 0, 0.5),
  // Two thin, lighter bands are the gaps between tracks.
  gapA: ngon(DISC_SIDES, 85, 0, 0, 0.25),
  bandA: ngon(DISC_SIDES, 82.5, 0, 0, 0.75),
  gapB: ngon(DISC_SIDES, 66, 0, 0, 0.5),
  bandB: ngon(DISC_SIDES, 63.5, 0, 0, 0),
  runout: ngon(DISC_SIDES, 46, 0, 0, 0.5),
  label: 37,
}
/* The stationary sheen: two facets of reflected light on opposite sides of
   the centre, on the light's diagonal. On the platter it stays put while the
   record turns under it, which is what makes the spin read. */
const SHEEN = [arcBand(46, 92, 196, 232, 0, 0, 5), arcBand(46, 92, 16, 52, 0, 0, 5)]

export function Sheen() {
  return (
    <g className="vpf-sheen" opacity="0.42">
      <polygon points={SHEEN[0]} />
      <polygon points={SHEEN[1]} />
    </g>
  )
}

/**
 * One record at radius DISC (100), centred on the origin: a faceted
 * near-black disc with concentric facet bands, the album cover as its round
 * label, and the spindle hole. `clipId` names the scene's circular clip
 * (objectBoundingBox units, so one clip serves every label).
 */
export function Record({ clipId, coverSrc, sheen = true }) {
  return (
    <g>
      <polygon className="vpf-vinyl-dark" points={RECORD.edge} />
      <polygon className="vpf-vinyl" points={RECORD.lip} />
      <polygon className="vpf-vinyl-light" points={RECORD.gapA} />
      <polygon className="vpf-vinyl" points={RECORD.bandA} />
      <polygon className="vpf-vinyl-light" points={RECORD.gapB} />
      <polygon className="vpf-vinyl" points={RECORD.bandB} />
      <polygon className="vpf-vinyl-dark" points={RECORD.runout} />
      {sheen && <Sheen />}
      {/* The label's paper edge, so even a black cover reads as a label. */}
      <circle r={RECORD.label + 2.6} className="vpf-label-rim" />
      <circle r={RECORD.label} className="vpf-vinyl-light" />
      <image
        href={coverSrc}
        x={-RECORD.label}
        y={-RECORD.label}
        width={RECORD.label * 2}
        height={RECORD.label * 2}
        clipPath={`url(#${clipId})`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      />
      <circle r="3.4" className="vpf-vinyl-dark" />
    </g>
  )
}

/* --- chrome --------------------------------------------------------------- */

/* The metallic gradients' stops: [offset, --vp-chrome-N]. `chrome` runs
   corner to corner across whatever it fills; `bar` across a bar's thickness
   (the arm tube, the hinges, the slider knob); `rim` once across the whole
   platter, so the 40 rim facets read as one turned ring catching the light
   in bands; `bezel` once across the whole case, a softer brushed finish. */
const STOPS = {
  chrome: [[0, 1], [0.28, 3], [0.46, 1], [0.6, 4], [0.8, 2], [1, 3]],
  bar: [[0, 1], [0.42, 2], [0.58, 4], [1, 3]],
  rim: [[0, 2], [0.18, 4], [0.36, 1], [0.5, 3], [0.64, 1], [0.82, 5], [1, 2]],
  bezel: [[0, 2], [0.22, 3], [0.45, 1], [0.6, 3], [0.8, 2], [1, 4]],
}
function Stops({ list }) {
  return list.map(([offset, n]) => <stop key={offset} offset={offset} style={{ stopColor: `var(--vp-chrome-${n})` }} />)
}
/** One set of gradients per player. Ids come from useId, so the card's two
    layers and the pop-up never point at each other's. */
function MetalDefs({ ids }) {
  return (
    <defs>
      <linearGradient id={ids.chrome} x1="0" y1="0" x2="1" y2="1">
        <Stops list={STOPS.chrome} />
      </linearGradient>
      <linearGradient id={ids.bar} x1="0" y1="0" x2="0" y2="1">
        <Stops list={STOPS.bar} />
      </linearGradient>
      <linearGradient
        id={ids.rim}
        gradientUnits="userSpaceOnUse"
        x1={PLATTER.x - PLATTER.r}
        y1={PLATTER.y - PLATTER.r}
        x2={PLATTER.x + PLATTER.r}
        y2={PLATTER.y + PLATTER.r}
      >
        <Stops list={STOPS.rim} />
      </linearGradient>
      <linearGradient id={ids.bezel} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={PLINTH.w} y2={PLINTH.h}>
        <Stops list={STOPS.bezel} />
      </linearGradient>
    </defs>
  )
}

/* --- the case ------------------------------------------------------------- */

const PLINTH_SHAPE = bevelled({ w: PLINTH.w, h: PLINTH.h, c: PLINTH.chamfer, b: PLINTH.bevel })


/* The signal loom: three wires from the main board up to the back edge,
   along it, and down under the platter to the motor, in the margin the
   platter leaves clear. `o` moves a wire outwards (towards the case's
   rim), so the three stay parallel round every bend. */
const loom = (o) =>
  `M ${640 + o} 214 C 628 130 600 ${54 - o} 520 ${54 - o} L 220 ${54 - o} ` +
  `C ${160 - o} ${54 - o} ${128 - o} ${96 - o} ${128 - o} 210`
const LOOM = [
  ['vpw-light', 9],
  ['vpw-mid', 0],
  ['vpw-dark', -9],
]
/* Cable ties round the loom. */
const TIES = [
  { x: 300, y: 54, w: 7, h: 36 },
  { x: 470, y: 54, w: 7, h: 36 },
]
/* The mains cable: from the power socket in the front edge, along it to
   the power supply, an earth wire alongside. */
const MAINS = 'M 166 636 L 660 636'
const EARTH = 'M 166 622 L 660 622'

/* The main board, under the controls, and what is on it. */
const PCB = { x: 624, y: 214, w: 200, h: 252 }
const TRACES = [
  'M 696 252 L 730 252 L 742 264 L 742 300',
  'M 696 266 L 718 266 L 726 274 L 726 300',
  'M 676 340 L 706 340',
  'M 676 372 L 706 372',
  'M 736 360 L 736 398 L 724 410 L 650 410',
  'M 766 316 L 784 316 L 796 304 L 796 236',
  'M 766 344 L 782 344 L 792 354 L 792 440 L 780 452 L 722 452',
  'M 640 296 L 640 312',
]
const VIAS = [[742, 300], [726, 300], [650, 410], [796, 236], [722, 452], [640, 296]]
/** A chip seen from above, `pins` a side along the sides `sides` names. */
function Chip({ x, y, w, h, pins, sides }) {
  const out = []
  const step = (len, n) => len / (n + 1)
  if (sides.includes('x')) {
    for (let k = 1; k <= pins; k += 1) {
      const py = y + k * step(h, pins) - 2
      out.push(<rect key={`l${k}`} x={x - 7} y={py} width="7" height="4" className="vpf-metal-dark" />)
      out.push(<rect key={`r${k}`} x={x + w} y={py} width="7" height="4" className="vpf-metal-dark" />)
    }
  }
  if (sides.includes('y')) {
    for (let k = 1; k <= pins; k += 1) {
      const px = x + k * step(w, pins) - 2
      out.push(<rect key={`t${k}`} x={px} y={y - 7} width="4" height="7" className="vpf-metal-dark" />)
      out.push(<rect key={`b${k}`} x={px} y={y + h} width="4" height="7" className="vpf-metal-dark" />)
    }
  }
  return (
    <>
      {out}
      <rect x={x} y={y} width={w} height={h} rx="2" className="vpf-chip" />
      <circle cx={x + 7} cy={y + 7} r="2.5" className="vpf-body-light" />
    </>
  )
}
/** An electrolytic capacitor from above: its can, rim and vent cross. */
function Cap({ cx, cy, r }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} className="vpf-cap" />
      <circle cx={cx} cy={cy} r={r * 0.72} className="vpf-metal-dark" />
      <rect x={cx - r * 0.5} y={cy - 1} width={r} height="2" className="vpf-cap" />
      <rect x={cx - 1} y={cy - r * 0.5} width="2" height={r} className="vpf-cap" />
    </>
  )
}
const SCREWS = [[50, 50], [890, 50], [50, 630], [890, 630]]

/** What the frosted case shows of the inside: board, chips, power supply,
    wires, the corner screws and the light ring under the platter. Drawn
    sharp; Case blurs it. */
function Internals() {
  return (
    <>
      {/* Screws holding the floor, a slot across each. */}
      {SCREWS.map(([x, y]) => (
        <g key={`${x},${y}`}>
          <circle cx={x} cy={y} r="9" className="vpf-metal" />
          <rect x={x - 6} y={y - 1.5} width="12" height="3" className="vpf-metal-dark" />
        </g>
      ))}

      {/* The power socket in the front edge: a shroud and three pins. */}
      <rect x="104" y="612" width="62" height="40" rx="4" className="vpf-body-light" />
      <rect x="112" y="618" width="46" height="28" rx="3" className="vpf-chip" />
      {[122, 133, 144].map((x) => (
        <rect key={x} x={x} y="626" width="5" height="12" className="vpf-metal" />
      ))}
      <path d={EARTH} className="vpw vpw-sleeve" strokeWidth="8" />
      <path d={EARTH} className="vpw vpw-mid" strokeWidth="4.5" />
      <path d={MAINS} className="vpw vpw-sleeve" strokeWidth="15" />
      <path d={MAINS} className="vpw vpw-ribbon" strokeWidth="11" />

      {/* The ribbon cable from the board under the platter, to the motor. */}
      <path d="M 640 380 L 540 380" className="vpw vpw-ribbon" strokeWidth="26" strokeLinecap="butt" />
      {[-7, 0, 7].map((d) => (
        <path key={d} d={`M 640 ${380 + d} L 540 ${380 + d}`} className="vpw vpw-ribbon-line" strokeWidth="1.5" />
      ))}

      {/* The main board. */}
      <rect x={PCB.x} y={PCB.y} width={PCB.w} height={PCB.h} rx="8" className="vpf-pcb" />
      {TRACES.map((d) => (
        <path key={d} d={d} className="vpw vpw-trace" strokeWidth="3" />
      ))}
      {VIAS.map(([x, y]) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r="4" className="vpf-glow" />
      ))}
      {/* A heatsink: a base plate and its fins. */}
      <rect x="640" y="228" width="56" height="50" className="vpf-metal-dark" />
      {Array.from({ length: 6 }, (_, k) => (
        <rect key={k} x={643 + k * 9} y="228" width="4" height="50" className="vpf-metal" />
      ))}
      <Chip x={706} y={300} w={60} h={60} pins={5} sides="xy" />
      <Chip x={640} y={322} w={36} h={70} pins={5} sides="x" />
      <Cap cx={790} cy={262} r={13} />
      <Cap cx={760} cy={262} r={10} />
      <Cap cx={664} cy={436} r={15} />
      {/* A pin header down the board's right edge. */}
      {Array.from({ length: 8 }, (_, k) => (
        <rect key={k} x="806" y={308 + k * 15} width="9" height="9" className="vpf-metal-light" />
      ))}

      {/* The power supply: a transformer (laminated core, winding)
          and its smoothing capacitors, wired up to the board. */}
      <path d="M 694 584 C 694 540 676 520 676 466" className="vpw vpw-mid" strokeWidth="5" />
      <path d="M 712 584 C 714 530 744 520 744 466" className="vpw vpw-dark" strokeWidth="5" />
      <rect x="660" y="584" width="72" height="58" rx="3" className="vpf-body-light" />
      {[596, 610, 624].map((y) => (
        <rect key={y} x="660" y={y} width="72" height="2" className="vpf-body-dark" />
      ))}
      <rect x="678" y="584" width="36" height="58" rx="2" className="vpf-winding" />
      <Cap cx={764} cy={612} r={20} />
      <Cap cx={800} cy={600} r={11} />

      {/* The loom: a dark sleeve under each wire so it reads on the board
          and the floor alike, then the wires, then the ties. */}
      {LOOM.map(([, o]) => (
        <path key={`s${o}`} d={loom(o)} className="vpw vpw-sleeve" strokeWidth="9" />
      ))}
      {LOOM.map(([cls, o]) => (
        <path key={o} d={loom(o)} className={`vpw ${cls}`} strokeWidth="5.5" />
      ))}
      {TIES.map((t) => (
        <rect key={`${t.x},${t.y}`} x={t.x - t.w / 2} y={t.y - t.h / 2} width={t.w} height={t.h} rx="2" className="vpf-body-dark" />
      ))}

      {/* The light ring under the platter's edge, which the frost turns into
          a soft white halo round it. */}
      <circle cx={PLATTER.x} cy={PLATTER.y} r={PLATTER.r + 9} className="vpw vpw-glow" strokeWidth="9" />
    </>
  )
}

/* Glints across the frosted top: two light bands on the light's diagonal,
   corner to corner of the top-left of the case (the platter covers the
   rest of them). Their ends lie on the top face's edges, so they need no
   clip. */
const GLINTS = [
  '190,24 290,24 24,290 24,190',
  '330,24 356,24 24,356 24,330',
]

/** The body: a black floor, the electronics on it seen through the frost
    (blurred by `frostId`), the frosted acrylic top, and round it a
    brushed-metal bezel, each facet lit or shaded by the way it faces, with
    its outer edge catching the light. */
function Case({ frostId, metal }) {
  return (
    <>
      <defs>
        <filter id={frostId} x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
      </defs>
      <polygon points={PLINTH_SHAPE.outline} className="vpf-case-floor" />
      <g filter={`url(#${frostId})`}>
        <Internals />
      </g>
      <polygon points={PLINTH_SHAPE.top} className="vpf-frost" />
      {PLINTH_SHAPE.faces.map((f, i) => {
        const face = facetOf(f.n[0], f.n[1])
        return (
          <g key={i}>
            <polygon points={f.points} fill={metal('bezel')} />
            {face && <polygon points={f.points} className={`vp-facet-${face}`} />}
          </g>
        )
      })}
      {GLINTS.map((points) => (
        <polygon key={points} points={points} className="vp-frost-glint" />
      ))}
      <polygon points={PLINTH_SHAPE.outline} className="vp-frost-edge" />
      <polygon points={PLINTH_SHAPE.top} className="vp-frost-edge vp-frost-edge--inner" />
    </>
  )
}

/* --- the player ------------------------------------------------------------ */

const RIM_SIDES = 40
const RIM = Array.from({ length: RIM_SIDES }, (_, k) => {
  const a0 = (k / RIM_SIDES) * 360
  const a1 = ((k + 1) / RIM_SIDES) * 360
  return { points: arcBand(PLATTER.r - 17, PLATTER.r, a0, a1, PLATTER.x, PLATTER.y, 1) }
})
/* The mat: a 40-gon in six alternating fan facets. */
const MAT_R = PLATTER.r - 17
const MAT = Array.from({ length: 6 }, (_, k) =>
  arcBand(0, MAT_R, k * 60 + 15, (k + 1) * 60 + 15, PLATTER.x, PLATTER.y, 7),
)
const RING = ngon(48, PLATTER.r + 26, PLATTER.x, PLATTER.y, 0.5)

/** Rotation of the arm group (and its shadow, offset by how high it is). */
export function armTransform(angle) {
  return `rotate(${fmt(angle)} ${ARM.x} ${ARM.y})`
}
export function armShadowTransform(angle, lift) {
  const d = 6 + 16 * lift
  return `translate(${fmt(d * 0.8)} ${fmt(d)}) ${armTransform(angle)}`
}
/** The cue lever, up while the arm is lifted. */
export function cueTransform(lift) {
  return `rotate(${fmt(-38 * lift)} ${CUE.x} ${CUE.y + 18})`
}
/** A record in its platter slot, turned to `angle`. */
export function platterRecordTransform(angle) {
  return `translate(${PLATTER.x} ${PLATTER.y}) rotate(${fmt(angle)}) scale(${RECORD_R / DISC})`
}

const CUE = { x: ARM.x + 76, y: ARM.y + 66 }
const CONTROLS_X = 880

/** The arm, in its own frame: pointing along +x from the pivot. */
function ArmShape({ shadow = false, metal }) {
  const tube = HEAD.at
  const head = `translate(${HEAD.at} 0) rotate(${HEAD.bend})`
  if (shadow) {
    return (
      <>
        <rect x="-106" y="-23" width="70" height="46" rx="4" />
        <rect x="-40" y="-6" width={tube + 44} height="12" />
        <g transform={head}>
          <polygon points="-4,-8 66,-15 74,-11 74,13 66,16 -4,8" />
          <polygon points="46,-14 57,-14 64,-38 56,-40" />
        </g>
      </>
    )
  }
  return (
    <>
      {/* Counterweight: a dark drum, three facets across. */}
      <rect x="-106" y="-23" width="70" height="15" className="vpf-vinyl-light" />
      <rect x="-106" y="-8" width="70" height="16" className="vpf-vinyl" />
      <rect x="-106" y="8" width="70" height="15" className="vpf-vinyl-dark" />
      <rect x="-36" y="-5" width="36" height="10" fill={metal('bar')} />
      {/* The tube: chrome, lit along its top edge. */}
      <rect x="0" y="-6" width={tube} height="12" fill={metal('bar')} />
      <g transform={head}>
        <polygon points="-4,-8 66,-15 74,-11 74,13 66,16 -4,8" fill={metal('chrome')} />
        <polygon points="-4,0 74,0 74,13 66,16 -4,8" className="vp-facet-dark" />
        {/* The cartridge, black, and the finger lift. */}
        <rect x="36" y="-10" width="32" height="20" className="vpf-key" />
        <rect x="36" y="-10" width="32" height="7" className="vpf-key-light" />
        <polygon points="46,-14 57,-14 64,-38 56,-40" fill={metal('chrome')} />
      </g>
    </>
  )
}

/**
 * The turntable. `vinyls` gets one hidden platter slot each, so the live
 * scene can put any record down without React in the loop; a still render
 * shows `platterIndex` and poses the arm with `armAngle` / `armLift`.
 *
 * `layer` splits a still into the two halves either side of the record on
 * the platter, for the Works card, which spins that record in a layer of its
 * own between them (VinylThumb): 'base' is everything under it (the record
 * itself left out, its shadow kept), 'top' only what lies over it (its
 * stationary sheen, the spindle, the arm and the arm's shadow). Without
 * `layer`, everything is drawn, in the same order.
 *
 * `onStop` makes the start/stop key a real button while `canStop` is true.
 */
export function RecordPlayer({
  vinyls,
  clipId,
  coverSrc,
  parts,
  platterIndex = null,
  armAngle = ARM_REST,
  armLift = 0,
  ledOn = false,
  canStop = false,
  onStop,
  layer,
}) {
  const under = layer !== 'top'
  const over = layer !== 'base'
  const reg = (key, i) =>
    parts
      ? (el) => {
          if (i === undefined) parts[key] = el
          else (parts[key] ||= [])[i] = el
        }
      : undefined
  const hasRecord = platterIndex !== null
  const uid = useId()
  const frostId = `${uid}frost`
  const metalIds = { chrome: `${uid}chrome`, bar: `${uid}bar`, rim: `${uid}rim`, bezel: `${uid}bezel` }
  const metal = (k) => `url(#${metalIds[k]})`

  const stopKeys = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onStop?.()
    }
  }

  return (
    <g>
      <MetalDefs ids={metalIds} />
      {under && (
        <>
          {/* --- the plinth ------------------------------------------------- */}
          <g className="vp-shadow">
            <polygon points={PLINTH_SHAPE.outline} transform="translate(22 28)" />
          </g>
          <Case frostId={frostId} metal={metal} />
          {/* Chrome hinges along the back, where a dust cover would hang. */}
          {[120, 520].map((x) => (
            <rect key={x} x={x} y={PLINTH.bevel} width="120" height="12" fill={metal('bar')} />
          ))}

          {/* --- the platter -------------------------------------------------- */}
          <g className="vp-shadow">
            <polygon points={ngon(RIM_SIDES, PLATTER.r, PLATTER.x + 10, PLATTER.y + 13)} />
          </g>
          {RIM.map((f, i) => (
            <polygon key={i} points={f.points} fill={metal('rim')} />
          ))}
          {MAT.map((points, i) => (
            <polygon key={i} points={points} className={i % 2 ? 'vpf-mat-light' : 'vpf-mat'} />
          ))}
          <polygon points={ngon(RIM_SIDES, MAT_R * 0.36, PLATTER.x, PLATTER.y, 0.5)} className="vpf-mat-light" />

          {/* Drop target: a solid faceted ring, which the live scene lights
              while a carried record is over the turntable's side of the drop
              line. */}
          <polygon
            ref={reg('ring')}
            points={RING}
            className="vp-ring"
            opacity="0"
            data-vp-platter=""
          />

          {/* Records sit on the mat: a tight shadow, the turning disc, then the
              stationary sheen and the spindle over it. */}
          <g className="vp-shadow" ref={reg('platterShadow')} display={hasRecord ? undefined : 'none'}>
            <circle cx={PLATTER.x + 4} cy={PLATTER.y + 6} r={RECORD_R} />
          </g>
        </>
      )}
      {!layer &&
        vinyls.map((v, i) => (
          <g
            key={v.id}
            ref={reg('platterRecord', i)}
            transform={platterRecordTransform(0)}
            display={platterIndex === i ? undefined : 'none'}
          >
            <Record clipId={clipId} coverSrc={coverSrc(v)} sheen={false} />
          </g>
        ))}
      {over && (
        <>
          <g
            ref={reg('platterSheen')}
            transform={`translate(${PLATTER.x} ${PLATTER.y}) scale(${RECORD_R / DISC})`}
            display={hasRecord ? undefined : 'none'}
          >
            <Sheen />
          </g>
          <Dome n={6} r={10} cx={PLATTER.x} cy={PLATTER.y} material="metal" />
        </>
      )}

      {under && (
        <>
          {/* --- controls, down the right edge -------------------------------- */}
          <circle ref={reg('led')} cx={CONTROLS_X} cy="250" r="8" className={ledOn ? 'vpf-led-on' : 'vpf-led-off'} />
          <rect x={CONTROLS_X - 15} y="282" width="30" height="20" rx="3" className="vpf-body-dark" />
          <rect x={CONTROLS_X - 15} y="282" width="30" height="7" rx="2" fill={metal('bar')} />
          <rect x={CONTROLS_X - 15} y="310" width="30" height="20" rx="3" fill={metal('chrome')} />
          {/* Pitch slider: the slot, centre ticks, and the knob at zero. */}
          <rect x={CONTROLS_X - 7} y="360" width="14" height="190" rx="3" className="vpf-body-dark" />
          {[380, 412, 488, 520].map((y) => (
            <rect key={y} x={CONTROLS_X - 26} y={y} width="10" height="3" className="vpf-metal-dark" />
          ))}
          <rect x={CONTROLS_X - 30} y="448" width="14" height="4" className="vpf-glow" />
          <rect x={CONTROLS_X - 20} y="441" width="40" height="18" rx="2" fill={metal('bar')} />
          {/* Start/stop: a stop button while a record plays. */}
          <g
            role={onStop ? 'button' : undefined}
            tabIndex={onStop ? (canStop ? 0 : -1) : undefined}
            aria-label={onStop ? 'Stop the record' : undefined}
            aria-disabled={onStop ? !canStop : undefined}
            className={onStop ? 'vp-key' : undefined}
            data-vp-stop={onStop ? '' : undefined}
            onClick={onStop ? () => onStop() : undefined}
            onKeyDown={onStop ? stopKeys : undefined}
          >
            <g className="vp-shadow">
              <rect x={CONTROLS_X - 34 + 5} y={584 + 6} width="68" height="52" rx="5" />
            </g>
            <rect x={CONTROLS_X - 34} y="584" width="68" height="52" rx="5" className="vpf-key-dark" />
            <rect x={CONTROLS_X - 30} y="586" width="60" height="42" rx="4" className="vpf-key" />
            <rect x={CONTROLS_X - 30} y="586" width="60" height="14" rx="4" className="vpf-key-light" />
            <rect x={CONTROLS_X - 9} y="600" width="18" height="18" fill={metal('chrome')} />
            {/* Its keyboard focus ring, drawn round the key on the case in
                white (ink would not show on the black key or the frost). */}
            {onStop && (
              <rect x={CONTROLS_X - 44} y="574" width="88" height="74" rx="10" className="vp-key-ring" />
            )}
          </g>

          {/* --- the tonearm -------------------------------------------------- */}
          {/* Arm rest, where the arm lies when it is parked. */}
          <g className="vp-shadow">
            <rect x={ARM.x - 15} y="496" width="30" height="46" rx="4" transform="translate(6 8)" />
          </g>
          <rect x={ARM.x - 15} y="496" width="30" height="46" rx="4" className="vpf-body" />
          <rect x={ARM.x - 15} y="496" width="30" height="12" rx="3" fill={metal('bar')} />
          {/* Cue lever on its plinth. */}
          <rect x={CUE.x - 14} y={CUE.y - 10} width="28" height="58" rx="4" className="vpf-body" />
          <g ref={reg('cue')} transform={cueTransform(armLift)}>
            <rect x={CUE.x - 4} y={CUE.y - 26} width="8" height="46" rx="3" fill={metal('chrome')} />
          </g>
          {/* Pivot: a faceted base under the arm and a bearing cap over it. */}
          <g className="vp-shadow">
            <polygon points={ngon(8, 52, ARM.x + 8, ARM.y + 11, 0.5)} />
          </g>
          <Dome n={8} r={52} cx={ARM.x} cy={ARM.y} material="metal" />
        </>
      )}
      {over && (
        <>
          <g className="vp-shadow" ref={reg('armShadow')} transform={armShadowTransform(armAngle, armLift)}>
            <g transform={`translate(${ARM.x} ${ARM.y})`}>
              <ArmShape shadow />
            </g>
          </g>
          <g ref={reg('arm')} transform={armTransform(armAngle)}>
            <g transform={`translate(${ARM.x} ${ARM.y})`}>
              <ArmShape metal={metal} />
            </g>
          </g>
          <Dome n={8} r={20} cx={ARM.x} cy={ARM.y} material="metal" turn={0} />
        </>
      )}
    </g>
  )
}
