import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { holdScroll } from '@/lib/scrollLock'
import { setCursorHost } from '@/components/CustomCursor'
import { SizeGlyph } from '@/components/CaseStudyModal'
import { useMediaQuery, SM } from '@/lib/useMediaQuery'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { STACKS } from '@/data/comics'
import '@/styles/comics.css'

/* ---------------------------------------------------------------------------
   Comic Hoarder: the Works card that opens the comic collection.

   The rack is a newsstand's black wire comic rack (after the client's
   reference, Assets/comics/reference/): in the window, a sign across the
   top (on the card the rack is bare, and only its first tiers), tiers of
   pockets stepping down, each tier's comics standing in front of the bottom
   of the ones above so only their tops show, a wire lip across every tier,
   and splayed legs. Each comic has a pocket of its own, in order of
   character (src/data/comics.js), with the character's name on a black tag
   clipped to the wire under it. A whole run stands as one comic with a few
   more copies peeking out behind.

   Clicking a comic, or dragging it over to the right and letting go there,
   pulls it out of its pocket and flies it over, where it shows in full: who
   it is, the series and issue, a "Completed" tag and the client's rating in
   five pixel stars. The one that was there flies back to its pocket, as does
   one let go of anywhere but the stand (over the rack, or off the window). The
   window opens with the first comic already out. On a phone the comic on
   show sits in a strip across the top that stays put while the rack
   scrolls under it; a tap is the only way to pick one there (a drag on a
   phone is a scroll).

   The pop-up is Binary Bloom's (FlowerGenerator), which is the Vinyl
   Player's: a native <dialog> (Escape, focus trap and the top layer come
   free), the page behind held still, the custom cursor moved inside, the
   same title bar (red closes, green maximizes; a phone, always full screen,
   has only the red one), a short animated close, and focus handed back to
   the card. A click outside closes it too.
--------------------------------------------------------------------------- */

const CLOSE_MS = 180
const RESIZE_MS = 320
const RESIZE_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
// A comic's flight from the rack to the stand (and back).
const FLY_MS = 560
const FLY_EASE = 'cubic-bezier(0.3, 0.7, 0.2, 1)'
// How far the pointer moves before a press on a comic becomes a drag, and
// how much bigger a comic in hand is, lifted off the rack.
const DRAG_START = 6
const HELD = 1.06

/* Every comic in rack order: by character, then as listed. */
const COMICS = STACKS.flatMap((stack) =>
  stack.comics.map((comic, k) => ({ ...comic, id: `${stack.key}-${k}`, who: stack.name, side: stack.side })),
)
const byId = (id) => COMICS.find((c) => c.id === id)

/* --- the rack's geometry, in rack units (--ch-u) --------------------------
   A comic is 10 x 15.4 (its covers are 360 x 554). Each tier stands 9.24
   (six tenths of a comic) below the one above it, so the tier in front
   covers the bottom four tenths of the one behind. The lip wire crosses each
   tier at 8, just above where the next tier's comics start. */
const COLUMNS = 3
const MIN_TIERS = 3
const TIERS = Math.max(MIN_TIERS, Math.ceil(COMICS.length / COLUMNS))
// The card shows a clean rack (no sign) of just its first few tiers.
const CARD_TIERS = 3
const G = { pocket: 11.6, side: 1.4, comicW: 10, comicH: 15.4, step: 9.24, sign: 4.4, hang: 1.8, legs: 6.6, lip: 8 }
const RACK_W = 2 * G.side + COLUMNS * G.pocket

/* Where a rack's first tier starts, its base and its full height, for a
   number of tiers, with or without the sign across the top. */
function rackSize(tiers, sign) {
  const top = (sign ? G.sign : 0) + G.hang
  const base = top + (tiers - 1) * G.step + G.comicH
  return { sign, top, base, height: base + G.legs }
}

/* --- the stars ----------------------------------------------------------- */

/* One star on a 10 x 9 pixel grid, so a half star is exactly its left five
   columns. Drawn as one path per colour, a square per pixel. */
