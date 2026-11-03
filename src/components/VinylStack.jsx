import { useId } from 'react'
import { Record, DISC } from '@/components/RecordPlayer'

/* ---------------------------------------------------------------------------
   The stack of records beside the Vinyl Player: one sleeve per entry in
   src/data/vinyls.json, showing its real album cover, fanned down a column
   on the left of the table so a strip of every sleeve stays in reach.

   The pile is drawn twice, which is what lets a sleeve lift without the
   pile ever reshuffling under the pointer:

     resting   every sleeve in pile order, the first on top. These never move,
               so they are also the hit areas and the focusable buttons, and
               whichever strip is showing is the sleeve the pointer is over.
     lifted    the same sleeves again, above the whole pile, each hidden until
               it lifts. A lifted sleeve rises up (it grows a little and its
               shadow drops further away), comes forward towards the player,
               squares up, and its record slides out of the open right edge,
               a little under half way, far enough for the label to show.
               While it is up, its resting copy fades out, so the gap it left
               in the pile shows what was underneath. While it is up it also
               takes the pointer, sleeve and peeking record both: what is
               drawn on top is what is hovered, so the hand can travel from
               the strip it lifted onto the record without the sleeve
               dropping back under it.

   The lifted copies are reordered (the latest on top) as the pointer moves
   down the pile. Nothing here animates by itself: a still render (the card
   thumbnail) passes `still`, and the live scene passes `parts` and moves the
   nodes it is handed every frame, from the same pose functions below.

   For the keyboard and screen readers the sleeves read top to bottom, as
   they look, even though the pile is painted bottom first: one sleeve at a
   time is the Tab stop (a roving tabindex; the arrow keys move along), and
   the group owns the buttons in that order (aria-owns).
--------------------------------------------------------------------------- */

/** A sleeve's record: its radius as a share of the sleeve's side. */
export const RS = 0.47
/** How far a lifted record slides out: a share of its diameter. */
export const PEEK = 0.44

const LIFT = { forward: 0.085, up: -0.04, grow: 0.05, square: 0.6 }
const SHADOW = { rest: 0.024, lifted: 0.075 }
/* Hand-placed, so the pile looks put down rather than stacked by a machine. */
const NUDGE = [-0.05, 0.045, -0.02, 0.04, -0.035]
const TILT = [-4, 3, -2, 4, -3]

const fmt = (n) => Math.round(n * 100) / 100

/** The cover at `px` square. iTunes artwork URLs carry their size
    (".../600x600bb.jpg"), and any other size can be asked for; other URLs
    come back unchanged. */
export function coverAt(url, px) {
  return url.replace(/\/\d+x\d+bb\./, `/${px}x${px}bb.`)
}

/** Where each sleeve rests: a column centred on `cx` between `top` and
    `bottom`, overlapping by at least `overlap` of a sleeve, and centred
    vertically when there are only a few. */
export function sleeveSlots({ n, cx, top, bottom, size, overlap = 0.38 }) {
  const step = n > 1 ? Math.min(size * (1 - overlap), (bottom - top - size) / (n - 1)) : 0
  const span = size + step * Math.max(0, n - 1)
  const first = (top + bottom) / 2 - span / 2 + size / 2
  return Array.from({ length: n }, (_, i) => ({
    x: cx + NUDGE[i % NUDGE.length] * size,
    y: first + i * step,
    rot: TILT[i % TILT.length],
  }))
}

/** A sleeve's pose at lift `p` (0 resting, 1 fully up). */
export function liftPose(slot, p, size) {
  return {
    x: slot.x + LIFT.forward * size * p,
    y: slot.y + LIFT.up * size * p,
    rot: slot.rot * (1 - LIFT.square * p),
    s: 1 + LIFT.grow * p,
  }
}
export function poseTransform({ x, y, rot, s }) {
  return `translate(${fmt(x)} ${fmt(y)}) rotate(${fmt(rot)}) scale(${fmt(s * 1000) / 1000})`
}
/** The hard shadow's offset, further away the higher the sleeve. */
export function shadowOffset(p, size) {
  const d = (SHADOW.rest + (SHADOW.lifted - SHADOW.rest) * p) * size
  return { x: fmt(d * 0.8), y: fmt(d) }
}
/** How far the record sits out of its sleeve, in sleeve units, for slide `q`
    (0 inside, 1 peeking). */
