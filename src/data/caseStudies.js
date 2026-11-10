import heysoVideo from '@assets/heyso/video/walkthrough-1080p.webm'
import liptonVideo from '@assets/lipton/video/walkthrough-1080p.mp4'
import tmuVideo from '@assets/tmu-kpop/video/walkthrough-1080p.mp4'
// One frame of each walkthrough (0.5s in — the same frame the reduced-motion
// render parks on), 1280 wide. The card and the case-study hero play the same
// file, so they share it.
import heysoPoster from '@assets/heyso/video/poster.webp'
import liptonPoster from '@assets/lipton/video/poster.webp'
import tmuPoster from '@assets/tmu-kpop/video/poster.webp'
// Shore-Up's: recorded from the live app (the globe turning), 1280x720 WebM.
import shoreUpVideo from '@assets/shore-up/video/globe-720p.webm'
import shoreUpPoster from '@assets/shore-up/video/globe-poster.webp'
import heysoLogo from '@assets/brand/icons/clients/heyso.png'
import tmuLogo from '@assets/brand/icons/clients/tmu-kpop.png'
import liptonLogo from '@assets/brand/icons/clients/lipton.png'
import shoreUpLogo from '@assets/brand/icons/clients/shore-up.png'
import vibeBloom from '@assets/current-vibes/binary-bloom.webp'
import vibeVinyl from '@assets/current-vibes/vinyl-player.webp'
import vibeComics from '@assets/current-vibes/comic-collection.webp'

/**
 * The Works grid and every case-study route are driven from this list.
 * Adding a project here is all that's needed — no new components.
 *
 * `metaTitle` is the readable form for the browser tab (card titles are
 * stylised, e.g. all caps) and `description` is the meta description.
 *
 * `title` is the stylised name, transcribed verbatim from
 * Assets/site-design/images/works-page.png; it heads the "next case study"
 * link and the coming-soon shell. Card order matches the comp: HeySo and TMU
 * on the top row, then Lipton and Shore-Up. The grid itself reads WORKS_GRID
 * (below); the toys sit in a row of their own under it (CURRENT_VIBES).
 *
 * The Works card shows only `logo` and `metaTitle` (its top-left chip) and,
 * on hover, `blurb`. The four marks only ever existed inside the comp, so they
 * were sliced out of works-page.png as 160px squares centred on each mark.
 *
 * `blurb` — one line, drafted from each article's objective. DRAFT: the client
 * to edit. Coming-soon studies have none (their card shows no description).
 */
export const CASE_STUDIES = [
  {
    slug: 'heyso',
    logo: heysoLogo,
    title: 'Heyso...',
    metaTitle: 'HeySo',
    description: 'Case study: HeySo, a group-planning app designed in a day at the WITM WeDesignTech Hackathon 2023.',
    blurb: 'A group-planning app my team designed in a day for the WITM WeDesignTech Hackathon 2023.',
    video: heysoVideo,
    videoPoster: heysoPoster,
    status: 'published',
  },
  {
    slug: 'tmu-kpop',
    logo: tmuLogo,
    title: 'TMU-KPOP revamp',
    metaTitle: 'TMU-KPOP revamp',
    description: 'Case study: a web design and revamp for TMU-KPOP.',
    blurb: 'A fast-turnaround revamp of the TMU K-POP club website, shipped before the school year began.',
    video: tmuVideo,
    videoPoster: tmuPoster,
    status: 'published',
  },
  {
    slug: 'lipton',
    logo: liptonLogo,
    title: 'LIPTON TEA MOBILE',
    metaTitle: 'Lipton Tea Mobile',
    description: 'Case study: a UI revamp of the Lipton Tea mobile experience.',
    blurb: 'A UI revamp of the Lipton Tea mobile experience, made for GCM 810: Creativity, Clients & Design.',
    video: liptonVideo,
    videoPoster: liptonPoster,
    status: 'published',
  },
  {
    slug: 'shore-up',
    logo: shoreUpLogo,
    title: 'SHORE-UP',
    metaTitle: 'Shore-Up',
    description: 'Case study: Shore-Up, a one-day hackathon web app that brings communities together to clean up local beaches.',
    blurb: 'A one-day hackathon web app that brings communities together to clean up their local beaches.',
    video: shoreUpVideo,
    videoPoster: shoreUpPoster,
    status: 'published',
  },
]

