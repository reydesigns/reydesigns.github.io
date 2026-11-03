import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { createFlowerView } from '@/lib/flowers/render'
import { SPECIES, speciesByKey } from '@/lib/flowers/species'
import { setCursorHost } from '@/components/CustomCursor'
import { useMediaQuery, HOVER } from '@/lib/useMediaQuery'
import { useInView } from '@/lib/useInView'
import { useReducedMotion } from '@/lib/useReducedMotion'

/* ---------------------------------------------------------------------------
   ASCII Flowers: the Works card that opens a little flower generator.

   A plant drawn from above in one hairline (a 3D model, painted as line art
   by lib/flowers/render.js), with ASCII codes drifting up off its petals like
   pollen. Its flowers bloom one at a time: each opens while the pointer is on
   it, stays a moment after it leaves, then closes back into a bud. On the
   left, a plain list of the four plants and a 3 x 3 palette, all in the
   site's burgundies and greys, that colours both the drawing and the pollen.

   Touch opens and closes a flower with a tap on it. The keyboard has the
   whole drawing as one button: Enter or Space opens every flower, one after
   another, and again closes them. Reduced motion keeps the drawing and its
   pollen but holds them still: a bloom happens at once, and nothing drifts
   or sways.

   The pop-up follows VinylPlayerModal's: a native <dialog> (Escape, focus
   trap and the top layer come free), the page behind held still, the custom
   cursor moved inside, a short animated close, and focus handed back to the
   card. It borrows the Vinyl Player's dialog and close-button styles, so
   the two toys open and close alike.
--------------------------------------------------------------------------- */

const CLOSE_MS = 180
const DEFAULT_SPECIES = 'spider-lily'
const DEFAULT_SWATCH = 2 // maroon

/** The palette, in reading order: three rows of three (tokens.css, --fl-swatch-n). */
const SWATCHES = [
  'Ink',
  'Maroon',
  'Wine',
  'Muted ink',
  'Rose',
  'Blush',
  'Warm grey',
  'Grey',
  'Light grey',
].map((name, k) => ({ n: k + 1, name, token: `--fl-swatch-${k + 1}` }))

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}
const swatchHex = (n) => cssVar(`--fl-swatch-${n}`, '#440000')

/**
 * A FlowerView on a canvas for as long as the component is mounted, kept in
 * step with the props. `running` starts and stops its animation loop; `rest`
 * is how open the flowers sit when nothing asks them to bloom; `onOpen(n)`
 * hears how many flowers are open. The drawing hides what is behind each
 * petal by painting it in the background of the box the canvas sits in.
 */
function useFlowerView(canvasRef, { species, swatch, rest = 0, reduced, running, framing, sway, onOpen }) {
  const viewRef = useRef(null)
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const view = createFlowerView(canvas, {
      species,
      color: swatchHex(swatch),
      paper: getComputedStyle(canvas.parentElement).backgroundColor,
      rest,
      reduced,
      framing,
      sway,
      onOpen: (n) => onOpenRef.current?.(n),
    })
    viewRef.current = view
    view.resize()
    const ro = new ResizeObserver(() => view.resize())
    ro.observe(canvas)
    return () => {
      ro.disconnect()
      view.destroy()
      viewRef.current = null
    }
    // Made once; the effects below keep it in step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => viewRef.current?.setSpecies(species), [species])
  useEffect(() => viewRef.current?.setColor(swatchHex(swatch)), [swatch])
  useEffect(() => viewRef.current?.setRest(rest), [rest])
  useEffect(() => viewRef.current?.setReduced(reduced), [reduced])
  useEffect(() => {
    const view = viewRef.current
    if (!view) return undefined
    if (running) view.start()
    else view.stop()
    return () => view.stop()
  }, [running])

  return viewRef
}

/* --- the card ------------------------------------------------------------ */

const CARD_REST = 0.45 // the spider lily's florets half open, until the card is hovered

/**
 * The Works card's thumbnail: a spider lily, its florets half open, shedding
 * pollen while at least half the card is on screen (the rule the other
 * cards' videos play by; otherwise it holds still on its last frame).
 * Hovering or focusing the card opens the florets one after another, a taste
 * of what the pop-up does. It stops while anything covers the grid: a pop-up
 * on this page (`paused`) or a case study (as WorkCard's videos do).
 */
export function FlowerThumb({ paused = false }) {
  const reduced = useReducedMotion()
  const covered = Boolean(useLocation().state?.caseStudy)
  const [boxRef, inView] = useInView({ threshold: 0.5 })
  const canvasRef = useRef(null)
  const [hot, setHot] = useState(false)

  // The card (the <article> round this thumbnail) is what the pointer and
  // focus land on; the thumbnail itself sits under its button.
  useEffect(() => {
    const card = canvasRef.current?.closest('[data-card]')
    if (!card) return undefined
    const on = () => setHot(true)
    const off = () => setHot(false)
    card.addEventListener('pointerenter', on)
    card.addEventListener('pointerleave', off)
    card.addEventListener('focusin', on)
    card.addEventListener('focusout', off)
    return () => {
      card.removeEventListener('pointerenter', on)
      card.removeEventListener('pointerleave', off)
      card.removeEventListener('focusin', on)
      card.removeEventListener('focusout', off)
    }
  }, [])

  const viewRef = useFlowerView(canvasRef, {
    species: DEFAULT_SPECIES,
    swatch: DEFAULT_SWATCH,
    rest: CARD_REST,
    reduced,
    running: inView && !paused && !covered,
    framing: 0.84,
    sway: 0.6,
  })
  useEffect(() => viewRef.current?.setAll(hot), [hot, viewRef])

  return (
    <div ref={boxRef} className="fl-card absolute inset-0">
      <canvas ref={canvasRef} className="fl-canvas" aria-hidden="true" />
    </div>
  )
}

