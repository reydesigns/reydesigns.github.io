import { forwardRef, useEffect, useRef, useState } from 'react'
import { CroppedMark } from './GifMark'
import { loaderTotalMs } from '@/lib/loaderTiming'
import { useReducedMotion } from '@/lib/useReducedMotion'
// 750x625 WebP copies of the 3000x2500 frame-0N.png originals (exactly a
// quarter scale, so the crop fractions below hold for both). The mark is never
// drawn wider than 15rem (--loader-mark-w), i.e. a ~241px canvas — 750px
// covers that at 3x. The originals cost ~30MB each to decode for a ~145px
// mark; these cost under 2MB.
import frame01 from '@assets/brand/animation/loader-frames/frame-01-750.webp'
import frame02 from '@assets/brand/animation/loader-frames/frame-02-750.webp'
import frame03 from '@assets/brand/animation/loader-frames/frame-03-750.webp'
import frame04 from '@assets/brand/animation/loader-frames/frame-04-750.webp'

/* ---------------------------------------------------------------------------
   The loader screen — the second of the landing page's three screens.

   Geometry is from Assets/site-design/images/loading-page.png: the wordmark is
   10.07% of the viewport wide and centred on the page, with the top bar and the
   nav pill both still present. The 3000x2500 frame canvas is blank for its top
   27.12%, so the mark is cropped to its ink before it is centred — otherwise
   the artwork sits visibly low.

   WHY THIS DRIVES ITS OWN FRAMES
   ------------------------------
   The hand-off is 2000ms, and the source GIF runs 4 frames in 1.32s. A browser
   has no way to retime a GIF — no rate, no seek, no "play for exactly this
   long" — so the GIF is not used at all here. The four frames are extracted as
   PNGs (already cumulative, i.e. each one is the drawing so far) and swapped on
   a clock of --loader-frame-ms:

       4 frames x 250ms = 1000ms a loop  (--loader-loop-ms)
       2 loops          = 2000ms exactly (--loader-total-ms)

   which is the same number useScrollSequence waits before handing off, both
   read from tokens.css so they cannot drift apart.

   The run ends on frame 4 — every stroke drawn — and stays there, which is the
   composited still the GIF version used to swap to. `playing` is false until
   the sequence actually engages, so the loop count is deterministic: before
   then the last frame is on screen and no clock is running.
--------------------------------------------------------------------------- */

const FRAMES = [frame01, frame02, frame03, frame04]
const LAST = FRAMES.length - 1

function frameMs() {
  if (typeof window === 'undefined') return 250
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--loader-frame-ms')
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : 250
}

/**
 * Steps through the frames for exactly --loader-total-ms, then rests on the
 * last one.
 *
 * A timer rather than requestAnimationFrame, deliberately. The whole point of
 * dropping the GIF was to control the timing, and rAF hands that control back:
 * it is tied to the compositor, so a busy tab (or a headless browser, which is
 * how this gets tested) starves it and the wordmark stalls mid-draw while the
 * hand-off runs to time anyway. Timers keep firing.
 *
 * The index is derived from elapsed time rather than incremented, so a late
 * tick costs that frame instead of pushing the run past the hand-off. Returns
 * the resting frame when it is not playing.
 */
function useFrameClock(playing, runId) {
  const [index, setIndex] = useState(LAST)
  const shown = useRef(LAST)

  useEffect(() => {
    const start = performance.now()

    // Only ever hand React a frame it is not already showing: this ticks on
    // every rAF, and a setState per frame would re-render ~4x more often than
    // there is anything new to paint.
    //
    // Each change is also left on `window.__loaderFrames` — a breadcrumb trail
    // for scripts/sequence.mjs, the same trick useScrollSequence uses for its
    // stage changes. It is the only way a test can tell a frame clock that is
    // running from one that is stuck on a single image.
    const show = (next) => {
      if (shown.current === next) return
      shown.current = next
      setIndex(next)
      if (typeof window !== 'undefined') {
        window.__loaderFrames?.push({ frame: next, t: Math.round(performance.now() - start) })
      }
    }

    if (!playing) {
      show(LAST)
      return undefined
    }
    const step = frameMs()
    const total = loaderTotalMs()
    // A new run, a new trail. Scrolling back up replays the loader, and the
    // assertions are about one run.
    window.__loaderFrames = []
    show(0)

    // Half a frame, so a tick that slips still lands inside the slot it meant.
    const id = setInterval(() => {
      const elapsed = performance.now() - start
      if (elapsed >= total) {
        show(LAST)
        clearInterval(id)
        return
      }
      show(Math.floor(elapsed / step) % FRAMES.length)
    }, step / 2)
    return () => clearInterval(id)
  }, [playing, runId])

  return index
}

