import { Navigate, useParams } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { CaseStudyNav } from '@/components/CaseStudyNav'
import { HeySoArticle } from '@/components/HeySoArticle'
import { TmuKpopArticle } from '@/components/TmuKpopArticle'
import { LiptonArticle } from '@/components/LiptonArticle'
import {
  CASE_STUDIES,
  HEYSO_SECTIONS,
  LIPTON_SECTIONS,
  TMU_SECTIONS,
  getCaseStudy,
} from '@/data/caseStudies'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import '@/styles/case-study.css'

/** The written-up case studies. `ids` keeps a stable identity, because
 *  useActiveSection keys its observer off that array. */
const ARTICLES = {
  heyso: { Article: HeySoArticle, sections: HEYSO_SECTIONS, ids: HEYSO_SECTIONS.map((s) => s.id) },
  'tmu-kpop': { Article: TmuKpopArticle, sections: TMU_SECTIONS, ids: TMU_SECTIONS.map((s) => s.id) },
  lipton: { Article: LiptonArticle, sections: LIPTON_SECTIONS, ids: LIPTON_SECTIONS.map((s) => s.id) },
}

/** The case study that follows this one, wrapping at the end of the list.
 *  Coming-soon studies are skipped: their page is only a title, a dead end for
 *  the one link at the bottom of an article. */
function nextAfter(slug) {
  const i = CASE_STUDIES.findIndex((c) => c.slug === slug)
  if (i === -1) return null
  for (let step = 1; step < CASE_STUDIES.length; step += 1) {
    const c = CASE_STUDIES[(i + step) % CASE_STUDIES.length]
    if (c.status !== 'coming-soon') return c
  }
  return null
}

export function CaseStudy() {
  const { slug } = useParams()
  const study = getCaseStudy(slug)

  // Hooks run before the redirect below; an unknown slug just falls back to the default.
  useDocumentMeta({ title: study?.metaTitle, description: study?.description })

  if (!study) return <Navigate to="/works" replace />

  // The rest are shells until their screenshots land, so they get the title
  // and nothing that would pretend to be a case study.
  const entry = ARTICLES[slug]
  if (!entry) {
    return (
      <Layout>
        <section className="flex flex-1 items-center px-[var(--page-gutter)]">
          <h1 className="font-display text-[length:var(--text-card-title)] text-[var(--color-ink)]">
            {study.title}
          </h1>
        </section>
      </Layout>
    )
  }

  return (
    <Layout>
      <CaseStudyNav key={slug} sections={entry.sections} ids={entry.ids} />
      {/* The fixed panel is out of flow, so the article is pushed clear of it
          by hand. Below 64rem the nav is a strip above the article instead and
          there is nothing to clear. data-skip-target sends the skip link here,
          past the section nav; below 64rem its scroll margin keeps it clear of
          the sticky strip (0.5rem band + 47px pill + its 0.75rem fade), which
          would otherwise cover the top of the hero when focus lands here. */}
      <div data-skip-target="" tabIndex={-1} className="mt-[1.5rem] scroll-mt-[calc(1.25rem+47px)] lg:mt-[2.5rem] lg:scroll-mt-0 lg:pl-[clamp(9.5rem,11.5vw,12.25rem)]">
        <entry.Article key={slug} next={nextAfter(slug)} />
      </div>
    </Layout>
  )
}
