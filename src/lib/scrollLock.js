/* ---------------------------------------------------------------------------
   Holding the page still behind a pop-up.

   Every pop-up (the case-study window, the Vinyl Player, Binary Bloom, the
   Design page's project windows) takes a hold while it is open: Lenis stopped
   and the root's overflow hidden, so the page behind cannot scroll. Holds are
   counted, so the page only lets go when the last one is released, in
   whatever order pop-ups open and close, and each release works once, so a
   doubled clean-up cannot let go of another pop-up's hold.

   (Each pop-up used to note whether the page was already held when it opened
   and put that back when it closed. If that note was ever wrong, say two
   holds overlapping, or a hot reload in dev while one was open, the page was
   left unable to scroll for good.)

   As a last line of defence, healScroll() (installed once, by SmoothScroll)
   lets go on the reader's next wheel, touch or key if the page is somehow
   still held while no hold is taken and no dialog is open.
--------------------------------------------------------------------------- */

let holds = 0

function letGo() {
  document.documentElement.style.overflow = ''
  window.__lenis?.start()
}

/** Hold the page still; returns the release. */
export function holdScroll() {
  holds += 1
  window.__lenis?.stop()
  document.documentElement.style.overflow = 'hidden'
  let released = false
  return () => {
    if (released) return
    released = true
    holds = Math.max(0, holds - 1)
    if (holds === 0) letGo()
  }
}

/** Free a page left held by mistake, on the reader's next input. Returns
    the clean-up. */
export function healScroll() {
  const check = () => {
    if (holds > 0 || document.querySelector('dialog[open]')) return
    if (window.__lenis?.isStopped || document.documentElement.style.overflow === 'hidden') {
      console.warn('[scroll] the page was held with nothing open; letting go')
      letGo()
    }
  }
  const passive = { capture: true, passive: true }
  window.addEventListener('wheel', check, passive)
  window.addEventListener('touchstart', check, passive)
  window.addEventListener('keydown', check, true)
  return () => {
    window.removeEventListener('wheel', check, passive)
    window.removeEventListener('touchstart', check, passive)
    window.removeEventListener('keydown', check, true)
  }
}
