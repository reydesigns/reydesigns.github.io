# Portfolio revamp — design spec

Date: 2026-10-31
Status: draft, awaiting review

## Intent

Make the portfolio quicker to get through and more minimal: no forced loader
stop between the hero and the work, cleaner work cards, case studies that open
in place instead of navigating away, and a personal "shelf" of books and movies
on the Me page. Success = a visitor lands, scrolls once to the 2x2 grid, opens
any study in a pop-up and closes it without ever leaving `/`.

### What the client decided (2026-10-31)

| Topic | Decision |
|---|---|
| Landing loader screen | Remove from the scroll; hero scrolls smoothly straight to works |
| Loader animation | Keep the 4-frame wordmark as-is; same on phones; skipped under reduced motion |
| Loader on case study open | None — the pop-up appears immediately on click |
| Status text | "Master of Information @ UofT", bold, lower opacity, centred; no green dot |
| Work cards | Keep 2x2; thumbnail video fills the whole card (no white frame); top-left logo + name in burgundy like the Me page logos; hover shows a short description |
| Card aspect | 16:9 |
| Logos | Claude traces single-colour mask versions from the existing files |
| Case study pop-up | Shows only the clicked study; URL unchanged; top-left maximize → fullscreen, which becomes a minimize button |
| Phones | Pop-up opens fullscreen with a back button; `/` shows works under the hero with natural scrolling |
| Shore-Up | Not clickable yet |
| Shelf | Section at the bottom of the Me page; UI/look only, details filled in later by the client |
| Art section | **Out of scope** — deferred until the client returns to it. No page, no nav item |
| Delivery | Phased, one commit per phase on `main` |

### Assumptions (confirm during review)

1. **"Remove loader completely" + "keep animation as is" / "same on phone" / "skip
   under reduced motion" / "every full page load (a)"** is read as: the loader
   leaves the landing scroll, and the same animation survives only as a
   full-screen overlay on every full page load/refresh of any route. If the
   client meant "no loader anywhere", Phase B drops the overlay half.
2. **Status text "just show text"** = plain bold text, no pill background, no
   dot, no "currently:" prefix.
3. **Hover blurbs** are drafted by Claude from each article (one line, ~90–120
   chars) and flagged in the data file for the client to edit.

## Phase A — Status text

`src/pages/Landing.jsx:184-187` currently renders a surface pill with a pulsing
`.status-dot` and "currently: masters of information @uoft".

- Replace with a plain `<p>`: text `Master of Information @ UofT`, `font-bold`,
  `text-[var(--color-ink-muted)]`, opacity from a new token
  `--hero-status-opacity` in `tokens.css` (start at 0.55), `text-center`,
  `mx-auto`. Keep the existing top margin so the hero stays balanced.
- Remove the pill classes and the `.status-dot` span. Delete `.status-dot`
  CSS if nothing else uses it.

## Phase B — Loader out of the scroll; first-load overlay

### B1. Two-screen landing

- `Landing.jsx`: delete `LoaderStage` (import, `loaderRef`, block at ~198-207,
  dead `onSkip`). The document becomes hero → works.
- Render the works section on **all** widths (today phones get the hero only,
  `sequence = wide`). Phones scroll naturally; the auto-glide is desktop only.
- Replace `useScrollSequence` with a lean two-stage hook (same file, rewritten):
  - Desktop (≥64rem, fine pointer), no reduced motion: a downward scroll past
    ~0.15×vh from the hero calls `glideTo(worksRef)` via Lenis
    (`force: true`, ~1.1s, `--ease-brand`-like easing), guarded by the existing
    `selfScrollRef`. Re-arm when the reader returns to the top band (<0.1×vh).
  - No `lenis.stop()`, no timers, no visibility handler, no `__seqLocked`.
  - Reduced motion / phones: no glide; `stage` just mirrors position, so the
    nav highlights "works" when the grid is on screen.
  - Drop the reload-adopt branch: reload always lands at the hero.
- Nav "works" on `/` keeps gliding to the grid without changing the URL (all
  widths; on phones a plain smooth scroll).
- Re-check `Layout` `stickyHeader`, the footer's `--dock-clear` padding and
  `--footer-h` reservation on phones now that works renders there.
- Add `history.scrollRestoration = 'manual'` at the top of `main.jsx` so late
  browser restoration can't fire the glide behind the overlay.
