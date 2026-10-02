import { useEffect, useRef, useState } from 'react'

/**
 * Whether an element is on screen right now. Used to start looping mockup
 * animations only while they can be seen — and to pause them again when they
 * scroll away, so nothing animates off-screen.
 *
 * `once` latches true on first sight instead (for one-shot reveals).
 */
export function useInView({ rootMargin = '0px', threshold = 0.2, once = false } = {}) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) io.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { rootMargin, threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin, threshold, once])

  return [ref, inView]
}
