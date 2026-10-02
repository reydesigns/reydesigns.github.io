import { useEffect, useRef, useState } from 'react'
import { useInView } from '@/lib/useInView'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { SpeechBubble } from '@/components/SpeechBubble'
import { PixelWindow } from '@/components/PixelWindow'
import '@/styles/pixel-cat.css'
import { CAT_FRAMES, CAT_W, CAT_H, BOWL_AT, BOWL_W, BOWL_H, BOWL_PIXELS, BOWL_FILL } from '@/lib/pixelCat'

/** Screen pixels per sprite pixel. */
const SCALE = 4
/** Walking pace, and how long each leg pose holds. */
const SPEED = 70 // px per second
const STEP_MS = 160
/** At the bowl: bend down and hold, then chomp until EAT_MS. */
const BEND_MS = 400
const CHOMP_MS = 260
const EAT_MS = 2600
/** How long it stands saying "Meow.", and how long it sleeps. */
const MEOW_MS = 2200
const SLEEP_MS = 5000
/** Gap between the bowl and the right end of the lane. */
const BOWL_GAP = 4

/** The routine, in order; after `sleep` it starts again. */
const NEXT = { walkRight: 'eat', eat: 'meow', meow: 'walkLeft', walkLeft: 'sleep', sleep: 'walkRight' }

/**
 * The pixel cat, in front of a little night window (PixelWindow), on the Me
 * page. On a loop, while its lane is on screen: it
 * walks right to the food bowl at the far end, bends down and eats (head
 * bobbing), stands up and says "Meow.", turns and walks back to the left,
 * curls up and sleeps — "z"s drifting up — then wakes and does it all again.
 * It moves in whole sprite pixels, so it stays crisp and steppy like a sprite
 * should. Scrolled out of view it pauses where it is, and picks up from there.
 * Under reduced motion it holds still at the bowl, mid-meow.
 *
 * Decorative only: hidden from screen readers.
 */
export function PixelCat({ className = '' }) {
  const reduced = useReducedMotion()
  const [laneRef, inView] = useInView({ threshold: 0.3 })
  const [laneW, setLaneW] = useState(0)
  // Before it comes into view it is asleep on the left, a moment from waking.
  const loop = useRef({ phase: 'sleep', t: SLEEP_MS - 600 })
  const [view, setView] = useState({ x: 0, frame: 'sleep', left: true, phase: 'sleep' })

  useEffect(() => {
    const lane = laneRef.current
    if (!lane) return undefined
    const ro = new ResizeObserver(() => setLaneW(lane.clientWidth))
    ro.observe(lane)
    return () => ro.disconnect()
  }, [laneRef])

  const bowlX = Math.max(0, laneW - BOWL_GAP - BOWL_W * SCALE)
  const stopX = Math.max(0, bowlX - BOWL_AT * SCALE)
  const ready = laneW > 0

  useEffect(() => {
    if (!ready || reduced || !inView) return undefined
    const lane = laneRef.current
    const s = loop.current
    let raf
    let last = performance.now()
    const tick = (now) => {
      // Advance by real time, but never by more than a tenth of a second at
      // once, so a backgrounded tab doesn't make it jump on return.
      s.t += Math.min(100, now - last)
      last = now
      // Measured every frame, so a resize mid-walk just moves the goal.
      const stop = Math.max(0, lane.clientWidth - BOWL_GAP - (BOWL_W + BOWL_AT) * SCALE)
      const walkMs = (stop / SPEED) * 1000
      const done = { walkRight: walkMs, eat: EAT_MS, meow: MEOW_MS, walkLeft: walkMs, sleep: SLEEP_MS }
      if (s.t >= done[s.phase]) {
        s.t -= done[s.phase]
        s.phase = NEXT[s.phase]
      }
      const walked = Math.min(stop, Math.floor(((s.t / 1000) * SPEED) / SCALE) * SCALE)
      const step = Math.floor(s.t / STEP_MS) % 2 ? 'walk2' : 'walk1'
      const chomp = s.t < BEND_MS || Math.floor((s.t - BEND_MS) / CHOMP_MS) % 2 === 0 ? 'eat1' : 'eat2'
      const next = {
        walkRight: { x: walked, frame: step, left: false },
        eat: { x: stop, frame: chomp, left: false },
        meow: { x: stop, frame: 'walk2', left: false },
        walkLeft: { x: stop - walked, frame: step, left: true },
        sleep: { x: 0, frame: 'sleep', left: true },
      }[s.phase]
      setView((v) =>
        v.x === next.x && v.frame === next.frame && v.left === next.left && v.phase === s.phase
          ? v
          : { ...next, phase: s.phase },
      )
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ready, reduced, inView, laneRef])

  // Under reduced motion: standing at the bowl, saying "Meow.". At the bowl
  // (eating, meowing) it follows the bowl if the lane is resized.
  const shown = reduced ? { x: stopX, frame: 'walk2', left: false, phase: 'meow' } : view
  const atBowl = shown.phase === 'eat' || shown.phase === 'meow'
  const x = atBowl ? stopX : shown.x

  return (
    <div ref={laneRef} className={`fz-cat-lane ${className}`} aria-hidden="true">
      <PixelWindow className="fz-cat-lane__window" />
      {ready && (
        <div className="fz-cat" style={{ transform: `translateX(${x}px)` }} data-left={shown.left || undefined}>
          <svg width={CAT_W * SCALE} height={CAT_H * SCALE} viewBox={`0 0 ${CAT_W} ${CAT_H}`} shapeRendering="crispEdges">
            {CAT_FRAMES[shown.frame].map(([px, py]) => (
              <rect key={`${px},${py}`} x={px} y={py} width="1" height="1" />
            ))}
          </svg>
          {/* Over its head (the right third of the sprite). */}
          <SpeechBubble
            open={shown.phase === 'meow'}
            text="Meow."
            side="top"
            className="bottom-[calc(100%+0.6rem)] left-[78%] -translate-x-1/2"
          />
          {shown.phase === 'sleep' && (
            <span className="fz-cat__zs">
              <span>z</span>
              <span>z</span>
              <span>z</span>
            </span>
          )}
        </div>
      )}
      {ready && (
        <svg
          className="fz-bowl"
          style={{ left: bowlX }}
          width={BOWL_W * SCALE}
          height={BOWL_H * SCALE}
          viewBox={`0 0 ${BOWL_W} ${BOWL_H}`}
          shapeRendering="crispEdges"
        >
          {BOWL_FILL.map(([px, py]) => (
            <rect key={`f${px},${py}`} className="fz-bowl__fill" x={px} y={py} width="1" height="1" />
          ))}
          {BOWL_PIXELS.map(([px, py]) => (
            <rect key={`l${px},${py}`} x={px} y={py} width="1" height="1" />
          ))}
        </svg>
      )}
    </div>
  )
}