- Tokens: delete `--loader-total-ms` and `--loader-loop-ms` once nothing reads
  them; keep `--loader-frame-ms`, `--loader-mark-*`, and `cssMs`.
- Update the stale "three screens" comments (Landing docblock, `App.jsx:45-48`,
  `Layout.jsx:60-83`, `global.css` loader notes, `NavDock` notes).

### B2. First-load overlay

- Extract from `LoaderStage.jsx` a reusable `src/components/LoaderMark.jsx`:
  the 4-frame stack (`CroppedMark` crop maths unchanged), decode-up-front, and
  a timer-driven frame clock that loops until told to rest, then snaps to
  frame 4. Delete `LoaderStage.jsx` and `.loader-mark` screen CSS.
- `src/components/BootOverlay.jsx`, mounted once in `App.jsx` outside
  `<Suspense>` / `<Routes>` so it covers every route, only on a full page load:
  - `position: fixed; inset: 0; z-index: 90` (below the custom cursor's 100),
    background `--color-bg`, mark centred, `role="status"` `aria-label="Loading"`.
  - Dismiss when **both**: a random minimum `500 + rand*1000` ms measured from
    `performance.now()` (computed once, StrictMode-safe via a module-level
    value) **and** an app-ready signal (the routed page's first commit, incl.
    the lazy CaseStudy chunk on a cold `/works/:slug`, plus
    `document.fonts.ready`). Hard cap ~3s so it can never stick.
  - Snap to the fully drawn frame, fade out ~250ms, then unmount. Timers via
    `setTimeout`, never rAF-only or `transitionend`-only (headless Chrome).
  - Scroll lock while up: `SmoothScroll` calls `lenis.stop()` right after
    creating Lenis when `html.is-booting` is set; the overlay removes the class
    and calls `window.__lenis?.start()` on dismiss. Without Lenis, lock
    `html { overflow: hidden }` via the same class.
  - Reduced motion: never rendered; `is-booting` never set.
  - Test hooks: `window.__bootLog` (`boot-start`, `boot-end` with `t`) and
    `data-boot-loader` on the root; keep `window.__loaderFrames`.
- No inline HTML splash in v1 (keeps one implementation). Revisit only if the
  blank moment before JS boots is visible on a throttled connection.

### B3. QA

- Rewrite `scripts/sequence.mjs` for the new flow: two-screen document, wheel
  down glides to works (desktop), no lock, nav "works" glides with URL still `/`,
  no glide under reduced motion, phone shows works with natural scroll, overlay
  present then gone within ~1.5s + fade + slack, overlay absent under reduced
  motion, overlay also on `/me` and at phone size. Drop the loader-lock,
  hand-off, replay, frame-slot and already-failing left-pill assertions.
- Make `verify.mjs`, `shot.mjs`, `scrollshots.mjs`, `navcheck.mjs` wait for
  `__bootLog` `boot-end` instead of fixed sleeps. Add `/works/lipton` to
  `verify.mjs` ROUTES.

## Phase C — Work cards

### C1. Logo masks

- New `scripts/prep-client-masks.mjs` (puppeteer + canvas, like
  `scripts/prep-me.mjs`) produces single-colour alpha PNGs in
  `Assets/brand/icons/clients/masks/` from `clients/originals/`:
  - **TMU-KPOP**: red brush lettering → alpha by red-on-white threshold.
  - **Shore-Up**: the white bow-tie mark + "SHORE UP" inside the teal disc →
    alpha from the white pixels, disc dropped.
  - **Lipton**: the white "Lipton" wordmark → alpha from the white pixels inside
    the red banner, sun disc dropped.
  - **HeySo**: the file is the hackathon "Participant" badge, not an org logo.
    Trace the badge silhouette with "PARTICIPANT" knocked out; flag for the
    client to replace with a real mark if they have one.
  - Trim to ink, keep transparency for shading like `Assets/brand/icons/experience/*`.
- Pull the `.me-tl__logo` recipe (me.css:85-94) into a shared `.logo-mask`
  utility (`background-color: var(--color-maroon); mask: var(--logo) center /
  contain no-repeat`) used by both `ExperienceTimeline` and the card. Each
  consumer sets its own height/opacity.

### C2. Card

- `caseStudies.js`: add `logoMask` (import from masks/) and `blurb` (drafted,
  marked `// draft — client to edit`). `logo`, `client`, `tag` and the
  Pixelta `title` stop rendering on the card; remove `logo` imports once unused.
- `WorkCard.jsx`:
  - Frameless shell: `relative overflow-hidden aspect-video
    rounded-[var(--radius-card)]! bg-[var(--color-maroon)] shadow-sm
    hover:shadow-md group`. Remove surface background, padding, `CardBody`,
    `@container`/`TITLE` and the stale comp-measurement comment block.
  - Thumbnail becomes `absolute inset-0` with `data-card-thumb`; poster img,
    video, preload and in-view play/pause logic unchanged (`object-cover`).
  - Top-left chip (≈0.875rem inset): `.logo-mask` span (≈1.5rem tall,
    `aria-hidden`) + the study name (`metaTitle`) in Kumbh Sans semibold,
    `--color-maroon` at full opacity, on a frosted light backing
    (`color-mix(in srgb, var(--color-surface) 82%, transparent)` +
    `backdrop-blur`, the `.nav-pop` recipe). New tokens `--card-chip-bg`,
    `--card-logo-h`.
  - Hover description: bottom band with `blurb`, frosted or light gradient,
    hidden by default (`opacity-0 translate-y-2`), revealed by
    `group-hover` and `group-focus-visible`, `duration-300
    ease-[var(--ease-brand)]`; hover reveal only under `(hover: hover)`. Not
    shown on touch (a tap opens the pop-up).
  - Accessible name on the link = the visible study name.
  - Shore-Up keeps its non-link `<article>` branch: chip shown, no
    description, no hover shadow, "Coming Soon" label and dim poster kept,
    `cursor-default`.
- `WorksGrid.jsx`: re-derive `GRID_FIT` for 16:9 cards (width capped so two
  rows + gaps fit between top bar and nav: `W = (16/9)·(100dvh − chrome) +
  gap`), keep gaps, `max-w-[82.0625rem]` and `lg:grid-cols-2`. Verify at
  1728×1117, 1920×1080, 1440×900, 1280×800 and 390×844. Use `data-card-thumb`
  instead of `firstElementChild`.

## Phase D — Case study pop-up

### D1. Shared body

- `src/pages/CaseStudy.jsx` exports `CaseStudyBody({ slug, variant:
  'page'|'modal', onClose, onSelect })` — nav + article, no `Layout`, no
  `useDocumentMeta` — and the existing `CaseStudy` page = meta + Layout + body,
  so `/works/:slug` is unchanged (incl. unknown-slug redirect). Both stay in
  the lazy chunk with `case-study.css`. Move `loadCaseStudy` into
  `src/lib/caseStudyChunk.js`, shared by `App.jsx` and the modal.
- `src/lib/scrollRoot.js`: `ScrollRootContext` (`null` = window, element =
  modal scroller) with helpers. Teach the window-bound helpers to use it:
  `useScrollMotion` (root scroll + `ResizeObserver`), `useScrollProgress`,
  `useActiveSection` (observer `root`, root metrics, `root.querySelector`),
  `scrollToSection` (`root.scrollTo` when a root is set, Lenis otherwise).
- Modal variant tweaks: `CaseStudyNav` home button and `Outro` "next case
  study" take callbacks instead of router links (`onClose`, `onSelect(next)`
  swaps the slug in place and scrolls to top). Override `--cs-wide-w` with
  container units inside the modal.

