import gsap from 'gsap'

/* ---------------------------------------------------------------------------
   Works card -> case study, as one moving object.

   Clicking a card does not hard-cut to the case study. The card's thumbnail is
   cloned into a fixed overlay at its exact on-screen rect, the route changes
   underneath it, and the clone then grows into the case study's hero before
   fading out.

   Deliberately dumb and deliberately disposable:

   * The clone is a detached copy. Nothing on the live page is moved, hidden or
     restyled, so an interrupted transition cannot leave the grid in a broken
     state — the worst case is an orphan overlay, and that is what `cancel()`,
     the route watcher and the hard safety timeout are all for.

   * Any <video> inside the clone is stripped. A card thumbnail may hold a
     walkthrough; a second decoding video for a half-second morph is not worth
     it, and the resting state of those thumbnails is flat --color-maroon
     anyway, which is exactly what the case-study hero opens on.

   * The destination is looked up as `[data-case-hero]` on the page that just
     mounted. The case-study page owns that marker and may not have one yet, so
     a sensible full-bleed rect is used when it is missing. The transition must
     never depend on the other page cooperating.
--------------------------------------------------------------------------- */

const OVERLAY_Z = 60
const MORPH_MS = 0.55
const SAFETY_MS = 2000

let run = null

export function cancelCardMorph() {
  if (!run) return
  const r = run
  run = null
  clearTimeout(r.safety)
  r.tween?.kill()
  r.host.remove()
}

/** Called from the router so a navigation elsewhere tears the overlay down. */
export function noteRoute(pathname) {
  if (run && pathname !== run.to) cancelCardMorph()
}

function heroRect() {
  const target = document.querySelector('[data-case-hero]')
  if (target) {
    const r = target.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return r
  }
  // No marker on the destination: open on a full-bleed band at the top of the
  // viewport, which is where a case-study hero lands in every comp.
  const width = document.documentElement.clientWidth
  return {
    left: 0,
    top: 0,
    width,
    height: Math.min(window.innerHeight * 0.62, width / 2),
  }
}

/**
 * @param thumb    the card's thumbnail element — the thing that morphs
 * @param to       the case-study path
 * @param navigate react-router's navigate
 */
export function morphCardToCaseStudy({ thumb, to, navigate }) {
  cancelCardMorph()

  const from = thumb.getBoundingClientRect()
  if (!from.width || !from.height) {
    navigate(to)
    return
  }

  const clone = thumb.cloneNode(true)
  clone.querySelectorAll('video').forEach((v) => v.remove())
  clone.removeAttribute('id')
  clone.setAttribute('aria-hidden', 'true')
  Object.assign(clone.style, {
    position: 'absolute',
    margin: '0',
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    willChange: 'left, top, width, height',
  })

  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = `position:fixed;inset:0;z-index:${OVERLAY_Z};pointer-events:none;`
  host.appendChild(clone)
  document.body.appendChild(host)

  run = { host, clone, to, tween: null, safety: 0 }
  const token = run
  // Whatever happens below — a thrown render, a stalled route, a tab switch —
  // the overlay is gone within a couple of seconds.
  token.safety = setTimeout(() => {
    if (run === token) cancelCardMorph()
  }, SAFETY_MS)

  navigate(to)

  // Two frames: one for React to commit the new route, one for layout to
  // settle so `[data-case-hero]` measures at its real size.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (run !== token) return
      const to2 = heroRect()
      token.tween = gsap.timeline({
        onComplete: () => {
          if (run === token) cancelCardMorph()
        },
      })
      token.tween
        .to(clone, {
          left: to2.left,
          top: to2.top,
          width: to2.width,
          height: to2.height,
          borderRadius: 0,
          duration: MORPH_MS,
          ease: 'power2.inOut',
        })
        .to(host, { opacity: 0, duration: 0.18, ease: 'none' }, `-=0.14`)
    })
  })
}
