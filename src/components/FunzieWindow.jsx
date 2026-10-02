import { useEffect, useState } from 'react'
import { useInView } from '@/lib/useInView'
import { useReducedMotion } from '@/lib/useReducedMotion'

/** How long each picture holds on a tile, and in the popup. */
export const CYCLE_MS = 2000

/**
 * A tile on the Funzies bento: the maroon title bar from the comp over a
 * preview of the piece. The whole window is one button; it opens the popup
 * (FunziePopup).
 *
 * Tiles with more than one picture cycle through them on their own, a
 * crossfade every CYCLE_MS, while the tile is on screen — no hover needed.
 * Videos are left to the popup.
 */
export function FunzieWindow({ item, className = '', delay = 0, onOpen }) {
  const { tile, label } = item
  const images = item.media.filter((m) => m.type === 'image')
  const [ref, inView] = useInView({ threshold: 0 })
  const shown = useCycle(images.length, delay, !inView)

  return (
    <button
      ref={ref}
      type="button"
      className={`fz-window ${className}`}
      onClick={(e) => onOpen(item, e.currentTarget)}
      aria-haspopup="dialog"
      aria-label={`Open ${item.title}`}
    >
      <WindowBar label={label} />
      <span className={`fz-window__body ${tile === 'icon' ? 'fz-window__body--icon' : ''}`}>
        {images.map((m, i) => (
          <img
            key={m.src}
            src={m.src}
            alt=""
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            data-shown={i === shown || undefined}
          />
        ))}
      </span>
    </button>
  )
}

/**
 * Index that advances every CYCLE_MS and wraps. `delay` staggers the first
 * step so neighbouring tiles don't all flip on the same beat. Holds at 0 for
 * one picture, and under reduced motion.
 */
function useCycle(count, delay = 0, paused = false) {
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (count < 2 || reduced || paused) return undefined
    let interval
    const start = setTimeout(() => {
      setIndex((i) => (i + 1) % count)
      interval = setInterval(() => setIndex((i) => (i + 1) % count), CYCLE_MS)
    }, CYCLE_MS + delay)
    return () => {
      clearTimeout(start)
      clearInterval(interval)
    }
  }, [count, delay, reduced, paused])

  return index
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
