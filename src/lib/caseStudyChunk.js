/* The case studies are the one part of the site worth splitting out: three
   articles, their figures' code and case-study.css, none of which a phone
   opening `/` should wait for. Both hosts load the same chunk through this —
   the /works/:slug route (App) and the pop-up over the grid (CaseStudyModal) —
   and import() caches it, so warming it from either serves both. */
export const loadCaseStudy = () => import('@/pages/CaseStudy')
