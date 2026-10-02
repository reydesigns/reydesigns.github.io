import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/* A modal <dialog> renders in the browser's top layer, above every z-index on
   the page, so a cursor left in the page would disappear behind it. A popup
   hands its dialog over here while it is open and the cursor is portalled
   into it; null puts it back. */
let hostListener = null
export function setCursorHost(el) {
  hostListener?.(el)
}

/**
 * Brand cursor: a plain burgundy dot that replaces the native cursor.
 *
 * Only on devices with a real pointer, `(hover: hover) and (pointer: fine)`;
 * touch keeps its own behaviour. The native cursor is hidden by the
 * `html.has-custom-cursor` rule in global.css, which this component adds only
 * once it is running, so the page is never left with no cursor at all (before
 * hydration, or if this fails). The dot sits exactly on the pointer, with no
 * trail: it is the cursor now, and a lagging cursor feels broken.
 */
export function CustomCursor() {
  const dotRef = useRef(null)
  const [host, setHost] = useState(null)
  const posRef = useRef(null)

  // A fresh dot (just moved into or out of a dialog) starts where the last one was.
  useLayoutEffect(() => {
    const el = dotRef.current
    const pos = posRef.current
    if (!el || !pos) return
    el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`
    el.style.opacity = '1'
  }, [host])

  useEffect(() => {
    hostListener = setHost
    return () => {
      hostListener = null
    }
  }, [])

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    if (!dotRef.current || !fine.matches) return undefined

    const root = document.documentElement
    root.classList.add('has-custom-cursor')

    let frame = 0
    let x = 0
    let y = 0
    // Read the ref every time: moving into a dialog's portal remounts the dot.
    const draw = () => {
      frame = 0
      const el = dotRef.current
      if (el) el.style.transform = `translate3d(${x}px, ${y}px, 0)`
    }

    const onMove = (e) => {
      x = e.clientX
      y = e.clientY
      posRef.current = { x, y }
      if (dotRef.current) dotRef.current.style.opacity = '1'
      if (!frame) frame = requestAnimationFrame(draw)
    }
    const onLeave = () => {
      if (dotRef.current) dotRef.current.style.opacity = '0'
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(frame)
      root.classList.remove('has-custom-cursor')
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  const dot = (
    <span
      ref={dotRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[100] hidden opacity-0 transition-opacity duration-200 [@media(hover:hover)_and_(pointer:fine)]:block"
    >
      {/* The outer span follows the pointer; the cat head's round face is
          centred on it (the face's centre is the hotspot, the ears sit above).
          A page-coloured outline, drawn behind the fill, keeps it visible over
          the burgundy and ink surfaces (the case-study rail, card thumbnails).
          It stays the same size everywhere: grown over a link, it covered the
          link's text. */}
      <svg
        viewBox="0 0 20 20"
        className="block h-[1.125rem] w-[1.125rem] -translate-x-1/2 -translate-y-[58%] overflow-visible"
      >
        <path
          d="M3.2 11.6 L3.6 3.2 L8 7 A7.2 7.2 0 0 1 12 7 L16.4 3.2 L16.8 11.6 A6.8 6.6 0 1 1 3.2 11.6 Z"
          fill="var(--color-ink)"
          stroke="var(--color-bg)"
          strokeWidth="1.6"
          strokeLinejoin="round"
          paintOrder="stroke"
        />
      </svg>
    </span>
  )

  return host ? createPortal(dot, host) : dot
}
