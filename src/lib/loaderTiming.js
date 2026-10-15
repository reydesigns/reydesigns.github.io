/**
 * A time token from tokens.css, in milliseconds.
 *
 * The unit has to be read, not assumed: tokens.css writes `2000ms`, but the
 * production CSS minifier rewrites it as `2s` (and `250ms` as `.25s`), so a
 * bare parseFloat gave 2 and the live loader handed off after 2ms — before
 * a single frame of it was seen.
 */
export function cssMs(name, fallback) {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return /\ds$/.test(raw) ? n * 1000 : n
}

/**
 * How long the loader runs, in milliseconds.
 *
 * Two loops of the wordmark at the client's 2s hand-off: 4 frames x 250ms x 2.
 * The number is written down once, in tokens.css as `--loader-total-ms`, and
 * read back from there — LoaderStage paces its frames off the same token, so
 * the animation and the hand-off cannot drift apart. Hard-coding it in
 * JavaScript as well is exactly how they would.
 */
export function loaderTotalMs() {
  return cssMs('--loader-total-ms', 2000)
}