### D2. Modal shell

- `src/components/CaseStudyModal.jsx` (entry bundle, small), built on the
  `FunziePopup` native-`<dialog>` pattern: `showModal()`, Escape via `cancel`
  (with close animation), backdrop click closes in window mode, focus returns
  to the card, `setCursorHost(dialog)`, `data-lenis-prevent`.
- Structure: `dialog` > `.cs-modal__frame` (non-scrolling, carries a
  `transform` so the nav's `fixed` rail anchors to it) > control bar +
  `.cs-modal__scroll` (`overflow-y: auto; overscroll-behavior: contain;
  container-type: inline-size`) > `ScrollRootContext` > `Suspense`
  (maroon placeholder) > lazy `CaseStudyBody variant="modal"`.
- Sizes:
  - Desktop window: `min(92vw, 90rem)` × `calc(100dvh − 4rem)`, centred,
    rounded. Top-left **maximize** button (`aria-label="Maximize"`).
  - Fullscreen: `inset: 0`, no radius; the same button becomes **minimize**.
    Toggle animated with a transform/FLIP tween, not per-frame width/height.
  - Phones/tablets (<64rem): always fullscreen, top-left **back** chevron
    (`aria-label="Back to works"`, 44px target), no maximize.
- Scroll lock: remember `lenis.isStopped`, stop on open, restore the previous
  state on close (never blindly `start()`); without Lenis lock
  `html { overflow: hidden }`. Restore `document.title` if changed.
- History: URL never changes. On open push a same-pathname entry with
  `state: { caseStudy: slug }` (remember in a ref that this session pushed
  it) so the phone back gesture / Android back closes the modal. Close via
  `navigate(-1)` only if we pushed; otherwise replace state with null. On first
  mount clear any restored `caseStudy` state so a refresh doesn't reopen it.
- Mounted at App level, driven by `location.state.caseStudy`, so it works from
  both `/` and `/works`.
- Pause grid card videos while the modal is open (the modal hero plays the same
  file).

### D3. Grid wiring

- Card stays `<Link to="/works/:slug">` (cmd/middle-click and no-JS open the
  real page). `WorksGrid` intercepts plain left clicks and opens the modal
  instead of `morphCardToCaseStudy`. No reduced-motion early return — reduced
  motion gets the modal without animation. Warm the chunk on card
  `pointerenter`/`focus`.
- Delete `src/lib/cardMorph.js`, its import in `WorksGrid`, and `noteRoute`
  in `App.jsx`. `data-case-hero` may go if unused.

## Phase E — Shelf (UI only)

- Location: new full-width `<section>` at the bottom of `src/pages/Me.jsx`,
  after `.me-grid`. Files: `src/components/Shelf.jsx`, `src/data/shelf.js`
  (placeholder entries), `src/styles/shelf.css`.
- Look: two wooden-ish shelves in the site's palette (maroon/cream, pixel
  touches consistent with the fridge and cat), a visible plank edge and a soft
  shadow under each row.
