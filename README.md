# reydesigns.com

Personal design portfolio for Shreya Rudrapatna — *rey designs*.

## Setup

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # production bundle -> dist/
npm run preview  # serve the built bundle
```

Requires Node 18+. This machine runs Node 24 LTS installed at `~/.local/node`,
symlinked into `~/.local/bin` (already on `PATH`). Nothing was installed
system-wide; remove it by deleting `~/.local/node` and the three symlinks.

## Stack

| Concern | Choice |
|---|---|
| Build | Vite 7 |
| UI | React 19 + React Router 7 |
| Styles | Tailwind 4 (CSS-first `@theme`) |
| Scroll animation | GSAP + ScrollTrigger |
| Smooth scrolling | Lenis |

No hosting is configured — the site runs on localhost only, by request.

## Where assets live

Everything is under `Assets/`, organised by project, then by media type.
Design sources and web-ready files sit side by side; only web-ready files are
ever imported, so the heavy originals never reach the bundle.

```
Assets/
├── brand/
│   ├── animation/      sparkle, monogram, loader wordmark, pika (+ -still.png)
│   ├── fonts/          kumbh-sans/ (woff2, OFL), pixelta/ (ttf)
│   └── icons/          nav-works, nav-funzies, nav-me-frame
├── me/                 portrait.heic (original), portrait-avatar.jpg (web)
├── resume/             resume 2026.pdf
├── site-design/images/ Figma comps — the layout source of truth
├── heyso/
│   ├── images/         case-study.png (186 MB source) + slices/ (9 exports)
│   └── video/          walkthrough-1080p.webm
├── lipton/            lipton tea case study.png (94 MB comp — never import)
│   ├── Images/         client exports + web/ (WebP, made by scripts/prep-lipton-images.mjs)
│   └── video/          walkthrough-1080p.mp4
├── tmu-kpop/          tmukpop case study.png (148 MB comp — never import)
│   ├── images/         client exports + web/ (WebP, made by scripts/prep-tmu-images.mjs)
│   └── video/          walkthrough-1080p.mp4
├── shore-up/images/    app-screenshot.png (static thumbnail, no video)
└── experiments/        3D drawing toys (unassigned)
```

**Never import `heyso/images/case-study.png`** (186 MB) or `me/portrait.heic`
(browsers can't decode HEIC). Use the `slices/` exports and
`portrait-avatar.jpg` instead.

### Deriving assets

The `-still.png` files are every GIF frame composited together — what a draw-on
animation looks like once finished. They back `prefers-reduced-motion` and let
`GifMark` freeze a GIF after one pass. The case-study slices were cut from the
186 MB comp by detecting card regions against the page margin (the cards are
only 4–10 luminance levels above the background, so thresholding doesn't work).

## Design tokens

`src/styles/tokens.css` is the single source of truth. Every colour was
measured from the comps by histogram. **Use only these tokens — no raw hex
elsewhere.**

Two things worth knowing before editing type:

- **Kumbh Sans has no italic cut.** The slanted hero in the comp is a Figma
  synthetic oblique; `.font-oblique` reproduces it with a skew.
- **Pixelta has no quote or dash glyphs** (`" ' “ ” ‘ ’ – — …`). Quotes set in
  Pixelta silently fall back to another font. Keep them in Kumbh Sans via
  `.quote-mark`, and write ellipses as three periods.

## Adding a new case study

Case studies are data-driven; adding one should not need new components.

1. Drop assets in `Assets/<slug>/` following the structure above
   (`video/walkthrough-1080p.mp4`, `images/`).
2. Add an entry to `src/data/caseStudies.js` — slug, title, client, tag,
   thumbnail video, and the ordered list of sections. Section ids drive both
   the left nav and the scroll targets, so they must match.
3. That's it. `/works` picks up the card and `/works/<slug>` renders the page.

## Project layout

```
src/
├── components/   TopBar, SparkleGrid, GifMark, Layout
├── lib/          SmoothScroll (Lenis), useReducedMotion
├── pages/        Landing, Works, CaseStudy, Funzies, Me
└── styles/       global.css, tokens.css, fonts.css
```

## Status

- [x] **Phase 1** — setup, tokens, fonts, global layout, sparkle grid, top bar
- [x] **Phase 2** — landing hero + scramble text
- [x] **Phase 3** — scroll sequence (hero → loader ×2 → Works) + nav transition
- [x] **Phase 4** — Works page and cards
- [x] **Phase 5** — HeySo case study + fixed side nav
- [x] **Phase 6** — Funzies and Me shells (awaiting screenshots)
- [ ] Phase 7 — QA (scripted checks green; side-by-side comp review outstanding)

## QA scripts

All four drive a real browser over the DevTools protocol. Do **not** use
`chrome --headless --screenshot` — it throttles `requestAnimationFrame` and
`IntersectionObserver` to nothing, so animations never run, lazy content never
initialises, and the capture lies.

```bash
node scripts/verify.mjs [w] [h]        # every route: console errors + overflow
node scripts/sequence.mjs [dir] [w] [h] [reduced]   # the landing scroll sequence
node scripts/shot.mjs <route> <out.png> [w] [h] [waitMs] [reduced]
node scripts/scrollshots.mjs <route> <prefix> <fractions> [w] [h]
```