export const peekX = (q, size) => fmt(q * PEEK * 2 * RS * size)
/** The slide at which a record is wholly clear of its sleeve's right edge:
    where a record coming home is handed over to the sleeve. */
export const Q_CLEAR = (0.5 + RS + 0.02) / (PEEK * 2 * RS)

/** Where a sleeve's record is on the table: centre, turn and scale (of a
    radius-DISC record), for lift `p` and slide `q`. */
export function recordPose(slot, p, q, size) {
  const pose = liftPose(slot, p, size)
  const lx = q * PEEK * 2 * RS * size
  const a = (pose.rot * Math.PI) / 180
  return {
    x: pose.x + pose.s * lx * Math.cos(a),
    y: pose.y + pose.s * lx * Math.sin(a),
    rot: pose.rot,
    s: (pose.s * RS * size) / DISC,
  }
}

/** The cover and its flat-shaded card: a lit corner facet, and a thin
    bevel round the edge like the plinth's (lit along the top and left,
    shaded along the bottom and the open right edge, where the record comes
    out). */
function SleeveFace({ size, coverSrc }) {
  const h = size / 2
  const fold = size * 0.36
  const e = fmt(size * 0.02)
  const i = fmt(h - e)
  return (
    <>
      <rect x={-h} y={-h} width={size} height={size} className="vpf-vinyl-light" />
      <image
        href={coverSrc}
        x={-h}
        y={-h}
        width={size}
        height={size}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      />
      <polygon points={`${-h},${-h} ${fmt(-h + fold)},${-h} ${-h},${fmt(-h + fold)}`} className="vp-glint" />
      <polygon points={`${-h},${-h} ${h},${-h} ${i},${-i} ${-i},${-i}`} className="vp-edge-lit" />
      <polygon points={`${-h},${-h} ${-i},${-i} ${-i},${i} ${-h},${h}`} className="vp-edge-lit" />
      <polygon points={`${-h},${h} ${-i},${i} ${i},${i} ${h},${h}`} className="vp-edge-shade" />
      <polygon points={`${h},${-h} ${h},${h} ${i},${i} ${i},${-i}`} className="vp-edge-shade" />
    </>
  )
}

function SleeveShadow({ size, offset, innerRef, children }) {
  const h = size / 2
  return (
    <g ref={innerRef} className="vp-shadow" transform={`translate(${offset.x} ${offset.y})`}>
      <rect x={-h} y={-h} width={size} height={size} />
      {children}
    </g>
  )
}

const register = (parts, key, i) =>
  parts
    ? (el) => {
        ;(parts[key] ||= [])[i] = el
      }
    : undefined

/** A sleeve's name for assistive tech. The children of a button are
    presentational, so its cover's alt text has to be part of the name. */
export const sleeveLabel = (v) => `${v.title} by ${v.artist}, ${v.album} album cover`

/**
 * `on` (live scene only) carries the pointer, focus and key handlers, each
 * called with the sleeve's index. `order` is the stacking order of the lifted
 * copies, latest last. `tabStop` is the one sleeve in the Tab order. `still`
 * poses a thumbnail: `lift` is the sleeve shown lifted with its record
 * peeking, `empty` one whose record is out.
 */
