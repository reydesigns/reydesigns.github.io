import { useCallback, useRef } from 'react'
import { Layout } from '@/components/Layout'
import { WordCycle } from '@/components/WordCycle'
import { BottomNav } from '@/components/BottomNav'
import { NavDock } from '@/components/NavDock'
import { WorksGrid } from '@/components/WorksGrid'
import { Drawing3DLazy } from '@/components/Drawing3DLazy'
import { SpeechBubble, useSpeech } from '@/components/SpeechBubble'
import { STRAWBERRY_CAT, SELF_PORTRAIT } from '@/data/drawings'
import { useMediaQuery, WIDE, SM, FINE } from '@/lib/useMediaQuery'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useScrollSequence } from '@/lib/useScrollSequence'

/**
 * Landing — the first ten seconds.
 *
 * `/` is one continuous document, two screens tall: the hero, then the works
 * grid, on every width. On a desktop (wide, fine pointer, motion allowed) a
 * small scroll down from the hero glides the rest of the way to the grid; on a
 * phone, a touch tablet or with reduced motion the page simply scrolls.
 * useScrollSequence owns that; this file only lays the screens out and says
 * where the nav pill belongs. The loader no longer lives in the scroll — it
 * was a whole screen the reader had to sit through on every visit.
 *
 * "works" in the nav never leaves `/`: it glides (or, on a phone, smooth-
 * scrolls) down to the grid, and the URL stays put.
 *
 * The tagline and status pill come from Assets/site-design/images/1st-page.png;
 * the headline copy was revised by the client after the comp, and the tagline
 * moved from under the headline to above it, replacing "rey designs".
 *
 * The headline is Inter except for three words. Its last word types and
 * backspaces through who the solution should feel obvious to, in Pixelta:
 * the client moved the pixel face onto the changing word alone so the one
 * thing that moves is the one thing that looks different. "why" and "how"
 * are set in Parisienne, a cursive script (.hero-script), with no quotation
 * marks, and no full stop after "how". The typed full stop at the end stays
 * in Inter.
 *
 * The copy is all lowercase, written that way rather than transformed, so the
 * accessible name reads the same as the screen (client, round 3).
 *
 * The four lines are hard breaks so each lands on a phrase boundary; on a
 * phone they still wrap. The leading is tighter than solid (client: less space
 * between the lines); 0.96 is as tight as it goes before the descenders of
 * one line touch the ascenders of the next.
 */
const AUDIENCES = ['user', 'stakeholder', 'engineer', 'product manager']

/* What the drawings say when hovered (client copy). The self-portrait
   alternates between its two lines, one per hover. */
const SELF_LINES = ['Hey, my name is Shreya', 'Welcome to my portfolio']
const CAT_LINES = ['meow']

/* The tagline above the headline: muted ink, and lowercase as written — the
   whole hero is lowercase (client, round 3), so it is no longer set in caps. */
const HERO_LABEL =
  'text-[length:var(--text-body)] font-medium leading-none ' +
  'text-[var(--color-ink-muted)] opacity-[var(--hero-label-opacity)]'

