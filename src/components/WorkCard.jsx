import { useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useSaveData } from '@/lib/useSaveData'
import { useInView } from '@/lib/useInView'

/* ---------------------------------------------------------------------------
   One card in the Works grid.

   Every number below is measured off Assets/site-design/images/works-page.png
   (6912×4468 = 4× a 1728pt frame), card-relative:

     card            619 × 453,  radius --radius-card
     padding          9 left/right/top, 22 bottom
     thumbnail      601 × 299  (601/299 ≈ 2:1), radius --radius-card
     meta row        40 tall, 8 below the thumbnail
       logo slot     40 square, 20 from the card's left edge
       client name   10 after the logo slot
       tag pill     104 × 28, 1.5px stroke (smaller than the comp's 112 × 34
                    by client request), 38 from the card's right edge
     title           69px Pixelta, 6 below the meta row, 31 from the left edge

   Every card shows a still the moment it renders, whatever the input: the
   poster (one frame of the walkthrough, ~30-50 KB of WebP) is a plain <img>
   under the <video>. It used to be skipped for mouse users, who were meant to
   see flat maroon until they hovered — but a `preload="none"` video draws
   nothing, so on arrival the grid read as four empty blocks and the client had
   to hover each one to find out what it was. The maroon is now only the
   backing colour while the WebP decodes.

   The preview has two modes, which differ only in what the video does:

     inview   plays by itself while the thumbnail is mostly on screen and
              pauses when it leaves, on every device (it used to wait for a
              hover on desktop; the client wanted it playing on arrival).
     still    reduced motion, or data saver on: never plays; the poster is the
              whole picture.

   The <video> sits on top and is transparent until it has a decoded frame, so
   the poster stays visible while a video is still fetching and there is no
   flash back to maroon. Nothing but the poster downloads up front: `preload`
   stays "none" until a card is near the viewport, and only goes to "metadata"
   (enough to start promptly). Still mode never preloads.
--------------------------------------------------------------------------- */

// The radius carries `!` because global.css's focus-visible rule is unlayered
// and would otherwise flatten the card's corners to 4px while it has focus.
// `@container` lets the title size itself off the card's own width (TITLE).
const CARD =
  '@container group flex h-full flex-col rounded-[var(--radius-card)]! bg-[var(--color-surface)] ' +
  'p-[0.5625rem] pb-[1.375rem] no-underline shadow-sm transition-[box-shadow,transform] ' +
  'duration-300 ease-[var(--ease-brand)]'

/* The title follows the viewport width (--text-works-title), but on a wide,
   short screen the grid is capped by height (WorksGrid GRID_FIT) and the cards
   are narrower than the viewport implies — "TMU-KPOP revamp" then wrapped to
   two lines at 1920x1080 and pushed the grid past the screen. Capping it at
   12.9% of the card's content width keeps the longest title on one line on
   desktop (it needs ~13.3%) and is exactly the full 69px at the 1728x1117
   reference, so there, on phones and at 1440 the viewport-based size still
   wins unchanged. It is not a no-wrap guarantee: the title also has a left
   inset, so on the narrowest phones (~320px) the longest titles still take two
   lines, as they did before at the 2.25rem floor. */
const TITLE = 'text-[length:min(var(--text-works-title),12.9cqi)]'

function Thumbnail({ study, thumbRef, videoRef, mode, near }) {
  const comingSoon = study.status === 'coming-soon'
  return (
    <div
      ref={thumbRef}
      className="relative aspect-[601/299] w-full overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-maroon)]"
    >
      {/* Shore-Up has no walkthrough — the static screenshot sits behind a
          maroon scrim so the card still reads as the comp's flat rectangle. */}
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
          on /works, and the third screen of the landing sequence on desktop,
          where a lazy image would wait on an observer that fires late. */}
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
          has no ellipsis, quote or dash glyph, so plain letters only. Sized off
          the card title so it scales with the rest of the card. */}
      {comingSoon && (
        <span className="absolute inset-0 grid place-items-center px-[0.5rem]">
          <span className="font-display whitespace-nowrap text-[length:var(--text-works-title)] leading-none text-[var(--color-surface)]">
            Coming Soon
          </span>
        </span>
      )}
    </div>
  )
}

function CardBody({ study }) {
  return (
    <>
      {/* Client + tag. Padding is asymmetric because it is in the comp; on
          phones the right side matches the left instead, because those 18px
          are what the client name needs to fit. */}
      <div className="mt-[0.5rem] flex h-10 items-center justify-between gap-3 pl-[0.6875rem] pr-[0.6875rem] sm:pr-[1.8125rem]">
        <span className="flex min-w-0 items-center gap-[0.625rem]">
          <img
            src={study.logo}
            alt=""
            width="40"
            height="40"
            className="h-10 w-10 shrink-0 object-contain"
          />
          {/* Two lines rather than an ellipsis: on a narrow phone
              "WITM: Designathon" is wider than the room left by the logo and
              the pill, and two short lines still sit inside the 40px row. */}
          <span className="line-clamp-2 text-[length:var(--text-works-meta)] font-semibold leading-tight text-[var(--color-ink-muted)]">
            {study.client}
          </span>
        </span>

        {/* Every tag is the same pill — one fixed width, height and type size —
            whatever the word inside, so the four cards read as a set. A touch
            narrower on phones (still clear of the longest word, "WEB DESIGN"),
            which also goes to the client name. */}
        <span className="inline-flex h-[1.75rem] w-[5.75rem] sm:w-[6.5rem] shrink-0 items-center justify-center whitespace-nowrap rounded-[var(--radius-pill)] border-[1.5px] border-[var(--color-ink)] text-[0.6875rem] font-semibold tracking-[0.04em] text-[var(--color-ink)]">
          {study.tag}
        </span>
      </div>

      {/* Pixelta. "Heyso..." is three literal periods — the face has no
          ellipsis, quote or dash glyph, and anything missing falls back
          silently to another font. */}
      <h2 className={`font-display mt-[0.375rem] pl-[1.375rem] ${TITLE} leading-none text-[var(--color-ink)]`}>
        {study.title}
      </h2>
    </>
  )
}

export function WorkCard({ study }) {
  const videoRef = useRef(null)
  const reduced = useReducedMotion()
  // Data saver turns autoplay off.
  const saveData = useSaveData()
  const comingSoon = study.status === 'coming-soon'
  const mode = reduced || saveData ? 'still' : 'inview'

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

  // Play while in view, pause when not.
  useEffect(() => {
    const el = videoRef.current
    if (!el || mode !== 'inview') return
    // play() rejects if the browser declines (Low Power Mode, data saver); the
    // poster is then what stays on screen.
    if (inView) el.play().catch(() => {})
    else el.pause()
  }, [mode, inView])

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
    <Thumbnail study={study} thumbRef={thumbRef} videoRef={videoRef} mode={mode} near={near} />
  )
  const body = <CardBody study={study} />

  if (comingSoon) {
    return (
      <article className={CARD} aria-label={`${study.title} — coming soon`}>
        {thumb}
        {body}
      </article>
    )
  }

  return (
    <Link
      to={`/works/${study.slug}`}
      className={`${CARD} hover:shadow-md focus-visible:shadow-md`}
    >
      {thumb}
      {body}
    </Link>
  )
}
