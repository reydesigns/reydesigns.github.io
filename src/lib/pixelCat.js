/**
 * Sprites for the pixel cat on the Funzies page (PixelCat), drawn as filled
 * silhouettes — `X` is cat, `.` is not, `E` is an eye pixel. Only each
 * silhouette's outline is drawn (cat pixels touching a non-cat pixel or the
 * edge), so the cat is see-through with a burgundy rim. Every sprite is the
 * same size and stands on the bottom row, so swapping them never jumps.
 */
const SPRITES = {
  // Facing right, mid-stride: legs apart, tail up.
  walk1: [
    '................X....X..',
    '...............XX...XX..',
    '...............XXX.XXX..',
    '...............XXXXXXXX.',
    '..............XXXXXXXXXX',
    'X.............XXXEXXXEXX',
    'X.............XXXXXXXXXX',
    '.X............XXXXXXXXX.',
    '.X..XXXXXXXXXXXXXXXXXX..',
    '..XXXXXXXXXXXXXXXXXXX...',
    '...XXXXXXXXXXXXXXXXXX...',
    '...XXXXXXXXXXXXXXXXXX...',
    '....XXXXXXXXXXXXXXXX....',
    '....X...X......X...X....',
    '...X.....X....X.....X...',
    '...X.....X....X.....X...',
  ],
  // Facing right, legs together, tail lower.
  walk2: [
    '................X....X..',
    '...............XX...XX..',
    '...............XXX.XXX..',
    '...............XXXXXXXX.',
    '..............XXXXXXXXXX',
    '..............XXXEXXXEXX',
    'X.............XXXXXXXXXX',
    'X.............XXXXXXXXX.',
    '.X..XXXXXXXXXXXXXXXXXX..',
    '..XXXXXXXXXXXXXXXXXXX...',
    '...XXXXXXXXXXXXXXXXXX...',
    '...XXXXXXXXXXXXXXXXXX...',
    '....XXXXXXXXXXXXXXXX....',
    '.....X.X........X.X.....',
    '.....X.X........X.X.....',
    '.....X.X........X.X.....',
  ],
  // Bent down over the bowl: back level, head dropped below it past a dip at
  // the neck, ears up, chin low — the bowl (drawn in front) hides its mouth.
  eat1: [
    '........................',
    '........................',
    'X.......................',
    'X.......................',
    '.X......................',
    '.X......................',
    '..X.....................',
    '...XXXXXXXXXXXXX........',
    '...XXXXXXXXXXXXXX.X...X.',
    '...XXXXXXXXXXXXXX.XX.XX.',
    '...XXXXXXXXXXXXXXXXXXXXX',
    '....XXXXXXXXXXXXXXXEXXXX',
    '....XXXXXXXXXXXXXXXXXXXX',
    '.....X.X....X.X..XXXXXX.',
    '.....X.X....X.X.........',
    '.....X.X....X.X.........',
  ],
  // The same, head dipped one pixel lower: alternating the two is a chomp.
  eat2: [
    '........................',
    '........................',
    'X.......................',
    'X.......................',
    '.X......................',
    '.X......................',
    '..X.....................',
    '...XXXXXXXXXXXXX........',
    '...XXXXXXXXXXXXXX.......',
    '...XXXXXXXXXXXXXX.X...X.',
    '...XXXXXXXXXXXXXX.XX.XX.',
    '....XXXXXXXXXXXXXXXXXXXX',
    '....XXXXXXXXXXXXXXXEXXXX',
    '.....X.X....X.X.XXXXXXXX',
    '.....X.X....X.X..XXXXXX.',
    '.....X.X....X.X.........',
  ],
  // Curled up asleep: a loaf, head tucked on the right with its eye shut (a
  // dash), tail wrapped along the bottom. (Mirrored when it sleeps facing
  // left.)
  sleep: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '...............X...X....',
    '...............XX.XX....',
    '..............XXXXXXX...',
    '....XXXXXXXXXXXXXXXXXX..',
    '..XXXXXXXXXXXXXXXXXXXXX.',
    '.XXXXXXXXXXXXXXXXEEXXXXX',
    '.XXXXXXXXXXXXXXXXXXXXXXX',
    '.XXXXXXXXXXXXXXXXXXXXXXX',
    '..XXXXXXXXXXXXXXXXXXXXX.',
    'XXXXXXXXXXXXXXXXXXXXX...',
  ],
}

/* The food bowl: a rounded dish (outlined like the cat) heaped with kibble
   (`E`, always painted). It is drawn in front of the cat with its inside
   filled in the page colour (BOWL_FILL), so a head dipped into it vanishes
   behind the rim instead of showing through. */
const BOWL = [
  '..E.EE.EE.EE..',
  'XXXXXXXXXXXXXX',
  '.XXXXXXXXXXXX.',
  '..XXXXXXXXXX..',
]
/** Where the bowl sits, in sprite pixels from the cat's left edge once it has
    stopped: far enough right that only the mouth dips behind the rim. */
export const BOWL_AT = 20

export const CAT_W = SPRITES.walk1[0].length
export const CAT_H = SPRITES.walk1.length

/** [x, y] of every pixel to paint: the silhouette's outline plus its eyes.
    Shared with the window scene (PixelWindow). */
export function paint(rows) {
  const at = (x, y) => (rows[y]?.[x] ?? '.') !== '.'
  const out = []
  rows.forEach((row, y) => {
    ;[...row].forEach((c, x) => {
      if (c === '.') return
      const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1)
      if (edge || c === 'E') out.push([x, y])
    })
  })
  return out
}

export const CAT_FRAMES = Object.fromEntries(Object.entries(SPRITES).map(([k, rows]) => [k, paint(rows)]))
export const BOWL_W = BOWL[0].length
export const BOWL_H = BOWL.length
export const BOWL_PIXELS = paint(BOWL)
export const BOWL_FILL = BOWL.flatMap((row, y) => [...row].flatMap((c, x) => (c === 'X' ? [[x, y]] : [])))
