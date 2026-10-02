import { useEffect, useState } from 'react'
import { useReducedMotion } from '@/lib/useReducedMotion'

/**
 * Plays an animated GIF, then either keeps looping or freezes on a fully
 * composited still.
 *
 * A GIF can't be told how many times to loop, so when `loop` is false the still
 * is swapped in after the measured duration of one pass. The `-still.png` files
 * are every frame drawn on top of each other, which is what a draw-on animation
 * looks like when it finishes — the last frame alone would only be the final
 * stroke.
 *
 * `loop` keeps the GIF on screen instead, which is all that is needed: every
 * GIF in Assets/brand/animation carries a loop count of 0 (forever), so leaving
 * it alone is what makes it run for as long as the page is open. Reduced motion
 * still gets the still, loop or not.
 *
 * Each GIF canvas carries transparent padding around the artwork, so the
 * wrapper crops to the artwork's measured bounds. The same crop applies to the
 * GIF and the still, so the swap doesn't shift anything.
 *
 * @param canvas [width, height] of the GIF canvas in px
 * @param box    [x, y, w, h] of the artwork inside that canvas, as 0–1 fractions
 * @param width  CSS length the cropped artwork should occupy
 * @param loop   never swap to the still — run for the lifetime of the page
 */
export function GifMark({
  gif,
  still,
  durationMs,
  canvas,
  box,
  width,
  className = '',
  alt = '',
  loop = false,
}) {
  const reduced = useReducedMotion()
  const [done, setDone] = useState(false)
  const [stillReady, setStillReady] = useState(false)

  // Decode the still up front. Swapping src to a not-yet-fetched image leaves a
  // visible gap where the mark briefly disappears.
  useEffect(() => {
    let cancelled = false
    const pre = new Image()
    pre.onload = () => {
      if (!cancelled) setStillReady(true)
    }
    pre.src = still
    return () => {
      cancelled = true
    }
  }, [still])

  useEffect(() => {
    if (reduced || loop) return undefined
    const t = setTimeout(() => setDone(true), durationMs)
    return () => clearTimeout(t)
  }, [reduced, durationMs, loop])

  const showStill = (reduced || done) && stillReady

  return (
    <CroppedMark
      src={showStill ? still : gif}
      canvas={canvas}
      box={box}
      width={width}
      className={className}
      alt={alt}
    />
  )
}

/**
 * One frame of brand artwork, cropped to its ink.
 *
 * Every animation in Assets/brand/animation sits on a canvas with transparent
 * padding around it, and all of a given animation's frames share that canvas —
 * so cropping with the same numbers is what keeps successive frames from
 * shifting against each other. The loader drives its own frames (a browser
 * cannot retime a GIF) and reuses this so its crop is identical to the one the
 * GIF version had.
 *
 * @param canvas [width, height] of the source canvas in px
 * @param box    [x, y, w, h] of the artwork inside that canvas, as 0–1 fractions
 * @param width  CSS length the cropped artwork should occupy
 */
export function CroppedMark({ src, canvas, box, width, className = '', alt = '', style, ...rest }) {
  const [cw, ch] = canvas
  const [x, y, w, h] = box

  // Scale the whole canvas up so its content box ends up `width` wide.
  const imgW = `calc(${width} / ${w})`
  // The image keeps its natural aspect, so its rendered height is imgW * ch/cw.
  const offsetX = -x
  const offsetY = (-y * ch) / cw

  return (
    <span
      className={`relative block overflow-hidden ${className}`}
      style={{ width, aspectRatio: `${w * cw} / ${h * ch}`, ...style }}
      role={alt ? 'img' : 'presentation'}
      aria-label={alt || undefined}
      {...rest}
    >
      <img
        src={src}
        alt=""
        decoding="async"
        className="absolute max-w-none"
        style={{
          width: imgW,
          height: 'auto',
          left: `calc(${imgW} * ${offsetX})`,
          top: `calc(${imgW} * ${offsetY})`,
        }}
      />
    </span>
  )
}
