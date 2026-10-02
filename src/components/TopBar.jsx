import { Link } from 'react-router-dom'
import { GifMark } from './GifMark'
import monogramGif from '@assets/brand/animation/monogram.gif'
import monogramStill from '@assets/brand/animation/monogram-still.png'
import { EMAIL, LINKEDIN, RESUME } from '@/data/links'

const LINKS = [
  { label: 'LINKEDIN', href: LINKEDIN, external: true },
  { label: 'EMAIL', href: EMAIL },
  { label: 'RESUME', href: RESUME, external: true },
]

/**
 * Top bar — present on every page, identical across all of them in the comps.
 * Link order follows the screenshots (LinkedIn, Email, Resume), not the brief.
 */
export function TopBar() {
  return (
    <header className="layer-chrome flex items-start justify-between px-[var(--page-gutter)] pt-[clamp(1rem,2vw,1.75rem)]">
      {/* hit-44 grows the tap targets here to 44px without moving the bar. */}
      <Link to="/" className="hit-44 flex items-center gap-3 no-underline" aria-label="reydesigns — home">
        <GifMark
          gif={monogramGif}
          still={monogramStill}
          // Runs for as long as the page is open, by client request. The GIF
          // already carries a loop count of 0, so `loop` simply stops GifMark
          // freezing it on the composited still after one pass.
          loop
          durationMs={1650}
          canvas={[2568, 2738]}
          box={[0.277, 0.449, 0.529, 0.465]}
          width="clamp(2.25rem, 2.9vw, 3.1rem)"
          alt="Shreya Rudrapatna monogram"
        />
        <span className="text-[length:var(--text-eyebrow)] font-bold leading-[1.25] tracking-[0.02em] text-[var(--color-ink)]">
          SHREYA
          <br />
          RUDRAPATNA
        </span>
      </Link>

      {/* Hidden on phones — these three fold into the "links" button beside
          "me" in the bottom nav, which opens them as a small sheet. The gap is
          the client's "a little closer" (~30% under the old 1.25rem / 3vw /
          3.5rem); it stays wider than the slack hit-44 adds around the
          shortest label, so the tap targets never overlap. */}
      <nav className="hidden items-center gap-[clamp(0.875rem,2.1vw,2.45rem)] sm:flex">
        {LINKS.map((l) => (
          <a
            key={l.label}
            href={l.href}
            {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="hit-44 text-[length:var(--text-eyebrow)] font-medium tracking-[0.06em] text-[var(--color-ink)] no-underline transition-opacity duration-200 hover:opacity-60"
          >
            {l.label}
          </a>
        ))}
      </nav>
    </header>
  )
}
