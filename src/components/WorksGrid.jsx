import { useCallback } from 'react'
import { WorkCard } from './WorkCard'
import { useOpenCaseStudy } from './CaseStudyModal'
import { CASE_STUDIES } from '@/data/caseStudies'
import { loadCaseStudy } from '@/lib/caseStudyChunk'

/* ---------------------------------------------------------------------------
   The 2x2 card grid on its own — no Layout, no nav, no page chrome.

   It is rendered twice: as the second screen of the landing page (under the
   hero, on every width), and as the whole of the `/works` route. Both have to
   be the same pixels, which is why the grid geometry lives here and not in
   either page.

   Grid geometry: two columns with a tight 1.5rem gap both ways (client
   request — bigger cards, less space between them; the comp's works-page.png
   had 619px cards 75px apart). The block is centred, up to 100rem wide, and on
   wide screens as big as the viewport's height allows (GRID_FIT).

   Opening a study in the pop-up (CaseStudyModal) is wired up here, at the
   grid, rather than inside WorkCard: a plain click is intercepted on its way
   down to the card, so the card itself stays an ordinary <Link> to /works/:slug that
   middle-clicks, cmd-clicks and degrades without JavaScript to the study's own
   page, exactly as before.
--------------------------------------------------------------------------- */

/* The bottom padding is what keeps the last row of cards out from under the
   nav pill at the end of the scroll. The pill is fixed bottom-centre on every
   width, and NavDock publishes `--dock-clear` (pill's distance from the
   viewport bottom + a 16px gap). The footer always comes after this section
   and already fills part of that distance — in flow below it on /works and on
   the landing page below 64rem, its height reserved below this section on the
   wide landing works screen (see Layout) — so only the remainder is padded
   here. On phones the footer pads
   itself past the pill (see Footer), the remainder goes negative, and the
   2rem floor is all that is left: one clearance, not two stacked. */
const SECTION =
  'flex flex-1 items-center justify-center px-[var(--page-gutter)] pt-[clamp(1rem,2.5vh,2rem)] ' +
  'pb-[max(2rem,calc(var(--dock-clear,7rem)-var(--footer-h,0px)))]'

/* On wide screens the 2x2 grid must fit in one viewport between the top bar
   and the nav pill. A card is a 16:9 thumbnail and nothing else, so its height
   follows its width, and the grid's width is capped by the viewport's height:
   two rows of ((W − 24px) / 2) × 9/16 plus the 24px row gap have to fit in
   100dvh less ~252px of chrome (top bar, section padding, nav-pill clearance),
   which solves to W ≈ 177.8dvh − 29.2rem. The 252px is generous, though —
   measured, the grid can take another ~25px of height and still clear the
   top bar and the pill by 20px+ — so the cap is W = 177.8dvh − 27.9rem: the
   grid is about one viewport less 240px tall. On laptop screens that height
   cap is what sizes the cards (≈758px wide at 1728x1117, 565px at 1440x900);
   very tall or wide screens stop at the 100rem ceiling or the page gutters. */
const GRID_FIT = 'lg:max-w-[min(100rem,calc(177.8dvh-27.9rem))]'

export function WorksGrid({ className = '', ...rest }) {
  const openCaseStudy = useOpenCaseStudy()

  const onClick = useCallback(
    (event) => {
      // Anything other than a plain primary click belongs to the browser.
      if (event.defaultPrevented) return
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }

      const link = event.target.closest?.('a[data-card][href]')
      if (!link) return
      // The href carries the router's basename in production; the slug is the
      // last segment either way.
      const slug = (link.getAttribute('href') || '').match(/\/works\/([^/?#]+)$/)?.[1]
      if (!slug) return

      event.preventDefault()
      openCaseStudy(slug)
    },
    [openCaseStudy],
  )

  // A pointer heading for a card, or focus landing on one, starts the study's
  // chunk downloading if the idle prefetch (App) has not got to it yet.
  const warm = useCallback(() => {
    loadCaseStudy().catch(() => {})
  }, [])

  return (
    <section className={`${SECTION} ${className}`} {...rest}>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions --
          this only ever upgrades a real link that is already keyboard
          reachable; it adds no new interactive surface. */}
      {/* Capture phase: the card's <Link> handles the click on the way up,
          navigating to the study's page; this has to get there first. */}
      <ul
        onClickCapture={onClick}
        onPointerOver={warm}
        onFocus={warm}
        className={`grid w-full max-w-[100rem] ${GRID_FIT} grid-cols-1 gap-[1.5rem] lg:grid-cols-2`}
      >
        {CASE_STUDIES.map((study) => (
          <li key={study.slug} className="min-w-0">
            <WorkCard study={study} />
          </li>
        ))}
      </ul>
    </section>
  )
}
