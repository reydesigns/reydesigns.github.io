import { Layout } from '@/components/Layout'
import { NavDock } from '@/components/NavDock'
import { WorksGrid } from '@/components/WorksGrid'
import { useDocumentMeta } from '@/lib/useDocumentMeta'

/**
 * `/works` as a direct route: the grid, immediately, with the nav at the
 * bottom centre exactly as it is on the landing page. No hero and no loader —
 * someone who arrives here from a bookmark, a shared link or the browser's back
 * button has not asked to sit through an intro.
 *
 * The landing page reaches the same grid by scrolling instead, and renders the
 * very same WorksGrid, so the two can never drift apart.
 *
 * Below 64rem the grid is a single column, which is also the whole of the
 * mobile "tap works, read the case studies" path — there is no scroll sequence
 * on a phone at all.
 */
export function Works() {
  useDocumentMeta({
    title: 'Works',
    description: 'Selected design work by Shreya Rudrapatna: product, web and mobile case studies.',
  })
  return (
    <Layout>
      <h1 className="sr-only">Works</h1>
      <WorksGrid />
      <NavDock placement="bottom" activePath="/works" />
    </Layout>
  )
}
