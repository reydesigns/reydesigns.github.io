import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { holdScroll } from '@/lib/scrollLock'
import { setCursorHost } from './CustomCursor'
import { getCaseStudy } from '@/data/caseStudies'
import { CaseStudyHostContext } from '@/lib/caseStudyHost'
import { loadCaseStudy } from '@/lib/caseStudyChunk'
import { useMediaQuery, WIDE } from '@/lib/useMediaQuery'
import { useReducedMotion } from '@/lib/useReducedMotion'
import '@/styles/case-study-modal.css'

const CaseStudyBody = lazy(() => loadCaseStudy().then((m) => ({ default: m.CaseStudyBody })))

const CLOSE_MS = 180
const RESIZE_MS = 320
// --ease-brand, for the maximize / minimize tween (WAAPI can't read the token).
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

/* True while the open pop-up sits on a history entry this tab pushed (a card
   click), so closing it can step back off that entry. A pop-up reached any
   other way — forward button — replaces its state instead. */
let pushed = false

/**
 * Opens a case study in the pop-up over the current page. The address never
 * changes: the open study lives in history state on a new entry for the same
 * URL, so the phone's back gesture (or the browser's back button) closes it.
 */
export function useOpenCaseStudy() {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  return useCallback(
    (slug) => {
      pushed = true
      navigate(pathname + search, { state: { caseStudy: slug } })
    },
    [navigate, pathname, search],
  )
}

/** ‹ as a shape, like CaseStudyNav's. */
function Chevron() {
  return (
    <svg viewBox="0 0 8 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 1 1.5 7l5 6" />
    </svg>
  )
}

/** The green dot's glyph: corners pointing out (maximize) or in (minimize). */
/** The green dot's glyph: arrows out to maximize, in to minimize. Shared
    with the Vinyl Player's window. */
export function SizeGlyph({ full }) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" fill="currentColor">
      {full ? <path d="M5.4 0.8v3.8h3.8zM4.6 9.2V5.4H0.8z" /> : <path d="M1.2 1.2h4.2L1.2 5.4zM8.8 8.8H4.6l4.2-4.2z" />}
    </svg>
  )
}

/**
 * A case study, opened in place over the works grid (on `/` or `/works`).
 *
 * A native <dialog> (focus trap, Escape and focus return come free), dressed
 * like the Funzies windows: a burgundy title bar with macOS dots top-left —
 * red closes, green maximizes the window to fill the screen and, once it
 * does, minimizes it back. Below 64rem it is always full screen, and the dots
 * give way to a back chevron (a 44px target).
 *
 * The study renders through CaseStudyBody, the same component its own route
 * uses, inside a scroller that is handed down as the scroll root
 * (caseStudyHost.js): the section nav, progress bar and scroll-linked motion
 * then measure against the pop-up, not the window. HOME closes the pop-up and
 * "next case study" swaps the study in place.
 *
 * The study's desktop section nav is a `position: fixed` panel. The frame
 * carries a transform, which makes it the containing block for fixed
 * descendants, so the panel pins to the pop-up's left edge, not the screen's.
 *
 * Driven entirely by `location.state.caseStudy` (see useOpenCaseStudy), so it
 * is mounted once, at App level, and works over any page.
 */
