import { useCallback, useEffect, useRef, useState } from 'react'

/** How long a tapped bubble stays up on a touch screen, which has no "leave". */
const TAP_HOLD_MS = 2400

/**
 * What a drawing on the landing page says, and when.
 *
 * A hover shows the bubble and leaving hides it; a tap (touch tablets, where
 * there is no hover) shows it for TAP_HOLD_MS. With several `lines`, each new
 * appearance says the next one — the self-portrait alternates between its two
 * greetings rather than repeating one. The line only changes while the bubble
 * is hidden, so it never swaps under the reader's eye.
 *
 * Returns the props for Drawing3DLazy (`onHoverChange`, `onTap`) and for
 * SpeechBubble (`open`, `text`).
 */
export function useSpeech(lines) {
  const [open, setOpen] = useState(false)
  const [turn, setTurn] = useState(-1)
  const openRef = useRef(false)
  const hovering = useRef(false)
  const timer = useRef(0)

  const set = useCallback((next) => {
    // A new appearance moves on to the next line; staying open does not.
    if (next && !openRef.current) setTurn((n) => n + 1)
    openRef.current = next
    setOpen(next)
  }, [])

  const onHoverChange = useCallback(
    (over) => {
      hovering.current = over
      clearTimeout(timer.current)
      set(over)
    },
    [set],
  )

  const onTap = useCallback(() => {
    if (hovering.current) return
    clearTimeout(timer.current)
    set(true)
    timer.current = setTimeout(() => set(false), TAP_HOLD_MS)
  }, [set])

  useEffect(() => () => clearTimeout(timer.current), [])

  const text = lines[Math.max(0, turn) % lines.length]
  return { open, text, onHoverChange, onTap }
}

/**
 * A comic speech bubble pinned to one of the landing drawings. Kumbh Sans on
 * the card surface, with a tail pointing back at whoever is talking:
 * `side="top"` sits above the speaker (tail down), `side="right"` beside it
 * (tail left). Where exactly is up to `className`, in the drawing's own box.
 *
 * It pops in with a small overshoot from the tail's end, as if spoken; under
 * reduced motion the global override collapses that to a plain appearance.
 * Decorative: the drawings are already hidden from assistive tech, and the
 * greeting repeats what the page header says.
 */
export function SpeechBubble({ open, text, side = 'top', className = '' }) {
  return (
    <span
      className={`speech-bubble speech-bubble--${side} ${className}`}
      data-open={open ? '' : undefined}
      aria-hidden="true"
    >
      {text}
    </span>
  )
}
