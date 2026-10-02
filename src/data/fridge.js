import strawberryColor from '@assets/me/web/magnets/strawberry/color.png'
import strawberryBack from '@assets/me/web/magnets/strawberry/back.png'
import strawberryHeight from '@assets/me/web/magnets/strawberry/height.png'
import spideyColor from '@assets/me/web/magnets/spidey/color.png'
import spideyBack from '@assets/me/web/magnets/spidey/back.png'
import spideyHeight from '@assets/me/web/magnets/spidey/height.png'
import catColor from '@assets/me/web/magnets/cat/color.png'
import catBack from '@assets/me/web/magnets/cat/back.png'
import catHeight from '@assets/me/web/magnets/cat/height.png'
import meta from '@assets/me/web/magnets/meta.json'
import waterfall from '@assets/me/web/photos/waterfall.jpg'
import helmet from '@assets/me/web/photos/helmet.jpg'
import catDesk from '@assets/me/web/photos/cat-desk.jpg'

/**
 * The Me page's fridge door: three photos, and the 3D magnets holding them up.
 * All built by scripts/prep-me.mjs — the magnets are drawn in code
 * (scripts/lib/magnet-art.mjs), extruded with the same textures as the
 * landing page's drawings.
 */
export const MAGNETS = {
  strawberry: {
    textures: { color: strawberryColor, back: strawberryBack, height: strawberryHeight },
    meta: meta.strawberry,
    label: 'A strawberry fridge magnet',
  },
  spidey: {
    textures: { color: spideyColor, back: spideyBack, height: spideyHeight },
    meta: meta.spidey,
    label: 'A Spider-Man head fridge magnet',
  },
  cat: {
    textures: { color: catColor, back: catBack, height: catHeight },
    meta: meta.cat,
    label: 'An orange cat head fridge magnet',
  },
}

export const PHOTOS = {
  waterfall: { src: waterfall, alt: 'Shreya with her arms up on the rocks below a waterfall' },
  helmet: { src: helmet, alt: 'Shreya in a racing helmet, strapped into a race car, throwing a peace sign' },
  catDesk: { src: catDesk, alt: 'An orange cat asleep across the keyboard on Shreya’s desk' },
}
