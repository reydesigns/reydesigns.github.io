import { Suspense, lazy, useEffect, useRef, useState } from 'react'

const Drawing3D = lazy(() =>
  import('./Drawing3D').then((m) => ({ default: m.Drawing3D })),
)

/**
 * Defers both the Three.js bundle and the WebGL context until the drawing is
 * near the viewport. Three is ~550 kB — far too much to put in the critical
 * path for two decorative corners.
 *
 * `children` render in the same box, over the canvas — the speech bubbles
 * position themselves against it.
 */
export function Drawing3DLazy({ className = '', children, ...props }) {
  const ref = useRef(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
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
  }, [])

  return (
    <div ref={ref} className={className}>
      {near && (
        <Suspense fallback={null}>
          <Drawing3D {...props} className="h-full w-full" />
        </Suspense>
      )}
      {children}
    </div>
  )
}
