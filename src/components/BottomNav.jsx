import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import navWorks from '@assets/brand/icons/nav-works.png'
import navFunzies from '@assets/brand/icons/nav-funzies.png'
import navMeFrame from '@assets/brand/icons/nav-me-frame-square.png'
import navMeMask from '@assets/brand/icons/nav-me-frame-mask.png'
import avatar from '@assets/me/portrait-avatar.jpg'
import { EMAIL, LINKEDIN, RESUME } from '@/data/links'
import { useMediaQuery, SM } from '@/lib/useMediaQuery'

/* What the phones-only "links" button opens: the top bar's three links, which
   that bar hides below `sm`. Same order as the top bar. */
const CONTACT_LINKS = [
  { label: 'LinkedIn', href: LINKEDIN, external: true },
  { label: 'Email', href: EMAIL },
  { label: 'Resume', href: RESUME, external: true },
]

const ITEMS = [
  { to: '/works', label: 'works', icon: navWorks },
  { to: '/funzies', label: 'funzies', icon: navFunzies },
  { to: '/me', label: 'me', avatar: true },
]

/* The item is a fixed-size box with no background of its own — the hover and
   active highlight is the circle behind the glyph (see Halo). Keeping the box
   the same size in both orientations is what lets NavDock interpolate the
   row-to-column reflow without anything changing shape mid-flight. */
const ITEM =
  'group/item relative flex w-[4.25rem] flex-col items-center gap-1 px-2 py-1.5 no-underline'

/* The highlight. A circle, not the item's rectangle: it is centred on the glyph
   and sized to it, so it reads as a halo around the icon. It is the first child
   and everything after it is positioned, so painting order puts it behind the
   glyph without needing a z-index. */
const HALO =
  // top = py-1.5 (0.375rem) + half of the h-7 glyph (0.875rem).
  'pointer-events-none absolute left-1/2 top-[1.25rem] h-9 w-9 -translate-x-1/2 ' +
  '-translate-y-1/2 rounded-full transition-colors duration-200'

function Halo({ active }) {
  return (
    <span
      aria-hidden="true"
      className={`${HALO} ${
        active
          ? 'bg-[var(--color-ink)]/10'
          : 'bg-transparent group-hover/item:bg-[var(--color-ink)]/6'
      }`}
    />
  )
}

function Glyph({ item }) {
  if (item.avatar) {
    return (
      <span className="relative grid aspect-square h-7 w-7 place-items-center">
        {/* Both layers are square boxes holding square source images, and the
            frame is `object-contain` on top of that, so the ring is a circle at
            any size and in either orientation. nav-me-frame-square.png is the
            shipped frame cropped to its artwork (782x782); the original
            1047x902 canvas had uneven transparent padding, which is what
            squashed the ring into an oval when it was stretched to fill a
            square box.

            The photo runs under the whole frame, so it shows through the
            spirals' see-through holes too rather than the pill behind:
            nav-me-frame-mask.png is the frame's outer silhouette (everything
            not flood-filled from the canvas edge), pulled in 2px so no photo
            peeks past the ring's outer edge. Same 782x782 canvas, so it lines
            up at any size. */}
        <img
          src={avatar}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[50%_38%]"
          style={{
            maskImage: `url(${navMeMask})`,
            WebkitMaskImage: `url(${navMeMask})`,
            maskSize: '100% 100%',
            WebkitMaskSize: '100% 100%',
          }}
        />
        <img src={navMeFrame} alt="" className="relative h-full w-full object-contain" />
      </span>
    )
  }
  return <img src={item.icon} alt="" className="relative h-7 w-7 object-contain" />
}

function Label({ children }) {
  return (
    <span className="relative text-[0.6875rem] leading-none text-[var(--color-ink)]">
      {children}
    </span>
  )
}