export function Landing() {
  useDocumentMeta()
  const wide = useMediaQuery(WIDE, true)
  // On phones the drawings crowd the wrapped tagline, so they are not mounted
  // at all: that also keeps the three.js chunk and textures from downloading.
  const showDrawings = useMediaQuery(SM, true)
  const reduced = useReducedMotion()
  const self = useSpeech(SELF_LINES)
  const cat = useSpeech(CAT_LINES)
  const fine = useMediaQuery(FINE, true)
  const worksRef = useRef(null)

  // The glide is for a mouse or trackpad on a big screen. A thumb flicking a
  // phone expects the page to go exactly as far as it was flicked.
  const glide = wide && fine && !reduced

  const { stage, toWorks } = useScrollSequence({ glide, worksRef })

  // "works" in the nav scrolls down to the grid rather than routing to /works:
  // the grid is right here, on every width.
  const onNavigate = useCallback(
    (to, event) => {
      if (to !== '/works') return
      event.preventDefault()
      toWorks()
    },
    [toWorks],
  )

  // The top bar floats over the grid only where the grid is one screen: on a
  // phone the cards run several screens long and the bar would just eat a
  // slice of every one, so there it scrolls away like any other page (see
  // Layout).
  return (
    <Layout stickyHeader={wide}>
      {/* ---- screen 1: the hero ------------------------------------------ */}
      <div className="screen-first flex shrink-0 flex-col">
        <section className="relative flex flex-1 flex-col justify-center overflow-x-clip px-[var(--page-gutter)] pb-[clamp(1rem,5vh,4rem)]">
          {/* One measured column: `w-fit` makes this box exactly as wide as the
              headline's longest line, so the tagline sits on the same origin
              as the "i". The cycling last word reserves the width of its
              longest option, so the box never changes size as it types. It
              collapses to the available width before it can ever overflow.

              The column is centred on the page, still set flush left, and the
              two drawings hang off its sides — the cat low on the left, the
              self-portrait high on the right — so the hero reads as one group
              in the middle of the screen rather than spanning edge to edge
              (client, round 4). */}
          <div className="relative mx-auto w-fit max-w-full">
            {showDrawings && (
              <>
                {/* Each box is the size of the visible artwork; the canvas is
                    half as big again and hangs over every edge, because the
                    camera fits the drawing at ~65% of its frame. Each tucks a
                    few vw in over the headline's edge (client, round 6: a
                    little overlap is fine), the portrait beside its top, the
                    cat below its last line.

                    Hovering a drawing (tapping, on a touch tablet) makes it
                    talk. The bubbles are placed in each drawing's own box, in
                    the same percentages as the artwork inside it, so they
                    track it at every width. */}
                <div className="hero-drawing hero-drawing--cat pointer-events-none absolute right-[calc(100%_-_6vw)] bottom-[-95%] z-[2]">
                  <Drawing3DLazy
                    {...STRAWBERRY_CAT}
                    onHoverChange={cat.onHoverChange}
                    onTap={cat.onTap}
                    className="pointer-events-auto absolute inset-[-25%]"
                  >
                    <SpeechBubble
                      open={cat.open}
                      text={cat.text}
                      side="right"
                      className="left-[78%] top-[44%] -translate-y-1/2"
                    />
                  </Drawing3DLazy>
                </div>
                <div className="hero-drawing hero-drawing--self pointer-events-none absolute left-[calc(100%_-_9vw)] top-[-12%] z-[2]">
                  <Drawing3DLazy
                    {...SELF_PORTRAIT}
                    onHoverChange={self.onHoverChange}
                    onTap={self.onTap}
                    className="pointer-events-auto absolute inset-[-25%]"
                  >
                    {/* From lg the top bar is sticky and opaque, and the
                        portrait rides high enough that a bubble above her hair
                        would sit under it, so there it comes down to overlap
                        the top of her hair instead. */}
                    <SpeechBubble
                      open={self.open}
                      text={self.text}
                      side="top"
                      className="bottom-[88%] left-1/2 -translate-x-1/2 lg:bottom-[70%]"
                    />
                  </Drawing3DLazy>
                </div>
              </>
            )}

            <p className={`mb-[clamp(0.75rem,1.4vw,1.5rem)] ${HERO_LABEL}`}>
              your friendly neighbourhood experience designer
            </p>

            <h1
              aria-label={`i ask the why before i design the how that way, your solution feels obvious to every ${AUDIENCES.join(', ')}.`}
              className="text-[length:var(--text-landing-headline)] font-light leading-[0.96] tracking-[-0.01em] text-[var(--color-ink)]"
            >
              <span aria-hidden="true">
                i ask the <span className="hero-script">why</span>
                <br />
                before i design the <span className="hero-script">how</span>
                <br />
                that way, your solution feels
                <br />
                obvious to every{' '}
              </span>
              <WordCycle words={AUDIENCES} after="." wordClassName="font-display text-[1.1em]" />
            </h1>
          </div>

          {/* Plain, bold, muted line: the copy carries the status, no pill or dot. */}
          <p className="mx-auto mt-[clamp(3rem,10vh,8rem)] text-center font-bold text-[length:var(--text-body)] text-[var(--color-ink-muted)] opacity-[var(--hero-status-opacity)]">
            masters of information @ UofT
          </p>
        </section>

        {/* The real pill is fixed (NavDock) so it stays put while the page
            scrolls on to the grid. This reserves the box it used to
            occupy, so the hero still centres exactly where it did. */}
        <div className="flex justify-center pb-[clamp(1.5rem,3.5vh,3rem)]">
          <BottomNav className="invisible" decorative />
        </div>
      </div>

      {/* ---- screen 2: the works grid ------------------------------------ */}
      <section ref={worksRef} className="screen flex shrink-0 flex-col" data-stage="works">
        <h2 className="sr-only">Works</h2>
        <WorksGrid />
      </section>

      {/* The pill stays bottom-centre on both screens, works included. */}
      <NavDock
        placement="bottom"
        activePath={stage === 'works' ? '/works' : undefined}
        onNavigate={onNavigate}
      />
    </Layout>
  )
}
