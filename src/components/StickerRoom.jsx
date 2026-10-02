import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FRAME, ROOM, SHEET_W, SHEET_H, SHEET_PAD, TALL_W, TALL_H, STICKERS } from '@/data/stickers'
import { useMediaQuery } from '@/lib/useMediaQuery'

const BY_ID = Object.fromEntries(STICKERS.map((s) => [s.id, s]))
/** A press that moves less than this (CSS px) is a click, not a drag. */
const DRAG_START = 4
/** Arrow keys nudge a placed sticker this many art pixels. */
const NUDGE = 2

/** How far a sticker's corner lifts on hover (art px), and pressed: about a
    quarter of its short side — but never so far the fold line leaves the
    sticker (it must stay past both its width and height; see the CSS). */
const peelOf = (s, f) => Math.max(0, Math.min(Math.round(Math.min(s.w, s.h) * f), s.k - Math.max(s.w, s.h) - 1))

/* Each sticker's opaque pixels, read once its image has loaded, so a press
   on a clear corner of one sticker falls through to whatever is under it. */
const solid = {}
for (const s of STICKERS) {
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = s.w
    c.height = s.h
    const g = c.getContext('2d', { willReadFrequently: true })
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, s.w, s.h).data
    solid[s.id] = (x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h && d[(y * s.w + x) * 4 + 3] > 0
  }
  img.src = s.src
}
/** Whether the point (client px) is over an opaque pixel of sticker `el`. */
function hits(el, cx, cy) {
  const s = BY_ID[el.dataset.id]
  const test = solid[s.id]
  if (!test) return true
  const r = el.getBoundingClientRect()
  return test(Math.floor(((cx - r.left) / r.width) * s.w), Math.floor(((cy - r.top) / r.height) * s.h))
}

/**
 * One sticker: the art, clipped along a fold line x + y = c that runs across
 * its bottom-right corner, and the flap — its white back — folded over that
 * line. `--peel` slides the line in; at 0 the flap is empty and the sticker
 * lies flat. All of it is CSS (funzies.css), so the peel animates on hover
 * without React.
 */
function Sticker({ s, x, y, className = '', style, onPointerDown, onClick, onKeyDown, label, refEl }) {
  return (
    <button
      ref={refEl}
      type="button"
      data-id={s.id}
      className={`fz-sticker ${className}`}
      style={{
        '--x': x,
        '--y': y,
        '--w': s.w,
        '--h': s.h,
        '--k': s.k,
        '--peel-hover': peelOf(s, 0.24),
        '--peel-press': peelOf(s, 0.42),
        '--peel-rest': s.rest ? Math.min(s.rest, peelOf(s, 0.24)) : 0,
        ...style,
      }}
      aria-label={label}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <span className="fz-sticker__front">
        <img src={s.src} alt="" draggable="false" />
      </span>
      <span className="fz-sticker__flap" aria-hidden="true">
        <span className="fz-sticker__back" style={{ '--src': `url(${s.src})` }} />
      </span>
    </button>
  )
}

/**
 * The isometric room — Shreya's own pixel-art drawing — and, in its own grid
 * cell, the sheet of stickers that decorate it.
 *
 * Hover a sticker and its corner peels up; press and drag and it comes off
 * the sheet, follows the pointer (tilting as it swings) and sticks wherever
 * it's dropped in the room. A placed sticker can be dragged again, or dragged
 * out of the room to go back on the sheet. A plain click (or Enter/Space)
 * sticks one at its spot in the room; on a placed one, Enter/Space/Delete
 * peels it back off and the arrow keys nudge it.
 *
 * On wide screens the room moves to the left of its cell and the sheet stands
 * upright to its right, running past the grid's edge; otherwise the sheet
 * lies across under the room.
 *
 * Room and sheet share one scale, measured from the room's cell: an art pixel
 * is the cell's height / FRAME CSS px. Rugs stay under everything else;
 * otherwise the last sticker down is on top. Every visit starts with them all
 * on the sheet; "Put them back" returns them without a reload.
 */
