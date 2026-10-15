import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useInView } from '@/lib/useInView'
import { useMediaQuery, HOVER } from '@/lib/useMediaQuery'
import { useReducedMotion } from '@/lib/useReducedMotion'

/** How long each picture holds in the popup. */
export const CYCLE_MS = 2000

/**
 * How the tiles show their pictures. Change this one word to switch.
 *
 *   'hover'  the tile rests on its thumbnail; hovering it floats a preview
 *            card of every picture in the window over the page. Clicking
 *            still opens the popup. (current, client)
 *   'swipe'  the tile slides through its pictures on its own, one every
 *            SWIPE_MS, while it is on screen. Kept as the alternative.
 */
export const TILE_MOTION = 'hover'

/** How long each picture holds on a tile in 'swipe' mode. */
export const SWIPE_MS = 2750

/** Hover-intent: sweeping the pointer across the grid shouldn't flash cards. */
const PREVIEW_DELAY_MS = 140
/** The preview shows at most this many pictures, the last one marked "+N". */
const PREVIEW_MAX = 8

/**
 * A tile on the Funzies bento: the maroon title bar from the comp over a
 * preview of the piece. The whole window is one button; it opens the popup
 * (FunziePopup). Videos are left to the popup.
 */
export function FunzieWindow({ item, className = '', delay = 0, onOpen }) {
  const { tile, label } = item
  const images = item.media.filter((m) => m.type === 'image')
  const [ref, inView] = useInView({ threshold: 0 })
  const canHover = useMediaQuery(HOVER, true)
  const swipe = TILE_MOTION === 'swipe'
  const preview = usePreview(ref, !swipe && canHover)
  const bodyClass = `fz-window__body ${tile === 'icon' ? 'fz-window__body--icon' : ''}`

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`fz-window ${className}`}
        onClick={(e) => {
          preview.hide()
          onOpen(item, e.currentTarget)
        }}
        onPointerEnter={preview.onEnter}
        onPointerLeave={preview.hide}
        aria-haspopup="dialog"
        aria-label={`Open ${item.title}`}
      >
        <WindowBar label={label} />
        {swipe ? (
          <SwipeBody className={bodyClass} images={images} delay={delay} paused={!inView} />
        ) : (
          <span className={bodyClass}>
            <img src={(item.thumb ?? images[0]).src} alt="" decoding="async" data-shown />
          </span>
        )}
      </button>
      {preview.anchor && <PreviewCard item={item} images={images} {...preview} />}
    </>
  )
}

/* --- 'swipe' ------------------------------------------------------------- */

/**
 * The pictures side by side on a track that slides one window-width every
 * SWIPE_MS. The first picture is repeated at the end so the loop always moves
 * forwards: on reaching the copy, the track jumps back to the real first one
 * with its transition off, which looks like nothing happened.
 */
function SwipeBody({ className, images, delay, paused }) {
  const reduced = useReducedMotion()
  const count = images.length
  const [index, setIndex] = useState(0)
  const [snap, setSnap] = useState(false)

  useEffect(() => {
    if (count < 2 || reduced || paused) return undefined
    let interval
    const start = setTimeout(() => {
      setIndex((i) => i + 1)
      interval = setInterval(() => setIndex((i) => i + 1), SWIPE_MS)
    }, SWIPE_MS + delay)
    return () => {
      clearTimeout(start)
      clearInterval(interval)
    }
  }, [count, delay, reduced, paused])

  // Two frames: one to paint the jump with no transition, one to restore it.
  useEffect(() => {
    if (!snap) return undefined
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => setSnap(false))
    })
    return () => cancelAnimationFrame(id)
  }, [snap])

  const onTransitionEnd = (e) => {
    if (e.target !== e.currentTarget || index < count) return
    setSnap(true)
    setIndex(0)
  }

  const slides = count > 1 ? [...images, images[0]] : images
  return (
    <span className={`${className} fz-window__body--swipe`}>
      <span
        className="fz-swipe"
        data-snap={snap || undefined}
        style={{ transform: `translateX(${-index * 100}%)` }}
        onTransitionEnd={onTransitionEnd}
      >
        {slides.map((m, i) => (
          <span key={`${m.src}-${i}`} className="fz-swipe__slide">
            <img src={m.src} alt="" loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
          </span>
        ))}
      </span>
    </span>
  )
}

