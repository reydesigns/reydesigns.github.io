import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { WorkCard } from './WorkCard'
import { CASE_STUDIES } from '@/data/caseStudies'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { morphCardToCaseStudy } from '@/lib/cardMorph'

/* ---------------------------------------------------------------------------
   The 2x2 card grid on its own — no Layout, no nav, no page chrome.

   It is rendered twice: as the third screen of the landing page's scroll
   sequence, and as the whole of the `/works` route. Both have to be the same
   pixels, which is why the grid geometry lives here and not in either page.

   Grid geometry from Assets/site-design/images/works-page.png at 1728px:
   two 619px columns, 75px apart, 26px between rows — i.e. a 1313px block,
   centred.

   The card -> case-study morph is wired up here, at the grid, rather than
   inside WorkCard: the click is intercepted on the way up so the card itself
   stays an ordinary <Link> that middle-clicks, cmd-clicks and degrades without
   JavaScript exactly as before.
--------------------------------------------------------------------------- */

/* The bottom padding is what keeps the last row of cards out from under the
   nav pill at the end of the scroll. The pill is fixed bottom-centre on every
   width, and NavDock publishes `--dock-clear` (pill's distance from the
   viewport bottom + a 16px gap). The footer always comes after this section
   and already fills part of that distance — on /works it is in flow below, on
   the landing works screen its height is reserved below this section (see
   Layout) — so only the remainder is padded here. On phones the footer pads
   itself past the pill (see Footer), the remainder goes negative, and the
   2rem floor is all that is left: one clearance, not two stacked. */
const SECTION =
  'flex flex-1 items-center justify-center px-[var(--page-gutter)] pt-[clamp(1rem,2.5vh,2rem)] ' +
  'pb-[max(2rem,calc(var(--dock-clear,7rem)-var(--footer-h,0px)))]'

/* On wide screens the 2x2 grid must fit in one viewport between the top bar
   and the nav pill. A card's height follows its width (the thumbnail is
   601:299), so the grid's width is capped by the viewport's height:
   roughly 2px of width per 1px of height, less the fixed chrome and card text.
   At the 1728x1117 reference this works out at ~1180px. It never goes below
   70rem, where the card titles would start to wrap; on a viewport shorter than
   that the works screen simply scrolls a little. */
const GRID_FIT = 'lg:max-w-[min(82.0625rem,max(70rem,calc(201dvh-66.6rem)))]'

export function WorksGrid({ className = '', ...rest }) {
  const navigate = useNavigate()
  const reduced = useReducedMotion()

  const onClick = useCallback(
    (event) => {
      if (reduced) return
      // Anything other than a plain primary click belongs to the browser.
      if (event.defaultPrevented) return
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }

      const link = event.target.closest?.('a[href]')
      if (!link) return
      const href = link.getAttribute('href') || ''
      if (!/^\/works\/[^/]+$/.test(href)) return

      // The thumbnail is the card's first child — the 601:299 maroon block.
      const thumb = link.querySelector('[data-card-thumb]') ?? link.firstElementChild
      if (!thumb) return

      event.preventDefault()
      morphCardToCaseStudy({ thumb, to: href, navigate })
    },
    [navigate, reduced],
  )

  return (
    <section className={`${SECTION} ${className}`} {...rest}>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions --
          this only ever upgrades a real link that is already keyboard
          reachable; it adds no new interactive surface. */}
      <ul
        onClick={onClick}
        className={`grid w-full max-w-[82.0625rem] ${GRID_FIT} grid-cols-1 gap-x-[4.6875rem] gap-y-[1.625rem] lg:grid-cols-2`}
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
