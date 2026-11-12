import { useCallback, useMemo, useRef, useState } from 'react'
import { WorkCard } from './WorkCard'
import { ExpandingProjectCards } from './ExpandingProjectCards'
import { useOpenCaseStudy } from './CaseStudyModal'
import { VinylPlayerModal, prepareVinylAudio } from './VinylPlayerModal'
import { FlowerModal } from './FlowerGenerator'
import { ComicModal } from './ComicHoarder'
import { WORKS_GRID, CURRENT_VIBES } from '@/data/caseStudies'
import { loadCaseStudy } from '@/lib/caseStudyChunk'

/* ---------------------------------------------------------------------------
   The two-column card grid on its own: no Layout, no nav, no page chrome.
   (WORKS_GRID: the four case studies in two rows.) Under it, "current
   vibes": the three toys, Binary Bloom, the Vinyl Player and the Comic
   Hoarder, in a row of square cards that widen on hover
   (ExpandingProjectCards), each opening its own pop-up.

   It is rendered twice: as the second screen of the landing page (under the
   hero, on every width), and as the whole of the `/works` route. Both have to
   be the same pixels, which is why the grid geometry lives here and not in
   either page.

   Grid geometry (client request — big cards, little space between them; the
   comp's works-page.png had 619px cards 75px apart): two columns, a 1.5rem
   gap both ways, and on wide screens only a 1.5rem margin either side, so the
   cards run nearly edge to edge (≈828px wide at 1728px). They are sized by
   the viewport's width, not its height: the grid can run past one screen, and
   the reader scrolls a little for the second row (client: "it's okay if the
   user has to scroll a bit"). Ultra-wide screens stop at 120rem.

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
  'flex flex-1 items-center justify-center px-[var(--page-gutter)] lg:px-[1.5rem] ' +
  'pt-[clamp(1rem,2.5vh,2rem)] pb-[max(2rem,calc(var(--dock-clear,7rem)-var(--footer-h,0px)))]'

export function WorksGrid({ className = '', ...rest }) {
  const openCaseStudy = useOpenCaseStudy()

  /* The Vinyl Player card opens its pop-up here, on whichever page the grid
     is on. Its click is the user gesture iOS needs before it will load audio,
     so the previews start loading inside it, before the pop-up renders. */
  const [vinylOpen, setVinylOpen] = useState(false)
  const vinylCard = useRef(null)
  const openVinyl = useCallback((event) => {
    prepareVinylAudio()
    vinylCard.current = event.currentTarget
    setVinylOpen(true)
  }, [])
  const closeVinyl = useCallback(() => setVinylOpen(false), [])

  // Binary Bloom opens its pop-up the same way (no audio to wake).
  const [flowersOpen, setFlowersOpen] = useState(false)
  const flowersCard = useRef(null)
  const openFlowers = useCallback((event) => {
    flowersCard.current = event.currentTarget
    setFlowersOpen(true)
  }, [])
  const closeFlowers = useCallback(() => setFlowersOpen(false), [])

  // And the Comic Hoarder.
  const [comicsOpen, setComicsOpen] = useState(false)
  const comicsCard = useRef(null)
  const openComics = useCallback((event) => {
    comicsCard.current = event.currentTarget
    setComicsOpen(true)
  }, [])
  const closeComics = useCallback(() => setComicsOpen(false), [])

  const vibes = useMemo(() => {
    const opens = { 'binary-bloom': openFlowers, 'vinyl-player': openVinyl, 'comic-hoarder': openComics }
    return CURRENT_VIBES.map((item) => ({ ...item, onOpen: opens[item.slug] }))
  }, [openFlowers, openVinyl, openComics])

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
      {/* The grid and the row under it share one column. */}
      <div className="w-full max-w-[120rem]">
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions --
            this only ever upgrades a real link that is already keyboard
            reachable; it adds no new interactive surface. */}
        {/* Capture phase: the card's <Link> handles the click on the way up,
            navigating to the study's page; this has to get there first. */}
        <ul
          onClickCapture={onClick}
          onPointerOver={warm}
          onFocus={warm}
          className={`grid w-full grid-cols-1 gap-[1.5rem] [@media(hover:hover)]:gap-y-[var(--card-blurb-room)] lg:grid-cols-2`}
        >
          {WORKS_GRID.map((study) => (
            <li key={study.slug} className="min-w-0">
              <WorkCard study={study} />
            </li>
          ))}
        </ul>

        {/* Far enough down that a last-row card's caption (shown on hover,
            hanging below the card) never meets the heading. The heading is in
            the pixel face (Pixelta), as the page titles are. */}
        <section aria-labelledby="current-vibes" className="mt-[max(calc(var(--card-blurb-room)+1.5rem),clamp(3.5rem,6vw,6.5rem))]">
          <h3
            id="current-vibes"
            className="font-display mb-[clamp(1rem,1.5vw,1.5rem)] text-[length:clamp(1.25rem,1.7vw,1.875rem)] font-normal leading-none text-[var(--color-ink)]"
          >
            current vibes
          </h3>
          <ExpandingProjectCards items={vibes} />
        </section>
      </div>
      <VinylPlayerModal open={vinylOpen} onClose={closeVinyl} returnFocus={vinylCard} />
      <FlowerModal open={flowersOpen} onClose={closeFlowers} returnFocus={flowersCard} />
      <ComicModal open={comicsOpen} onClose={closeComics} returnFocus={comicsCard} />
    </section>
  )
}