export function StickerRoom({ roomClassName = '', sheetClassName = '' }) {
  const roomRef = useRef(null)
  const spaceRef = useRef(null)
  const sheetRef = useRef(null)
  // Wide enough for the sheet to stand beside the room (funzies.css, same query).
  const tall = useMediaQuery('(min-width: 80rem)')
  const [scale, setScale] = useState(0)
  const [placed, setPlaced] = useState({})
  // The sticker being dragged: { id, from: 'sheet' | 'room' }.
  const [drag, setDrag] = useState(null)
  const [justStuck, setJustStuck] = useState(null)
  const ghostRef = useRef(null)
  const press = useRef(null)

  useLayoutEffect(() => {
    const el = roomRef.current
    const ro = new ResizeObserver(() => setScale(Math.min(el.clientWidth, el.clientHeight) / FRAME))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!justStuck) return undefined
    const t = setTimeout(() => setJustStuck(null), 400)
    return () => clearTimeout(t)
  }, [justStuck])

  const stick = useCallback((id, x, y) => {
    setPlaced((p) => {
      const z = Math.max(0, ...Object.values(p).map((q) => q.z)) + 1
      return { ...p, [id]: { x, y, z } }
    })
    setJustStuck(id)
  }, [])
  const unstick = useCallback((id) => {
    setPlaced((p) => {
      const { [id]: _gone, ...rest } = p
      return rest
    })
  }, [])

  /* Drag. The ghost — the sticker following the pointer — is positioned by
     writing its style directly, so moving it never re-renders the room. */
  const moveGhost = (cx, cy, tilt) => {
    const g = ghostRef.current
    const p = press.current
    if (!g || !p) return
    g.style.left = `${cx - p.dx}px`
    g.style.top = `${cy - p.dy}px`
    g.style.setProperty('--tilt', `${tilt}deg`)
    g.style.transformOrigin = `${p.dx}px ${p.dy}px`
  }

  const onPointerDown = (from) => (e) => {
    if (e.button !== 0 || !scale) return
    // Pressed on a clear bit? Then it's whichever sticker below has a pixel
    // there; on none, the press is nobody's.
    let el = e.currentTarget
    if (!hits(el, e.clientX, e.clientY)) {
      el = document
        .elementsFromPoint(e.clientX, e.clientY)
        .find((n) => n !== e.currentTarget && n.classList.contains('fz-sticker') && hits(n, e.clientX, e.clientY))
      if (!el) return
      from = el.closest('.fz-room') ? 'room' : 'sheet'
    }
    const id = el.dataset.id
    const r = el.getBoundingClientRect()
    press.current = {
      id,
      from,
      el,
      x0: e.clientX,
      y0: e.clientY,
      dx: e.clientX - r.left,
      dy: e.clientY - r.top,
      lastX: e.clientX,
      lastY: e.clientY,
      tilt: 0,
      dragging: false,
    }
    el.classList.add('is-pressed')
    e.preventDefault()

    const onMove = (ev) => {
      const p = press.current
      if (!p) return
      if (!p.dragging) {
        if (Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0) < DRAG_START) return
        p.dragging = true
        p.el.classList.remove('is-pressed')
        setDrag({ id: p.id, from: p.from })
      }
      // Swing: lean into horizontal motion, easing back when it stops.
      p.tilt = Math.max(-12, Math.min(12, p.tilt * 0.8 + (ev.clientX - p.lastX) * 0.6))
      p.lastX = ev.clientX
      p.lastY = ev.clientY
      moveGhost(ev.clientX, ev.clientY, p.tilt)
    }
    const end = (ev, cancelled) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      const p = press.current
      press.current = null
      if (!p) return
      p.el.classList.remove('is-pressed')
      const s = BY_ID[p.id]
      if (!p.dragging) {
        // A click: off the sheet it goes, to its spot in the room.
        if (!cancelled && p.from === 'sheet') stick(p.id, s.home[0], s.home[1])
        return
      }
      setDrag(null)
      if (cancelled) return
      const over = (r) => ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom
      // The upright sheet overlaps the room's cell, so it's checked first.
      const onSheet = over(sheetRef.current.getBoundingClientRect())
      const room = spaceRef.current.getBoundingClientRect()
      if (!onSheet && over(roomRef.current.getBoundingClientRect())) {
        // Whole art pixels, so it lines up with the room's own pixels; kept
        // at least half on the room's space.
        const x = Math.round((ev.clientX - p.dx - room.left) / scale)
        const y = Math.round((ev.clientY - p.dy - room.top) / scale)
        stick(p.id, Math.max(-s.w / 2, Math.min(FRAME - s.w / 2, x)), Math.max(-s.h / 2, Math.min(FRAME - s.h / 2, y)))
      } else if (p.from === 'room') {
        unstick(p.id)
      }
    }
    const onUp = (ev) => end(ev, false)
    const onCancel = (ev) => end(ev, true)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  // Put the ghost under the pointer as soon as it mounts.
  useLayoutEffect(() => {
    const p = press.current
    if (drag && p) moveGhost(p.lastX, p.lastY, p.tilt)
  }, [drag])

  // Keyboard (a click from the keyboard has detail 0; mouse clicks are
  // handled by the pointer code above).
  const onSheetClick = (id) => (e) => {
    if (e.detail !== 0) return
    stick(id, BY_ID[id].home[0], BY_ID[id].home[1])
  }
  const onRoomClick = (id) => (e) => {
    if (e.detail !== 0) return
    unstick(id)
  }
  const onRoomKey = (id) => (e) => {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      unstick(id)
    } else if (step) {
      e.preventDefault()
      setPlaced((p) => ({ ...p, [id]: { ...p[id], x: p[id].x + step[0] * NUDGE, y: p[id].y + step[1] * NUDGE } }))
    }
  }

  // Rugs first, then the rest, each in the order they were stuck down.
  const inRoom = Object.entries(placed)
    .map(([id, p]) => ({ s: BY_ID[id], ...p }))
    .sort((a, b) => (a.s.flat === b.s.flat ? a.z - b.z : a.s.flat ? -1 : 1))
  const anyPlaced = inRoom.length > 0

  return (
    <>
      <div ref={roomRef} className={`fz-room ${roomClassName}`} style={{ '--s': scale }}>
        {scale > 0 && (
          <div ref={spaceRef} className="fz-room__space" style={{ '--room-x': ROOM.x }}>
            <img
              className="fz-room__art"
              src={ROOM.src}
              alt="Shreya's isometric pixel-art room: a wooden cabin with a loft, a ladder and an arched window"
              style={{ '--x': ROOM.x, '--y': ROOM.y, '--w': ROOM.w, '--h': ROOM.h }}
              draggable="false"
            />
            {inRoom.map(({ s, x, y }) => (
              <Sticker
                key={s.id}
                s={s}
                x={x}
                y={y}
                className={`is-placed${drag?.id === s.id ? ' is-away' : ''}${justStuck === s.id ? ' is-stuck' : ''}`}
                label={`${s.name}, in the room. Drag to move, or drag out of the room to put it back. Delete to remove, arrow keys to move.`}
                onPointerDown={onPointerDown('room')}
                onClick={onRoomClick(s.id)}
                onKeyDown={onRoomKey(s.id)}
              />
            ))}
          </div>
        )}
      </div>

      <section
        ref={sheetRef}
        className={`fz-sheet ${sheetClassName}`}
        aria-label="Sticker sheet"
        style={{
          '--s': scale,
          '--sheet-h': SHEET_H + 2 * SHEET_PAD,
          '--sheet-w': TALL_W + 2 * SHEET_PAD,
          '--room-w': ROOM.w,
        }}
      >
        {scale > 0 && (
          <div className="fz-sheet__page" style={tall ? { '--w': TALL_W, '--h': TALL_H } : { '--w': SHEET_W, '--h': SHEET_H }}>
            {STICKERS.map((s) => {
              const gone = !!placed[s.id] || drag?.id === s.id
              return (
                <div key={s.id} className="fz-sheet__slot" style={{ '--x': (tall ? s.tall : s.sheet)[0], '--y': (tall ? s.tall : s.sheet)[1], '--w': s.w, '--h': s.h }}>
                  {/* The kiss-cut outline left on the backing paper. */}
                  <span className="fz-sheet__cut" style={{ '--src': `url(${s.src})` }} aria-hidden="true" />
                  {!placed[s.id] && (
                    <Sticker
                      s={s}
                      x={0}
                      y={0}
                      className={gone ? 'is-away' : ''}
                      label={`${s.name} sticker. Drag it into the room, or press to stick it there.`}
                      onPointerDown={onPointerDown('sheet')}
                      onClick={onSheetClick(s.id)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
        {/* One corner, two jobs: how it works, until something's been stuck
            down; then a way to start over. */}
        {anyPlaced ? (
          <button type="button" className="fz-sheet__reset" onClick={() => setPlaced({})}>
            Put them back
          </button>
        ) : (
          <p className="fz-sheet__hint" aria-hidden="true">
            {tall ? '← Peel + stick' : 'Peel + stick ↑'}
          </p>
        )}
      </section>

      {drag &&
        createPortal(
          <div ref={ghostRef} className="fz-sticker-ghost" style={{ '--s': scale }} aria-hidden="true">
            <Sticker s={BY_ID[drag.id]} x={0} y={0} className="is-lifted" />
          </div>,
          document.body,
        )}
    </>
  )
}
