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
  if (typeof window === 'undefined') return 2000
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--loader-total-ms')
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : 2000
}
