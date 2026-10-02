import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { BottomNav } from './BottomNav'
import { useReducedMotion } from '@/lib/useReducedMotion'

/* ---------------------------------------------------------------------------
   The nav pill's home.

   There is exactly ONE nav pill on the site and this is the element that holds
   it. Nothing cross-fades: when the landing page reaches the works screen the
   dock's placement prop flips from 'bottom' to 'left', and the pill physically
   travels across the viewport, reflowing from a row into a column on the way.

   HOW THE TWEEN STAYS HONEST
   --------------------------
   This used to be GSAP Flip with `absolute: '[data-nav-item]'`. Flip scales the
   pill to get from one box to the other and lifts the buttons out of flow to
   carry them across, and the two together meant the icons visibly escaped the
   pill mid-flight — they scattered, then regrouped.

   The replacement is a plain FLIP done by hand, built on one property: if the
   pill's box and every item's position are interpolated between the same two
   measurements with the SAME easing, and an item's size never changes, then an
   item that is inside the pill at both ends is inside it on every frame in
   between. Linear interpolation preserves "is inside"; scaling does not.

   So, for one tween:

     * the host div is pinned to the pill's FINAL size, so its placement classes
       (which centre it with a percentage translate) resolve to a constant and
       the host cannot drift while the pill resizes underneath it;
     * the pill is absolutely positioned inside that host, and tweens its width
       and height from the old box to the new one, offset by a transform that
       decays from (old position - new position) to zero;
     * each item keeps its place in normal flow — nothing is taken out — and
       tweens a transform from (its old offset in the pill - its new offset) to
       zero;
     * `align-items: flex-start` is forced for the duration. The resting layouts
       centre their items, which is a no-op when the pill hugs them, but while
       the pill is wider or taller than its content it would drag every item
       around and break the interpolation.

   Everything moving is `transform` plus the pill's own width/height, inside a
   `position: fixed` host, so a scroll in flight cannot shift any of it — which
   is the other half of the jitter the client was seeing.

   Why `fixed` even on the landing page: the pill has to stay put through three
   screens of scrolling. The landing page reserves the pill's old in-flow box
   with an invisible spacer, so the hero lays out exactly as it did when the
   pill lived in the document.
--------------------------------------------------------------------------- */

const PLACEMENT = {
  // Same offsets the pill had when it was an in-flow block at the end of the
  // hero, and the same `left-12` the works page used.
  bottom: 'fixed bottom-[clamp(1.5rem,3.5vh,3rem)] left-1/2 z-30 -translate-x-1/2',
  left: 'fixed left-12 top-1/2 z-30 -translate-y-1/2',
}

/**
 * Snapshot the pill and its buttons in viewport coordinates.
 *
 * `getBoundingClientRect` reports what is on screen right now, transforms
 * included, so interrupting a tween half way measures where things actually
 * are rather than where CSS would like them to be — the new tween picks up
 * from the visible state instead of snapping first.
 */
function measure(host) {
  const pill = host?.querySelector('[data-flip-id="nav-pill"]')
  if (!pill) return null
  const box = pill.getBoundingClientRect()
  const items = new Map()
  pill.querySelectorAll('[data-nav-item]').forEach((el) => {
    const r = el.getBoundingClientRect()
    // The phones-only "links" button is `display: none` at the widths where
    // this transition happens, and a hidden element measures as a zero rect.
    if (!r.width || !r.height) return
    items.set(el.dataset.flipId ?? el, { el, x: r.x - box.x, y: r.y - box.y })
  })
  return { pill, box, items }
}

/**
 * Hand layout back to CSS: no transforms, no inline sizes, nothing left over.
 *
 * The host's inline styles are wiped directly rather than with GSAP's
 * `clearProps`. Its placement classes position it with a percentage translate,
 * and clearing a transform GSAP never set makes GSAP read that translate off
 * the computed style and write it back as an inline `transform` — which then
 * composes with the class's own `translate` and leaves the pill half its width
 * to the left of where it belongs. Nothing but this file writes inline styles
 * on these three nodes, so emptying the host's is exact; the pill and its
 * buttons have no CSS transform of their own and can safely go through GSAP.
 */
function reset(host) {
  if (!host) return
  const pill = host.querySelector('[data-flip-id="nav-pill"]')
  host.style.cssText = ''
  if (!pill) return
  gsap.set(pill, { clearProps: 'all' })
  gsap.set(pill.querySelectorAll('[data-nav-item]'), { clearProps: 'all' })
}