/* --- 'hover' ------------------------------------------------------------- */

/**
 * Where the preview card goes and whether it is showing. The card is placed
 * from the tile's box when the pointer arrives, above the tile when there is
 * room and below it otherwise, and hidden again on leave, click or scroll.
 * It ignores the pointer entirely, so a click always reaches the tile.
 */
function usePreview(ref, enabled) {
  const [anchor, setAnchor] = useState(null)
  const [open, setOpen] = useState(false)
  const timer = useRef()

  const hide = useCallback(() => {
    clearTimeout(timer.current)
    setOpen(false)
  }, [])

  const onEnter = useCallback(
    (e) => {
      if (!enabled || e.pointerType !== 'mouse') return
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        const el = ref.current
        if (!el) return
        setAnchor(el.getBoundingClientRect())
        setOpen(true)
      }, PREVIEW_DELAY_MS)
    },
    [enabled, ref],
  )

  useEffect(() => {
    if (!open) return undefined
    window.addEventListener('scroll', hide, { passive: true })
    window.addEventListener('resize', hide)
    return () => {
      window.removeEventListener('scroll', hide)
      window.removeEventListener('resize', hide)
    }
  }, [open, hide])

  useEffect(() => () => clearTimeout(timer.current), [])

  return { anchor, open, onEnter, hide }
}

const GUTTER = 16
const GAP = 12

function PreviewCard({ item, images, anchor, open }) {
  const shown = images.slice(0, PREVIEW_MAX)
  const more = images.length - shown.length
  const cols = Math.min(shown.length, 4)
  // ~7.5rem a picture, never wider than the viewport allows.
  const width = Math.min(cols * 120 + (cols - 1) * 8 + 24, window.innerWidth - 2 * GUTTER)
  const center = anchor.left + anchor.width / 2
  const left = Math.min(Math.max(center, GUTTER + width / 2), window.innerWidth - GUTTER - width / 2)
  const above = anchor.top > window.innerHeight * 0.45
  const style = above
    ? { left, top: anchor.top - GAP, width }
    : { left, top: anchor.bottom + GAP, width }

  return createPortal(
    <div
      className="fz-preview"
      data-open={open || undefined}
      data-side={above ? 'top' : 'bottom'}
      style={{ ...style, '--fz-preview-cols': cols }}
      aria-hidden="true"
    >
      <div className="fz-preview__head">
        <span className="fz-preview__title">{item.title}</span>
        <span className="fz-preview__count">
          {images.length} {images.length === 1 ? 'piece' : 'pieces'}
        </span>
      </div>
      <div className="fz-preview__grid">
        {shown.map((m, i) => (
          <span key={m.src} className="fz-preview__cell">
            <img src={m.src} alt="" decoding="async" />
            {more > 0 && i === shown.length - 1 && <span className="fz-preview__more">+{more + 1}</span>}
          </span>
        ))}
      </div>
      <div className="fz-preview__hint">click to open</div>
    </div>,
    document.body,
  )
}

/** The title bar, shared with the popup so the two can't drift apart. */
export function WindowBar({ label, onClose, id }) {
  return (
    <span className="fz-bar">
      <span className="fz-bar__dots">
        {onClose ? (
          <button type="button" className="fz-dot fz-dot--red fz-dot--button" onClick={onClose} aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
        ) : (
          <span className="fz-dot fz-dot--red" />
        )}
        <span className="fz-dot fz-dot--grey" />
      </span>
      <span className="fz-bar__label" id={id}>
        {label}
      </span>
    </span>
  )
}
