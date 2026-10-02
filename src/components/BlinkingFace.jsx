/**
 * The kaomoji beside the Funzies headline, („> ᴗ <„), winking on a loop like
 * a GIF for as long as the page is open: it holds, then tips its head, the
 * right eye snaps shut and a little sparkle pops beside it.
 *
 * It is live text rather than a .gif so it stays crisp at any size and in the
 * ink colour. The winking eye is a fixed-width box holding both states stacked
 * — open and shut — so the swap never shifts the face sideways.
 */
export function BlinkingFace({ className = '' }) {
  return (
    <span className={`fz-face ${className}`} role="img" aria-label="winking face">
      <span className="fz-face__head" aria-hidden="true">
        („<span className="fz-face__eye">&gt;</span> <span className="fz-face__mouth">ᴗ</span>{' '}
        <span className="fz-face__eye fz-face__eye--wink">
          <span className="fz-face__open">&lt;</span>
          <span className="fz-face__shut">-</span>
          <span className="fz-face__spark">✦</span>
        </span>
        „)
      </span>
    </span>
  )
}
