import { useEffect, useRef } from 'react'
import { useReducedMotion } from './useReducedMotion'
import { useCaseStudyHost } from './caseStudyHost'

const clamp = (v) => Math.min(1, Math.max(0, v))
const easeOut = (t) => 1 - (1 - t) ** 3

/**
 * Scroll-linked motion. Writes the element's progress through the viewport to
 * a CSS custom property, `--p`, from 0 (its top has just entered at the bottom
 * of the screen) to 1 (its top has risen to `end` of the way up), eased.
 * CSS then derives every transform from `--p`, so the browser does the motion
 * and React never re-renders on scroll.
 *
 * `--t` runs 0 → 1 over the element's whole pass, from entering at the bottom
 * to leaving at the top (linear), and `--q` is the same centred on 0 (-0.5 …
 * 0.5) — for parallax that keeps drifting after the entrance has landed.
 *
 * Reduced motion pins `--p` at 1: the composition sits in its final layout.
 *
 * In the case-study pop-up "the viewport" is the pop-up's scroller (the
 * host's `root`, see caseStudyHost.js): positions are read against its box
 * and its own scroll events drive the update.
 */
export function useScrollMotion({ end = 0.3 } = {}) {
  const ref = useRef(null)
  const reduced = useReducedMotion()
  const { root } = useCaseStudyHost()

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    if (reduced) {
      el.style.setProperty('--p', '1')
      el.style.setProperty('--q', '0')
      el.style.setProperty('--t', '0.5')
      return undefined
    }

    let frame = 0
    const write = () => {
      frame = 0
      const r = el.getBoundingClientRect()
      const vh = root ? root.clientHeight : window.innerHeight
      const top = root ? r.top - root.getBoundingClientRect().top : r.top
      const t = (vh - top) / (vh * (1 - end))
      el.style.setProperty('--p', easeOut(clamp(t)).toFixed(4))
      const pass = clamp((vh - top) / (vh + r.height))
      el.style.setProperty('--t', pass.toFixed(4))
      el.style.setProperty('--q', (pass - 0.5).toFixed(4))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(write)
    }
    write()
    const target = root ?? window
    target.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      target.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [end, reduced, root])

  return ref
}
