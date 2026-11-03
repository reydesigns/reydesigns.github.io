import { Suspense, lazy, useEffect, useLayoutEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { SmoothScroll } from '@/lib/SmoothScroll'
import { loadCaseStudy } from '@/lib/caseStudyChunk'
import { CaseStudyModal } from '@/components/CaseStudyModal'
import { Landing } from '@/pages/Landing'
import { Works } from '@/pages/Works'
import { Funzies } from '@/pages/Funzies'
import { Me } from '@/pages/Me'

/* The case studies are the one route worth splitting out (caseStudyChunk.js).
   The other pages are a few hundred bytes each and stay in the entry chunk,
   where they render with no gap on a direct load. */
const CaseStudy = lazy(() => loadCaseStudy().then((m) => ({ default: m.CaseStudy })))

/**
 * Fetch the case-study chunk once the first page has fully loaded and the
 * browser is idle, so it never competes with that page's own images, and so
 * opening a study later doesn't wait on the network — a card opens its study
 * in the pop-up (CaseStudyModal), which renders from this same chunk.
 */
function PrefetchCaseStudy() {
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 1500))
    const cancel = window.cancelIdleCallback ?? clearTimeout
    let id
    const start = () => {
      id = idle(() => loadCaseStudy().catch(() => {}))
    }
    if (document.readyState === 'complete') start()
    else window.addEventListener('load', start, { once: true })
    return () => {
      window.removeEventListener('load', start)
      if (id !== undefined) cancel(id)
    }
  }, [])
  return null
}

/**
 * Every route starts at the top.
 *
 * This matters more than it used to: `/` is two screens tall, so without it a
 * visitor who scrolled to the works grid and opened a case study would land a
 * screen down a brand new page. It is also half of "reload lands on the hero"
 * — main.jsx turns the browser's own scroll restoration off. Lenis keeps its
 * own scroll position, so it has to be told as well as the window.
 */
function RouteEffects() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    const lenis = window.__lenis
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true })
    else window.scrollTo(0, 0)
  }, [pathname])

  return null
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <SmoothScroll>
        <RouteEffects />
        <PrefetchCaseStudy />
        {/* No fallback UI. Navigations run in a transition (BrowserRouter's
            default), so a link to a case study still loading keeps the current
            page up until it is ready; only a cold deep link to a study sees the
            plain page background, for as long as its chunk takes. */}
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/works" element={<Works />} />
            <Route path="/works/:slug" element={<CaseStudy />} />
            <Route path="/funzies" element={<Funzies />} />
            <Route path="/me" element={<Me />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        {/* Over any page: opens when a works card puts a study in history
            state, without changing the address. */}
        <CaseStudyModal />
      </SmoothScroll>
    </BrowserRouter>
  )
}
