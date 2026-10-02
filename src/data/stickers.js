/* ---------------------------------------------------------------------------
   The isometric room and its sticker sheet (StickerRoom.jsx).

   Everything is measured in art pixels — the pixels of Shreya's drawing —
   and drawn at one shared scale, so a sticker peeled off the sheet is exactly
   the size it should be in the room. Images and sizes come from
   scripts/prep-room.mjs (Assets/funzies/web/room/); the stickers drawn in code
   are in scripts/lib/room-art.mjs.

   Each sticker has:
     sheet   where it sits on the sheet (top-left, on a SHEET_W x SHEET_H page;
             on wide screens it's `tall`, on the upright TALL_W x TALL_H one)
     home    where it lands in the room if it's clicked or picked by keyboard
             rather than dragged (top-left, in the FRAME x FRAME room space)
     flat    rugs: always under everything else in the room
     rest    a small peel it shows before anyone touches it — one sticker
             does, so a touch screen (no hover) can tell they peel
--------------------------------------------------------------------------- */
import meta from '@assets/funzies/web/room/stickers.json'
import roomSrc from '@assets/funzies/web/room/room.png?url'

const files = import.meta.glob('@assets/funzies/web/room/stickers/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})

/** The room's square space, with the drawing (ROOM_W x ROOM_H) centred in it. */
export const FRAME = 392
// Size includes the room's white border (scripts/prep-room.mjs prints it).
export const ROOM = { src: roomSrc, w: 310, h: 384 }
ROOM.x = (FRAME - ROOM.w) / 2
ROOM.y = (FRAME - ROOM.h) / 2

/** The sheet's page: as wide as the room space, packed close; SHEET_PAD is
    its margin top and bottom. */
export const SHEET_W = FRAME
export const SHEET_H = 116
export const SHEET_PAD = 8

/** On wide screens the sheet stands upright beside the room instead: a
    TALL_W x TALL_H page, each sticker at its TALL spot (top-left). */
export const TALL_W = 128
export const TALL_H = 360
const TALL = {
  'flower-rug': [4, 4],
  bookshelf: [88, 4],
  couch: [4, 65],
  'cat-sitting': [65, 65],
  tv: [65, 91],
  bed: [4, 112],
  'lights-1': [60, 140],
  'cat-standing': [4, 164],
  'spider-rug': [4, 192],
  tree: [64, 192],
  'lights-2': [4, 228],
  cabinet: [60, 258],
  plant: [87, 258],
  table: [4, 280],
  lamps: [94, 300],
  'cat-bed': [50, 312],
  books: [4, 318],
  'wall-shelf': [94, 334],
}

const sticker = (id, name, sheet, home, extra) => {
  const src = files[`/Assets/funzies/web/room/stickers/${id}.png`]
  if (!src || !meta[id]) throw new Error(`stickers: missing ${id}`)
  return { id, name, src, ...meta[id], sheet, tall: TALL[id], home, ...extra }
}

export const STICKERS = [
  // Top row, left to right.
  sticker('bookshelf', 'Bookshelf', [8, 4], [74, 146]),
  sticker('flower-rug', 'Flower rug', [43, 4], [146, 288], { flat: true }),
  sticker('tv', 'TV on a stand', [126, 4], [236, 252]),
  sticker('couch', 'Couch', [180, 4], [84, 232]),
  sticker('lights-1', 'String lights', [240, 4], [70, 108]),
  sticker('tree', 'Potted tree', [295, 4], [290, 240]),
  sticker('plant', 'Potted plant', [333, 4], [290, 86]),
  // Tucked in underneath.
  sticker('cat-sitting', 'Sitting cat', [12, 92], [300, 112]),
  sticker('bed', 'Bed', [43, 64], [228, 74]),
  sticker('spider-rug', 'Spider-Man rug', [98, 64], [206, 316], { flat: true, rest: 5 }),
  sticker('table', 'Coffee table', [157, 52], [168, 298]),
  sticker('cat-standing', 'Standing cat', [157, 90], [140, 336]),
  sticker('cabinet', 'Cabinet', [202, 50], [200, 62]),
  sticker('lights-2', 'String lights', [228, 55], [236, 30]),
  sticker('lamps', 'Hanging lamps', [283, 69], [222, 198]),
  sticker('books', 'Stack of books', [310, 74], [176, 294]),
  sticker('cat-bed', 'Cat asleep in its bed', [333, 45], [112, 318]),
  sticker('wall-shelf', 'Wall shelf', [339, 75], [196, 34]),
]