/** Space the footer keeps clear above a bottom pill, past the pill itself. */
const DOCK_GAP = 16

/**
 * Publish `--dock-clear` on <html> while the pill sits at the bottom: the
 * distance from the bottom of the viewport to the top of the pill, plus a
 * 16px gap. On phones the footer pads itself by this much (see Footer), so at
 * the very end of the page its row sits above the pill instead of tucked
 * under it. Measured rather than written down because the pill's offset is a
 * clamp() of the viewport height. Removed when the dock unmounts, so pages
 * without a pill keep their own footer spacing.
 */
function usePublishedDockClearance(hostRef, placement) {
  useLayoutEffect(() => {
    const host = hostRef.current
    const root = document.documentElement
    if (!host || placement !== 'bottom') {
      root.style.removeProperty('--dock-clear')
      return undefined
    }

    const write = () => {
      const top = host.getBoundingClientRect().top
      root.style.setProperty('--dock-clear', `${Math.round(window.innerHeight - top + DOCK_GAP)}px`)
    }
    write()

    const ro = new ResizeObserver(write)
    ro.observe(host)
    window.addEventListener('resize', write)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', write)
      root.style.removeProperty('--dock-clear')
    }
  }, [hostRef, placement])
}

export function NavDock({
  placement = 'bottom',
  activePath,
  onNavigate,
  duration = 1.1,
}) {
  const hostRef = useRef(null)
  const pendingRef = useRef(null)
  const tweenRef = useRef(null)
  const [applied, setApplied] = useState(placement)
  const reduced = useReducedMotion()
  usePublishedDockClearance(hostRef, applied)

  // Pass 1 — the DOM is still in the OLD placement here, because `applied`
  // (not `placement`) is what renders. Record it, then commit the new one.
  useLayoutEffect(() => {
    if (placement === applied) return
    const host = hostRef.current
    if (!host) {
      setApplied(placement)
      return
    }
    // Measure BEFORE killing the previous tween: the rects we want are the ones
    // currently on screen, and clearing props first would snap them away.
    pendingRef.current = measure(host)
    tweenRef.current?.kill()
    tweenRef.current = null
    reset(host)
    setApplied(placement)
  }, [placement, applied])

  // Pass 2 — React flushed the new layout synchronously, still before paint,
  // so the tween can start from the recorded rects without a flash.
  useLayoutEffect(() => {
    const first = pendingRef.current
    pendingRef.current = null
    const host = hostRef.current
    if (!first || !host) return undefined

    const last = measure(host)
    if (!last) return undefined

    if (reduced) {
      reset(host)
      return undefined
    }

    // Pin the host at the final size so its percentage translate is a constant
    // for the whole tween, then let the pill float inside it.
    gsap.set(host, { width: last.box.width, height: last.box.height })
    gsap.set(last.pill, {
      position: 'absolute',
      top: 0,
      left: 0,
      margin: 0,
      alignItems: 'flex-start',
      width: first.box.width,
      height: first.box.height,
      x: first.box.x - last.box.x,
      y: first.box.y - last.box.y,
      willChange: 'transform,width,height',
    })

    // Matched on the flip id rather than on position, so an item that is only
    // rendered at some widths cannot shift the pairing of the others.
    const movers = []
    last.items.forEach((item, id) => {
      const was = first.items.get(id)
      if (!was) return
      movers.push(item.el)
      gsap.set(item.el, { x: was.x - item.x, y: was.y - item.y, willChange: 'transform' })
    })

    const tl = gsap.timeline({
      defaults: { duration, ease: 'power3.inOut' },
      onComplete: () => {
        tweenRef.current = null
        reset(host)
      },
    })
    tl.to(last.pill, { width: last.box.width, height: last.box.height, x: 0, y: 0 }, 0)
    if (movers.length) tl.to(movers, { x: 0, y: 0 }, 0)

    tweenRef.current = tl
    return undefined
  }, [applied, duration, reduced])

  useLayoutEffect(() => () => tweenRef.current?.kill(), [])

  return (
    <div ref={hostRef} className={PLACEMENT[applied] ?? PLACEMENT.bottom}>
      <BottomNav
        orientation={applied === 'left' ? 'vertical' : 'horizontal'}
        activePath={activePath}
        onNavigate={onNavigate}
      />
    </div>
  )
}
