import { useEffect, useState } from 'react'
import { useReducedMotion } from '@/lib/useReducedMotion'

const TYPE_MS = 95 // per character typed
const DELETE_MS = 45 // per character backspaced
const HOLD_MS = 1700 // a finished word stays up this long
const GAP_MS = 380 // pause on an empty slot before the next word

/**
 * One word that types itself out, holds, backspaces, and types the next —
 * round the list and back to the start.
 *
 * The slot is sized to the longest word up front (an invisible copy of each
 * word stacked in one grid cell) and the live text is laid over it, so the
 * line never reflows as the word changes and nothing after it moves. `after`
 * is text that ends each word, like the closing full stop; it is typed and
 * backspaced along with the word. `wordClassName` styles the word but not
 * `after` — on the landing page the word is Pixelta and the full stop stays in
 * the headline's Kumbh Sans, like the one after "how". The invisible copies
 * are built from the same two spans, so the slot is measured in the fonts
 * that are actually drawn.
 *
 * Screen readers get the full list once, through `label`; the animated text
 * is hidden from them. Reduced motion shows the first word, still.
 */
export function WordCycle({ words, after = '', className = '', wordClassName = '' }) {
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [length, setLength] = useState(0)
  const [phase, setPhase] = useState('typing') // typing | holding | deleting | gap

  useEffect(() => {
    if (reduced) return undefined
    // `after` (the full stop) is typed and backspaced along with the word.
    const word = words[index] + after
    let t
    if (phase === 'typing') {
      if (length < word.length) t = setTimeout(() => setLength((n) => n + 1), TYPE_MS)
      else t = setTimeout(() => setPhase('holding'), 0)
    } else if (phase === 'holding') {
      t = setTimeout(() => setPhase('deleting'), HOLD_MS)
    } else if (phase === 'deleting') {
      if (length > 0) t = setTimeout(() => setLength((n) => n - 1), DELETE_MS)
      else t = setTimeout(() => setPhase('gap'), 0)
    } else {
      t = setTimeout(() => {
        setIndex((i) => (i + 1) % words.length)
        setPhase('typing')
      }, GAP_MS)
    }
    return () => clearTimeout(t)
  }, [reduced, words, index, length, phase])

  const full = reduced ? words[0] : words[index]
  const count = reduced ? full.length + after.length : length
  const typedWord = full.slice(0, count)
  const typedAfter = after.slice(0, Math.max(0, count - full.length))
  // The caret blinks while a word is held or the slot is empty, and stays
  // solid while it is typing or deleting — like a real text cursor.
  const blink = reduced || phase === 'holding' || phase === 'gap'

  return (
    <span className={`relative inline-grid align-baseline ${className}`} aria-hidden="true">
      {words.map((w) => (
        <span key={w} className="invisible col-start-1 row-start-1 whitespace-nowrap">
          <span className={wordClassName}>{w}</span>
          {after}
        </span>
      ))}
      {/* The live text is laid over the slot rather than in it: only the
          invisible copies size the slot, so nothing the live word does — its
          length, the caret, the kerning against the full stop — can move the
          line.

          The caret is an inline-block sitting on the text's baseline, not a
          box hung off the text's edge. That keeps this line box from ever
          being empty: with every character backspaced, an empty line box
          collapses to zero height, and a caret anchored to it jumped a whole
          line up the headline. The word span is never empty either (a
          zero-width space stands in), so the Pixelta line metrics — and with
          them the baseline — are identical at every length. */}
      <span className="absolute top-0 left-0 whitespace-nowrap">
        <span className={wordClassName}>{typedWord || '\u200B'}</span>
        {typedAfter}
        <span
          className={`type-caret ml-[0.06em] inline-block h-[0.82em] w-[0.06em] align-[-0.06em] bg-[var(--color-ink)]${
            blink ? ' type-caret--blink' : ''
          }`}
        />
      </span>
    </span>
  )
}
