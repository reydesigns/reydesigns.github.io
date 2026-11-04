import catColor from '@assets/experiments/3d-drawing/textures/strawberry-cat/color.png'
import catBack from '@assets/experiments/3d-drawing/textures/strawberry-cat/back.png'
import catHeight from '@assets/experiments/3d-drawing/textures/strawberry-cat/height.png'
import catPoster from '@assets/experiments/3d-drawing/textures/strawberry-cat/poster.webp'
import faceColor from '@assets/experiments/3d-drawing/textures/self-portrait/color.png'
import faceBack from '@assets/experiments/3d-drawing/textures/self-portrait/back.png'
import faceHeight from '@assets/experiments/3d-drawing/textures/self-portrait/height.png'
import facePoster from '@assets/experiments/3d-drawing/textures/self-portrait/poster.webp'

/**
 * Textures + metadata extracted from the standalone Three.js toys. `maxH` is
 * the height map's peak in source units; `w`/`h` are the drawing's pixel size.
 * Both taken from the "smooth flat" variants — the soft-toy look, rather than
 * the stepped "layered" ones.
 *
 * `poster` is a still of the finished 3D drawing at rest, shown from the first
 * paint while three.js loads (Drawing3DLazy). It is rendered from the live
 * drawing by scripts/drawing-posters.mjs: re-run that after any change to the
 * look (style_config.json, these textures), or the crossfade will show it.
 */
export const STRAWBERRY_CAT = {
  textures: { color: catColor, back: catBack, height: catHeight },
  meta: { w: 806, h: 896, maxH: 111.75352173150821 },
  poster: catPoster,
  label: 'A strawberry cat drawing, extruded into 3D',
}

export const SELF_PORTRAIT = {
  textures: { color: faceColor, back: faceBack, height: faceHeight },
  meta: { w: 795, h: 818, maxH: 102.22304978644382 },
  poster: facePoster,
  label: 'A self-portrait drawing, extruded into 3D',
}
