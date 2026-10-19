import sdz from '@assets/brand/icons/experience/sdz.png'
import tmu from '@assets/brand/icons/experience/tmu.png'
import minoh from '@assets/brand/icons/experience/minoh.png'
import avisonYoung from '@assets/brand/icons/experience/avison-young.png'
import reyDesigns from '@assets/brand/icons/experience/rey-designs.png'

/* Oldest first. The logos are alpha masks (tones baked into the alpha, so a
   two-colour mark keeps its shape), painted maroon by the CSS. */
const STOPS = [
  { name: 'Science Discovery Zone', when: '2023', logo: sdz, ratio: 1 },
  { name: 'TMU', when: '2023 – 2024', logo: tmu, ratio: 236 / 128 },
  { name: 'Minoh', when: '2024 · 6 months', logo: minoh, ratio: 1 },
  { name: 'Avison Young', when: '2024 – 2026', logo: avisonYoung, ratio: 211 / 128 },
  { name: 'Rey Designs', when: 'Freelance', logo: reyDesigns, ratio: 136 / 128 },
]

/**
 * Where Shreya has worked, left to right on a grey rule (top to bottom on
 * phones): a small logo over each dot, the name and dates under it, ending on
 * her own RD monogram for the freelance work.
 */
export function ExperienceTimeline() {
  return (
    <ol className="me-tl" aria-label="Experience">
      {STOPS.map((s) => (
        <li key={s.name} className="me-tl__stop">
          <span
            className="me-tl__logo"
            style={{ '--logo': `url(${s.logo})`, aspectRatio: s.ratio }}
            aria-hidden="true"
          />
          <span className="me-tl__dot" aria-hidden="true" />
          <span className="me-tl__name">{s.name}</span>
          <span className="me-tl__when">{s.when}</span>
        </li>
      ))}
    </ol>
  )
}
