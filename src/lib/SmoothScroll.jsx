import { useEffect } from 'react'
import Lenis from 'lenis'
import { useReducedMotion } from './useReducedMotion'
import { healScroll } from './scrollLock'

/** Lenis smooth scrolling, exposed as window.__lenis for the scroll sequence.
    Pop-ups hold it still through scrollLock.js, which also frees the page on
    the reader's next input if it is ever left held with nothing open. */
export function SmoothScroll({ children }) {
  const reduced = useReducedMotion()

  useEffect(() => healScroll(), [])

  useEffect(() => {
    if (reduced) return undefined

    const lenis = new Lenis({ duration: 1.1, smoothWheel: true })
    window.__lenis = lenis

    let frame
    const raf = (time) => {
      lenis.raf(time)
      frame = requestAnimationFrame(raf)
    }
    frame = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(frame)
      lenis.destroy()
      delete window.__lenis
    }
  }, [reduced])

  return children
}
