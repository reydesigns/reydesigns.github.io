import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { prepareDrawing } from '@/lib/drawingPrep'

const Drawing3D = lazy(() =>
  import('./Drawing3D').then((m) => ({ default: m.Drawing3D })),
)

/**
 * Keeps the Three.js bundle (~550 kB) out of the critical path, and makes the
 * drawing appear at once anyway.
 *
 * With a `poster` (the landing page's two drawings), the drawing is on screen
 * from the first paint: the poster is a still of the 3D drawing in its
 * resting pose (scripts/drawing-posters.mjs), shown straight away, while
 * three.js downloads and the mesh is built in a worker. When the live canvas
 * has drawn its first frame, which is the same pose, the two crossfade, and
 * from then on it moves. If WebGL never starts, the still simply stays.
 *
 * `eager` mounts the 3D drawing straight away (it starts downloading and
 * building on mount); without it, the drawing waits until it is near the
 * viewport, as the fridge magnets do.
 *
 * `children` render in the same box, over the canvas — the speech bubbles
 * position themselves against it.
 */
export function Drawing3DLazy({ className = '', poster, eager = false, children, ...props }) {
  const ref = useRef(null)
  const [near, setNear] = useState(eager)
  const [live, setLive] = useState(false)
  const onReady = useCallback(() => setLive(true), [])

  // The worker starts on the PNGs now, in parallel with the three.js chunk.
  const { textures, meta, depth, maxSegments } = props
  useEffect(() => {
    if (near) prepareDrawing({ textures, meta, depth, maxSegments }).catch(() => {})
  }, [near, textures, meta, depth, maxSegments])

  useEffect(() => {
    if (near) return undefined
    const el = ref.current
    if (!el) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          setNear(true)
        }
      },
      { rootMargin: '300px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [near])

  return (
    <div ref={ref} className={className} data-live={live}>
      {poster && (
        <img
          src={poster}
          alt=""
          aria-hidden="true"
          draggable={false}
          // Preloaded by index.html, so it is usually in hand by the first
          // render: decoding it in step puts it in the same frame as the
          // headline instead of a frame or two after.
          decoding="sync"
          fetchPriority="high"
          className={`pointer-events-none absolute inset-0 h-full w-full select-none transition-opacity duration-300 ease-out ${live ? 'opacity-0' : 'opacity-100'}`}
        />
      )}
      {near && (
        <Suspense fallback={null}>
          <Drawing3D
            {...props}
            onReady={onReady}
            className={`relative h-full w-full transition-opacity duration-300 ease-out ${live ? 'opacity-100' : 'opacity-0'}`}
          />
        </Suspense>
      )}
      {children}
    </div>
  )
}