/* --- the pop-up ---------------------------------------------------------- */

/**
 * `open` mounts and shows it; `onClose` runs once it has animated away;
 * `returnFocus` (a ref) is the card, which gets focus back.
 */
export function FlowerModal({ open, onClose, returnFocus }) {
  const ref = useRef(null)
  const downOnBackdrop = useRef(false)
  const closingRef = useRef(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return undefined
    closingRef.current = false
    setClosing(false)
    if (!dialog.open) dialog.showModal()
    setCursorHost(dialog)
    // Lenis and the page's own scroll both hold still behind the pop-up, and
    // are left as they were found (the landing sequence can hold Lenis).
    const lenis = window.__lenis
    const wasStopped = lenis ? lenis.isStopped : true
    lenis?.stop()
    const root = document.documentElement
    const overflow = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      setCursorHost(null)
      root.style.overflow = overflow
      if (lenis && !wasStopped && window.__lenis === lenis) lenis.start()
    }
  }, [open])

  const reduced = useReducedMotion()

  const finishClose = useCallback(() => {
    if (ref.current?.open) ref.current.close()
    onClose()
    const card = returnFocus?.current
    if (card && (document.activeElement === document.body || !document.activeElement)) {
      card.focus({ preventScroll: true })
    }
  }, [onClose, returnFocus])

  const close = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    setTimeout(finishClose, reduced ? 0 : CLOSE_MS)
  }, [finishClose, reduced])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      className="vp-pop fl-pop"
      data-closing={closing || undefined}
      data-lenis-prevent
      aria-labelledby="fl-title"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClose={() => {
        if (closingRef.current) return
        closingRef.current = true
        finishClose()
      }}
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdrop.current) close()
      }}
    >
      <FlowerGenerator onClose={close} reduced={reduced} />
    </dialog>
  )
}

/** The generator itself: the controls on the left, the flower on the right. */
function FlowerGenerator({ onClose, reduced }) {
  const [speciesKey, setSpeciesKey] = useState(DEFAULT_SPECIES)
  const [swatch, setSwatch] = useState(DEFAULT_SWATCH)
  const [allOpen, setAllOpen] = useState(false)
  const [openCount, setOpenCount] = useState(0)
  const canHover = useMediaQuery(HOVER, true)
  const canvasRef = useRef(null)
  const pointerType = useRef('')
  const name = useId()
  const species = speciesByKey(speciesKey)

  const viewRef = useFlowerView(canvasRef, {
    species: speciesKey,
    swatch,
    reduced,
    running: true,
    framing: 0.84,
    sway: 1,
    onOpen: setOpenCount,
  })
  // A new plant starts in bud.
  useEffect(() => setAllOpen(false), [speciesKey])

  /** The event's point over the canvas, in CSS pixels. */
  const local = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }

  return (
    <div className="fl-frame">
      <button type="button" className="vp-close" onClick={onClose} aria-label="Close">
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path d="M5 5 15 15M15 5 5 15" />
        </svg>
      </button>

      <div className="fl-head">
        <h2 id="fl-title" className="fl-title font-display">
          ASCII Flowers
        </h2>
        <p className="fl-hint">{canHover ? 'Hover a flower to bloom it' : 'Tap a flower to bloom it'}</p>
      </div>

      <div className="fl-controls">
        <fieldset className="fl-group">
          <legend className="fl-label">Flower</legend>
          <div className="fl-options">
            {SPECIES.map((s) => (
              <label key={s.key} className="fl-option">
                <input
                  type="radio"
                  name={`${name}-flower`}
                  value={s.key}
                  checked={speciesKey === s.key}
                  onChange={() => setSpeciesKey(s.key)}
                />
                <span>{s.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="fl-group">
          <legend className="fl-label">Colour</legend>
          <div className="fl-swatches">
            {SWATCHES.map((sw) => (
              <label key={sw.n} className="fl-swatch" style={{ '--sw': `var(${sw.token})` }} title={sw.name}>
                <input
                  type="radio"
                  name={`${name}-colour`}
                  value={sw.n}
                  checked={swatch === sw.n}
                  onChange={() => setSwatch(sw.n)}
                  aria-label={sw.name}
                />
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {/* The drawing. A mouse blooms whichever flower it is on; a tap opens
          or closes the flower under it; Enter or Space opens every flower,
          one after another, and closes them again. */}
      <button
        type="button"
        className="fl-stage"
        aria-pressed={allOpen}
        aria-label={`Bloom the ${species.name.toLowerCase()} flowers`}
        data-open={openCount}
        onPointerMove={(e) => {
          if (e.pointerType === 'mouse') viewRef.current?.pointer(...local(e))
        }}
        onPointerLeave={() => viewRef.current?.pointer(null)}
        onPointerDown={(e) => {
          pointerType.current = e.pointerType
        }}
        onClick={(e) => {
          const type = pointerType.current
          pointerType.current = ''
          // the keyboard (a click with no pointer behind it): every flower
          if (e.detail === 0) {
            const next = !allOpen
            setAllOpen(next)
            viewRef.current?.setAll(next)
            return
          }
          // a mouse needs no click: hovering already blooms
          if (type !== 'mouse') viewRef.current?.tap(...local(e))
        }}
      >
        <canvas ref={canvasRef} className="fl-canvas" aria-hidden="true" />
        <span className="fl-latin" aria-hidden="true">
          {species.latin}
        </span>
      </button>
    </div>
  )
}