const STAR = [
  '....XX....',
  '...XXXX...',
  '...XXXX...',
  'XXXXXXXXXX',
  '.XXXXXXXX.',
  '..XXXXXX..',
  '..XXXXXX..',
  '.XXX..XXX.',
  '.XX....XX.',
]
const STAR_W = 10
const STAR_GAP = 2

function starPaths(rating) {
  let on = ''
  let off = ''
  for (let s = 0; s < 5; s += 1) {
    const x0 = s * (STAR_W + STAR_GAP)
    STAR.forEach((row, y) => {
      for (let x = 0; x < STAR_W; x += 1) {
        if (row[x] !== 'X') continue
        const lit = rating >= s + 1 || (rating >= s + 0.5 && x < STAR_W / 2)
        const d = `M${x0 + x} ${y}h1v1h-1z`
        if (lit) on += d
        else off += d
      }
    })
  }
  return { on, off }
}

export function Stars({ rating, className = '' }) {
  const { on, off } = starPaths(rating)
  return (
    <svg
      className={`ch-stars ${className}`}
      viewBox={`0 0 ${5 * STAR_W + 4 * STAR_GAP} ${STAR.length}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Rated ${rating} out of 5 stars`}
    >
      <path className="ch-stars__off" d={off} />
      <path className="ch-stars__on" d={on} />
    </svg>
  )
}

/* --- the rack ------------------------------------------------------------ */

/** The frame behind the comics: the two side rails (and, with no sign, a
 *  bar across their tops), the base and the legs. */
function RackFrame({ size }) {
  const l = G.side / 2
  const r = RACK_W - G.side / 2
  const foot = size.height - 0.35
  const base = size.base + 0.4
  const top = size.sign ? G.sign * 0.5 : 0.25
  return (
    <svg className="ch-rack__frame" viewBox={`0 0 ${RACK_W} ${size.height}`} preserveAspectRatio="none" aria-hidden="true">
      <g className="ch-wire">
        {/* the rails, from under the sign (or the top bar) to the base */}
        <line x1={l} y1={top} x2={l} y2={base} />
        <line x1={r} y1={top} x2={r} y2={base} />
        {!size.sign && <line x1={l} y1={top} x2={r} y2={top} />}
        {/* the base, and an X brace between the legs */}
        <line x1={l} y1={base} x2={r} y2={base} />
        <line x1={l + 2.4} y1={base} x2={r - 2.4} y2={foot - 1.6} className="ch-wire--thin" />
        <line x1={r - 2.4} y1={base} x2={l + 2.4} y2={foot - 1.6} className="ch-wire--thin" />
        {/* legs: one straight down each side, one splayed in, and feet */}
        <line x1={l} y1={base} x2={l} y2={foot} />
        <line x1={r} y1={base} x2={r} y2={foot} />
        <line x1={l} y1={base} x2={l + 4.2} y2={foot} />
        <line x1={r} y1={base} x2={r - 4.2} y2={foot} />
        <line x1={l - 0.5} y1={foot} x2={l + 1.2} y2={foot} />
        <line x1={r + 0.5} y1={foot} x2={r - 1.2} y2={foot} />
        <line x1={l + 3.4} y1={foot} x2={l + 5} y2={foot} />
        <line x1={r - 3.4} y1={foot} x2={r - 5} y2={foot} />
      </g>
    </svg>
  )
}

/** In front of one tier's comics: the lip wire, the pockets' uprights and
 *  their floor (only the front tier's floor is ever seen). */
function TierWire() {
  const w = COLUMNS * G.pocket
  return (
    <svg className="ch-tier__wire" viewBox={`${-G.side} 0 ${RACK_W} ${G.comicH}`} preserveAspectRatio="none" aria-hidden="true">
      <g className="ch-wire">
        {Array.from({ length: COLUMNS + 1 }, (_, k) => (
          <line key={k} x1={k * G.pocket} y1={G.lip} x2={k * G.pocket} y2={G.comicH - 0.25} className="ch-wire--thin" />
        ))}
        <line x1={0} y1={G.comicH - 0.25} x2={w} y2={G.comicH - 0.25} className="ch-wire--thin" />
        <line x1={-G.side / 2} y1={G.lip} x2={w + G.side / 2} y2={G.lip} />
      </g>
    </svg>
  )
}

