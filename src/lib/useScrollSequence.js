import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from './useReducedMotion'

/* ---------------------------------------------------------------------------
   The landing glide.

   `/` is ONE document, two screens tall:

       0  ──────── hero          (100dvh, top bar included)
       1  ──────── works grid    (100dvh at least; taller on a phone)

   On a desktop (`glide`: wide viewport, fine pointer, no reduced motion) a
   downward scroll past 0.15 of a viewport from the hero hands over: the page
   glides the rest of the way to the works screen through Lenis, 1.1s on the
   brand ease-out, and the nav marks "works" as current. Back up in the top
   band (< 0.10 of a viewport) the hero re-arms, so the next scroll down glides
   again.

   Everywhere else — phones, touch tablets, reduced motion — nothing is taken
   over. The page scrolls the way the reader scrolls it, and `stage` only
   mirrors position: "works" once the grid's top has come up to the middle of
   the screen.

   Design notes that are easy to get wrong later:

   * The 0.10 / 0.15 gap is hysteresis. One threshold would re-arm and fire on
     the same few pixels of jitter.

   * Nothing locks the page. There is no `lenis.stop()`, no overflow toggle, no
     timer and no visibility handler; Lenis' own `lock` only holds the wheel off
     for the 1.1s of the glide and lets go when it lands. A visitor can never
     end up on a page that will not scroll.

   * Our own glide trips the scroll watcher on every frame, and the nav's
     "works" starts one from y≈0, inside the re-arm band — without a guard it
     would re-arm the hero and fire a second glide on the way past 0.15. The
     guard lasts exactly as long as Lenis holds the glide's lock. onComplete
     drops it when the glide lands, but a glide cut short never gets one:
     another scrollTo, `lenis.stop()` under a dialog and a middle-click all
     reset Lenis, which ends the animation and the lock without a callback. So
     the watcher also drops the guard on the first scroll it sees with the lock
     gone. A guard left up would keep the hero from ever re-arming.

   * Reload always lands on the hero: main.jsx turns the browser's scroll
     restoration off and RouteEffects scrolls to 0, so there is no "adopt the
     end state" branch here any more.
--------------------------------------------------------------------------- */

function lenis() {
  return typeof window !== 'undefined' ? window.__lenis : undefined
}

function documentTop(el) {
  return el.getBoundingClientRect().top + window.scrollY
}

/* --ease-brand, cubic-bezier(0.22, 1, 0.36, 1), is the ease-out-quint curve;
   this is it in the closed form Lenis takes, so the glide decelerates like
   every other transition on the site. */
const easeBrand = (t) => 1 - (1 - t) ** 5

// A breadcrumb trail the QA script asserts against — see scripts/checks/landing.mjs.
function mark(event, extra) {
  if (typeof window === 'undefined') return
  const log = (window.__seqLog ||= [])
  log.push({ event, ...extra, t: Math.round(performance.now()) })
}

export function useScrollSequence({ glide, worksRef }) {
  const reduced = useReducedMotion()
  const [stage, setStage] = useState('hero')
  const stageRef = useRef('hero')
  // True while WE are scrolling the page (see the notes above).
  const selfScrollRef = useRef(false)

  const goStage = useCallback((next) => {
    if (stageRef.current === next) return
    stageRef.current = next
    setStage(next)
    mark('stage', { stage: next })
  }, [])

  /** Go to the works screen: the auto-glide, and the nav's "works" on `/`. */
  const toWorks = useCallback(() => {
    const el = worksRef.current
    if (!el) return
    goStage('works')

    const l = lenis()
    if (l) {
      selfScrollRef.current = true
      mark('glide')
      // `force` so it runs even if Lenis is mid-wheel; `lock` keeps that wheel
      // from fighting the glide until it lands, and is what the watcher reads
      // to know the glide is still in flight.
      l.scrollTo(el, {
        duration: 1.1,
        easing: easeBrand,
        force: true,
        lock: true,
        onComplete: () => {
          selfScrollRef.current = false
        },
      })
      return
    }

    // No Lenis in practice means reduced motion (SmoothScroll does not start
    // it), so this is a jump, and the watcher's position mapping agrees with
    // 'works' as soon as it lands. The smooth branch is only a fallback.
    if (!reduced) mark('glide')
    window.scrollTo({ top: documentTop(el), behavior: reduced ? 'auto' : 'smooth' })
  }, [goStage, reduced, worksRef])

  /* --- the watcher ------------------------------------------------------- */
  useEffect(() => {
    let lastY = window.scrollY

    const onScroll = () => {
      const y = window.scrollY
      const vh = window.innerHeight
      const down = y > lastY
      lastY = y

      if (selfScrollRef.current) {
        // Still our glide while Lenis holds its lock. Once the lock has gone
        // the glide is over — landed or cut short (see the notes above) — and
        // this scroll is the reader's, so it is read like any other.
        if (lenis()?.isLocked) return
        selfScrollRef.current = false
      }

      if (!glide) {
        const works = worksRef.current
        const top = works ? works.getBoundingClientRect().top : Number.POSITIVE_INFINITY
        goStage(top <= vh * 0.5 ? 'works' : 'hero')
        return
      }

      if (stageRef.current === 'hero') {
        // Only ever WITH the reader: an upward scroll that happens to be past
        // the line (the glide switched on by a resize part way down) stays put.
        if (down && y > vh * 0.15) toWorks()
        return
      }

      // Re-arm: back in the top band, the next scroll down glides again.
      if (y < vh * 0.1) goStage('hero')
    }

    // Without the glide, start from wherever the page already is. With it, a
    // first read could fire a glide nobody scrolled for (e.g. on a resize
    // that turns the glide on part way down), so it waits for a real scroll.
    if (!glide) onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [glide, goStage, toWorks, worksRef])

  return { stage, toWorks }
}
