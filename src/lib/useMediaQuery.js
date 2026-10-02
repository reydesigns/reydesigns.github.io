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
 * The breakpoint the whole site pivots on: above it the nav is a vertical pill
 * at the left edge and the landing page runs the hero -> loader -> works scroll
 * sequence; below it the nav stays a bottom bar and there is no loader at all.
 */
export const WIDE = '(min-width: 64rem)'

/** Tailwind's `sm`: below it we treat the device as a phone. */
export const SM = '(min-width: 40rem)'

/** A pointer that can hover. False on phones and touch tablets. */
export const HOVER = '(hover: hover)'
