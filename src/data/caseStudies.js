import heysoVideo from '@assets/heyso/video/walkthrough-1080p.webm'
import liptonVideo from '@assets/lipton/video/walkthrough-1080p.mp4'
import tmuVideo from '@assets/tmu-kpop/video/walkthrough-1080p.mp4'
// One frame of each walkthrough (0.5s in — the same frame the reduced-motion
// render parks on), 1280 wide. The card and the case-study hero play the same
// file, so they share it.
import heysoPoster from '@assets/heyso/video/poster.webp'
import liptonPoster from '@assets/lipton/video/poster.webp'
import tmuPoster from '@assets/tmu-kpop/video/poster.webp'
import shoreUpImage from '@assets/shore-up/images/app-screenshot.png'
import heysoLogo from '@assets/brand/icons/clients/heyso.png'
import tmuLogo from '@assets/brand/icons/clients/tmu-kpop.png'
import liptonLogo from '@assets/brand/icons/clients/lipton.png'
import shoreUpLogo from '@assets/brand/icons/clients/shore-up.png'

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
 * (below), which puts the Vinyl Player beside Lipton and so moves Shore-Up
 * down to a third row, under Lipton.
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
    description: 'Shore-Up, a hackathon project. The case study is coming soon.',
    poster: shoreUpImage, // static thumbnail — no walkthrough video exists
    status: 'coming-soon',
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

/** The Works grid's cards, in order: the Vinyl Player sits beside Lipton on
 *  the second row, which moves Shore-Up down to the third, under Lipton. */
export const WORKS_GRID = CASE_STUDIES.flatMap((c) => (c.slug === 'lipton' ? [c, VINYL_PLAYER] : [c]))

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
  { id: 'process', label: 'PROCESS' },
  { id: 'roi', label: 'ROI' },
]

/** Ordered sections for the Lipton Tea case study. */
export const LIPTON_SECTIONS = [
  { id: 'objective', label: 'OBJECTIVE' },
  { id: 'research-outcome', label: 'RESEARCH & OUTCOME' },
  { id: 'branding', label: 'BRANDING' },
]