/** The chain-link glyph for the phones-only "links" button. */
function LinkGlyph() {
  return (
    <span
      className="relative grid h-7 w-7 place-items-center text-[var(--color-ink)]"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" strokeLinecap="round" />
        <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" strokeLinecap="round" />
      </svg>
    </span>
  )
}

/* One row of the links sheet. min-h-11 is the 44px touch target; the rounding
   is the sheet's radius less its padding, so the hover fill nests inside it. */
const SHEET_ROW =
  'flex min-h-11 items-center justify-between gap-6 rounded-[calc(var(--radius-nav)-0.5rem)] px-3 ' +
  'text-[length:var(--text-body)] text-[var(--color-ink)] no-underline transition-colors duration-200 ' +
  'hover:bg-[var(--color-ink)]/6'

/**
 * The phones-only "links" button, and the small glass sheet it opens above the
 * pill — LinkedIn, Email, Resume. A disclosure (button + aria-expanded), not an
 * ARIA menu: the rows are ordinary links and Tab moves through them as such.
 *
 * Opening moves focus to the first row; Escape closes and hands focus back to
 * the button; a tap anywhere else, or tabbing out of the sheet, just closes it.
 *
 * Returned as two elements because they go in two places: the button inside
 * the pill, the sheet as the pill's sibling. Not inside it: the pill's
 * backdrop-filter makes it a backdrop root, so a second frosted layer nested in
 * it would blur nothing and read as a flat, see-through card. NavDock's fixed
 * host is the containing block that positions it.
 */
function useLinksMenu(itemClass) {
  const buttonRef = useRef(null)
  const sheetRef = useRef(null)
  const sheetId = useId()
  const { pathname } = useLocation()
  // The button only exists below `sm`; past it the top bar has the links.
  const wide = useMediaQuery(SM)

  // Open is remembered as "open on this path", so a route change closes the
  // sheet without an effect, and so does rotating past `sm`, which takes the
  // button away from under it.
  const [openOn, setOpenOn] = useState(null)
  const open = openOn === pathname && !wide

  const close = useCallback((restoreFocus = false) => {
    setOpenOn(null)
    if (restoreFocus) buttonRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return undefined
    sheetRef.current?.querySelector('a')?.focus()

    const onKey = (event) => {
      if (event.key === 'Escape') close(true)
    }
    const onPointer = (event) => {
      if (sheetRef.current?.contains(event.target)) return
      if (buttonRef.current?.contains(event.target)) return
      close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer, true)
    }
  }, [open, close])

  // Tabbing past the last row (or back past the button) leaves the sheet.
  const onBlur = (event) => {
    const next = event.relatedTarget
    if (!next) return
    if (sheetRef.current?.contains(next) || buttonRef.current?.contains(next)) return
    close()
  }

  const button = (
    <button
      ref={buttonRef}
      type="button"
      aria-expanded={open}
      // The sheet only exists while open; a dangling id is an invalid reference.
      aria-controls={open ? sheetId : undefined}
      onClick={() => (open ? close() : setOpenOn(pathname))}
      onBlur={onBlur}
      data-flip-id="nav-links"
      data-nav-item=""
      className={`${itemClass} cursor-pointer sm:hidden`}
    >
      <Halo active={open} />
      <LinkGlyph />
      <Label>links</Label>
    </button>
  )

  const sheet = open && (
    <div
      ref={sheetRef}
      id={sheetId}
      onBlur={onBlur}
      className="nav-glass nav-pop absolute bottom-full right-0 z-10 mb-2 flex min-w-[11rem] flex-col rounded-[var(--radius-nav)] p-2 sm:hidden"
    >
      {CONTACT_LINKS.map((l) => (
        <a
          key={l.label}
          href={l.href}
          {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          onClick={() => close()}
          className={SHEET_ROW}
        >
          {l.label}
          {l.external && (
            <span aria-hidden="true" className="text-[var(--color-ink-muted)]">
              ↗
            </span>
          )}
          {l.external && <span className="sr-only"> (opens in a new tab)</span>}
        </a>
      ))}
    </div>
  )

  return { button, sheet }
}

