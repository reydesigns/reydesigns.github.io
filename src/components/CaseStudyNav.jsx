import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { scrollToSection, useActiveSection, useScrollProgress } from '@/lib/sectionScroll'
import pikaGif from '@assets/brand/animation/pika-sleeping.gif'

/* The sleeping cat sits in the bottom of the panel in the comp. Its GIF canvas
   carries a lot of transparent padding, so the wrapper crops to the artwork's
   measured bounds — same trick as GifMark, without the freeze: the cat is a
   loop, not a draw-on. */
const PIKA_CANVAS = [2000, 2100]
const PIKA_BOX = [0.112, 0.301, 0.868, 0.686]

/** `‹` as a shape rather than a glyph, so it keeps its weight at any size. */
function Chevron() {
  return (
    <svg
      viewBox="0 0 8 14"
      aria-hidden="true"
      className="h-[0.85em] w-[0.5em] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6.5 1 1.5 7l5 6" />
    </svg>
  )
}

function Pika({ width }) {
  const [cw, ch] = PIKA_CANVAS
  const [x, y, w, h] = PIKA_BOX
  const imgW = `calc(${width} / ${w})`
  return (
    <span
      aria-hidden="true"
      className="relative block overflow-hidden"
      style={{ width, aspectRatio: `${w * cw} / ${h * ch}` }}
    >
      <img
        src={pikaGif}
        alt=""
        decoding="async"
        className="absolute max-w-none"
        style={{
          width: imgW,
          height: 'auto',
          left: `calc(${imgW} * ${-x})`,
          top: `calc(${imgW} * ${(-y * ch) / cw})`,
        }}
      />
    </span>
  )
}

function HomeButton({ className = '' }) {
  return (
    <Link
      to="/works"
      className={`inline-flex shrink-0 items-center gap-[0.45em] rounded-[var(--radius-pill)] border-[2.5px] border-[var(--color-surface)] px-[0.85em] py-[0.5em] text-[length:var(--text-eyebrow)] font-bold tracking-[0.08em] text-[var(--color-surface)] no-underline transition-colors duration-200 hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] ${className}`}
    >
      <Chevron />
      HOME
    </Link>
  )
}

/**
 * The case study's own navigation.
 *
 * Desktop: a fixed maroon panel pinned to the left edge and vertically centred,
 * rounded on its right side only — it reads as a tab growing out of the page
 * edge. It never scrolls; only the article does.
 *
 * Under 64rem the same panel would sit on top of the article, so it becomes a
 * slim sticky strip above it instead: the HOME button plus the six sections in
 * a horizontally swipeable row, with the progress bar as a hairline underneath.
 * The strip sits in an opaque, page-coloured band that fades out at its foot,
 * so the article scrolls cleanly underneath it; the row keeps its active link
 * centred as the reader moves through the sections.
 *
 * @param sections [{ id, label }] in document order
 */
