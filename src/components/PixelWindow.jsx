import { paint } from '@/lib/pixelCat'

/**
 * Background for the pixel cat: a small window onto a night sky — crescent
 * moon, twinkling stars — with curtains billowing in from a breeze. Drawn
 * like the cat: see-through, burgundy outlines only, on the same pixel grid,
 * so the two read as one scene. The motion is all CSS (funzies.css) and stops
 * under reduced motion.
 *
 * Grid: W x H sprite pixels. The glass runs from GLASS to W - GLASS - 1 across
 * and from GLASS to SILL - 1 down, split into four panes by a cross bar.
 */
const W = 30
const H = 25
const GLASS = 2
const SILL = 22
const BAR_X = 14 // the vertical bar is two pixels wide: 14 and 15
const BAR_Y = 11

/* One curtain, gathered at the middle: full at the rod, pinched where it is
   tied back, flaring out again at the hem. The right one is its mirror. */
const CURTAIN = [
  'XXXXXXX',
  'XXXXXXX',
  'XXXXXX.',
  'XXXXXX.',
  'XXXXX..',
  'XXXXX..',
  'XXXX...',
  'XXXX...',
  'XXX....',
  'XXX....',
  'XXX....',
  'XXXX...',
  'XXXX...',
  'XXXXX..',
  'XXXXX..',
  'XXXXXX.',
  'XXXXXX.',
  'XXXXXXX',
  'XXXXXXX',
  'XXXXXXX',
]
const CURTAIN_LINE = paint(CURTAIN)

/** Crescent moon, outlined: a disc with a second, offset disc taken out of
    it, drawn as the shape's edge pixels only. */
const MOON_ROWS = []
for (let y = -3; y <= 3; y += 1) {
  let row = ''
  for (let x = -3; x <= 3; x += 1) {
    row += x * x + y * y <= 10 && (x - 2) * (x - 2) + (y + 1) * (y + 1) > 7 ? 'X' : '.'
  }
  MOON_ROWS.push(row)
}
const MOON = paint(MOON_ROWS).map(([x, y]) => [x + 19, y + 3])

/** Star positions, each with its own twinkle delay. */
const STARS = [
  [5, 4, 0], [10, 7, 1.1], [8, 14, 0.5], [12, 17, 1.7], [18, 15, 0.8],
  [24, 13, 1.4], [26, 18, 0.2], [17, 4, 1.9], [11, 3, 0.9], [20, 19, 1.2],
]

const px = (x, y, cls) => <rect key={`${cls}${x},${y}`} className={cls} x={x} y={y} width="1" height="1" />

export function PixelWindow({ className = '', scale = 4 }) {
  const glassW = W - 2 * GLASS
  const glassH = SILL - GLASS
  return (
    <svg
      className={`fz-night ${className}`}
      width={W * scale}
      height={H * scale}
      viewBox={`0 0 ${W} ${H}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {/* Moon and stars, in outline on the open glass. */}
      {MOON.map(([x, y]) => px(x, y, 'fz-night__line'))}
      {STARS.map(([x, y, d]) => (
        <rect
          key={`s${x},${y}`}
          className="fz-night__star"
          x={x}
          y={y}
          width="1"
          height="1"
          style={{ animationDelay: `${d}s` }}
        />
      ))}
      {/* The cross bar over the glass. */}
      <rect className="fz-night__line" x={BAR_X} y={GLASS} width="2" height={glassH} />
      <rect className="fz-night__line" x={GLASS} y={BAR_Y} width={glassW} height="1" />
      {/* Glass edge and outer edge. */}
      <rect className="fz-night__edge" x={GLASS - 0.5} y={GLASS - 0.5} width={glassW + 1} height={glassH + 1} />
      <rect className="fz-night__edge" x="0.5" y="0.5" width={W - 1} height={SILL - 0.5} />
      {/* Curtains, hung from the rod and swaying from their top corners. */}
      {[
        ['fz-night__curtain fz-night__curtain--left', `translate(${GLASS} ${GLASS})`],
        ['fz-night__curtain fz-night__curtain--right', `translate(${W - GLASS} ${GLASS}) scale(-1 1)`],
      ].map(([cls, at]) => (
        <g key={cls} transform={at}>
          <g className={cls}>
            {CURTAIN_LINE.map(([x, y]) => px(x, y, 'fz-night__line'))}
          </g>
        </g>
      ))}
      {/* Rod and sill. */}
      <rect className="fz-night__line" x="0" y="1" width={W} height="1" />
      <rect className="fz-night__line" x="0" y={SILL} width={W} height="1" />
      <rect className="fz-night__line" x="1" y={SILL + 2} width={W - 2} height="1" />
    </svg>
  )
}
