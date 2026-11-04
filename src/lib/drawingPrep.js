/**
 * Starts building a 3D drawing's mesh and textures in a worker
 * (drawing.worker.js) and hands back a promise of the arrays.
 *
 * Kept free of three.js so Drawing3DLazy can call it the moment a drawing
 * mounts: the worker then decodes and processes the PNGs while the three.js
 * chunk is still downloading, and Drawing3D (which calls it again, getting
 * the same promise) finds the work done. Each drawing gets its own worker, so
 * two drawings build side by side.
 *
 * The promise is dropped from the cache once Drawing3D has taken its result
 * (`release`), so a page that comes back builds afresh rather than the arrays
 * sitting in memory for the whole visit.
 */
import style from '@/data/style_config.json'

/** Drawing3D's defaults, here so both callers key the same build. */
export const DEFAULT_DEPTH = 0.85
export const DEFAULT_SEGMENTS = style.geometry.maxSegments

const pending = new Map()

const keyOf = ({ textures, depth = DEFAULT_DEPTH, maxSegments = DEFAULT_SEGMENTS }) =>
  `${textures.color}|${depth}|${maxSegments}`

/** Resolves to { mesh, tex } (see drawing.worker.js), or rejects. */
export function prepareDrawing({ textures, meta, depth = DEFAULT_DEPTH, maxSegments = DEFAULT_SEGMENTS }) {
  const key = keyOf({ textures, depth, maxSegments })
  let job = pending.get(key)
  if (job) return job
  job = new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./drawing.worker.js', import.meta.url), { type: 'module' })
    const abs = (src) => new URL(src, document.baseURI).href
    worker.onmessage = ({ data }) => {
      worker.terminate()
      if (data.ok) resolve(data)
      else reject(new Error(data.error))
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(e instanceof Error ? e : new Error(e.message || 'drawing worker failed'))
    }
    worker.postMessage({
      color: abs(textures.color),
      height: abs(textures.height),
      back: abs(textures.back),
      meta,
      depth,
      maxSegments,
    })
  })
  // A failed build is not cached, so the next mount tries again.
  job.catch(() => pending.delete(key))
  pending.set(key, job)
  return job
}

/** Forgets a finished build (its arrays now belong to the three.js objects). */
export function releaseDrawing(props) {
  pending.delete(keyOf(props))
}