export function VinylStack({
  vinyls,
  slots,
  size,
  clipId,
  coverSrc,
  parts,
  order,
  on,
  still,
  describedBy,
  playingIndex = null,
  tabStop = 0,
}) {
  const live = Boolean(on)
  const clip = useId()
  const uid = useId()
  const sleeveId = (i) => `${uid}-sleeve-${i}`
  const h = size / 2
  const R = RS * size
  const restShadow = shadowOffset(0, size)
  const pile = vinyls.map((_, i) => i).reverse()
  const lifted = order ?? vinyls.map((_, i) => i)

  return (
    <g
      onPointerLeave={on?.leave}
      role={live ? 'group' : undefined}
      aria-label={live ? 'Records' : undefined}
      aria-owns={live ? vinyls.map((_, i) => sleeveId(i)).join(' ') : undefined}
    >
      {/* The peeking record is clipped at its sleeve's open edge (in the
          sleeve's own frame), so only the part that shows can be grabbed:
          the rest lies under the sleeve and over its neighbours' strips,
          which have to keep answering the pointer. */}
      <clipPath id={clip}>
        <rect x={h - 2} y={-R - 4} width={2 * R + 8} height={2 * R + 8} />
      </clipPath>

      {/* Resting copies, bottom of the pile first. */}
      {pile.map((i) => {
        const v = vinyls[i]
        const up = still?.lift === i
        return (
          <g
            key={v.id}
            ref={register(parts, 'base', i)}
            id={live ? sleeveId(i) : undefined}
            transform={poseTransform(liftPose(slots[i], 0, size))}
            opacity={up ? 0 : 1}
            data-vp-sleeve={live ? i : undefined}
            className={live ? 'vp-sleeve' : undefined}
            role={live ? 'button' : undefined}
            tabIndex={live ? (i === tabStop ? 0 : -1) : undefined}
            aria-label={live ? sleeveLabel(v) : undefined}
            aria-pressed={live ? playingIndex === i : undefined}
            aria-describedby={live ? describedBy : undefined}
            onPointerDown={live ? (e) => on.down(i, e) : undefined}
            onPointerEnter={live ? (e) => on.enter(i, e) : undefined}
            onFocus={live ? (e) => on.focus(i, e) : undefined}
            onBlur={live ? (e) => on.blur(i, e) : undefined}
            onKeyDown={live ? (e) => on.key(i, e) : undefined}
            onClick={live ? (e) => on.click(i, e) : undefined}
          >
            <SleeveShadow size={size} offset={restShadow} />
            <SleeveFace size={size} coverSrc={coverSrc(v)} />
          </g>
        )
      })}

      {/* Lifted copies: hidden until they lift, and aria-hidden throughout
          (the resting copies are the ones a screen reader meets). */}
      <g aria-hidden="true">
        {lifted.map((i) => {
          const v = vinyls[i]
          const p = still?.lift === i ? 1 : 0
          const home = still?.empty !== i
          const x = peekX(p, size)
          return (
            <g
              key={v.id}
              ref={register(parts, 'lift', i)}
              transform={poseTransform(liftPose(slots[i], p, size))}
              opacity={p}
              visibility={p ? 'visible' : 'hidden'}
              pointerEvents="none"
            >
              <SleeveShadow size={size} offset={shadowOffset(p, size)} innerRef={register(parts, 'liftShadow', i)}>
                <circle
                  ref={register(parts, 'peekShadow', i)}
                  cx={x}
                  r={R}
                  display={home ? undefined : 'none'}
                />
              </SleeveShadow>
              <g clipPath={`url(#${clip})`}>
                <g
                  ref={register(parts, 'peek', i)}
                  transform={`translate(${x} 0)`}
                  display={home ? undefined : 'none'}
                  className={live ? 'vp-grab' : undefined}
                  data-vp-peek={live ? i : undefined}
                  onPointerEnter={live ? (e) => on.enter(i, e) : undefined}
                  onPointerDown={live ? (e) => on.down(i, e) : undefined}
                >
                  <g transform={`scale(${R / DISC})`}>
                    <Record clipId={clipId} coverSrc={coverSrc(v)} />
                  </g>
                </g>
              </g>
              <SleeveFace size={size} coverSrc={coverSrc(v)} />
              {/* While it is up, the lifted sleeve answers the pointer like
                  its resting copy (`visible` ignores it while it is hidden). */}
              {live && (
                <rect
                  x={-h}
                  y={-h}
                  width={size}
                  height={size}
                  fill="none"
                  pointerEvents="visible"
                  className="vp-hit"
                  data-vp-lifted={i}
                  onPointerEnter={(e) => on.enter(i, e)}
                  onPointerDown={(e) => on.down(i, e)}
                />
              )}
              {live && (
                <rect
                  ref={register(parts, 'focusRing', i)}
                  x={-h - 14}
                  y={-h - 14}
                  width={size + 28}
                  height={size + 28}
                  rx="10"
                  className="vp-focus"
                  visibility="hidden"
                />
              )}
            </g>
          )
        })}
      </g>
    </g>
  )
}
