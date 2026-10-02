# Designer-toy restyle

The two landing-page drawings (self-portrait, strawberry cat) are given a
glossy vinyl-toy finish live in three.js. Nothing is pre-rendered and the
original PNGs in `Assets/experiments/3d-drawing/textures/` are never modified.

| File | Role |
|---|---|
| `src/data/style_config.json` | Every tunable value: gloss, lights, blush, smoothing |
| `src/lib/toyStyle.js` | Sorts each pixel of `color.png` into a region by colour and builds the gloss maps |
| `src/components/Drawing3D.jsx` | Applies the config: lights, studio reflections, smoothing, materials |
| `scripts/model-shots.mjs` | Close-up screenshots for before/after |
| `restyle/comparison.html` | Side-by-side gallery |

## Run

```bash
npm run dev                              # keep running
node scripts/model-shots.mjs after       # writes restyle/renders/*-after.png
open restyle/comparison.html
```

For fresh "before" shots, set `"enabled": false` in the config, run
`node scripts/model-shots.mjs before`, then set it back to `true`.

## Tweaking

Edit `src/data/style_config.json`; the dev server reloads on save.

- **Turn the whole look off:** `"enabled": false` (back to the original matte look).
- **Gloss per part:** each entry in `regions` has `roughness` (0 = mirror),
  `clearcoat` (0–1 lacquer layer) and `clearcoatRoughness`. Skin and blush
  also take `sheen` and `glow` for the soft warm skin glow.
- **Which colours count as which part:** each region's `match` takes
  `hue` (degrees, list of ranges), `sat` and `lum` (0–1). Regions are checked
  top to bottom; the first match wins, and `plastic` catches the rest.
  Set `"debugRegions": true` to paint each region in a flat colour and check
  the sorting (white eye-white, blue dark-gloss, magenta blush, orange skin,
  green hair-highlight, grey plastic).
- **Blush:** `blush.feather` (how far it spreads) and `blush.strength`.
- **Lights / reflections:** `lights.*.intensity`, `render.environmentIntensity`,
  `render.exposure`. `render.toneMapping` is `"Neutral"` or `"AgX"`.
- **Softness:** `geometry.smoothRadius` / `smoothPasses` round off the relief.

## Chunky mode

`"chunky": true` in `geometry` inflates the relief for a puffier toy look;
`chunkyGamma` (<1 puffs flatter areas up) and `chunkyDepth` control how much.
Set it back to `false` to keep the original proportions.

## Departures from the original brief

- Built in three.js rather than Blender: the models are generated in the
  browser from height maps, so Blender renders would not change the site.
- Drawn colours are kept (the brief's `#F2A98C` skin would recolour the
  self-portrait); only the finish changes.
- Tone mapping is Neutral, not AgX: AgX washed the drawn colours out.
- Drawn lines share the hair colour, so they are glossy along with the hair.
