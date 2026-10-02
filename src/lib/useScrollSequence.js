import { useCallback, useEffect, useRef, useState } from 'react'
import { loaderTotalMs } from './loaderTiming'

/* ---------------------------------------------------------------------------
   The landing sequence.

   `/` is ONE document, three screens tall:

       0  ──────── hero          (100dvh, top bar included)
       1  ──────── loader        (100dvh, wordmark centred)
       2  ──────── works grid    (100dvh)

   Scrolling down past ~40% of the first screen hands control over: the page
   eases the loader screen into place, scrolling is stopped, the wordmark GIF
   plays its two loops, and at --loader-total-ms the page releases the lock and
   glides to the works screen while the nav pill flies from the bottom to the
   left edge.

   Design notes that are easy to get wrong later:

   * The trigger is at 0.40 of a viewport, which is *before* the wordmark is
     on screen (it is centred on the second screen, so it appears at ~0.46).
     That is deliberate — the take-over scroll is what reveals the mark, so
     there is no moment where a half-scrolled loader is visible and then jumps.

   * Lenis `stop()` kills any animation in flight, so the order is always
     stop-then-scrollTo-with-force, never the other way round.

   * Nothing is remembered between runs. The client asked for the loader to
     replay every single time, so scrolling back up to the hero re-arms it.
     There is deliberately no sessionStorage here; do not add one.

   * Every lock is paired with a safety timer that releases it no matter what,
     and the effect cleanup releases it on unmount. A visitor must never end up
     on a page that will not scroll.
--------------------------------------------------------------------------- */

function lenis() {
  return typeof window !== 'undefined' ? window.__lenis : undefined
}

function documentTop(el) {
  return el.getBoundingClientRect().top + window.scrollY
}

/** Scroll to an element, through Lenis when it is there and natively when not. */
function glideTo(el, { duration = 1, force = false, onComplete } = {}) {
  if (!el) return
  const l = lenis()
  if (l) {
    l.scrollTo(el, { duration, lock: true, force, onComplete })
    return
  }
  window.scrollTo({ top: documentTop(el), behavior: 'smooth' })
  onComplete?.()
}

// A breadcrumb trail the QA script asserts against — see scripts/sequence.mjs.
function mark(event) {
  if (typeof window === 'undefined') return
  const log = (window.__seqLog ||= [])
  log.push({ event, t: Math.round(performance.now()) })
}

export function useScrollSequence({ enabled, reduced, loaderRef, worksRef }) {
  const [stage, setStage] = useState('hero')
  // Bumped on every loader run so the <img> is a brand new node and the GIF
  // restarts from frame 0 instead of resuming wherever the decoder left off.
  const [runId, setRunId] = useState(0)

  const stageRef = useRef('hero')
  const lockedRef = useRef(false)
  const timersRef = useRef(new Set())
  // True while WE are scrolling the page. Without this the glide that the skip
  // and the nav's Works button start trips the watcher itself: it begins at
  // y≈0, which is inside the re-arm band, so the hero re-arms and the loader
  // fires on the way past 40% — exactly what skipping is meant to avoid.
  const selfScrollRef = useRef(false)

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current.clear()
  }, [])

  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id)
      fn()
    }, ms)
    timersRef.current.add(id)
    return id
  }, [])

  const unlock = useCallback((silent = false) => {
    if (!lockedRef.current) return
    lockedRef.current = false
    lenis()?.start()
    window.__seqLocked = false
    if (!silent) mark('unlock')
  }, [])

  /**
   * Only ever locks through Lenis. If Lenis is missing — reduced motion, a
   * failed import, anything — the sequence simply runs unlocked rather than
   * reaching for `overflow: hidden` and risking a page nobody can scroll.
   */
  const lock = useCallback(() => {
    const l = lenis()
    if (!l || lockedRef.current) return
    lockedRef.current = true
    l.stop()
    window.__seqLocked = true
    mark('lock')
  }, [])

  const goStage = useCallback((next) => {
    if (stageRef.current === next) return
    stageRef.current = next
    setStage(next)
  }, [])

  /** Hand off to the works screen. Also the skip button and the nav's Works. */
  const toWorks = useCallback(
    ({ animate = true } = {}) => {
      clearTimers()
      const wasLoader = stageRef.current === 'loader'
      goStage('works')
      unlock()
      mark(wasLoader ? 'handoff' : 'skip')
      const el = worksRef.current
      if (!el) return
      selfScrollRef.current = true
      if (!animate) {
        window.scrollTo({ top: documentTop(el), behavior: 'auto' })
        lenis()?.scrollTo(el, { immediate: true, force: true })
        later(() => {
          selfScrollRef.current = false
        }, 120)
        return
      }
      const release = () => {
        selfScrollRef.current = false
      }
      // Release on the glide's own completion rather than a fixed timer: a
      // timer long enough to cover the easing tail also swallows the visitor's
      // next real scroll, which left the hero unable to re-arm after a skip.
      glideTo(el, { duration: 1.1, force: true, onComplete: release })
      later(release, 2000) // fallback if onComplete never fires
    },
    [clearTimers, goStage, later, unlock, worksRef],
  )

  const enterLoader = useCallback(() => {
    goStage('loader')
    setRunId((n) => n + 1)
    mark('loader-start')

    // Stop first: Lenis' stop() resets any animation, so a scrollTo issued
    // before it would be thrown away.
    lock()
    glideTo(loaderRef.current, { duration: 0.85, force: true })

    const total = loaderTotalMs()
    later(() => toWorks(), total)
    // Belt and braces: whatever happens above, the page scrolls again.
    later(() => unlock(), total + 3000)
  }, [goStage, lock, later, loaderRef, toWorks, unlock])

  /* --- the watcher ------------------------------------------------------- */
  useEffect(() => {
    if (!enabled) {
      goStage('hero')
      return undefined
    }

    // A reload restores the old scroll offset. Landing two screens down with
    // the nav still at the bottom would be nonsense, so adopt the end state.
    if (window.scrollY > window.innerHeight * 0.5) goStage('works')

    let lastY = window.scrollY

    const onScroll = () => {
      const y = window.scrollY
      const vh = window.innerHeight
      const down = y > lastY + 0.5
      lastY = y

      // Our own glides must not re-arm or re-trigger anything.
      if (selfScrollRef.current) return

      if (reduced) {
        // No hijacking at all: just reflect where the reader already is, so
        // the nav still lands on the left when the works screen arrives.
        const works = worksRef.current
        const top = works ? documentTop(works) : Number.POSITIVE_INFINITY
        goStage(y > top - vh * 0.5 ? 'works' : 'hero')
        return
      }

      if (stageRef.current === 'hero') {
        if (down && y > vh * 0.4) enterLoader()
        return
      }

      // Re-arm. Scrolling back up to the hero makes the loader play again —
      // every time, by explicit client request.
      if (!lockedRef.current && y < vh * 0.18) goStage('hero')
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [enabled, reduced, enterLoader, goStage, worksRef])

  /* --- never leave the page locked --------------------------------------- */
  useEffect(
    () => () => {
      clearTimers()
      lockedRef.current = true // force unlock() past its own guard
      unlock(true)
    },
    [clearTimers, unlock],
  )

  // Releasing the lock if the tab is hidden mid-loop stops a backgrounded tab
  // (where timers are throttled) from coming back frozen.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && lockedRef.current) {
        clearTimers()
        unlock()
        goStage('works')
      }
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [clearTimers, goStage, unlock])

  return { stage, runId, toWorks }
}
