import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { holdScroll } from '@/lib/scrollLock'
import { setCursorHost } from './CustomCursor'
import { SizeGlyph } from './CaseStudyModal'
import { picturesOf } from '@/data/funzies'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { useReducedMotion } from '@/lib/useReducedMotion'

const CLOSE_MS = 180
// Maximize / minimize: the frame's move between its two boxes (a FLIP), as
// the case-study window does it.
const RESIZE_MS = 320
const RESIZE_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const WIDE = '(min-width: 48rem)'
// Scrolling or swiping up and down over the picture steps through the strip.
// A trackpad flick sends a burst of wheel events: this much of it turns one
// picture, and the burst has to go quiet for WHEEL_QUIET before the next.
const WHEEL_STEP = 40
const WHEEL_QUIET = 180
// A finger has to travel this far, mostly up or down, to count as a swipe.
const SWIPE_STEP = 40

/**
 * Calls onStep(1) for a scroll down or a swipe up over `ref`'s element, and
 * onStep(-1) for the reverse: one step per flick, however long its momentum
 * runs. A set's carousel is left alone, so it can still scroll sideways.
 */
function useVerticalStep(ref, onStep, key) {
  const latest = useRef(onStep)
  useEffect(() => {
    latest.current = onStep
  })
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const inSet = (e) => e.target instanceof Element && e.target.closest('.fz-pop__set')

    let acc = 0
    let locked = false
    let quiet = 0
    const onWheel = (e) => {
      // Pinch-zoom on a trackpad arrives as ctrl+wheel; sideways is the carousel's.
      if (e.ctrlKey || inSet(e) || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      e.preventDefault()
      clearTimeout(quiet)
      quiet = setTimeout(() => {
        acc = 0
        locked = false
      }, WHEEL_QUIET)
      if (locked) return
      acc += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      if (Math.abs(acc) >= WHEEL_STEP) {
        latest.current(Math.sign(acc))
        locked = true
      }
    }

    let start = null
    const onTouchStart = (e) => {
      start = e.touches.length === 1 && !inSet(e) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null
    }
    const onTouchEnd = (e) => {
      if (!start) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      start = null
      if (Math.abs(dy) >= SWIPE_STEP && Math.abs(dy) > Math.abs(dx)) latest.current(dy < 0 ? 1 : -1)
    }
    const onTouchCancel = () => {
      start = null
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchCancel)
    return () => {
      clearTimeout(quiet)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [ref, key])
}

/**
 * The window a project on the Design board opens: a native <dialog> (focus
 * trap, Escape and focus return come free), dressed like the case-study
 * window — a burgundy title bar with only its macOS dots (red closes, green
 * maximizes to the screen and back), on the page's own ground.
 *
 * Left, a narrow strip of square thumbnails, every picture the project has,
 * ruled off from the rest by a thin line (a row along the top on a phone).
 * Right, the picked picture large and whole (a set with a small carousel of
 * its pictures under it), and beside it the write-up:
 * Pixelta header, tools, the picture's copy, and for the PC build its game
 * covers and floating parts. The arrow keys step through the thumbnails, and
 * so does scrolling or swiping up and down over the picture.
 *
 * A modal dialog sits in the browser's top layer, above the custom cursor, so
 * while it is open the cursor is portalled into it (setCursorHost). Lenis is
 * paused, and the dialog carries `data-lenis-prevent`, so the wheel scrolls
 * the window rather than the page behind.
 */
export function FunziePopup({ item, onClose }) {
  const ref = useRef(null)
  const frameRef = useRef(null)
  const stageRef = useRef(null)
  const reduced = useReducedMotion()
  const wide = useMediaQuery(WIDE, true)
  const [closing, setClosing] = useState(false)
  const [size, setSize] = useState('window')
  const [index, setIndex] = useState(0)
  // Within a set (a strip thumbnail with a carousel under its picture), which
  // of its pictures is showing.
  const [sub, setSub] = useState(0)
  const pick = useCallback((i) => {
    setIndex(i)
    setSub(0)
  }, [])
  const pics = item ? picturesOf(item) : []
  useVerticalStep(
    stageRef,
    (d) => {
      const next = Math.min(pics.length - 1, Math.max(0, index + d))
      if (next !== index) pick(next)
    },
    item,
  )

  useEffect(() => {
    const dialog = ref.current
    if (!item || !dialog) return undefined
    setClosing(false)
    setSize('window')
    setIndex(0)
    setSub(0)
    if (!dialog.open) dialog.showModal()
    setCursorHost(dialog)
    const release = holdScroll()
    return () => {
      setCursorHost(null)
      release()
    }
  }, [item])

  const close = useCallback(() => {
    setClosing(true)
    setTimeout(
      () => {
        ref.current?.close()
        onClose()
      },
      reduced ? 0 : CLOSE_MS,
    )
  }, [onClose, reduced])

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
      { duration: RESIZE_MS, easing: RESIZE_EASE },
    )
  }, [reduced])

  if (!item) return null

  const entry = pics[Math.min(index, pics.length - 1)]
  const set = entry.set ?? [entry]
  const cur = set[Math.min(sub, set.length - 1)]
  const shown = wide ? size : 'full'

  return (
    <dialog
      ref={ref}
      className="fz-pop"
      data-size={shown}
      data-closing={closing || undefined}
      data-lenis-prevent
      aria-labelledby="fz-pop-label"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      // A click that lands on the dialog element itself is on the backdrop.
      onClick={(e) => e.target === e.currentTarget && shown === 'window' && close()}
    >
      <div ref={frameRef} className="fz-pop__window">
        <div className="fz-pop__bar">
          <div className="fz-pop__controls">
            <button type="button" className="fz-pop__dot fz-pop__dot--close" onClick={close} aria-label="Close" title="Close">
              <span aria-hidden="true">×</span>
            </button>
            {wide && (
              <button
                type="button"
                data-fz-toggle=""
                className="fz-pop__dot fz-pop__dot--size"
                onClick={toggle}
                aria-label={size === 'full' ? 'Minimize' : 'Maximize'}
                title={size === 'full' ? 'Minimize' : 'Maximize'}
              >
                <SizeGlyph full={size === 'full'} />
              </button>
            )}
          </div>
          {/* Dots only in the bar, as on the case-study window: the name is
              the dialog's label, for screen readers. */}
          <span className="sr-only" id="fz-pop-label">
            {item.title}
          </span>
        </div>

        <div className="fz-pop__body">
          <Thumbs pics={pics} index={index} onPick={pick} title={item.title} />
          <div className="fz-pop__main">
            <figure
              ref={stageRef}
              className="fz-pop__stage"
              data-icon={cur.icon || undefined}
              data-set={set.length > 1 || undefined}
            >
              {cur.type === 'video' ? (
                <video key={cur.src} src={cur.src} autoPlay={!reduced} controls={reduced} muted loop playsInline />
              ) : (
                <img
                  key={cur.src}
                  src={cur.src}
                  alt={
                    set.length > 1
                      ? `${item.title}, ${index + 1} of ${pics.length}, view ${sub + 1} of ${set.length}`
                      : `${item.title}, ${index + 1} of ${pics.length}`
                  }
                  decoding="async"
                  draggable={false}
                />
              )}
              {set.length > 1 && <SetThumbs set={set} sub={sub} onPick={setSub} title={item.title} />}
            </figure>
            <div className="fz-pop__text">
              <h2 className="fz-pop__title">{item.title}</h2>
              <div className="fz-pop__tools">
                <span className="fz-pop__tools-label">Tools:</span>
                {/* Icons only; the name is the alt text and the hover tooltip. */}
                <ul className="fz-pop__tool-list">
                  {item.tools.map((t) => (
                    <li key={t.name} className="fz-pop__tool" title={t.name}>
                      <img src={t.icon} alt={t.name} width="36" height="36" draggable={false} />
                    </li>
                  ))}
                </ul>
              </div>
              <Copy text={cur.text} />
              {item.games && <Games games={item.games} />}
              {item.parts && <Parts parts={item.parts} label={item.partsLabel} />}
            </div>
          </div>
        </div>
      </div>
    </dialog>
  )
}

