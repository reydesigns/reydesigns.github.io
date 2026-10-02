import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { posterForVideo } from '@/data/caseStudies'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useSaveData } from '@/lib/useSaveData'

/* ---------------------------------------------------------------------------
   Building blocks every case study shares, so the articles read as one system:
   the same heading, eyebrow, body copy, section rhythm, hero and outro.
   Spacing is never set here — sections are `cs-flow` containers and the rhythm
   comes from the scale in case-study.css.
--------------------------------------------------------------------------- */

/* Every heading in a case study — section headings (h2) and the sub-headings
   inside them (h3) alike — is one style: ~30px Kumbh Sans, extra bold. The
   level is carried by the markup, not by the size. */
export const HEAD =
  'cs-head m-0 text-[length:var(--text-cs-head)] leading-[1.18] font-extrabold tracking-[-0.01em] text-[var(--color-ink)]'

/** The article column. The wide figures in TMU break out of it on purpose. */
export const ARTICLE =
  'mx-auto flex w-[min(calc(100%-2*var(--page-gutter)),var(--cs-col-w))] flex-col pb-[var(--cs-8)]'

/**
 * Small letterspaced label that opens each section. Doubles as the landmark.
 * Uppercase, bold, and set back to --cs-header-opacity, as in the comp.
 */
export function Eyebrow({ children }) {
  return (
    <p
      className="cs-eyebrow m-0 text-[length:var(--text-eyebrow)] font-extrabold tracking-[0.12em] text-[var(--color-ink)] uppercase"
      style={{ opacity: 'var(--cs-header-opacity)' }}
    >
      {children}
    </p>
  )
}

export function P({ children, className = '' }) {
  return (
    <p
      className={`m-0 text-[length:var(--text-body)] leading-[1.3] text-[var(--color-ink)] ${className}`}
    >
      {children}
    </p>
  )
}

/** Pixelta accent inside a Kumbh line. Never give it a quote — it has none. */
export function Accent({ children, className = '' }) {
  return <span className={`font-display ${className}`}>{children}</span>
}

export function Section({ id, children, className = '' }) {
  return (
    <section id={id} className={`cs-section cs-flow ${className}`}>
      {children}
    </section>
  )
}

/** The hero walkthrough. Behaves like a GIF: muted, looping, no chrome.
 *
 *  The poster is a frame of the same walkthrough, so the box opens on the
 *  project instead of empty maroon while the 1080p file starts — and stays on
 *  it wherever the video can't play (HeySo is WebM only, which iOS Safari
 *  before 17.4 won't decode).
 *
 *  Reduced motion and the browser's data saver both start on the poster alone:
 *  nothing autoplays and `preload="none"` keeps the walkthrough (2.6–7 MB) from
 *  downloading. Data saver is about bytes, not motion, so there the native
 *  controls let the visitor choose to spend them; reduced motion stays still.
 *  The hero sits at the top of the page, so there is no "near view" to wait
 *  for — when it plays, it plays from the first paint. */
export function CaseHero({ src, label, aspect }) {
  const videoRef = useRef(null)
  const reduced = useReducedMotion()
  const saveData = useSaveData()
  const still = reduced || saveData
  const tapToPlay = saveData && !reduced

  // The src never changes, so toggling reduced motion mid-visit has to stop
  // and restart playback by hand. Stopping goes back to the poster's frame
  // (0.5s); a video that never loaded is already showing the poster. Under
  // data saver, turning reduced motion off only brings the controls back.
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    if (reduced) {
      el.pause()
      if (el.readyState > 0) el.currentTime = 0.5
    } else if (!saveData) {
      el.play().catch(() => {})
    }
  }, [reduced, saveData])

  return (
    <div
      data-case-hero
      className="relative w-full overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-maroon)]"
      style={{ aspectRatio: aspect }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={posterForVideo(src)}
        autoPlay={!still}
        loop
        controls={tapToPlay}
        muted
        playsInline
        preload={still ? 'none' : 'metadata'}
        aria-label={label}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  )
}