export function CaseStudyModal() {
  const location = useLocation()
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const wide = useMediaQuery(WIDE, true)
  const dialogRef = useRef(null)
  const frameRef = useRef(null)
  const scrollRef = useRef(null)
  const [scroller, setScroller] = useState(null)
  const [size, setSize] = useState('window')
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)

  // A reload restores history state, pop-up flag included. The pop-up is not
  // part of the address, so a reload lands on the page without it.
  const restoredKey = useRef(location.state?.caseStudy ? location.key : null)
  useEffect(() => {
    if (restoredKey.current) {
      navigate(location.pathname + location.search, { replace: true, state: null })
    }
    // Once, on the first mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const slug = location.state?.caseStudy
  const study = slug ? getCaseStudy(slug) : undefined
  const open = Boolean(study && study.status !== 'coming-soon' && location.key !== restoredKey.current)
  const openRef = useRef(open)
  openRef.current = open
  const here = location.pathname + location.search
  const shown = wide ? size : 'full'

  /* Leave the history entry the pop-up lives on: step back off it if this tab
     pushed it, otherwise clear its state where it stands. */
  const finish = useCallback(() => {
    if (pushed) {
      pushed = false
      navigate(-1)
    } else {
      navigate(here, { replace: true, state: null })
    }
  }, [navigate, here])

  const close = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    if (reduced) {
      finish()
      return
    }
    setClosing(true)
    setTimeout(finish, CLOSE_MS)
  }, [finish, reduced])

  const select = useCallback(
    (next) => navigate(here, { replace: true, state: { caseStudy: next } }),
    [navigate, here],
  )

  /* Maximize / minimize. The size is a class swap; the move between the two
     boxes is a FLIP on the frame — one transform tween, so the article does
     not reflow on every frame of it. */
  const toggle = useCallback(() => {
    const frame = frameRef.current
    const before = frame?.getBoundingClientRect()
    flushSync(() => setSize((s) => (s === 'full' ? 'window' : 'full')))
    if (!frame || !before || reduced) return
    const after = frame.getBoundingClientRect()
    if (!after.width || !after.height) return
    frame.animate(
      [
        {
          transformOrigin: '0 0',
          transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / after.width}, ${before.height / after.height})`,
        },
        { transformOrigin: '0 0', transform: 'translate(0px, 0px) scale(1, 1)' },
      ],
      { duration: RESIZE_MS, easing: EASE },
    )
  }, [reduced])

  /* Open: show the dialog, hand it the cursor, lock the page behind it. Close
     (or a back gesture) undoes each, leaving Lenis as it was found. */
  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return undefined
    closingRef.current = false
    setClosing(false)
    setSize('window')
    // The dialog's own focus return doesn't survive: the study unmounts (and
    // focus drops to <body>) before the dialog closes. So keep the card — the
    // link, not whatever inside it a mouse click focused (its <video>).
    const active = document.activeElement
    const opener = active?.closest?.('a[href], button') ?? active
    if (!dialog.open) dialog.showModal()
    // Keys scroll the study straight away (space, arrows, page down).
    scrollRef.current?.focus({ preventScroll: true })
    setCursorHost(dialog)

    const release = holdScroll()

    return () => {
      setCursorHost(null)
      release()
      if (dialog.open) dialog.close()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
      pushed = false
    }
  }, [open])

  // Every study starts at its top, including one swapped in by "next".
  useEffect(() => {
    if (scroller) scroller.scrollTop = 0
  }, [slug, scroller])

  const setScroll = useCallback((el) => {
    scrollRef.current = el
    setScroller(el)
  }, [])

  const host = useMemo(() => ({ root: scroller, onClose: close, onSelect: select }), [scroller, close, select])

  return (
    <dialog
      ref={dialogRef}
      className="cs-modal"
      data-size={shown}
      data-closing={closing || undefined}
      data-lenis-prevent=""
      aria-labelledby="cs-modal-title"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      // A dialog the browser closes on its own (a repeated Escape can force
      // one) still has to leave the history entry it lives on.
      onClose={() => {
        if (openRef.current && !closingRef.current) {
          closingRef.current = true
          finish()
        }
      }}
      // A click that lands on the dialog element itself is on the backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget && shown === 'window') close()
      }}
    >
      {open && (
        <div ref={frameRef} className="cs-modal__frame">
          <div className="cs-modal__bar">
            <div className="cs-modal__controls">
              {wide ? (
                <>
                  <button type="button" className="cs-modal__dot cs-modal__dot--close" onClick={close} aria-label="Close" title="Close">
                    <span aria-hidden="true">×</span>
                  </button>
                  <button
                    type="button"
                    data-cs-toggle=""
                    className="cs-modal__dot cs-modal__dot--size"
                    onClick={toggle}
                    aria-label={shown === 'full' ? 'Minimize' : 'Maximize'}
                    title={shown === 'full' ? 'Minimize' : 'Maximize'}
                  >
                    <SizeGlyph full={shown === 'full'} />
                  </button>
                </>
              ) : (
                <button type="button" data-cs-back="" className="cs-modal__back" onClick={close} aria-label="Back to works">
                  <Chevron />
                </button>
              )}
            </div>
            {/* The bar shows only the dots (client request): the study's
                name stays for screen readers, as the dialog's label. */}
            <span className="sr-only" id="cs-modal-title">
              {study.metaTitle}
            </span>
          </div>

          <div ref={setScroll} className="cs-modal__scroll" tabIndex={-1}>
            {scroller && (
              <CaseStudyHostContext.Provider value={host}>
                <Suspense fallback={null}>
                  <CaseStudyBody slug={slug} />
                </Suspense>
              </CaseStudyHostContext.Provider>
            )}
          </div>
        </div>
      )}
    </dialog>
  )
}
