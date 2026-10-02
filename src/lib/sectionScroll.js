import { useEffect, useState } from 'react'

/**
 * Scroll to a case-study section.
 *
 * Lenis owns the scroll position whenever it is running, so driving the window
 * directly would fight it. It is exposed as `window.__lenis` by SmoothScroll,
 * which only mounts it when the visitor has not asked for reduced motion — so
 * its absence is also the signal to jump rather than glide.
 */
export function scrollToSection(id, { reduced = false } = {}) {
  const el = document.getElementById(id)
  if (!el) return

  const lenis = window.__lenis
  if (lenis && typeof lenis.scrollTo === 'function') {
    lenis.scrollTo(el, { immediate: reduced })
    return
  }

  if (reduced) {
    const top = el.getBoundingClientRect().top + window.scrollY
    window.scrollTo(0, top)
    return
  }

  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Marks the end of the document for `useActiveSection`. */
export const END_MARKER = '[data-cs-end]'

/**
 * Which section the reader is currently in.
 *
 * An IntersectionObserver rather than a scroll handler: the browser does the
 * geometry off the main thread, and nothing has to run on every frame of a
 * Lenis glide. The root is squashed to a band across the top of the viewport,
 * so "current" means "the section that owns the top of the screen". Sections
 * overlap that band during a hand-over, so the last one in document order wins.
 *
 * THE LAST SECTION IS A SPECIAL CASE, and the band alone cannot handle it. A
 * band pinned near the top of the viewport is only reachable by a section that
 * has at least a viewport of document beneath it. The final section never does
 * — the page ends — so once the reader hits the bottom of the document, the
 * last section's top is still parked well below the band and the one before it
 * keeps the highlight no matter how long the reader stares at the end of the
 * page. Nudging the band down only moves which section is wrong.
 *
 * So the end of the document is watched explicitly, with a second observer on
 * a zero-height marker the article renders as its last child. While that
 * marker is on screen the reader is, by construction, inside the last section,
 * and it takes the highlight. Still no scroll handler.
 *
 * @param ids section element ids, in document order. Must be a stable array.
 */
export function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0])

  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean)
    if (els.length === 0) return undefined

    const last = ids[ids.length - 1]
    const visible = new Set()
    let atEnd = false

    const pick = () => {
      if (atEnd) {
        setActive(last)
        return
      }
      for (let i = ids.length - 1; i >= 0; i -= 1) {
        if (visible.has(ids[i])) {
          setActive(ids[i])
          return
        }
      }
    }

    const band = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        pick()
      },
      // Top ~28% of the viewport. Nothing intersects while the hero is on
      // screen, which is why `active` starts on the first section.
      { rootMargin: '0px 0px -72% 0px', threshold: 0 },
    )
    els.forEach((el) => band.observe(el))

    const marker = document.querySelector(END_MARKER)
    let end
    if (marker) {
      end = new IntersectionObserver(
        (entries) => {
          // A page short enough to show its own end without scrolling would
          // otherwise be pinned to the last section forever.
          const scrollable =
            document.documentElement.scrollHeight > document.documentElement.clientHeight + 4
          atEnd = scrollable && entries[entries.length - 1].isIntersecting
          pick()
        },
        { threshold: 0 },
      )
      end.observe(marker)
    }

    return () => {
      band.disconnect()
      end?.disconnect()
    }
  }, [ids])

  return active
}

/** How far through the document the reader is, 0–1. */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let frame = 0

    const read = () => {
      frame = 0
      const doc = document.documentElement
      const span = doc.scrollHeight - window.innerHeight
      setProgress(span > 0 ? Math.min(1, Math.max(0, window.scrollY / span)) : 0)
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read)
    }

    read()
    // Lenis moves the real scroll position, so a plain passive listener covers
    // both the smooth and the reduced-motion case.
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  return progress
}