/**
 * The Vinyl Player: a small interactive toy, not a case study. Its card opens
 * a pop-up on the page it is on (VinylPlayerModal) instead of a route, so it
 * is kept out of CASE_STUDIES, which also drives /works/:slug and the "next
 * case study" link, and joins the grid only through WORKS_GRID. Its records
 * come from src/data/vinyls.json (scripts/fetch-vinyls.mjs). It has no client
 * and no blurb: its card shows the name alone in the chip, over the scene.
 */
export const VINYL_PLAYER = {
  slug: 'vinyl-player',
  title: 'Vinyl Player',
  metaTitle: 'Vinyl Player',
  status: 'toy',
}

/**
 * Binary Bloom: the second toy. Its card opens a pop-up (FlowerGenerator)
 * where a bitmap line drawing of a plant, covered in glitching binary,
 * blooms flower by flower under the pointer. Kept out of CASE_STUDIES for
 * the same reasons as the Vinyl Player.
 */
export const BINARY_BLOOM = {
  slug: 'binary-bloom',
  title: 'Binary Bloom',
  metaTitle: 'Binary Bloom',
  tag: 'INTERACTIVE',
  status: 'toy',
}

/**
 * Comic Hoarder: the third toy. Its card opens a pop-up (ComicHoarder) of
 * the client's comics on a black 4 x 4 rack, one stack per hero or villain,
 * each comic rated out of five (src/data/comics.js). Kept out of
 * CASE_STUDIES for the same reasons as the Vinyl Player.
 */
export const COMIC_HOARDER = {
  slug: 'comic-hoarder',
  title: 'My Comic Collection',
  metaTitle: 'My Comic Collection',
  status: 'toy',
}

/** The Works grid's cards, in order: the four case studies, HeySo beside
 *  TMU K-POP, then Lipton beside Shore-Up. The three toys have a row of their
 *  own under it (CURRENT_VIBES). */
export const WORKS_GRID = CASE_STUDIES

/**
 * "current vibes": the row of three under the case studies
 * (ExpandingProjectCards). Each card is a square still that widens on hover
 * to show its title and labels, and opens the toy's own pop-up.
 *
 * The stills are square crops of each toy's old Works card artwork (Binary
 * Bloom in bloom, the Vinyl Player's turntable, the comic rack), 924px, in
 * Assets/current-vibes/. Swap a file to change a picture.
 *
 * `labels` — DRAFT: the client to edit. Shown in capitals; written in
 * sentence case so screen readers say them as words.
 */
export const CURRENT_VIBES = [
  { ...BINARY_BLOOM, image: vibeBloom, labels: ['Interactive', 'Generative', 'Canvas'] },
  { ...VINYL_PLAYER, image: vibeVinyl, labels: ['Interactive', 'Music', 'Song recs'] },
  { ...COMIC_HOARDER, image: vibeComics, labels: ['Interactive', 'Collection', 'Ratings'] },
]

export const getCaseStudy = (slug) => CASE_STUDIES.find((c) => c.slug === slug)

/** The poster for a walkthrough, looked up by its URL. The articles hand
 *  CaseHero the video they import, which resolves to the same URL as here. */
export const posterForVideo = (src) => CASE_STUDIES.find((c) => c.video === src)?.videoPoster

/** Ordered sections for the HeySo case study — ids drive the nav and scroll targets. */
export const HEYSO_SECTIONS = [
  { id: 'objective', label: 'OBJECTIVE' },
  { id: 'problem', label: 'PROBLEM' },
  { id: 'research', label: 'RESEARCH' },
  { id: 'solution', label: 'SOLUTION' },
  { id: 'final-product', label: 'FINAL PRODUCT' },
  { id: 'lessons', label: 'LESSONS' },
]

/** Ordered sections for the TMU K-POP case study. */
export const TMU_SECTIONS = [
  { id: 'objective', label: 'OBJECTIVE' },
  { id: 'screening', label: 'SCREENING' },
  { id: 'process', label: 'PROCESS' },
  { id: 'roi', label: 'ROI' },
]

/** Ordered sections for the Shore-Up case study. The facts list above the
 *  problem has a section of its own (`overview`) but no label, so no entry. */
export const SHOREUP_SECTIONS = [
  { id: 'problem', label: 'PROBLEM' },
  { id: 'solution', label: 'SOLUTION' },
  { id: 'research', label: 'RESEARCH' },
  { id: 'demo', label: 'DEMO' },
]

/** Ordered sections for the Lipton Tea case study. */
export const LIPTON_SECTIONS = [
  { id: 'objective', label: 'OBJECTIVE' },
  { id: 'research-outcome', label: 'RESEARCH & OUTCOME' },
  { id: 'branding', label: 'BRANDING' },
]