- **Top shelf — books**: a compact row of spines with varied `height` and
  `width` from data, standing upright, title set vertically on the spine,
  spine colour from data. Hover/focus: the book tilts and lifts out slightly
  (transform only). Click/Enter: small popup with cover, rating (stars), and
  opinion text.
- **Bottom shelf — movies**: VHS cassettes in an "organized mess" — mostly
  upright, some lying in short stacks, small deterministic tilts (from data,
  not random per render). Each has a sticker label with the title. Hover/focus:
  the cassette slides out toward the viewer. Click/Enter: small popup with
  thumbnail, rating and opinion.
- Data shape (placeholders until the client fills them):
  - book: `{ id, title, author, cover, rating, opinion, spine: { color, height, width } }`
  - movie: `{ id, title, year, thumbnail, rating, opinion, cassette: { color, pose: 'up'|'flat', tilt } }`
- Popups: a small native-`<dialog>` window reusing the FunziePopup chrome
  (title bar, close dot), same lock/cursor discipline as D2. Phones: tap opens
  the popup; hover animations only under `(hover: hover)`; reduced motion
  disables the tilt/slide.
- Overflow: the shelf row scrolls horizontally if items exceed the width.
- Every item is a `<button>` with an accessible name (title).

## Out of scope

- Art section/page and its nav item (deferred by the client).
- Real book/movie content and cover images.
- Inline HTML splash before JS boots.

## Verification (every phase)

1. `npm run build` passes with no chunk-size warnings; the entry chunk does not
   absorb the case-study chunk.
2. With `npm run dev`: `node scripts/verify.mjs` and `node scripts/verify.mjs
   390 844`; screenshots via `scripts/shot.mjs` for the changed screens at
   1728×1117, 1440×900 and 390×844, plus reduced motion.
3. Phase B: rewritten `scripts/sequence.mjs` passes; `npm run preview` once to
   confirm `cssMs` timing on the minified bundle.
4. Phase D: manual checks — open/close with click, Escape, backdrop, phone
   back gesture; maximize/minimize; section links, active section and Lipton's
   scroll animations work inside the modal; `/works/heyso` direct load still a
   full page; refresh with the modal open lands on the page without it.

## Commits

One commit per phase on `main` (A → E), README updated in the last one.
No `Co-Authored-By: Claude` line (client preference).
