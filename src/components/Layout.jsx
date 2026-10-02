import { useLayoutEffect, useRef } from 'react'
import { SparkleGrid } from './SparkleGrid'
import { TopBar } from './TopBar'
import { Footer } from './Footer'
import { CustomCursor } from './CustomCursor'

/** Publish an element's live height as a custom property on <html>. */
function usePublishedHeight(ref, name) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined

    const write = () => {
      document.documentElement.style.setProperty(name, `${el.offsetHeight}px`)
    }
    write()

    const ro = new ResizeObserver(write)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, name])
}

/**
 * "Skip to content": the first thing Tab reaches on every page, invisible until
 * it is focused. It lands on the page's own content marker when there is one
 * (`data-skip-target` — the article on a case study, past its section nav) and
 * on <main> otherwise. Focus is moved by hand rather than by following the
 * hash, so the URL doesn't pick up a #main that the router knows nothing about.
 */
function SkipLink() {
  const onClick = (event) => {
    const target = document.querySelector('[data-skip-target]') ?? document.getElementById('main')
    if (!target) return
    event.preventDefault()
    target.focus()
  }

  return (
    <a
      href="#main"
      onClick={onClick}
      className={
        'sr-only focus:not-sr-only focus:fixed focus:left-[var(--page-gutter)] focus:top-3 focus:z-50 ' +
        'focus:inline-flex focus:min-h-11 focus:items-center ' +
        'focus:bg-[var(--color-surface)] focus:px-5 focus:text-[length:var(--text-body)] ' +
        'focus:font-medium focus:text-[var(--color-ink)] focus:no-underline focus:shadow-md'
      }
    >
      Skip to content
    </a>
  )
}

/**
 * Global shell: sparkle layer behind, top bar above, footer below, page content
 * between. Every route renders through here, which is what makes the bar and
 * the footer genuinely site-wide rather than something to remember to add.
 *
 * Both bands publish their live height — `--topbar-h` and `--footer-h`. The
 * landing page's first screen has to be exactly one viewport tall *including*
 * the bar, and both bands are fluid (clamped padding around clamped artwork),
 * so the numbers cannot be written down anywhere. They are measured, and
 * re-measured on resize.
 *
 * `stickyHeader` is set by pages that scroll as one long document — in practice
 * the landing page, which scrolls two screens past the hero with the bar still
 * on screen. Three things follow from the bar floating over content:
 *
 *   * it is painted on --color-bg rather than left transparent, so cards pass
 *     behind it instead of showing through it;
 *   * the works screen is inset by the bar's height at the top and the footer's
 *     at the bottom, so its cards are centred in the space those two leave
 *     rather than running underneath either. Padding inside a
 *     `min-height: 100dvh` screen does not make the screen any taller, so the
 *     landing page stays exactly three viewports;
 *   * the footer comes out of flow and pins to the bottom of the document. On
 *     `/` that is the bottom of the works screen, which is where it belongs —
 *     and being absolute it cannot add a fourth screen to the sequence or shift
 *     the works screen off its 2x viewport offset.
 *
 * Every other page is an ordinary document and gets the footer in flow at the
 * end of it.
 */
export function Layout({ children, className = '', stickyHeader = false }) {
  const headerRef = useRef(null)
  const footerRef = useRef(null)

  usePublishedHeight(headerRef, '--topbar-h')
  usePublishedHeight(footerRef, '--footer-h')

  return (
    <div className={`relative min-h-dvh ${className}`}>
      <SkipLink />
      <SparkleGrid />
      <CustomCursor />
      <div className="layer-content flex min-h-dvh flex-col">
        <div
          ref={headerRef}
          className={stickyHeader ? 'sticky top-0 z-30 bg-[var(--color-bg)]' : undefined}
        >
          <TopBar />
        </div>
        <main
          id="main"
          tabIndex={-1}
          className={
            'flex flex-1 flex-col ' +
            (stickyHeader
              ? '[&>[data-stage=works]]:pt-[var(--topbar-h)] ' +
                '[&>[data-stage=works]]:pb-[var(--footer-h,3rem)]'
              : '')
          }
        >
          {children}
        </main>
        <div ref={footerRef} className={stickyHeader ? 'absolute inset-x-0 bottom-0 z-20' : undefined}>
          <Footer />
        </div>
      </div>
    </div>
  )
}