/** One comic in its pocket. A run brings two more copies, peeking out
 *  behind it. On the card it is a picture; in the window, a button. */
function RackComic({ comic, index, out, decorative, imgRef, handlers }) {
  const Tag = decorative ? 'span' : 'button'
  const props = decorative
    ? {}
    : {
        type: 'button',
        'data-comic': comic.id,
        'aria-pressed': out,
        'aria-label': `${comic.title} ${comic.issue}, ${comic.who}`,
        onClick: () => handlers.onClick(comic.id),
        onPointerDown: (e) => handlers.onPointerDown(e, comic.id),
        onPointerMove: handlers.onPointerMove,
        onPointerUp: handlers.onPointerUp,
        onPointerCancel: handlers.onPointerCancel,
        onDragStart: (e) => e.preventDefault(),
      }
  return (
    <Tag className="ch-comic" style={{ '--c': index % COLUMNS, '--i': index }} {...props}>
      {comic.run &&
        [2, 1].map((d) => (
          <span key={d} className="ch-comic__copy" style={{ '--d': d, backgroundImage: `url(${comic.cover})` }} />
        ))}
      <img
        ref={imgRef}
        className="ch-comic__cover"
        src={comic.cover}
        alt=""
        width="360"
        height="554"
        loading={decorative ? 'lazy' : undefined}
        decoding="async"
        draggable="false"
      />
    </Tag>
  )
}

/**
 * The wire rack. In the window (`decorative` false) every comic is a button
 * and `shown` is the one out of its pocket, under the sign that titles the
 * window; on the card it is all picture, a clean rack of its first tiers.
 */
