import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { visitorCount } from '@/lib/visits'
import { ScrambleText } from '@/components/ScrambleText'
import pikaGif from '@assets/brand/animation/pika-sleeping.gif'
import pikaStill from '@assets/brand/animation/pika-sleeping-still.png'

/* One line of small capitals, the same on all three parts of the footer. */
const FOOT_TEXT =
  'text-[length:var(--text-eyebrow)] uppercase tracking-[0.06em] text-[var(--color-ink-muted)] whitespace-nowrap'

/**
 * Site footer. Rendered by Layout, so it is on every page by construction
 * rather than by remembering to add it.
 *
 * Three parts on one line: REYDESIGNS @ 2026 (with the sleeping cat) on the
 * left, MADE /W THE HELP OF ICED CAPPS centred on the screen, and on the
 * right the visitor counter, WEBSITE STALKERS: ##. The left and centre are
 * static; the counter scrambles into place (ScrambleText) every time the
 * footer comes into view, once the count is in. Between times its text is
 * laid out invisibly, so nothing shifts when it plays. With no count to show
 * (visits.js), the right is simply empty. On a phone the centre line drops
 * to a second row.
 *
 * The sleeping cat is 3 frames over 1.5s with a loop count of 0, so it runs for
 * as long as the page is open on its own; reduced motion gets the first frame
 * as a flat PNG (pika-sleeping-still.png) and no animation at all.
 *
 * Deliberately short: on the landing page this sits at the bottom of the works
 * screen (see Layout), where the only space going spare is the gap under the
 * cards.
 *
 * On phones the nav pill is fixed over the bottom of the screen, and at the end
 * of the page this row would land just under it. Pages with the pill publish
 * `--dock-clear` (NavDock), and below `sm` the footer pads itself by that much
 * so the row comes to rest above the pill with room to tap.
 */
export function Footer({ className = '' }) {
  const reduced = useReducedMotion()
  const ref = useRef(null)
  const [count, setCount] = useState(null)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    let alive = true
    visitorCount().then((n) => alive && setCount(n))
    return () => {
      alive = false
    }
  }, [])

  // "Scrolled all the way down": most of the footer is on screen, and the
  // counter scrambles in. Every time: once the footer has gone right off the
  // screen again it resets, so the next visit to the bottom plays it anew
  // (half out and back in does not, so it never stutters at the edge).
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.intersectionRatio >= 0.9) setSeen(true)
          else if (!e.isIntersecting) setSeen(false)
        }
      },
      { threshold: [0, 0.9] },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const stalkers = count === null ? null : `WEBSITE STALKERS: ${count.toLocaleString('en-US')}`

  return (
    <footer
      ref={ref}
      className={
        'grid grid-cols-2 items-center gap-x-4 gap-y-1 px-[var(--page-gutter)] ' +
        'sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] ' +
        'pb-[clamp(0.375rem,0.8vh,0.625rem)] pt-[clamp(0.1875rem,0.5vh,0.375rem)] ' +
        `max-sm:pb-[max(clamp(0.375rem,0.8vh,0.625rem),var(--dock-clear,0px))] ${className}`
      }
    >
      <span className="flex min-w-0 items-center gap-[clamp(0.375rem,0.8vw,0.75rem)] justify-self-start">
        <img
          src={reduced ? pikaStill : pikaGif}
          alt=""
          aria-hidden="true"
          className="h-[clamp(1.5rem,1.9vw,2rem)] w-auto shrink-0 object-contain"
        />
        <span className={`truncate ${FOOT_TEXT}`}>REYDESIGNS @ 2026</span>
      </span>

      <span className={`col-span-2 row-start-2 justify-self-center sm:col-span-1 sm:col-start-2 sm:row-start-1 ${FOOT_TEXT}`}>
        MADE /W THE HELP OF ICED CAPPS
      </span>

      <span className={`justify-self-end sm:col-start-3 ${FOOT_TEXT}`}>
        {stalkers &&
          (seen ? (
            <ScrambleText segments={[{ text: stalkers }]} durationMs={1400} />
          ) : (
            <span className="invisible" aria-hidden="true">
              {stalkers}
            </span>
          ))}
      </span>
    </footer>
  )
}
