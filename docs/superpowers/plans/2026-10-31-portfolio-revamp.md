# Portfolio Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the five approved phases: status text, loader-out-of-scroll + first-load overlay, full-bleed work cards, in-place case-study pop-up, and the Me-page shelf UI.

**Architecture:** Vite + React 19 SPA on GitHub Pages. The landing scroll hook shrinks to two stages; the loader's frame animation moves into a reusable `LoaderMark` shown by an App-level `BootOverlay`. Case studies render through a shared `CaseStudyBody` hosted either by the existing route page or by an App-level native-`<dialog>` modal, with a `ScrollRootContext` so scroll-driven helpers work inside the modal's scroller.

**Tech Stack:** React 19, react-router-dom 7, Tailwind v4 (`@tailwindcss/vite`), Lenis 1.3, GSAP 3, puppeteer-core (QA scripts against `npm run dev` on :5173, macOS Chrome).

**Spec:** `docs/superpowers/specs/2026-10-31-portfolio-revamp-design.md`

## Global Constraints

- Status copy, exact: `Master of Information @ UofT`.
- Boot overlay minimum: `500 + Math.random() * 1000` ms from `performance.now()`; hard cap 3000 ms; fade 250 ms; `z-index: 90` (custom cursor is 100).
- Phone/tablet breakpoint for the modal and the scroll glide: below `WIDE` = `(min-width: 64rem)` (`src/lib/useMediaQuery.js:25`).
- Card aspect: 16:9 (`aspect-video`).
- Burgundy = `var(--color-maroon)` (#440000) at full opacity on cards.
- Every CSS time token read from JS goes through `cssMs` (`src/lib/loaderTiming.js`) — the minifier rewrites `ms` → `s`.
- Timers via `setTimeout`, never rAF-only or `transitionend`-only (headless Chrome starves rAF).
- Reduced motion: no boot overlay, no scroll glide, no hover tilts; modal still opens (no animation).
- No new runtime dependencies.
- Commits: one per phase on `main`; **no** `Co-Authored-By: Claude` line. Push only when the client asks.
- Art page/nav item: out of scope — do not add.

## Review Focus

1. **Refresh with the modal open** → page reloads without the modal (restored `history.state.caseStudy` is cleared). Test in Task 7.
2. **Phone back gesture / Android back with the modal open** → modal closes, URL still `/`, visitor stays on the site. Test in Task 7.
3. **Cold deep load of `/works/lipton`** → overlay stays until the lazy chunk has rendered its `h1`; no blank page after the fade. Test in Task 3.
4. **Reduced motion** → no overlay, no glide, and clicking a card still opens the modal. Tests in Tasks 2, 3, 7.
5. **Resizing across 64rem with the modal open** → window mode switches to fullscreen + back button and back again; no stuck size. Test in Task 7.

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/lib/browser.mjs` (create) | Shared puppeteer launch, `openPage(path, {w,h,reduced})`, `waitBoot(page)`, `assert(cond, msg)` + exit code |
| `scripts/checks/landing.mjs` (create, replaces `scripts/sequence.mjs`) | Phase A + B checks |
| `scripts/checks/cards.mjs` (create) | Phase C checks |
| `scripts/checks/modal.mjs` (create) | Phase D checks |
| `scripts/checks/shelf.mjs` (create) | Phase E checks |
| `scripts/prep-client-masks.mjs` (create) | Trace single-colour alpha masks from `Assets/brand/icons/clients/originals/` |
| `src/lib/useScrollSequence.js` (rewrite) | Two-stage hero ↔ works watcher |
| `src/components/LoaderMark.jsx` (create, from `LoaderStage.jsx`) | 4-frame mark + frame clock |
| `src/components/BootOverlay.jsx` (create) | First-load overlay + `bootReady()` signal |
| `src/lib/scrollRoot.js` (create) | `ScrollRootContext` + root-aware scroll helpers |
| `src/lib/caseStudyChunk.js` (create) | `loadCaseStudy()` shared lazy import |
| `src/components/CaseStudyModal.jsx` (create) | Dialog shell, sizes, history, lock |
| `src/components/Shelf.jsx`, `src/data/shelf.js`, `src/styles/shelf.css` (create) | Shelf UI + placeholder data |
| `src/components/ShelfPopup.jsx` (create) | Small dialog for a book/movie |

---

## Phase A — Status text

### Task 1: QA helper + status text

**Files:**
- Create: `scripts/lib/browser.mjs`, `scripts/checks/landing.mjs`
- Modify: `src/pages/Landing.jsx:184-187`, `src/styles/tokens.css` (near `--hero-label-opacity`, line ~32), `src/styles/global.css` (`.status-dot` rules)

**Interfaces:**
- Produces: `launch()`, `openPage(browser, path, { w = 1728, h = 1117, reduced = false, wait = true })` → `{ page, errors }` (`wait: false` = goto with `domcontentloaded` and skip `waitBoot`), `waitBoot(page)` (no-op until Task 3; then waits for `window.__bootLog` `boot-end` or absence of `[data-boot-loader]`), `check(name, cond, detail)`, `done()` (exits 1 if any check failed). All later check scripts use these.

- [ ] **Step 1: Write `scripts/lib/browser.mjs`** with the launch args copied from `scripts/verify.mjs:17-27` and the interface above.

- [ ] **Step 2: Write the failing check** in `scripts/checks/landing.mjs`:

```js
const { page } = await openPage(browser, '/')
const status = await page.evaluate(() => {
  const p = [...document.querySelectorAll('p')].find((el) => el.textContent.includes('Master of Information'))
  if (!p) return null
  const cs = getComputedStyle(p)
  return { text: p.textContent.trim(), weight: Number(cs.fontWeight), opacity: Number(cs.opacity),
           align: cs.textAlign, bg: cs.backgroundColor, dot: !!document.querySelector('.status-dot') }
})
check('status text', status?.text === 'Master of Information @ UofT', status?.text)
check('status bold', status?.weight >= 700)
check('status muted', status?.opacity > 0 && status?.opacity < 1)
check('status centred', status?.align === 'center')
check('no pill background', status?.bg === 'rgba(0, 0, 0, 0)')
check('no dot', status?.dot === false)
```

- [ ] **Step 3: Run** `npm run dev` (background) then `node scripts/checks/landing.mjs` → Expected: FAIL on `status text`.

- [ ] **Step 4: Implement.** Add `--hero-status-opacity: 0.55;` to `tokens.css`. Replace the pill `<p>` with a plain `<p>` (`mx-auto mt-[clamp(3rem,10vh,8rem)] text-center font-bold text-[length:var(--text-body)] text-[var(--color-ink-muted)] opacity-[var(--hero-status-opacity)]`) containing the exact copy. Delete the dot span and, if unused elsewhere (`grep -rn status-dot src`), the `.status-dot` CSS.

- [ ] **Step 5: Run** `node scripts/checks/landing.mjs` → PASS; `npm run build` → succeeds.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/browser.mjs scripts/checks/landing.mjs src/pages/Landing.jsx src/styles/tokens.css src/styles/global.css
git commit -m "Landing: status line reads Master of Information @ UofT, plain bold text"
```

---

## Phase B — Loader out of the scroll; first-load overlay

### Task 2: Two-screen landing with smooth glide

**Files:**
- Modify: `src/pages/Landing.jsx` (remove LoaderStage import/ref/block ~6, 68, 77, 92, 198-207; drop `sequence = wide` gate for rendering works; docblock), `src/lib/useScrollSequence.js` (rewrite), `src/main.jsx`, `src/components/Layout.jsx` (stickyHeader/works padding on phones; docblock 60-83), `src/App.jsx` (comment 45-48), `src/styles/global.css` (loader comments 13-17, `.loader-mark` 108-122), `scripts/checks/landing.mjs`
- Delete: `scripts/sequence.mjs` (superseded); update `README.md` QA section reference later in Task 9

**Interfaces:**
- Produces: `useScrollSequence({ glide: boolean, worksRef }) → { stage: 'hero' | 'works', toWorks: () => void }`. `glide` = wide && fine pointer && !reduced. `toWorks` glides (Lenis `scrollTo`, `force: true`, duration 1.1) or, without Lenis, `window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' })`.
- Keeps `window.__seqLog` breadcrumbs (`{ event: 'glide' | 'stage', t }`).

- [ ] **Step 1: Add failing checks** to `landing.mjs` (desktop 1728×1117, phone 390×844, reduced):

```js
// desktop
const doc = await page.evaluate(() => document.documentElement.scrollHeight / innerHeight)
check('two screens', doc < 2.6, doc)                       // was ~3
check('no loader screen', !(await page.$('[data-stage="loader"]')))
await page.mouse.wheel({ deltaY: 300 }); await sleep(1800)
const y = await page.evaluate(() => scrollY / innerHeight)
check('glided to works', Math.abs(y - worksTopRatio) < 0.05, y)   // worksTopRatio read from [data-stage=works] offsetTop/innerHeight
check('not locked', await page.evaluate(() => !window.__lenis?.isStopped && getComputedStyle(document.documentElement).overflow !== 'hidden'))
// nav works button from top
await page.click('[data-flip-id="nav-works"]'); await sleep(1800)
check('nav works glides, URL unchanged', (await page.evaluate(() => location.pathname)) === '/')
// phone
check('phone renders works', !!(await phone.$('[data-stage="works"]')))
await phone.mouse.wheel({ deltaY: 200 }); await sleep(1200)
check('phone: no auto-glide', (await phone.evaluate(() => scrollY)) < 400)
// reduced
await reducedPage.mouse.wheel({ deltaY: 300 }); await sleep(1200)
check('reduced: no glide', (await reducedPage.evaluate(() => (window.__seqLog ?? []).some((e) => e.event === 'glide'))) === false)
// reload lands at top
await page.evaluate(() => scrollTo(0, innerHeight)); await page.reload({ waitUntil: 'networkidle2' }); await waitBoot(page)
check('reload at hero', (await page.evaluate(() => scrollY)) < 5)
```

- [ ] **Step 2: Run** `node scripts/checks/landing.mjs` → FAIL on `two screens`.

- [ ] **Step 3: Rewrite `useScrollSequence`** to the interface above: trigger at `scrollY > 0.15 * innerHeight` while `stage === 'hero'` and not self-scrolling → `toWorks()`; re-arm when `scrollY < 0.1 * innerHeight`; when `!glide`, only map position → stage (works when the works section top ≤ 0.5×vh). No `lenis.stop`, timers, visibility handler or reload-adopt.

- [ ] **Step 4: Update `Landing.jsx`**: delete loader pieces; render the works `<section data-stage="works">` on all widths; call the hook with `glide`; keep the nav "works" interception (`onNavigate`) on all widths. Add `if ('scrollRestoration' in history) history.scrollRestoration = 'manual'` at the top of `main.jsx`. Fix `Layout` so the phone works section clears the footer/nav (`--dock-clear`) and the top bar; update stale "three screens" comments in the files listed.

- [ ] **Step 5: Run** `node scripts/checks/landing.mjs` → PASS; `node scripts/verify.mjs` and `node scripts/verify.mjs 390 844` → 0 failures; `node scripts/shot.mjs / $SCRATCH/phone.png 390 844` and inspect the works grid under the hero.

(No commit — Phase B commits after Task 3.)

### Task 3: LoaderMark + BootOverlay

**Files:**
- Create: `src/components/LoaderMark.jsx`, `src/components/BootOverlay.jsx`
- Delete: `src/components/LoaderStage.jsx`
- Modify: `src/App.jsx` (mount overlay outside `<Suspense>`), `src/lib/SmoothScroll.jsx`, `src/styles/global.css` (`.is-booting`, overlay styles), `src/styles/tokens.css` (delete `--loader-total-ms`, `--loader-loop-ms`; add `--boot-fade-ms: 250ms`), `src/lib/loaderTiming.js` (drop `loaderTotalMs`), `src/pages/*.jsx` (call `bootReady()`), `index.html` (`<html class="is-booting">` + inline `<script>` removing it under reduced motion), `scripts/verify.mjs`, `scripts/shot.mjs`, `scripts/scrollshots.mjs`, `scripts/navcheck.mjs`, `scripts/checks/landing.mjs`, `scripts/lib/browser.mjs`

**Interfaces:**
- Produces: `<LoaderMark playing: boolean, rest: boolean />` (loops frames every `--loader-frame-ms` while `playing && !rest`; `rest` snaps to frame 4); `<BootOverlay />`; `bootReady(): void` exported from `BootOverlay.jsx` (idempotent; marks the routed page as committed). `window.__bootLog: Array<{ event: 'boot-start' | 'boot-end', t: number }>`; overlay root has `data-boot-loader`.
- `waitBoot(page)` in `scripts/lib/browser.mjs` now waits (≤5 s) for `boot-end` or no `html.is-booting`.

- [ ] **Step 1: Add failing checks** to `landing.mjs`:

```js
for (const [path, w, h] of [['/', 1728, 1117], ['/me', 1728, 1117], ['/', 390, 844], ['/works/lipton', 1728, 1117]]) {
  const { page: p } = await openPage(browser, path, { w, h, wait: false })
  check(`${path}@${w} overlay shown`, !!(await p.$('[data-boot-loader]')))
  await p.waitForFunction(() => window.__bootLog?.some((e) => e.event === 'boot-end'), { timeout: 5000 })
  const ms = await p.evaluate(() => { const l = window.__bootLog; return l.find((e) => e.event === 'boot-end').t - l.find((e) => e.event === 'boot-start').t })
  check(`${path}@${w} duration 500–3000ms`, ms >= 450 && ms <= 3100, ms)
  await sleep(400)
  check(`${path}@${w} overlay gone`, !(await p.$('[data-boot-loader]')))
  check(`${path}@${w} unlocked`, await p.evaluate(() => !document.documentElement.classList.contains('is-booting')))
}
check('lipton h1 rendered after boot', !!(await liptonPage.$('h1')))
// reduced motion
check('reduced: no overlay', !(await reducedPage.$('[data-boot-loader]')))
// durations vary across 5 loads (random): max - min > 100ms
```

- [ ] **Step 2: Run** → FAIL on `overlay shown`.

- [ ] **Step 3: Extract `LoaderMark.jsx`** from `LoaderStage.jsx`: keep the four WebP imports, `CroppedMark` crop box `[0, 0.2712, 0.9967, 0.7224]` / canvas `[3000, 2500]`, `useDecodedFrames`, and the timer-based clock (elapsed-time-derived index, `window.__loaderFrames` breadcrumbs) — changed to loop until `rest`. Delete `LoaderStage.jsx` and `.loader-mark` screen CSS.

- [ ] **Step 4: Implement `BootOverlay.jsx`.** Module-level `const MIN_MS = 500 + Math.random() * 1000` and `const START = performance.now()` (StrictMode-safe). Dismiss at `max(MIN_MS − elapsed, 0)` after both `bootReady()` has fired and `document.fonts.ready` resolved, or at 3000 ms total regardless. On dismiss: set `rest`, log `boot-end`, remove `html.is-booting`, `window.__lenis?.start()`, then unmount after `cssMs('--boot-fade-ms', 250)` via `setTimeout`. Render `null` when `html.is-booting` is absent at mount (reduced motion / client navigation). Markup: `fixed inset-0 z-[90] grid place-items-center bg-[var(--color-bg)]`, `role="status" aria-label="Loading"`, `data-boot-loader`, opacity transition on dismiss.

- [ ] **Step 5: Wire it.** `index.html`: `<html lang="en" class="is-booting">` plus inline script `if (matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.remove('is-booting')`. `global.css`: `html.is-booting { overflow: hidden }`. `SmoothScroll`: right after `new Lenis(...)`, `if (document.documentElement.classList.contains('is-booting')) lenis.stop()`. Mount `<BootOverlay />` in `App.jsx` beside `<RouteEffects />`, outside `<Suspense>`. Call `bootReady()` in a `useEffect` of `Landing`, `Works`, `Funzies`, `Me`, and `CaseStudy` (after the article renders, incl. the shell branch).

- [ ] **Step 6: Replace fixed sleeps** in `verify.mjs`, `shot.mjs`, `scrollshots.mjs`, `navcheck.mjs` with a wait for `boot-end` (timeout 5 s) followed by their existing settle delay; add `/works/lipton` to `verify.mjs` ROUTES.

- [ ] **Step 7: Run** `node scripts/checks/landing.mjs` → PASS; `node scripts/verify.mjs`, `node scripts/verify.mjs 390 844` → 0 failures; `npm run build && npm run preview -- --port 5173` then `node scripts/checks/landing.mjs` again against the minified bundle → PASS (cssMs timing).

- [ ] **Step 8: Commit (Phase B)**

```bash
git add -A src scripts index.html
git commit -m "Landing: loader leaves the scroll; hero glides to works; wordmark plays as a first-load overlay"
```

---

## Phase C — Work cards

### Task 4: Client logo masks + shared `.logo-mask`

**Files:**
- Create: `scripts/prep-client-masks.mjs`, `Assets/brand/icons/clients/masks/{heyso,tmu-kpop,lipton,shore-up}.png`
- Modify: `src/styles/global.css` (add `.logo-mask`), `src/styles/me.css:85-94`, `src/components/ExperienceTimeline.jsx` (use `.logo-mask`)

**Interfaces:**
- Produces: mask PNGs (white/black irrelevant — alpha carries the shape, trimmed to ink, ≥256px tall); CSS class `.logo-mask` = `background-color: var(--color-maroon); -webkit-mask: var(--logo) center / contain no-repeat; mask: var(--logo) center / contain no-repeat;` consumers set `--logo: url(...)`, height and opacity.

- [ ] **Step 1: Write the script** (puppeteer page + `<canvas>`, same Chrome path as `scripts/prep-me.mjs:23`). Per-logo alpha rule on `originals/*.png`:
  - `tmu-kpop`: alpha = redness `clamp((r − max(g,b)) / 120, 0, 1)`.
  - `shore-up`, `lipton`: alpha = whiteness `clamp((min(r,g,b) − 200) / 55, 0, 1)` restricted to pixels inside the coloured shape (disc/banner bbox), so the page-white surround is excluded.
  - `heyso`: alpha = 1 for non-background badge pixels (distance from the corner colour > 40), minus whiteness (knocks out "PARTICIPANT").
  - Trim transparent margins, write PNG.

- [ ] **Step 2: Run** `node scripts/prep-client-masks.mjs` and view each output (Read tool) on a maroon fill via `node scripts/shot.mjs` of a scratch HTML — each must read as the mark, not a blob. Iterate thresholds until it does.

- [ ] **Step 3: Move the mask recipe** to `.logo-mask` in `global.css`; make `.me-tl__logo` keep only its grid placement, height and `opacity: var(--tl-logo-opacity)`, and add `logo-mask` to its element in `ExperienceTimeline.jsx`.

- [ ] **Step 4: Verify** `node scripts/shot.mjs /me $SCRATCH/me.png` matches `git stash`-ed baseline visually (timeline logos unchanged).

(No commit — Phase C commits after Task 5.)

### Task 5: Full-bleed 16:9 card + GRID_FIT

**Files:**
- Create: `scripts/checks/cards.mjs`
- Modify: `src/data/caseStudies.js`, `src/components/WorkCard.jsx`, `src/components/WorksGrid.jsx:45,51-73`, `src/styles/tokens.css` (`--card-chip-bg`, `--card-logo-h`)

**Interfaces:**
- Consumes: `.logo-mask`, mask PNGs (Task 4).
- Produces: `CASE_STUDIES[i].logoMask: string` (URL), `CASE_STUDIES[i].blurb: string`; card DOM: `a[data-card][href^="/works/"]` (published) / `article[data-card]` (coming soon), `[data-card-thumb]`, `[data-card-chip]`, `[data-card-blurb]`. Task 7 relies on `data-card-thumb` and the `<Link>` href.

- [ ] **Step 1: Write failing checks** in `cards.mjs` (at 1728×1117, 1920×1080, 1440×900, 1280×800, 390×844):

```js
const cards = await page.$$eval('[data-card]', (els) => els.map((el) => {
  const r = el.getBoundingClientRect(), t = el.querySelector('[data-card-thumb]').getBoundingClientRect()
  const chip = el.querySelector('[data-card-chip]'), blurb = el.querySelector('[data-card-blurb]')
  return { ratio: r.width / r.height, fullBleed: Math.abs(t.width - r.width) < 1 && Math.abs(t.height - r.height) < 1,
           chipColor: chip && getComputedStyle(chip.querySelector('[data-card-name]')).color,
           blurbOpacity: blurb ? Number(getComputedStyle(blurb).opacity) : null, tag: el.tagName, bottom: r.bottom }
}))
check('4 cards', cards.length === 4)
check('16:9', cards.every((c) => Math.abs(c.ratio - 16 / 9) < 0.02))
check('full-bleed thumb', cards.every((c) => c.fullBleed))
check('maroon name', cards.every((c) => c.chipColor === 'rgb(68, 0, 0)'))
check('blurb hidden by default', cards.filter((c) => c.tag === 'A').every((c) => c.blurbOpacity === 0))
check('shore-up not a link', cards[3].tag === 'ARTICLE')
// wide viewports: whole grid above the nav pill
check('grid fits', w < 1024 || Math.max(...cards.map((c) => c.bottom)) <= navTop - 8)
await page.hover('a[data-card]'); await sleep(400)
check('blurb on hover', (await page.$eval('a[data-card] [data-card-blurb]', (b) => Number(getComputedStyle(b).opacity))) === 1)
check('accessible name', (await page.$$eval('a[data-card]', (as) => as.every((a) => a.textContent.trim().length > 0))))
```

- [ ] **Step 2: Run** `node scripts/checks/cards.mjs` → FAIL on `16:9`.

- [ ] **Step 3: Data.** In `caseStudies.js` import the four masks as `logoMask` and add `blurb` per study, each marked `// draft — client to edit`, drafted from the article intros (HeySo: group-planning app designed in a day at the WITM hackathon; TMU-KPOP: web revamp for the club; Lipton: UI revamp of the mobile experience; Shore-Up: hackathon project, coming soon). Remove the `logo` imports and fields once nothing reads them (`grep -rn "\.logo\b" src`).

- [ ] **Step 4: Card.** Shell per spec §C2 (`relative overflow-hidden aspect-video rounded-[var(--radius-card)]! bg-[var(--color-maroon)] shadow-sm hover:shadow-md group`, `data-card`). Thumbnail → `absolute inset-0` + `data-card-thumb`, poster/video `object-cover`, playback logic untouched. Chip (`data-card-chip`, top-left, `bg-[var(--card-chip-bg)] backdrop-blur`) with `<span class="logo-mask" style={{'--logo': `url(${logoMask})`}} aria-hidden>` at `h-[var(--card-logo-h)]` (1.5rem) and `<span data-card-name>` = `metaTitle`. Blurb band (`data-card-blurb`, bottom) `opacity-0 translate-y-2 [@media(hover:hover)]:group-hover:opacity-100 group-focus-visible:opacity-100 ...translate-y-0 duration-300 ease-[var(--ease-brand)]`. Delete `CardBody`, `@container`/`TITLE`, and the comp-measurement comment. Coming-soon branch: `<article data-card>` with chip, dim poster, "Coming Soon", `cursor-default`, no blurb.

- [ ] **Step 5: Grid.** Recompute `GRID_FIT` for 16:9: with two rows, row gap 26px, and the measured vertical chrome `C` (top bar + nav clearance, currently encoded in the 277px term), two rows of `cardW·9/16` plus the gap must fit `100dvh − C`, so grid width `W = (16/9)·(100dvh − C − 26px) + 75px` → write as `lg:max-w-[min(82.0625rem,calc(...))]`; keep `max-w-[82.0625rem]`, gaps and `lg:grid-cols-2`. Replace `link.firstElementChild` with `link.querySelector('[data-card-thumb]')`.

- [ ] **Step 6: Run** `node scripts/checks/cards.mjs` → PASS at all five sizes; `node scripts/checks/landing.mjs` still PASS; `node scripts/shot.mjs /works $SCRATCH/works.png` and view it.

- [ ] **Step 7: Commit (Phase C)**

```bash
git add -A src scripts Assets/brand/icons/clients/masks
git commit -m "Works: full-bleed 16:9 cards with a maroon logo chip and hover blurb"
```

---

## Phase D — Case study pop-up

### Task 6: Shared body + scroll root

**Files:**
- Create: `src/lib/scrollRoot.js`, `src/lib/caseStudyChunk.js`
- Modify: `src/pages/CaseStudy.jsx`, `src/lib/sectionScroll.js`, `src/lib/useScrollMotion.js`, `src/components/CaseStudyNav.jsx:58-86`, `src/components/caseStudyParts.jsx:202-220`, `src/App.jsx:14-15`, `src/styles/case-study.css`

**Interfaces:**
- Produces:
  - `ScrollRootContext` (React context; value `HTMLElement | null`, null = window); `useScrollRoot(): HTMLElement | null`; `rootMetrics(root) → { scrollTop, scrollHeight, clientHeight, top }`; `onRootScroll(root, fn) → unsubscribe` (also fires on root `ResizeObserver`).
  - `loadCaseStudy(): Promise<module>` from `src/lib/caseStudyChunk.js`.
  - `export function CaseStudyBody({ slug: string, variant: 'page' | 'modal', onClose?: () => void, onSelect?: (slug: string) => void })` in `src/pages/CaseStudy.jsx` (same chunk as `CaseStudy`).
  - `CaseStudyNav({ sections, ids, onHome? })` — when `onHome` is set, HomeButton is a `<button>`.
  - `Outro({ next, onSelect? })` — when `onSelect` is set, a `<button data-cs-next>` calling `onSelect(next.slug)`.
  - `scrollToSection(id, { reduced, root })`, `useActiveSection(ids)` and `useScrollProgress()` read the root from context.

- [ ] **Step 1: Failing check** — add to `scripts/checks/modal.mjs` a "page parity" block for `/works/heyso`, `/works/lipton`: section nav click scrolls the target section to near top (`|rect.top| < 120`), active section updates, progress `> 0` after scrolling half the page, `h1` present, document title equals `metaTitle`. Also `const mod = await page.evaluate(() => import('/src/pages/CaseStudy.jsx').then((m) => typeof m.CaseStudyBody))` → `'function'`.

- [ ] **Step 2: Run** → FAIL on `CaseStudyBody`.

- [ ] **Step 3: Implement** `scrollRoot.js` and `caseStudyChunk.js`; point `App.jsx` at `loadCaseStudy`. Split `CaseStudy.jsx`: `CaseStudyBody` renders nav + article (or the shell `h1` for articles not in `ARTICLES`) and calls `bootReady()`; `CaseStudy` keeps `useDocumentMeta`, unknown-slug `<Navigate>`, and wraps `CaseStudyBody variant="page"` in `Layout`. Export `nextAfter` for the modal.

- [ ] **Step 4: Make the helpers root-aware**: `useScrollMotion` subscribes via `onRootScroll` and measures against the root rect/clientHeight; `useScrollProgress`/`useActiveSection` use `rootMetrics` and pass `root` to `IntersectionObserver`; `scrollToSection` uses `root.scrollTo({ top, behavior })` when a root exists, Lenis/window otherwise. Add `onHome`/`onSelect` variants. In `case-study.css`, `.cs-modal__scroll { --cs-wide-w: 77.5cqw; }`.

- [ ] **Step 5: Run** `node scripts/checks/modal.mjs` (parity block) → PASS; `node scripts/verify.mjs` → 0 failures; `npm run build` → CaseStudy chunk still separate (entry chunk not grown by >5 kB).

(No commit — Phase D commits after Task 7.)

### Task 7: Modal shell + grid wiring

**Files:**
- Create: `src/components/CaseStudyModal.jsx`, modal styles in `src/styles/global.css` (entry bundle; small)
- Modify: `src/App.jsx` (mount modal; remove `noteRoute`), `src/components/WorksGrid.jsx:51-73`, `src/components/WorkCard.jsx` (pause video while modal open), `scripts/checks/modal.mjs`
- Delete: `src/lib/cardMorph.js`

**Interfaces:**
- Consumes: `loadCaseStudy`, `CaseStudyBody`, `ScrollRootContext`, `nextAfter` (Task 6); `data-card-thumb`, card `<Link>` (Task 5); `setCursorHost` (`src/components/CustomCursor.jsx:9`).
- Produces: `openCaseStudy(slug: string): void` via `useCaseStudyModal()` hook exported from `CaseStudyModal.jsx` (pushes `navigate(location.pathname, { state: { caseStudy: slug } })`, records `pushedRef = true`); `<CaseStudyModal />` reads `location.state?.caseStudy`. DOM: `dialog.cs-modal[data-size="window"|"full"]`, `button[data-cs-toggle]` (aria-label `Maximize`/`Minimize`), `button[data-cs-back]` (aria-label `Back to works`), `.cs-modal__scroll`. `document.documentElement.dataset.modalOpen` while open (WorkCard pauses on it).

- [ ] **Step 1: Failing checks** in `modal.mjs`:

```js
// desktop, from '/'
await page.evaluate(() => document.querySelector('[data-stage="works"]').scrollIntoView())
await page.click('a[data-card][href$="/heyso"]'); await sleep(600)
check('modal open', await page.$eval('dialog.cs-modal', (d) => d.open))
check('URL unchanged', (await page.evaluate(() => location.pathname)) === '/')
check('window size', (await page.$eval('dialog.cs-modal', (d) => d.dataset.size)) === 'window')
check('h1 inside modal', !!(await page.$('.cs-modal__scroll h1')))
check('page locked', await page.evaluate(() => window.__lenis?.isStopped || getComputedStyle(document.documentElement).overflow === 'hidden'))
await page.click('[data-cs-toggle]'); await sleep(500)
check('maximized', (await page.$eval('dialog.cs-modal', (d) => d.dataset.size)) === 'full')
check('minimize label', (await page.$eval('[data-cs-toggle]', (b) => b.getAttribute('aria-label'))) === 'Minimize')
// section link inside modal scrolls the modal scroller
const before = await page.$eval('.cs-modal__scroll', (s) => s.scrollTop)
await page.click('.cs-modal nav a, .cs-modal nav button[data-section]'); await sleep(900)
check('section scroll in modal', (await page.$eval('.cs-modal__scroll', (s) => s.scrollTop)) > before)
// next study swaps in place
await page.$eval('.cs-modal__scroll', (s) => s.scrollTo(0, s.scrollHeight)); await page.click('.cs-modal [data-cs-next]'); await sleep(600)
check('next swaps slug', (await page.$eval('.cs-modal__scroll h1', (h) => h.textContent)) !== heysoTitle)   // heysoTitle captured from the h1 right after opening
await page.keyboard.press('Escape'); await sleep(500)
check('escape closes', !(await page.$eval('dialog.cs-modal', (d) => d.open).catch(() => false)))
check('unlocked after close', await page.evaluate(() => !window.__lenis?.isStopped))
check('focus back on card', await page.evaluate(() => document.activeElement?.matches('a[data-card]')))
// backdrop click closes (window mode)
// Review Focus 1: refresh with modal open
await page.click('a[data-card][href$="/lipton"]'); await sleep(600); await page.reload({ waitUntil: 'networkidle2' }); await waitBoot(page)
check('refresh: no modal', !(await page.$eval('dialog.cs-modal', (d) => d.open).catch(() => false)))
// Review Focus 5: resize across 64rem
await page.click('a[data-card][href$="/heyso"]'); await sleep(600); await page.setViewport({ width: 900, height: 900 }); await sleep(300)
check('resize → full + back', (await page.$eval('dialog.cs-modal', (d) => d.dataset.size)) === 'full' && !!(await page.$('[data-cs-back]')))
// phone 390x844
await phone.click('a[data-card][href$="/heyso"]'); await sleep(600)
check('phone full', (await phone.$eval('dialog.cs-modal', (d) => d.dataset.size)) === 'full')
check('phone no maximize', !(await phone.$('[data-cs-toggle]')))
// Review Focus 2: back gesture
await phone.goBack(); await sleep(500)
check('back closes, stays on /', (await phone.evaluate(() => location.pathname)) === '/' && !(await phone.$eval('dialog.cs-modal', (d) => d.open).catch(() => false)))
// Review Focus 4: reduced motion still opens
await reducedPage.click('a[data-card][href$="/heyso"]'); await sleep(300)
check('reduced opens modal', await reducedPage.$eval('dialog.cs-modal', (d) => d.open))
// cmd-click still targets the real page
check('card href', (await page.$eval('a[data-card][href$="/heyso"]', (a) => a.getAttribute('href'))).endsWith('/works/heyso'))
// shore-up does nothing
await page.click('article[data-card]'); await sleep(300)
check('shore-up inert', !(await page.$eval('dialog.cs-modal', (d) => d.open).catch(() => false)))
// direct route still a full page
check('/works/heyso full page', !!(await direct.$('main h1')) && !(await direct.$('dialog.cs-modal[open]')))
```

- [ ] **Step 2: Run** → FAIL on `modal open`.

- [ ] **Step 3: Implement `CaseStudyModal.jsx`** per spec §D2:
  - Structure `dialog.cs-modal[data-lenis-prevent]` > `.cs-modal__frame` (non-scrolling; `transform: translateZ(0)` so the nav's `fixed` rail anchors to it) > control bar + `.cs-modal__scroll` > `ScrollRootContext` > `Suspense` (maroon placeholder) > lazy `CaseStudyBody variant="modal" onClose onSelect`.
  - Size: `useMediaQuery(WIDE)` false → `full` + back button, no toggle; true → local `size` state (`window` default) + toggle. Window = `min(92vw, 90rem)` × `calc(100dvh − 4rem)` centred, radius `--radius-card`; full = inset 0.
  - Open effect: `showModal()`, `setCursorHost(dialog)`, `wasStopped = window.__lenis?.isStopped`, `window.__lenis?.stop()`, `html.style.overflow = 'hidden'` when no Lenis, `dataset.modalOpen = ''`, scroller `scrollTop = 0`. Cleanup restores each (Lenis only restarted if `!wasStopped`), restores `document.title`.
  - Close: `cancel` event → `preventDefault` + close animation (150 ms, skipped under reduced motion) → if `pushedRef` then `navigate(-1)` else `navigate(location.pathname, { replace: true, state: null })`. Backdrop click (target === dialog) closes in window mode.
  - First mount of the App: if `history.state?.usr?.caseStudy`, `navigate(pathname, { replace: true, state: null })` (Review Focus 1).
  - `onSelect(next)` → `navigate(pathname, { replace: true, state: { caseStudy: next } })` + scroller to top.
  - Maximize/minimize animated by a GSAP transform tween on the frame (or instant under reduced motion).

- [ ] **Step 4: Wire the grid.** In `WorksGrid.onClick`, keep the plain-left-click guard, drop the reduced-motion early return, `preventDefault()` and call `openCaseStudy(slug)` parsed from the href; warm the chunk on `pointerenter`/`focusin` with `loadCaseStudy()`. Delete `src/lib/cardMorph.js`, its import, and `noteRoute` in `App.jsx`. `WorkCard`: skip `play()` and pause while `document.documentElement.dataset.modalOpen` is set (observe with a `MutationObserver` on `<html>` attributes).

- [ ] **Step 5: Run** `node scripts/checks/modal.mjs` → PASS; `node scripts/checks/cards.mjs`, `node scripts/checks/landing.mjs` → PASS; `node scripts/verify.mjs` + `390 844` → 0 failures; `npm run build` → no chunk-size warnings. Take shots of the modal in window, full and phone modes and view them.

- [ ] **Step 6: Commit (Phase D)**

```bash
git add -A src scripts
git commit -m "Works: case studies open in a pop-up with maximize/minimize; fullscreen with back on phones"
```

---

## Phase E — Shelf

### Task 8: Two-shelf UI on the Me page

**Files:**
- Create: `src/components/Shelf.jsx`, `src/components/ShelfPopup.jsx`, `src/data/shelf.js`, `src/styles/shelf.css`, `scripts/checks/shelf.mjs`
- Modify: `src/pages/Me.jsx` (new `<section>` after `.me-grid`, ~line 83)

**Interfaces:**
- Consumes: `setCursorHost`, Lenis lock discipline from Task 7 (copy, don't import the case-study modal).
- Produces: `BOOKS: Array<{ id, title, author, cover: string|null, rating: number /*0–5, halves*/, opinion: string, spine: { color, height /*rem*/, width /*rem*/ } }>`, `MOVIES: Array<{ id, title, year, thumbnail: string|null, rating, opinion, cassette: { color, pose: 'up'|'flat', tilt /*deg*/ } }>` — 8 placeholder books, 7 placeholder movies, each `opinion: 'Placeholder — Shreya to write.'`. `<Shelf />`, `<ShelfPopup item kind="book"|"movie" onClose />`. DOM hooks: `section[data-shelf]`, `button[data-book]`, `button[data-movie]`, `dialog.shelf-popup`.

- [ ] **Step 1: Failing checks** in `shelf.mjs` (1728×1117, 390×844, reduced):

```js
check('shelf on /me', !!(await page.$('section[data-shelf]')))
const books = await page.$$eval('button[data-book]', (bs) => bs.map((b) => b.getBoundingClientRect()))
check('books vary', new Set(books.map((r) => Math.round(r.height))).size > 2 && new Set(books.map((r) => Math.round(r.width))).size > 1)
check('movies rendered', (await page.$$('button[data-movie]')).length === 7)
check('some cassettes flat', (await page.$$('button[data-movie][data-pose="flat"]')).length > 0)
await page.hover('button[data-book]'); await sleep(400)
check('book hover transforms', (await page.$eval('button[data-book]', (b) => getComputedStyle(b).transform)) !== 'none')
await page.click('button[data-book]'); await sleep(400)
check('book popup', await page.$eval('dialog.shelf-popup', (d) => d.open && /Placeholder/.test(d.textContent) && !!d.querySelector('[data-rating]')))
await page.keyboard.press('Escape'); await sleep(300)
await page.click('button[data-movie]'); await sleep(400)
check('movie popup has thumbnail slot', await page.$eval('dialog.shelf-popup', (d) => !!d.querySelector('[data-thumb]')))
check('accessible names', await page.$$eval('button[data-book],button[data-movie]', (bs) => bs.every((b) => b.getAttribute('aria-label') || b.textContent.trim())))
check('no horizontal page overflow', await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth))
// reduced: hover leaves transform none
```

- [ ] **Step 2: Run** `node scripts/checks/shelf.mjs` → FAIL on `shelf on /me`.

- [ ] **Step 3: Data + markup.** Write `shelf.js` placeholders (varied spine heights 9–13rem, widths 1.6–3rem, palette from tokens: maroon, cream, muted ink, a few accents; cassettes: 2–3 `flat` stacked, small tilts −4…4°). `Shelf.jsx`: two rows, each a `ul` on a plank (`.shelf__plank` with edge + shadow); books upright with vertical title (`writing-mode: vertical-rl`); cassettes as labelled VHS boxes, `flat` ones stacked horizontally. Rows `overflow-x: auto` inside the section.

- [ ] **Step 4: Motion + popup.** `shelf.css`: book hover/focus `transform: translateY(-0.6rem) rotate(-4deg)`; cassette hover/focus `transform: translateY(-0.3rem) translateZ(0) scale(1.06)` with a slide-out shadow; both gated by `@media (hover: hover)` for hover and always for `:focus-visible`; `prefers-reduced-motion` removes transforms. `ShelfPopup`: native `<dialog>` with the FunziePopup title bar look, cover/thumbnail (`data-thumb`, grey placeholder when null), `data-rating` stars (`aria-label="Rated N out of 5"`), title, author/year, opinion; Escape and backdrop close; cursor host + Lenis lock restore like Task 7.

- [ ] **Step 5: Run** `node scripts/checks/shelf.mjs` → PASS at all three configs; `node scripts/verify.mjs` + `390 844` → 0 failures; screenshot `/me` (scrolled to the shelf) at desktop and phone and view.

- [ ] **Step 6: Commit (Phase E)**

```bash
git add -A src scripts
git commit -m "Me: two-shelf section — book spines and VHS cassettes with placeholder popups"
```

### Task 9: README + final sweep

**Files:**
- Modify: `README.md` (pages list ~104, Status ~112, QA scripts ~118-128 → `scripts/checks/*.mjs`, hosting line ~31 → GitHub Pages via `deploy.yml`)

- [ ] **Step 1:** Update the README sections listed.
- [ ] **Step 2: Run all checks** — `node scripts/checks/landing.mjs && node scripts/checks/cards.mjs && node scripts/checks/modal.mjs && node scripts/checks/shelf.mjs && node scripts/verify.mjs && node scripts/verify.mjs 390 844 && npm run build` → all PASS.
- [ ] **Step 3: Commit** `git commit -am "README: new landing flow, case-study pop-up, shelf and QA checks"`.
