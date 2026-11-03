/* ---------------------------------------------------------------------------
   The Vinyl Player's turntable, seen from straight above.

   Everything is flat-shaded, faceted SVG: no gradients, no textures, only
   solid fills in the --vp-* tokens (coloured through the .vpf-* classes in
   global.css). The light is up and to the left, so a facet is lit, base or
   shaded by which way it faces (facetClass), and every solid casts a hard,
   offset shadow down and to the right.

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

/* --- the player ------------------------------------------------------------ */

const PLINTH_SHAPE = bevelled({ w: PLINTH.w, h: PLINTH.h, c: PLINTH.chamfer, b: PLINTH.bevel })

const RIM_SIDES = 40
const RIM = Array.from({ length: RIM_SIDES }, (_, k) => {
  const a0 = (k / RIM_SIDES) * 360
  const a1 = ((k + 1) / RIM_SIDES) * 360
  const mid = rad((a0 + a1) / 2)
  return {
    points: arcBand(PLATTER.r - 17, PLATTER.r, a0, a1, PLATTER.x, PLATTER.y, 1),
    className: tone('metal', Math.cos(mid), Math.sin(mid)),
  }
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
function ArmShape({ shadow = false }) {
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
      <rect x="-36" y="-5" width="36" height="10" className="vpf-metal-dark" />
      {/* The tube: a lit upper facet and a base lower one. */}
      <rect x="0" y="-6" width={tube} height="6" className="vpf-metal-light" />
      <rect x="0" y="0" width={tube} height="6" className="vpf-metal" />
      <g transform={head}>
        <polygon points="-4,-8 66,-15 74,-11 74,0 -4,0" className="vpf-metal-light" />
        <polygon points="-4,0 74,0 74,13 66,16 -4,8" className="vpf-metal" />
        {/* The cartridge, in the site's maroon, and the finger lift. */}
        <rect x="36" y="-10" width="32" height="20" className="vpf-maroon" />
        <rect x="36" y="-10" width="32" height="7" className="vpf-maroon-light" />
        <polygon points="46,-14 57,-14 64,-38 56,-40" className="vpf-metal-dark" />
      </g>
    </>
  )
}

/**
 * The turntable. `vinyls` gets one hidden platter slot each, so the live
 * scene can put any record down without React in the loop; a still render
 * shows `platterIndex` and poses the arm with `armAngle` / `armLift`, and
 * with `spin` turns that record at 33 1/3 rpm by itself (the Works card).
 * The spin is SVG's own animateTransform rather than CSS: it turns about the
 * record's own centre in every browser, where a CSS transform on an SVG group
 * puts its origin in different places in Safari and Firefox.
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
  spin = false,
}) {
  const reg = (key, i) =>
    parts
      ? (el) => {
          if (i === undefined) parts[key] = el
          else (parts[key] ||= [])[i] = el
        }
      : undefined
  const hasRecord = platterIndex !== null

  const stopKeys = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onStop?.()
    }
  }

  return (
    <g>
      {/* --- the plinth ------------------------------------------------- */}
      <g className="vp-shadow">
        <polygon points={PLINTH_SHAPE.outline} transform="translate(22 28)" />
      </g>
      {PLINTH_SHAPE.faces.map((f, i) => (
        <polygon key={i} points={f.points} className={tone('sage', f.n[0], f.n[1])} />
      ))}
      <polygon points={PLINTH_SHAPE.top} className="vpf-sage" />
      {/* A faint seam where a dust cover would hinge, along the back. */}
      <rect x="120" y={PLINTH.bevel} width="120" height="8" className="vpf-sage-dark" />
      <rect x="520" y={PLINTH.bevel} width="120" height="8" className="vpf-sage-dark" />

      {/* --- the platter -------------------------------------------------- */}
      <g className="vp-shadow">
        <polygon points={ngon(RIM_SIDES, PLATTER.r, PLATTER.x + 10, PLATTER.y + 13)} />
      </g>
      {RIM.map((f, i) => (
        <polygon key={i} points={f.points} className={f.className} />
      ))}
      {MAT.map((points, i) => (
        <polygon key={i} points={points} className={i % 2 ? 'vpf-mat-light' : 'vpf-mat'} />
      ))}
      <polygon points={ngon(RIM_SIDES, MAT_R * 0.36, PLATTER.x, PLATTER.y, 0.5)} className="vpf-mat-light" />

      {/* Drop target: a solid faceted ring whose opacity the live scene sets
          from how close a carried record is. */}
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
      {vinyls.map((v, i) => (
        <g
          key={v.id}
          ref={reg('platterRecord', i)}
          transform={platterRecordTransform(0)}
          display={platterIndex === i ? undefined : 'none'}
        >
          {spin && platterIndex === i ? (
            <g>
              {/* 1.8s a turn is 33 1/3 rpm. */}
              <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1.8s" repeatCount="indefinite" />
              <Record clipId={clipId} coverSrc={coverSrc(v)} sheen={false} />
            </g>
          ) : (
            <Record clipId={clipId} coverSrc={coverSrc(v)} sheen={false} />
          )}
        </g>
      ))}
      <g
        ref={reg('platterSheen')}
        transform={`translate(${PLATTER.x} ${PLATTER.y}) scale(${RECORD_R / DISC})`}
        display={hasRecord ? undefined : 'none'}
      >
        <Sheen />
      </g>
      <Dome n={6} r={10} cx={PLATTER.x} cy={PLATTER.y} material="metal" />

      {/* --- controls, down the right edge -------------------------------- */}
      <circle ref={reg('led')} cx={CONTROLS_X} cy="250" r="8" className={ledOn ? 'vpf-led-on' : 'vpf-led-off'} />
      <rect x={CONTROLS_X - 15} y="282" width="30" height="20" rx="3" className="vpf-sage-dark" />
      <rect x={CONTROLS_X - 15} y="282" width="30" height="7" rx="2" className="vpf-metal-dark" />
      <rect x={CONTROLS_X - 15} y="310" width="30" height="20" rx="3" className="vpf-metal" />
      <rect x={CONTROLS_X - 15} y="310" width="30" height="7" rx="2" className="vpf-metal-light" />
      {/* Pitch slider: the slot, centre ticks, and the knob at zero. */}
      <rect x={CONTROLS_X - 7} y="360" width="14" height="190" rx="3" className="vpf-sage-dark" />
      {[380, 412, 488, 520].map((y) => (
        <rect key={y} x={CONTROLS_X - 26} y={y} width="10" height="3" className="vpf-sage-dark" />
      ))}
      <rect x={CONTROLS_X - 30} y="448" width="14" height="4" className="vpf-sage-light" />
      <rect x={CONTROLS_X - 20} y="441" width="40" height="9" className="vpf-metal-light" />
      <rect x={CONTROLS_X - 20} y="450" width="40" height="9" className="vpf-metal" />
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
        <rect x={CONTROLS_X - 34} y="584" width="68" height="52" rx="5" className="vpf-maroon-dark" />
        <rect x={CONTROLS_X - 30} y="586" width="60" height="42" rx="4" className="vpf-maroon" />
        <rect x={CONTROLS_X - 30} y="586" width="60" height="14" rx="4" className="vpf-maroon-light" />
        <rect x={CONTROLS_X - 9} y="600" width="18" height="18" className="vpf-metal-light" />
        {/* Its keyboard focus ring, drawn round the key on the sage, where
            ink shows up (on the maroon face it would not). */}
        {onStop && (
          <rect x={CONTROLS_X - 44} y="574" width="88" height="74" rx="10" className="vp-key-ring" />
        )}
      </g>

      {/* --- the tonearm -------------------------------------------------- */}
      {/* Arm rest, where the arm lies when it is parked. */}
      <g className="vp-shadow">
        <rect x={ARM.x - 15} y="496" width="30" height="46" rx="4" transform="translate(6 8)" />
      </g>
      <rect x={ARM.x - 15} y="496" width="30" height="46" rx="4" className="vpf-sage-dark" />
      <rect x={ARM.x - 15} y="496" width="30" height="12" rx="3" className="vpf-metal-dark" />
      {/* Cue lever on its plinth. */}
      <rect x={CUE.x - 14} y={CUE.y - 10} width="28" height="58" rx="4" className="vpf-sage-dark" />
      <g ref={reg('cue')} transform={cueTransform(armLift)}>
        <rect x={CUE.x - 4} y={CUE.y - 26} width="8" height="46" rx="3" className="vpf-metal-light" />
      </g>
      {/* Pivot: a faceted base under the arm and a bearing cap over it. */}
      <g className="vp-shadow">
        <polygon points={ngon(8, 52, ARM.x + 8, ARM.y + 11, 0.5)} />
      </g>
      <Dome n={8} r={52} cx={ARM.x} cy={ARM.y} material="metal" />
      <g className="vp-shadow" ref={reg('armShadow')} transform={armShadowTransform(armAngle, armLift)}>
        <g transform={`translate(${ARM.x} ${ARM.y})`}>
          <ArmShape shadow />
        </g>
      </g>
      <g ref={reg('arm')} transform={armTransform(armAngle)}>
        <g transform={`translate(${ARM.x} ${ARM.y})`}>
          <ArmShape />
        </g>
      </g>
      <Dome n={8} r={20} cx={ARM.x} cy={ARM.y} material="metal" turn={0} />
    </g>
  )
}