export function CaseStudyNav({ sections, ids }) {
  const reduced = useReducedMotion()
  const observed = useActiveSection(ids)
  const progress = useScrollProgress()

  // A clicked section stays highlighted until the reader scrolls by hand.
  // Without this, jumping to a section near the end of the page lands at the
  // page's bottom, where the observer reports the last section instead.
  const [pinned, setPinned] = useState(null)
  useEffect(() => {
    if (!pinned) return undefined
    const release = () => setPinned(null)
    const opts = { passive: true }
    window.addEventListener('wheel', release, opts)
    window.addEventListener('touchmove', release, opts)
    window.addEventListener('keydown', release)
    return () => {
      window.removeEventListener('wheel', release, opts)
      window.removeEventListener('touchmove', release, opts)
      window.removeEventListener('keydown', release)
    }
  }, [pinned])
  const active = pinned ?? observed

  // Desktop rail: the filled line runs from the top of the list to the bottom
  // of the active section's label, so its end always sits level with the word
  // that is highlighted. Measured rather than computed, because the labels'
  // line height follows the fluid type scale.
  const listRef = useRef(null)
  const [railEnd, setRailEnd] = useState(0)
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return undefined
    const measure = () => {
      const link = list.querySelector(`[data-section="${active}"]`)
      if (link) setRailEnd(link.offsetTop + link.offsetHeight)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(list)
    return () => ro.disconnect()
  }, [active])

  // Phone strip: six labels overflow a 375px screen, so whenever the active
  // section changes the strip slides sideways to centre its link. This moves
  // the strip's own scrollLeft — element.scrollIntoView would also scroll the
  // page and fight Lenis mid-animation.
  const stripRef = useRef(null)
  useEffect(() => {
    const strip = stripRef.current
    // clientWidth is 0 while the strip is display:none (desktop).
    if (!strip || !strip.clientWidth) return
    const link = strip.querySelector('[aria-current="true"]')
    if (!link) return
    const offset =
      link.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft
    const max = strip.scrollWidth - strip.clientWidth
    const left = Math.max(0, Math.min(max, offset - (strip.clientWidth - link.offsetWidth) / 2))
    if (Math.abs(left - strip.scrollLeft) < 1) return
    strip.scrollTo({ left, behavior: reduced ? 'auto' : 'smooth' })
  }, [active, reduced])

  const go = (event, id) => {
    event.preventDefault()
    setPinned(id)
    scrollToSection(id, { reduced })
  }

  // On the desktop panel a label wraps at the panel's fixed width (as
  // "RESEARCH & OUTCOME" does in the comp) instead of widening the panel; the
  // phone strip scrolls sideways, so there every label stays on one line, and
  // is stretched to a 44px-tall touch target without changing the text.
  const linkClass = (id, wrap = false) =>
    `${wrap ? 'block whitespace-normal' : 'flex min-h-11 items-center whitespace-nowrap'} text-left text-[length:var(--text-body)] leading-[1.55] tracking-[0.015em] text-[var(--color-bg)] no-underline transition-opacity duration-200 ${
      active === id ? 'font-extrabold opacity-100' : 'font-semibold opacity-45 hover:opacity-75'
    }`

  return (
    <>
      {/* ---------- desktop: fixed left panel ---------- */}
      <nav
        aria-label="Case study sections"
        // One fixed width and one padding on every side, from case-study.css,
        // so the panel is identical across the case studies whatever their
        // section names (see --cs-nav-w).
        className="fixed top-1/2 left-0 z-20 hidden w-[var(--cs-nav-w)] -translate-y-1/2 flex-col rounded-r-[2rem] bg-[var(--color-ink)] p-[var(--cs-nav-pad)] lg:flex"
      >
        <HomeButton className="self-start" />

        <div className="relative mt-[var(--cs-nav-gap)] pl-[var(--cs-nav-indent)]">
          {/* the rail: filled down to the section being read */}
          <span
            aria-hidden="true"
            className="absolute top-0 left-0 h-full w-[3px] overflow-hidden rounded-full bg-[var(--color-bg)] opacity-20"
          />
          <span
            aria-hidden="true"
            className="cs-rail-fill absolute top-0 left-0 w-[3px] rounded-full bg-[var(--color-bg)]"
            style={{ height: railEnd }}
          />

          <ul ref={listRef} className="m-0 flex list-none flex-col gap-[0.45rem] p-0">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={(e) => go(e, s.id)}
                  aria-current={active === s.id ? 'true' : undefined}
                  data-section={s.id}
                  className={linkClass(s.id, true)}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* The same gap below the list as above it; with even padding the
            content box's centre is the panel's centre. */}
        <span className="mt-[var(--cs-nav-gap)] self-center">
          <Pika width="4.9rem" />
        </span>
      </nav>

      {/* ---------- phones + tablets: sticky strip above the article ---------- */}
      {/* The nav itself is a page-coloured band (top padding and gutters
          included, fading out below), so the article never shows around the
          pill as it scrolls underneath. */}
      <nav
        aria-label="Case study sections"
        className="cs-strip-band sticky top-0 z-20 mb-[1.25rem] bg-[var(--color-bg)] px-[var(--page-gutter)] pt-[0.5rem] lg:hidden"
      >
        <div className="overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-ink)]">
          {/* The links carry the vertical padding (not the strip), so each one
              is a full 44px touch target; HOME takes the shared .hit-44 to match. */}
          <div
            ref={stripRef}
            className="cs-strip flex items-center gap-[1.1rem] overflow-x-auto px-[0.85rem]"
          >
            <HomeButton className="hit-44" />
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => go(e, s.id)}
                aria-current={active === s.id ? 'true' : undefined}
                className={linkClass(s.id)}
              >
                {s.label}
              </a>
            ))}
          </div>
          <span aria-hidden="true" className="block h-[3px] w-full bg-[var(--color-bg)] opacity-20" />
          <span
            aria-hidden="true"
            className="cs-progress-h -mt-[3px] block h-[3px] w-full bg-[var(--color-bg)]"
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      </nav>
    </>
  )
}
