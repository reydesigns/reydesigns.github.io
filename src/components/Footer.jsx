import { useReducedMotion } from '@/lib/useReducedMotion'
import pikaGif from '@assets/brand/animation/pika-sleeping.gif'
import pikaStill from '@assets/brand/animation/pika-sleeping-still.png'
import { EMAIL, LINKEDIN } from '@/data/links'

/* hit-44: the links are 16px-tall text, so the tap target is grown to 44px
   around them without making the footer band any taller. */
const FOOT_LINK =
  'hit-44 text-[length:var(--text-eyebrow)] tracking-[0.02em] text-[var(--color-ink-muted)] no-underline ' +
  'transition-opacity duration-200 hover:opacity-60'

/**
 * Site footer. Rendered by Layout, so it is on every page by construction
 * rather than by remembering to add it.
 *
 * The sleeping cat is 3 frames over 1.5s with a loop count of 0, so it runs for
 * as long as the page is open on its own; reduced motion gets the first frame
 * as a flat PNG (pika-sleeping-still.png) and no animation at all.
 *
 * Deliberately short: on the landing page this sits at the bottom of the works
 * screen (see Layout), where the only space going spare is the gap under the
 * cards. LinkedIn and email sit on the right, on every page.
 *
 * On phones the nav pill is fixed over the bottom of the screen, and at the end
 * of the page this row would land just under it. Pages with the pill publish
 * `--dock-clear` (NavDock), and below `sm` the footer pads itself by that much
 * so the row comes to rest above the pill with room to tap.
 */
export function Footer({ className = '' }) {
  const reduced = useReducedMotion()

  return (
    <footer
      className={
        'flex items-center justify-between gap-4 px-[var(--page-gutter)] ' +
        'pb-[clamp(0.375rem,0.8vh,0.625rem)] pt-[clamp(0.1875rem,0.5vh,0.375rem)] ' +
        `max-sm:pb-[max(clamp(0.375rem,0.8vh,0.625rem),var(--dock-clear,0px))] ${className}`
      }
    >
      <span className="flex min-w-0 items-center gap-[clamp(0.375rem,0.8vw,0.75rem)]">
        <img
          src={reduced ? pikaStill : pikaGif}
          alt=""
          aria-hidden="true"
          className="h-[clamp(1.5rem,1.9vw,2rem)] w-auto shrink-0 object-contain"
        />
        <span className="truncate text-[length:var(--text-eyebrow)] tracking-[0.02em] text-[var(--color-ink-muted)]">
          2026 Shreya Rudrapatna
        </span>
      </span>

      <nav aria-label="Contact" className="flex shrink-0 items-center gap-[clamp(1rem,2vw,1.75rem)]">
        <a href={LINKEDIN} target="_blank" rel="noopener noreferrer" className={FOOT_LINK}>
          LinkedIn
        </a>
        <a href={EMAIL} className={FOOT_LINK}>
          Email
        </a>
      </nav>
    </footer>
  )
}
