import { useCallback, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useSaveData } from '@/lib/useSaveData'
import { useInView } from '@/lib/useInView'

/* ---------------------------------------------------------------------------
   One card in the Works grid.

   Minimal by client request: the card IS the thumbnail — a 16:9 still/video
   filling the whole card, no white frame, no meta row, no Pixelta title. One
   thing sits on it, and one drops down below it:

     chip         bottom-left, always shown: the client's logo and the study's
                  name in burgundy on a frosted light pill, so the card can be
                  identified at a glance without a caption under it.
     description  under the card, HIDDEN by default: a bare uppercase caption
                  in soft burgundy, no panel behind it, that fades up into the
                  space below the card's bottom edge (WorksGrid leaves room
                  for it between rows). A pointer that can hover reveals it on
                  hover; a keyboard reveals it on focus. Touch never sees it —
                  a tap opens the case study, which says the same at length.

   Every card shows a still the moment it renders, whatever the input: the
   poster (one frame of the walkthrough, ~30-50 KB of WebP) is a plain <img>
   under the <video>. The maroon behind it is only the backing colour while the
   WebP decodes.

   The preview has two modes, which differ only in what the video does:

     inview   plays by itself while the thumbnail is mostly on screen and
              pauses when it leaves, on every device.
     still    reduced motion, or data saver on: never plays; the poster is the
              whole picture.

   It also pauses while a case study is open in the pop-up (CaseStudyModal):
   the cards are hidden behind it, and the pop-up's hero plays the same file.

   The <video> sits on top and is transparent until it has a decoded frame, so
   the poster stays visible while a video is still fetching and there is no
   flash back to maroon. Nothing but the poster downloads up front: `preload`
   stays "none" until a card is near the viewport, and only goes to "metadata"
   (enough to start promptly). Still mode never preloads.
--------------------------------------------------------------------------- */

// The radius carries `!` because global.css's focus-visible rule is unlayered
// and would otherwise flatten the card's corners to 4px while it has focus.
const CARD =
  'group relative block aspect-video overflow-hidden rounded-[var(--radius-card)]! ' +
  'bg-[var(--color-maroon)] no-underline shadow-sm transition-shadow duration-300 ease-[var(--ease-brand)]'

/* The frosted backing shared by the chip and the description band. */
const FROST = 'bg-[var(--card-chip-bg)] backdrop-blur-md'

