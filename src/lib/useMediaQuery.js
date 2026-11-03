import { useEffect, useState } from 'react'

/** Reactive `matchMedia`. Re-reads on mount so SSR-ish first renders self-heal. */
export function useMediaQuery(query, fallback = false) {
  const [matches, setMatches] = useState(
    () => window.matchMedia?.(query).matches ?? fallback,
  )

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = (e) => setMatches(e.matches)
    setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/**
 * The breakpoint the whole site pivots on: above it the landing page glides
 * from the hero to the works grid (with a fine pointer) and the top bar floats
 * over the grid; below it the page just scrolls.
 */
export const WIDE = '(min-width: 64rem)'

/** Tailwind's `sm`: below it we treat the device as a phone. */
export const SM = '(min-width: 40rem)'

/** A pointer that can hover. False on phones and touch tablets. */
export const HOVER = '(hover: hover)'

/** A precise primary pointer — mouse or trackpad. Gates the landing glide. */
export const FINE = '(pointer: fine)'