/**
 * The nav pill. One element that lives at the bottom on the landing page and
 * moves to the left edge on Works — NavDock animates between the two, so it
 * must stay a single component.
 *
 * Two invariants NavDock's transition depends on, so please keep them:
 *
 *   * `data-nav-item` marks every direct child of the pill, in DOM order.
 *   * an item's rendered SIZE is identical in both orientations (fixed width,
 *     identical content). The tween interpolates each item's offset inside the
 *     pill at the same rate as the pill's own box, which only keeps the items
 *     inside the pill if their size never changes.
 *
 * `data-flip-id` on the pill is what QA matches on to prove the bottom pill and
 * the left pill are the same DOM node.
 *
 * These are plain `Link`s rather than `NavLink`s because the active item is not
 * always the routed one: on the landing page reaching the works screen is a
 * scroll, not a navigation, so the URL stays `/` while "works" is visibly
 * current. `activePath` says so, and `aria-current="page"` follows it, so the
 * highlight and the accessible state can never disagree.
 *
 * `onNavigate(to, event)` fires before the link does. Calling preventDefault on
 * the event is how the landing page turns "works" into a scroll instead.
 *
 * `decorative` renders the exact same box with none of the meaning: spans
 * rather than links, no landmark, no flip ids. The landing page uses it to
 * reserve the space the real (fixed) pill used to occupy in flow, and a second
 * set of live /works links in the document would be a bug, not a spacer.
 *
 * On phones the top bar's three links fold into the extra "links" button here,
 * since they overflow a 390px viewport. It opens a small sheet of the three
 * (useLinksMenu); the sheet is rendered after the <nav>, so this returns both.
 */
export function BottomNav({
  orientation = 'horizontal',
  className = '',
  activePath,
  onNavigate,
  decorative = false,
}) {
  const vertical = orientation === 'vertical'

  const shell = [
    'layer-chrome inline-flex items-center gap-1 rounded-[var(--radius-nav)] p-2',
    // iOS-style frosted glass: a translucent fill that blurs and saturates
    // whatever passes behind it, a hairline light edge, and a soft lift.
    'nav-glass',
    vertical ? 'flex-col' : 'flex-row',
    className,
  ].join(' ')

  if (decorative) {
    return (
      <div className={shell} aria-hidden="true">
        {ITEMS.map((item) => (
          <span key={item.to} className={ITEM}>
            <Glyph item={item} />
            <Label>{item.label}</Label>
          </span>
        ))}
        <span className={`${ITEM} sm:hidden`}>
          <LinkGlyph />
          <Label>links</Label>
        </span>
      </div>
    )
  }

  return <LivePill shell={shell} activePath={activePath} onNavigate={onNavigate} />
}

/* The real pill, split out of BottomNav so the links menu's hooks only ever run
   for it and never for the decorative spacer copy. */
function LivePill({ shell, activePath, onNavigate }) {
  const { pathname } = useLocation()
  const links = useLinksMenu(ITEM)

  const isCurrent = (to) =>
    activePath ? activePath === to : pathname === to || pathname.startsWith(`${to}/`)

  return (
    <>
      <nav data-flip-id="nav-pill" className={shell} aria-label="Sections">
        {ITEMS.map((item) => {
          const active = isCurrent(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              data-flip-id={`nav-${item.label}`}
              data-nav-item=""
              aria-current={active ? 'page' : undefined}
              onClick={(event) => onNavigate?.(item.to, event)}
              className={ITEM}
            >
              <Halo active={active} />
              <Glyph item={item} />
              <Label>{item.label}</Label>
            </Link>
          )
        })}

        {/* Phones only: the top bar's links, collapsed into one button. */}
        {links.button}
      </nav>
      {links.sheet}
    </>
  )
}