function Rack({ decorative = false, shown, slotRefs, handlers }) {
  const count = decorative ? CARD_TIERS : TIERS
  const size = rackSize(count, !decorative)
  const tiers = Array.from({ length: count }, (_, t) => COMICS.slice(t * COLUMNS, t * COLUMNS + COLUMNS))
  return (
    <div
      className="ch-rack"
      style={{
        '--ch-w': RACK_W,
        '--ch-h': size.height,
        '--ch-cols': COLUMNS,
        '--ch-side': G.side,
        '--ch-pocket': G.pocket,
        '--ch-comic-w': G.comicW,
        '--ch-comic-h': G.comicH,
        '--ch-lip': G.lip,
      }}
      role={decorative ? undefined : 'group'}
      aria-label={decorative ? undefined : 'The rack'}
      aria-hidden={decorative || undefined}
    >
      <RackFrame size={size} />
      {size.sign && (
        <div className="ch-sign" style={{ '--x': G.side / 2, '--h': G.sign }}>
          <h2 id="ch-title" className="ch-sign__text font-display">
            Comic Hoarder
          </h2>
        </div>
      )}
      {tiers.map((row, t) => (
        <div key={t} className="ch-tier" style={{ '--t': t, '--top': size.top + t * G.step }}>
          {row.map((comic, c) => (
            <RackComic
              key={comic.id}
              comic={comic}
              index={t * COLUMNS + c}
              out={comic.id === shown}
              decorative={decorative}
              imgRef={decorative ? undefined : (el) => slotRefs.current.set(comic.id, el)}
              handlers={handlers}
            />
          ))}
          <TierWire />
          {row.map((comic, c) => (
            <span key={comic.id} className="ch-tag" style={{ '--c': c, '--tilt': (t + c) % 2 ? 1 : -1 }} aria-hidden="true">
              {comic.who}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

/* --- the stand: the comic out of the rack -------------------------------- */

function Stand({ comic, coverRef, standRef, hint }) {
  const issues = comic.issues ?? 1
  return (
    <section ref={standRef} className="ch-display" aria-labelledby="ch-display-title">
      <div className="ch-display__stage" data-hint={hint}>
        <img
          ref={coverRef}
          key={comic.id}
          className="ch-display__cover"
          src={comic.cover}
          alt={`Cover of ${comic.title} ${comic.run ? '#1' : comic.issue}`}
          width="360"
          height="554"
          decoding="async"
          draggable="false"
        />
      </div>
      <div className="ch-display__info" aria-live="polite">
        <p className="ch-display__who">
          {comic.who} · {comic.side}
        </p>
        <h3 id="ch-display-title" className="ch-display__title">
          {comic.title}
        </h3>
        <p className="ch-display__issue">
          {comic.issue}
          {comic.run && ` · full run, ${issues} issues`}
        </p>
        <p className="ch-display__tag">{comic.status ?? 'Completed'}</p>
        <Stars rating={comic.rating} className="ch-stars--big" />
      </div>
    </section>
  )
}

/* --- the card ------------------------------------------------------------ */

/** The Works card's thumbnail: the rack, on a pale halftone wall. */
export function ComicThumb() {
  return (
    <div className="ch-card absolute inset-0">
      <Rack decorative />
    </div>
  )
}

/* --- flights ------------------------------------------------------------- */

/**
 * Flies a copy of a cover from one box on screen to another and resolves
 * when it lands. The copies live in a layer fixed over the whole screen, a
 * child of the dialog rather than of the window, so nothing clips one that
 * strays past the window's edge, and boxes on screen are its coordinates as
 * they are. A copy travels by transform alone, about its centre: placed at
 * its destination and started from where it was, at the tilt it had.
 */
function useFlights(layerRef) {
  const place = useCallback((el, box) => {
    el.style.left = `${box.left}px`
    el.style.top = `${box.top}px`
    el.style.width = `${box.width}px`
    el.style.height = `${box.height}px`
  }, [])

  const make = useCallback(
    (src, box) => {
      const el = document.createElement('img')
      el.className = 'ch-flyer'
      el.src = src
      el.alt = ''
      el.draggable = false
      place(el, box)
      layerRef.current.append(el)
      return el
    },
    [layerRef, place],
  )

  const fly = useCallback(
    (src, from, to, { el = null, back = false, tilt = 0 } = {}) => {
      const flyer = el ?? make(src, to)
      place(flyer, to)
      const dx = from.left + from.width / 2 - (to.left + to.width / 2)
      const dy = from.top + from.height / 2 - (to.top + to.height / 2)
      const sx = from.width / to.width
      const sy = from.height / to.height
      const start = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotate(${tilt}deg)`
      // Half way it rides a little high, tipped, as a comic swung across.
      const mid = `translate(${dx / 2}px, ${dy / 2 - Math.min(80, Math.abs(dx) * 0.12)}px) scale(${(sx + 1) / 2}, ${(sy + 1) / 2}) rotate(${back ? 4 : -4}deg)`
      // Already where the flight starts, so it never shows a frame at its
      // destination first.
      flyer.style.transform = start
      const anim = flyer.animate(
        [{ transform: start }, { transform: mid, offset: 0.45 }, { transform: 'none' }],
        { duration: FLY_MS, easing: FLY_EASE },
      )
      return anim.finished.catch(() => {}).then(() => flyer.remove())
    },
    [make, place],
  )

  return { fly, make, place }
}

/* --- the pop-up ---------------------------------------------------------- */

const within = (box, x, y) => box && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom

/**
 * `open` mounts and shows it; `onClose` runs once it has animated away;
 * `returnFocus` (a ref) is the card, which gets focus back.
 */
export function ComicModal({ open, onClose, returnFocus }) {
  const ref = useRef(null)
  const windowRef = useRef(null)
  const layerRef = useRef(null)
  const standRef = useRef(null)
  const coverRef = useRef(null)
  const slotRefs = useRef(new Map())
  // The comic in hand while dragging, and whether to ignore the click after.
  const drag = useRef(null)
  const suppressClick = useRef(false)
  const downOnBackdrop = useRef(false)
  const closingRef = useRef(false)
  const [closing, setClosing] = useState(false)
  const [size, setSize] = useState('window')
  const [shown, setShown] = useState(COMICS[0].id)
  const shownRef = useRef(shown)
  shownRef.current = shown
  const [dragging, setDragging] = useState(null) // null | 'drag' | 'over'
  const phone = !useMediaQuery(SM, true)
  const reduced = useReducedMotion()
  const { fly, make } = useFlights(layerRef)

  useEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return undefined
    closingRef.current = false
    setClosing(false)
    setSize('window')
    setShown(COMICS[0].id)
    drag.current = null
    if (!dialog.open) dialog.showModal()
    setCursorHost(dialog)
    const release = holdScroll()
    return () => {
      setCursorHost(null)
      release()
    }
  }, [open])

  /* Hides an element until its flyer lands. A newer flight to the same spot
     takes over, so an older one landing late does not show it early. */
  const holds = useRef(new WeakMap())
  const hold = useCallback((el) => {
    if (!el) return () => {}
    const token = {}
    holds.current.set(el, token)
    el.style.visibility = 'hidden'
    return () => {
      if (holds.current.get(el) === token) el.style.visibility = ''
    }
  }, [])

  /** Takes a comic out of the rack onto the stand; `from` is where its
   *  flight starts (its pocket, or where a drag let go of it). */
  const pick = useCallback(
    (id, from, flyer, tilt = 0) => {
      const prev = shownRef.current
      if (id === prev) {
        flyer?.remove()
        return
      }
      const cover = coverRef.current
      const prevBox = cover?.getBoundingClientRect()
      const start = from ?? slotRefs.current.get(id)?.getBoundingClientRect()
      flushSync(() => setShown(id))
      if (reduced || !start) {
        flyer?.remove()
        return
      }
      const landing = coverRef.current
      const showIt = hold(landing)
      fly(byId(id).cover, start, landing.getBoundingClientRect(), { el: flyer, tilt }).then(showIt)
      const pocket = slotRefs.current.get(prev)
      if (pocket && prevBox) {
        const backIt = hold(pocket)
        fly(byId(prev).cover, prevBox, pocket.getBoundingClientRect(), { back: true }).then(backIt)
      }
    },
    [fly, hold, reduced],
  )

  /* --- dragging a comic off the rack --- */

  const onPointerDown = useCallback(
    (e, id) => {
      suppressClick.current = false
      if (e.button !== 0 || id === shownRef.current) return
      // On a phone a finger on the rack is a scroll; a tap still picks.
      if (e.pointerType === 'touch' && phone) return
      const img = slotRefs.current.get(id)
      if (!img) return
      drag.current = { id, x: e.clientX, y: e.clientY, box: img.getBoundingClientRect(), el: null, pointer: e.pointerId }
      e.currentTarget.setPointerCapture?.(e.pointerId)
    },
    [phone],
  )

  const onPointerMove = useCallback(
    (e) => {
      const d = drag.current
      if (!d || e.pointerId !== d.pointer) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      if (!d.el) {
        if (Math.hypot(dx, dy) < DRAG_START) return
        d.el = make(byId(d.id).cover, d.box)
        d.el.classList.add('ch-flyer--held')
        d.release = hold(slotRefs.current.get(d.id))
        setDragging('drag')
      }
      d.dx = dx
      d.dy = dy
      d.tilt = Math.max(-8, Math.min(8, dx / 30))
      d.el.style.transform = `translate(${dx}px, ${dy}px) rotate(${d.tilt}deg) scale(${HELD})`
      const over = within(standRef.current?.getBoundingClientRect(), e.clientX, e.clientY)
      setDragging(over ? 'over' : 'drag')
    },
    [hold, make],
  )

  const endDrag = useCallback(
    (e, cancelled) => {
      const d = drag.current
      drag.current = null
      if (!d || !d.el) return
      // The click that follows a drag is not a pick. It comes straight after
      // this, in the same task, if it comes at all; either way the flag goes.
      suppressClick.current = true
      setTimeout(() => {
        suppressClick.current = false
      }, 0)
      setDragging(null)
      // The comic as it is in the hand, untilted: its pocket's box moved by
      // the drag and grown by the lift. The flight starts from there, at the
      // same tilt, so letting go never jumps.
      const { box, tilt } = d
      const held = {
        left: box.left + d.dx - (box.width * (HELD - 1)) / 2,
        top: box.top + d.dy - (box.height * (HELD - 1)) / 2,
        width: box.width * HELD,
        height: box.height * HELD,
      }
      d.el.classList.remove('ch-flyer--held')
      // Let go over the stand (the right of the window; a phone's strip):
      // it is the one on show now, and its pocket stays empty.
      const onStand = !cancelled && within(standRef.current?.getBoundingClientRect(), e.clientX, e.clientY)
      if (onStand) {
        d.release()
        pick(d.id, held, reduced ? null : d.el, tilt)
        if (reduced) d.el.remove()
        return
      }
      // Anywhere else, over the rack or off the window: back where it was.
      const pocket = slotRefs.current.get(d.id)
      if (reduced || !pocket) {
        d.el.remove()
        d.release()
        return
      }
      fly(byId(d.id).cover, held, pocket.getBoundingClientRect(), { el: d.el, back: true, tilt }).then(d.release)
    },
    [fly, pick, reduced],
  )

  const handlers = {
    onClick: (id) => {
      if (suppressClick.current) {
        suppressClick.current = false
        return
      }
      pick(id)
    },
    onPointerDown,
    onPointerMove,
    onPointerUp: (e) => endDrag(e, false),
    onPointerCancel: (e) => endDrag(e, true),
  }

  const toggle = useCallback(() => {
    const frame = windowRef.current
    const before = frame?.getBoundingClientRect()
    flushSync(() => setSize((s) => (s === 'full' ? 'window' : 'full')))
    if (!frame || !before || reduced) return
    const after = frame.getBoundingClientRect()
    if (!after.width || !after.height) return
    frame.animate(
      [
        {
          transformOrigin: '0 0',
          transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / after.width}, ${before.height / after.height})`,
        },
        { transformOrigin: '0 0', transform: 'translate(0px, 0px) scale(1, 1)' },
      ],
      { duration: RESIZE_MS, easing: RESIZE_EASE },
    )
  }, [reduced])

  const finishClose = useCallback(() => {
    if (ref.current?.open) ref.current.close()
    onClose()
    const card = returnFocus?.current
    if (card && (document.activeElement === document.body || !document.activeElement)) {
      card.focus({ preventScroll: true })
    }
  }, [onClose, returnFocus])

  const close = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    setTimeout(finishClose, reduced ? 0 : CLOSE_MS)
  }, [finishClose, reduced])

  if (!open) return null
  const comic = byId(shown) ?? COMICS[0]

  return (
    <dialog
      ref={ref}
      className="vp-pop ch-pop"
      data-size={phone ? undefined : size}
      data-closing={closing || undefined}
      data-lenis-prevent
      aria-labelledby="ch-title"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClose={() => {
        if (closingRef.current) return
        closingRef.current = true
        finishClose()
      }}
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdrop.current) close()
      }}
    >
      <div ref={windowRef} className="ch-window">
        <div className="vp-bar">
          <div className="vp-bar__controls">
            <button type="button" className="vp-dot vp-dot--close" onClick={close} aria-label="Close" title="Close">
              <span aria-hidden="true">×</span>
            </button>
            {!phone && (
              <button
                type="button"
                data-ch-toggle=""
                className="vp-dot vp-dot--size"
                onClick={toggle}
                aria-label={size === 'full' ? 'Minimize' : 'Maximize'}
                title={size === 'full' ? 'Minimize' : 'Maximize'}
              >
                <SizeGlyph full={size === 'full'} />
              </button>
            )}
          </div>
        </div>
        <div className="ch-frame" data-dragging={dragging ?? undefined}>
          <div className="ch-shelf">
            <Rack shown={shown} slotRefs={slotRefs} handlers={handlers} />
          </div>
          <Stand comic={comic} coverRef={coverRef} standRef={standRef} hint="Drop it here" />
        </div>
      </div>
      <div ref={layerRef} className="ch-flyers" aria-hidden="true" />
    </dialog>
  )
}
