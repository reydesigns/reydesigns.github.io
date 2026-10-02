import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from '@/lib/useReducedMotion'

const GLYPHS = '0123456789@#%&*=+<>/\\$§¶?!'

/**
 * How long one character takes to land, once its turn comes round. The swap
 * used to be instantaneous — a Pixelta glyph became its letter between two
 * frames, which read as a hard click down the line. Over this window the glyph
 * lifts and fades out while the real letter fades up out of a slight blur.
 */
const SETTLE_MS = 280

/**
 * How often the unresolved noise re-rolls. Re-rolling every frame (what this
 * did before) is 60 changes a second, which stops reading as motion and starts
 * reading as static fizz.
 */
const CHURN_MS = 55

/** Fraction of the run spent resolving; the rest is the last character landing. */
const RESOLVE_FRACTION = 0.8

const easeOut = (p) => 1 - (1 - p) ** 3

/**
 * Glyph scramble.
 *
 * Every character is on screen from the first frame as a random glyph, and
 * each one resolves into its real letter left to right. This is deliberately
 * NOT a typing effect and NOT a fade-in — nothing slides in, the text is fully
 * laid out immediately and every cell holds ink the whole time. What eases is
 * only the hand-off *within* a cell, from glyph to letter.
 *
 * While a character is unresolved it is set in Pixelta, so the scramble reads
 * as pixel noise that settles into the brand font. Unresolved characters are
 * held at the resolved character's width to stop the line from reflowing as it
 * settles — which is also why the only thing that ever moves is the glyph
 * overlay, and that is absolutely positioned.
 *
 * `segments` is an array of { text, display, quote } — `display: true` keeps
 * the segment in Pixelta after it resolves (the "why" / "obvious." accents),
 * `quote: true` keeps it in Kumbh Sans (Pixelta has no quote glyphs). A
 * segment of `{ br: true }` is a hard line break: the headline's two-line set
 * cannot be produced by wrapping at any width, because line two is wider than
 * the point at which line one would have to break.
 */
export function ScrambleText({ segments, durationMs = 3000, className = '', as: Tag = 'span' }) {
  const reduced = useReducedMotion()

  const chars = useMemo(() => {
    const out = []
    segments.forEach((seg, si) => {
      if (seg.br) {
        out.push({ br: true, key: `br-${si}` })
        return
      }
      Array.from(seg.text).forEach((ch, ci) => {
        out.push({ ch, display: !!seg.display, quote: !!seg.quote, key: `${si}-${ci}` })
      })
    })
    return out
  }, [segments])

  // A hard break is a space as far as a screen reader is concerned.
  const label = useMemo(() => segments.map((s) => (s.br ? ' ' : s.text)).join(''), [segments])

  // Group into words. Each character is its own element, so without this the
  // browser treats every boundary as a break opportunity and words split
  // mid-way ("so your s / olution").
  const words = useMemo(() => {
    const out = []
    let current = []
    chars.forEach((c, i) => {
      if (c.br || c.ch === ' ') {
        if (current.length) out.push(current)
        out.push(c.br ? 'break' : 'space')
        current = []
      } else {
        current.push({ ...c, index: i })
      }
    })
    if (current.length) out.push(current)
    return out
  }, [chars])

  // Milliseconds since the run started. Infinity means "finished" — the whole
  // line is then plain static markup again, with no per-character styles left
  // over for the browser to composite.
  const [elapsed, setElapsed] = useState(() => (reduced ? Infinity : 0))
  const raf = useRef(0)

  useEffect(() => {
    if (reduced) {
      setElapsed(Infinity)
      return undefined
    }
    setElapsed(0)
    const start = performance.now()
    // Letters start resolving over the first 80% of the run, so the tail isn't
    // a single character crawling on its own; the last one then needs its own
    // settle window on top before the line is actually done.
    const total = durationMs * RESOLVE_FRACTION + SETTLE_MS
    const step = (now) => {
      const t = now - start
      if (t >= total) {
        setElapsed(Infinity)
        return
      }
      setElapsed(t)
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [chars, durationMs, reduced])

  const done = elapsed === Infinity
  const resolveWindow = durationMs * RESOLVE_FRACTION
  const churn = done ? 0 : Math.floor(elapsed / CHURN_MS)

  return (
    <Tag className={className} aria-label={label}>
      {words.map((word, wi) => {
        if (word === 'break') return <br key={`br-${wi}`} />
        if (word === 'space') return <span key={`sp-${wi}`}> </span>
        return (
          <span key={`w-${wi}`} className="inline-block whitespace-nowrap">
            {word.map((c) => {
              // Pixelta accents ("why", "obvious.") keep their face after they
              // resolve; the quotes around them stay in Kumbh Sans because
              // Pixelta has no quote glyphs. Everything else is plain Kumbh —
              // the comp slants this line, the client does not want it.
              const face = c.display ? 'font-display' : c.quote ? 'quote-mark' : ''

              // `e` is this character's landing progress, 0 → 1.
              const age = done ? Infinity : elapsed - (c.index / chars.length) * resolveWindow
              const e = age <= 0 ? 0 : easeOut(Math.min(1, age / SETTLE_MS))

              if (e >= 1) {
                return (
                  <span key={c.key} aria-hidden="true" className={face}>
                    {c.ch}
                  </span>
                )
              }

              // The real character always holds the cell's width (it is only
              // transparent, never absent), and the glyph is laid over it
              // absolutely so a wide glyph can't widen the cell — otherwise the
              // line reflows, and overflows, on every frame as it settles.
              const g = GLYPHS[(c.index * 7 + churn) % GLYPHS.length]
              return (
                <span key={c.key} aria-hidden="true" className="relative inline-block">
                  <span
                    className={face}
                    style={
                      e > 0
                        ? { opacity: e, filter: `blur(${((1 - e) * 0.07).toFixed(4)}em)` }
                        : { opacity: 0 }
                    }
                  >
                    {c.ch}
                  </span>
                  <span
                    className="font-display absolute inset-0 flex items-center justify-center"
                    style={{
                      opacity: 0.7 * (1 - e),
                      // Only the overlay moves, so nothing here can reflow.
                      transform: e > 0 ? `translateY(${(-e * 0.1).toFixed(4)}em)` : undefined,
                    }}
                  >
                    {g}
                  </span>
                </span>
              )
            })}
          </span>
        )
      })}
    </Tag>
  )
}
