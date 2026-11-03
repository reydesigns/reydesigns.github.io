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

   A flower drawn in black line from above (a 3D model, painted as line art
   by lib/flowers/render.js), with ASCII characters drifting up off its petals
   like pollen. Hover it and it blooms; move away and it closes back into a
   bud. On the left, a plain list of the four flowers and a 3 x 3 palette for
   the pollen, all in the site's burgundies and greys.

   Touch and keyboard bloom it by tapping or pressing the flower instead
   (Enter or Space), and it stays open until tapped again. Reduced motion
   keeps the flower and its pollen but holds them still: a bloom happens at
   once, and nothing drifts or sways.

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
 * step with the props. `running` starts and stops its animation loop.
 */
function useFlowerView(canvasRef, { species, swatch, bloom, reduced, running, framing, sway }) {
  const viewRef = useRef(null)

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const view = createFlowerView(canvas, {
      species,
      color: swatchHex(swatch),
      ink: cssVar('--fl-line', '#161314'),
      paper: cssVar('--color-surface', '#ffffff'),
      bloom,
      reduced,
      framing,
      sway,
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
  useEffect(() => viewRef.current?.setBloom(bloom), [bloom])
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

const CARD_REST = 0.45 // a spider lily half open, until the card is hovered

/**
 * The Works card's thumbnail: a spider lily, half open, shedding pollen while
 * at least half the card is on screen (the rule the other cards' videos play
 * by; otherwise it holds still on its last frame). Hovering or focusing the card opens it fully, a
 * taste of what the pop-up does. It stops while anything covers the grid:
 * a pop-up on this page (`paused`) or a case study (as WorkCard's videos do).
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

  useFlowerView(canvasRef, {
    species: DEFAULT_SPECIES,
    swatch: DEFAULT_SWATCH,
    bloom: hot ? 1 : CARD_REST,
    reduced,
    running: inView && !paused && !covered,
    framing: 0.84,
    sway: 0.6,
  })

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
  const [hovering, setHovering] = useState(false)
  const [pinned, setPinned] = useState(false)
  const canHover = useMediaQuery(HOVER, true)
  const canvasRef = useRef(null)
  const pointerType = useRef('')
  const name = useId()
  const species = speciesByKey(speciesKey)

  const viewRef = useFlowerView(canvasRef, {
    species: speciesKey,
    swatch,
    bloom: hovering || pinned ? 1 : 0,
    reduced,
    running: true,
    framing: 0.84,
    sway: 1,
  })

  const lean = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    viewRef.current?.lean(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1)
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
        <p className="fl-hint">{canHover ? 'Hover the flower to bloom it' : 'Tap the flower to bloom it'}</p>
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

      {/* The flower. A mouse blooms it by hovering; a tap, Enter or Space
          toggles it open and shut. */}
      <button
        type="button"
        className="fl-stage"
        aria-pressed={pinned}
        aria-label={`Bloom the ${species.name.toLowerCase()}`}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') setHovering(true)
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') setHovering(false)
          viewRef.current?.lean(0, 0)
        }}
        onPointerMove={(e) => {
          if (e.pointerType === 'mouse') lean(e)
        }}
        onPointerDown={(e) => {
          pointerType.current = e.pointerType
        }}
        onClick={(e) => {
          // A mouse click is not a toggle: hovering already blooms it.
          const mouse = pointerType.current === 'mouse' && e.detail !== 0
          pointerType.current = ''
          if (!mouse) setPinned((p) => !p)
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