/** A list with large maroon Pixelta numerals hanging in the margin. An item
 *  may be an array, for several paragraphs under one number. */
export function NumberedList({ items }) {
  return (
    <ol className="m-0 flex list-none flex-col gap-[var(--cs-5)] p-0">
      {items.map((item, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <li key={i} className="flex gap-[var(--cs-4)]">
          <span
            aria-hidden="true"
            className="font-display w-[1.35em] shrink-0 text-[length:var(--cs-list-marker)] leading-[1.05] text-[var(--color-maroon)]"
          >
            {i + 1}.
          </span>
          <div className="flex flex-col gap-[var(--cs-gap-flow)]">
            {(Array.isArray(item) ? item : [item]).map((para, j) => (
              // eslint-disable-next-line react/no-array-index-key
              <P key={j}>{para}</P>
            ))}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** The client's logo and name above the title. Logos are square, transparent
 *  and trimmed to their artwork, so every client's mark reads the same size. */
export function ClientLine({ logo, children }) {
  return (
    <p className="m-0 mt-[var(--cs-6)] flex items-center gap-[var(--cs-3)] text-[length:var(--text-body)] font-medium text-[var(--color-ink-muted)]">
      <img src={logo} alt="" width={160} height={160} className="h-[2em] w-[2em] object-contain" />
      {children}
    </p>
  )
}

/** The role / duration / team / tools card. `cells` is [label, lines[]]. */
export function RoleCard({ cells }) {
  return (
    <dl className="cs-figure cs-figure--inset cs-card m-0 grid grid-cols-2 gap-x-[var(--cs-5)] gap-y-[var(--cs-7)] px-[12%] py-[var(--cs-6)]">
      {cells.map(([label, lines]) => (
        <div key={label}>
          <dt className="text-[length:var(--text-eyebrow)] font-extrabold tracking-[0.04em] text-[var(--color-ink-muted)] uppercase opacity-80">
            {label}
          </dt>
          {lines.map((l) => (
            <dd
              key={l}
              className="m-0 text-[length:calc(var(--text-body)*1.3)] leading-[1.2] text-[var(--color-ink)] first-of-type:mt-[var(--cs-2)]"
            >
              {l}
            </dd>
          ))}
        </div>
      ))}
    </dl>
  )
}

/** Uppercase pills under the title. */
export function Tags({ tags }) {
  return (
    <ul className="m-0 mt-[var(--cs-5)] flex list-none flex-wrap gap-[var(--cs-2)] p-0">
      {tags.map((tag) => (
        <li
          key={tag}
          className="rounded-[var(--radius-pill)] bg-[var(--color-surface)] px-[0.95rem] py-[0.4rem] text-[length:var(--text-eyebrow)] font-medium tracking-[0.04em] text-[var(--color-ink-muted)]"
        >
          {tag}
        </li>
      ))}
    </ul>
  )
}

/**
 * The link to the next case study, then the end-of-document marker the nav
 * watches: a short last section can never reach a band pinned to the top of
 * the viewport, so `useActiveSection` hands the last section the highlight
 * once this marker is on screen.
 */
export function Outro({ next }) {
  return (
    <>
      {next ? (
        <Link
          to={`/works/${next.slug}`}
          className="group mt-[var(--cs-gap-outro)] flex items-end justify-between gap-[var(--cs-5)] border-t-[1.5px] border-[var(--color-ink-muted)] pt-[var(--cs-4)] no-underline"
        >
          <span className="text-[length:var(--text-eyebrow)] font-bold tracking-[0.1em] text-[var(--color-ink-muted)] uppercase">
            Next case study
          </span>
          <span className="font-display text-right text-[length:var(--text-h2)] leading-[1.1] text-[var(--color-ink)] transition-opacity duration-200 group-hover:opacity-60">
            {next.title}
          </span>
        </Link>
      ) : null}
      <div data-cs-end aria-hidden="true" className="h-px w-full" />
    </>
  )
}