/**
 * Decode every frame up front, on the very <img> elements that will show them,
 * and make each swap wait for its pixels rather than paint without them.
 *
 * This is what the loader's flicker was. The frames were 3000x2500 PNGs, and
 * the three that start out `visibility: hidden` are never painted while the
 * reader is on the hero, so Chrome never decodes them. CroppedMark marks its
 * <img> `decoding="async"`, which tells the browser it may paint the page
 * *without* an image whose decode is still running — so the first time each
 * hidden frame was swapped in, the wordmark vanished for a frame or two while
 * it decoded off-thread: two or three blank flashes in the first loop, then a
 * clean second loop once everything was in the decode cache. (The old
 * preloader only fetched the files into throwaway Image objects; fetched is
 * not decoded.)
 *
 * `decode()` does the work while the loader is still offscreen, and
 * `decoding = 'sync'` makes the rare frame whose decoded pixels were evicted
 * since arrive late instead of blank.
 *
 * Under reduced motion the clock never runs and only the last frame is ever
 * shown, so only that one is decoded.
 */
function useDecodedFrames(markRef, reduced) {
  useEffect(() => {
    const layers = [...(markRef.current?.children ?? [])]
    const used = reduced ? layers.slice(LAST, LAST + 1) : layers
    used.forEach((layer) => {
      const img = layer.querySelector('img')
      if (!img) return
      img.decoding = 'sync'
      img.decode?.().catch(() => {})
    })
  }, [markRef, reduced])
}

/**
 * `shown` is false while the reader is still on the hero. The wordmark then
 * waits invisible instead of sitting there finished: otherwise the take-over
 * glide carries a static, fully drawn mark up the screen and it visibly snaps
 * into its animation once it lands. Hidden, it fades and settles in while the
 * page glides, already moving, and hides again when the hero re-arms so every
 * replay enters the same way.
 */
export const LoaderStage = forwardRef(function LoaderStage({ playing, runId, shown = true }, ref) {
  const reduced = useReducedMotion()
  const markRef = useRef(null)
  useDecodedFrames(markRef, reduced)
  const index = useFrameClock(playing && !reduced, runId)

  return (
    <section
      ref={ref}
      aria-label="Intro"
      data-stage="loader"
      className="screen relative flex shrink-0 flex-col items-center justify-center gap-[clamp(1.75rem,5vh,3.5rem)] px-[var(--page-gutter)]"
    >
      {/* All four frames are mounted and stacked; the clock only changes which
          one is visible. Swapping a single <img>'s src made the browser paint
          a blank frame whenever the next image had not finished decoding. */}
      <span
        ref={markRef}
        className="loader-mark relative block"
        data-shown={shown ? '' : undefined}
        data-loader-frame={index}
        role="img"
        aria-label="rey designs"
      >
        {FRAMES.map((src, i) => (
          <span
            key={src}
            className={i === 0 ? 'block' : 'absolute inset-0'}
            style={{ visibility: i === index ? 'visible' : 'hidden' }}
          >
            <CroppedMark
              src={src}
              canvas={[3000, 2500]}
              box={[0, 0.2712, 0.9967, 0.7224]}
              width="var(--loader-mark-w)"
            />
          </span>
        ))}
      </span>
    </section>
  )
})