function Thumbnail({ study, thumbRef, videoRef, mode, near, children }) {
  const comingSoon = study.status === 'coming-soon'
  return (
    <div ref={thumbRef} data-card-thumb="" className="absolute inset-0 isolate">
      {/* A card that brings its own picture (the Vinyl Player's scene). */}
      {children}

      {/* Shore-Up has no walkthrough — the static screenshot sits behind a
          maroon scrim so the card still reads as a flat block. */}
      {comingSoon && study.poster && (
        <img
          src={study.poster}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-20"
        />
      )}

      {/* The still every mode shows at rest. Eager on purpose: it is what the
          visitor sees on landing, and it is tiny. The grid is the first thing
          on /works, and the second screen of the landing page, where a lazy
          image would wait on an observer that fires late. */}
      {study.videoPoster && (
        <img
          src={study.videoPoster}
          alt=""
          width="1280"
          height="720"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Never autoplays by attribute: WorkCard starts and stops it, per mode.
          In still mode nothing ever calls play(). */}
      {study.video && (
        <video
          ref={videoRef}
          src={study.video}
          muted
          loop
          playsInline
          preload={mode === 'inview' && near ? 'metadata' : 'none'}
          tabIndex={-1}
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* No pill, no stroke: the words themselves, big, in Pixelta. The face
          has no ellipsis, quote or dash glyph, so plain letters only. */}
      {comingSoon && (
        <span className="absolute inset-0 grid place-items-center px-[0.5rem]">
          <span className="font-display whitespace-nowrap text-[length:var(--text-works-title)] leading-none text-[var(--color-surface)]">
            Coming Soon
          </span>
        </span>
      )}

      {/* Film grain over the whole picture, still or playing (see
          .card-grain). `isolate` on this box keeps its blend to the picture. */}
      <span aria-hidden="true" className="card-grain" />
    </div>
  )
}

/** Bottom-left: the client's logo and the study's name. The name is the card
 *  link's accessible name, so it is real text, not an image. A card with no
 *  logo (the Vinyl Player) shows the name alone, padded evenly, at the same
 *  height as the others. */
function Chip({ study }) {
  return (
    <span
      data-card-chip=""
      className={`absolute bottom-[0.875rem] left-[0.875rem] inline-flex max-w-[calc(100%-1.75rem)] items-center gap-[0.5rem] rounded-[var(--radius-pill)] py-[0.3rem] ${study.logo ? 'pl-[0.35rem]' : 'min-h-[2.1rem] pl-[0.85rem]'} pr-[0.85rem] ${FROST}`}
    >
      {study.logo && (
        <img
          src={study.logo}
          alt=""
          width="40"
          height="40"
          className="h-[1.5rem] w-[1.5rem] shrink-0 object-contain"
        />
      )}
      <span
        data-card-name=""
        className="truncate text-[length:var(--text-works-meta)] font-semibold leading-none text-[var(--color-maroon)]"
      >
        {study.metaTitle}
      </span>
    </span>
  )
}

/** Under the card: the one-line description, as a caption. The card link's
 *  next sibling, so it answers the link's hover and focus as a Tailwind
 *  peer. Hidden until hover (pointers that can hover) or keyboard focus, and
 *  never in the pointer's way; aria-hidden because it repeats, in short, what
 *  the case study opens with.
 *
 *  Type: one sentence on one line, uppercase, flush with the card's left
 *  edge. Semibold rather than the eyebrow's 800 because it is a sentence, not
 *  a label, and tracked tighter (0.04em) for the same reason. Its size
 *  (--card-blurb-size) shrinks with the card where the sentence would not
 *  otherwise fit; an ellipsis is the last resort, not the plan.
 *
 *  Motion: it rises 0.5rem as it fades in, a beat after the card is reached
 *  (75ms), and leaves at once. Reduced motion keeps the fade, drops the rise. */
function Description({ study }) {
  return (
    <span
      data-card-blurb=""
      aria-hidden="true"
      className={
        'pointer-events-none absolute inset-x-0 top-[calc(100%+0.75rem)] block overflow-hidden text-ellipsis whitespace-nowrap ' +
        'text-[length:var(--card-blurb-size)] font-semibold uppercase leading-[1.6] tracking-[0.04em] text-[var(--card-blurb-ink)] ' +
        'translate-y-[0.5rem] opacity-0 transition-[opacity,translate] duration-[450ms] ease-[var(--ease-brand)] ' +
        '[@media(hover:hover)]:peer-hover:translate-y-0 [@media(hover:hover)]:peer-hover:opacity-100 [@media(hover:hover)]:peer-hover:delay-75 ' +
        'peer-focus-visible:translate-y-0 peer-focus-visible:opacity-100 motion-reduce:translate-y-0'
      }
    >
      {study.blurb}
    </span>
  )
}

export function WorkCard({ study, thumbnail, onOpen }) {
  const videoRef = useRef(null)
  const reduced = useReducedMotion()
  // Data saver turns autoplay off.
  const saveData = useSaveData()
  const comingSoon = study.status === 'coming-soon'
  const mode = reduced || saveData ? 'still' : 'inview'
  // A case study open in the pop-up covers the grid (see CaseStudyModal).
  const covered = Boolean(useLocation().state?.caseStudy)

  // Two observers on the thumbnail: one latches as it comes within a screen
  // of the viewport (start fetching metadata), one tracks whether at least
  // half of it is visible (the only time a preview plays).
  const [nearRef, near] = useInView({ rootMargin: '100% 0px', threshold: 0, once: true })
  const [viewRef, inView] = useInView({ threshold: 0.5 })
  const thumbRef = useCallback(
    (el) => {
      nearRef.current = el
      viewRef.current = el
    },
    [nearRef, viewRef],
  )

  // Play while in view (and not covered by the pop-up), pause otherwise.
  useEffect(() => {
    const el = videoRef.current
    if (!el || mode !== 'inview') return
    // play() rejects if the browser declines (Low Power Mode, data saver); the
    // poster is then what stays on screen.
    if (inView && !covered) el.play().catch(() => {})
    else el.pause()
  }, [mode, inView, covered])

  // Switching to still (reduced motion or data saver turned on) must stop
  // whatever is already playing, and go back to the poster's frame (0.5s): a
  // video that has played shows its current frame, not the poster. One that
  // never loaded is left alone — it is already showing the poster.
  useEffect(() => {
    const el = videoRef.current
    if (!el || mode !== 'still') return
    el.pause()
    if (el.readyState > 0) el.currentTime = 0.5
  }, [mode])

  const thumb = (
    <Thumbnail study={study} thumbRef={thumbRef} videoRef={videoRef} mode={mode} near={near}>
      {thumbnail}
    </Thumbnail>
  )

  /* A card that opens a pop-up of its own on this page rather than a case
     study (the Vinyl Player): the same card and hover shadow, but the control
     is a <button> stretched over it, not a link. A button may not hold the
     card's block-level picture, so it sits on top and carries the name. */
  if (onOpen) {
    return (
      <article data-card="" className={`${CARD} hover:shadow-md has-[:focus-visible]:shadow-md`}>
        {thumb}
        <Chip study={study} />
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={study.metaTitle}
          onClick={onOpen}
          className="absolute inset-0 rounded-[var(--radius-card)]!"
        />
      </article>
    )
  }

  if (comingSoon) {
    return (
      <article data-card="" className={`${CARD} cursor-default`} aria-label={`${study.metaTitle} — coming soon`}>
        {thumb}
        <Chip study={study} />
      </article>
    )
  }

  // The description lives outside the link (the card clips what is inside
  // it), so the two share a wrapper. It hangs below the wrapper, in the room
  // WorksGrid leaves between rows. The wrapper is a size container so the
  // description can size itself to the card's width.
  return (
    <div className="@container relative">
      <Link
        to={`/works/${study.slug}`}
        data-card=""
        className={`${CARD} peer hover:shadow-md focus-visible:shadow-md`}
      >
        {thumb}
        <Chip study={study} />
      </Link>
      <Description study={study} />
    </div>
  )
}
