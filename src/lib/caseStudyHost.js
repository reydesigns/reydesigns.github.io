import { createContext, useContext } from 'react'

/**
 * Where a case study is being shown, for the few pieces of it that care.
 *
 * A case study renders in two hosts: its own route, /works/:slug (the window
 * scrolls), and the pop-up over the works grid, CaseStudyModal (an element
 * inside the dialog scrolls and the page behind it is locked). The default
 * value is the route, so nothing has to provide it there.
 *
 *   root      the element that scrolls, or null for the window. The section
 *             nav, the progress bar and scroll-linked motion measure against
 *             it (sectionScroll.js, useScrollMotion.js).
 *   onClose   set by the pop-up: what closes it (its red dot and backdrop).
 *   onSelect  set by the pop-up: "next case study" swaps the study in place
 *             instead of routing to its page.
 */
export const CaseStudyHostContext = createContext({ root: null, onClose: null, onSelect: null })

export const useCaseStudyHost = () => useContext(CaseStudyHostContext)