/**
 * The thumbnail strip: one square button per picture, the picked one in full
 * colour with a burgundy ring, the rest knocked back. Each folder of a
 * foldered project starts a little further down than the one before. The
 * arrow keys move the pick (and focus) along the strip; however the pick
 * moves, the strip scrolls to keep it in view.
 */
function Thumbs({ pics, index, onPick, title }) {
  const refs = useRef([])
  useEffect(() => {
    refs.current[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [index])
  const step = (d) => {
    const next = Math.min(pics.length - 1, Math.max(0, index + d))
    onPick(next)
    refs.current[next]?.focus()
  }
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      step(1)
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      step(-1)
    }
  }
  return (
    <nav className="fz-pop__thumbs" aria-label="Pictures">
      <ul className="fz-pop__thumb-list" onKeyDown={onKeyDown}>
        {pics.map((p, i) => (
          <li key={p.src} data-new-group={i > 0 && p.group !== pics[i - 1].group ? '' : undefined}>
            <button
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              className="fz-pop__thumb"
              data-icon={p.icon || undefined}
              aria-current={i === index || undefined}
              aria-label={`${title}, picture ${i + 1} of ${pics.length}${p.type === 'video' ? ' (video)' : ''}`}
              onClick={() => onPick(i)}
            >
              {p.type === 'video' ? (
                <>
                  <video src={`${p.src}#t=0.1`} muted playsInline preload="metadata" tabIndex={-1} aria-hidden="true" />
                  <span className="fz-pop__thumb-play" aria-hidden="true" />
                </>
              ) : (
                <img src={p.src} alt="" loading="lazy" decoding="async" draggable={false} />
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * A set's carousel, under its picture: a small square per picture in the set
 * (the main one first), the one showing ringed in burgundy like the strip's.
 * The arrow keys step through it.
 */
function SetThumbs({ set, sub, onPick, title }) {
  const refs = useRef([])
  const onKeyDown = (e) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const next = Math.min(set.length - 1, Math.max(0, sub + d))
    onPick(next)
    refs.current[next]?.focus()
    // A long set (the TMU K-POP icons) can run wider than the picture.
    refs.current[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
  return (
    <ul className="fz-pop__set" aria-label="More views" onKeyDown={onKeyDown}>
      {set.map((p, i) => (
        <li key={p.src}>
          <button
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            className="fz-pop__set-thumb"
            data-icon={p.icon || undefined}
            aria-current={i === sub || undefined}
            aria-label={`${title}, view ${i + 1} of ${set.length}`}
            onClick={() => onPick(i)}
          >
            <img src={p.src} alt="" loading="lazy" decoding="async" draggable={false} />
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * Body copy from plain text: blank lines separate paragraphs, and a paragraph
 * made entirely of "- " lines is a bulleted list.
 */
function Copy({ text }) {
  return (
    <div className="fz-pop__copy">
      {text.split(/\n{2,}/).map((block, i) => {
        const lines = block.split('\n')
        return lines.every((l) => l.startsWith('- ')) ? (
          <ul key={i}>
            {lines.map((l) => (
              <li key={l}>{l.slice(2)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{block}</p>
        )
      })}
    </div>
  )
}

/** A row of game covers, in place of a text list. Names surface on hover. */
function Games({ games }) {
  return (
    <ul className="fz-games" aria-label="Games played">
      {games.map((g) => (
        <li key={g.name} className="fz-game" title={g.name}>
          <img src={g.src} alt={g.name} draggable={false} />
        </li>
      ))}
    </ul>
  )
}

/**
 * Cut-out parts floating under the write-up. Each one bobs gently on its own
 * offset, and on hover tilts towards the pointer in 3D and drifts right, with
 * its name surfacing underneath.
 */
function Parts({ parts, label }) {
  const onMove = (e) => {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--rx', `${(-y * 22).toFixed(1)}deg`)
    el.style.setProperty('--ry', `${(x * 28).toFixed(1)}deg`)
  }
  const onLeave = (e) => {
    e.currentTarget.style.removeProperty('--rx')
    e.currentTarget.style.removeProperty('--ry')
  }

  return (
    <>
      {label && <p className="fz-parts__label">{label}</p>}
      <ul className="fz-parts" aria-label="Parts">
        {parts.map((p, i) => (
          <li key={p.name} className="fz-part" style={{ '--i': i }} onPointerMove={onMove} onPointerLeave={onLeave}>
            <span className="fz-part__float">
              <img src={p.src} alt="" draggable={false} />
            </span>
            <span className="fz-part__name">{p.name}</span>
          </li>
        ))}
      </ul>
    </>
  )
}
