import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from '@/lib/useReducedMotion'
import sparkleGif from '@assets/brand/animation/sparkle.gif'
import sparkleStill from '@assets/brand/animation/sparkle-still.png'

/**
 * Tiled sparkle background.
 *
 * Fixed to the viewport rather than drawn down the full document: the HeySo
 * case study is ~8200pt tall, so a document-height grid would mean thousands
 * of animated <img> nodes. Fixed keeps it at ~2 dozen on any page.
 *
 * Pattern: sparkles sit on a lattice of even rows and columns (pitch 2 × the
 * cell), and only every other point of that lattice is drawn, alternating
 * row to row:
 *
 *   ✦ · ✦ · ✦ ·
 *   · ✦ · ✦ · ✦
 *
 * so the pattern repeats every 4 cells down the page.
 */
export function SparkleGrid() {
  const reduced = useReducedMotion()
  const [vp, setVp] = useState({ w: 0, h: 0 })
  const [cell, setCell] = useState(130)

  const layerRef = useRef(null)

  useEffect(() => {
    const read = () => {
      setVp({ w: window.innerWidth, h: window.innerHeight })
      const v = getComputedStyle(document.documentElement).getPropertyValue('--sparkle-cell')
      const n = parseFloat(v)
      if (!Number.isNaN(n)) setCell(n)
    }
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])

  // Parallax: the layer is fixed, so drifting it against scroll gives depth
  // without re-laying out anything.
  useEffect(() => {
    if (reduced) return undefined
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const el = layerRef.current
        if (!el) return
        // Wrap the drift to the pattern's vertical period (4 × cell, because
        // the rows alternate) so it never runs out of sparkles at the bottom
        // of a long page and never visibly jumps.
        const pitch = cell * 4
        const drift = ((window.scrollY * 0.06) % pitch) * -1
        el.style.transform = `translate3d(0, ${drift}px, 0)`
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [reduced, cell])

  const points = useMemo(() => {
    if (!vp.w || !cell) return []
    const cols = Math.ceil(vp.w / cell) + 1
    const rows = Math.ceil(vp.h / cell) + 5
    // Inset by one cell (half the visible pitch) so the sparkles on the top and
    // left edges aren't sliced in half by the viewport.
    const inset = cell
    const out = []
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (r % 2 === 0 && c % 2 === 0 && (r / 2 + c / 2) % 2 === 0) {
          out.push({ x: c * cell + inset, y: r * cell + inset, key: `${r}-${c}` })
        }
      }
    }
    return out
  }, [vp, cell])

  return (
    <div
      ref={layerRef}
      className="layer-sparkles pointer-events-none fixed inset-0 overflow-hidden"
      aria-hidden="true"
      style={{ opacity: 'var(--sparkle-opacity)' }}
    >
      {points.map((p) => (
        <img
          key={p.key}
          src={reduced ? sparkleStill : sparkleGif}
          alt=""
          decoding="async"
          className="absolute"
          style={{
            left: p.x,
            top: p.y,
            width: 'var(--sparkle-size)',
            height: 'auto',
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </div>
  )
}
