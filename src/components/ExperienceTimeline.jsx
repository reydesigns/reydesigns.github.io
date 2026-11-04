import sdz from '@assets/brand/icons/experience/sdz.png'
import tmu from '@assets/brand/icons/experience/tmu.png'
import minoh from '@assets/brand/icons/experience/minoh.png'
import avisonYoung from '@assets/brand/icons/experience/avison-young.png'
import reyDesigns from '@assets/brand/icons/experience/rey-designs.png'

/* Oldest first. The logos are alpha masks (tones baked into the alpha, so a
   two-colour mark keeps its shape), painted maroon by the CSS. `time` is how
   long Shreya spent there, as shown; `spoken` is the same for a screen
   reader, with the name (the logo itself is decorative). */
const STOPS = [
  { name: 'Science Discovery Zone', time: '6M', spoken: '6 months', logo: sdz, ratio: 1 },
  { name: 'TMU', time: '6M', spoken: '6 months', logo: tmu, ratio: 236 / 128 },
  { name: 'Minoh', time: '6M', spoken: '6 months', logo: minoh, ratio: 1 },
  { name: 'Avison Young', time: '2Y', spoken: '2 years', logo: avisonYoung, ratio: 211 / 128 },
  { name: 'Rey Designs', time: '4Y', spoken: '4 years', logo: reyDesigns, ratio: 136 / 128 },
]

/**
 * Where Shreya has worked, left to right on a grey rule (top to bottom on
 * phones): a small logo over each dot and, under it, how long she spent
 * there, ending on her own RD monogram for the freelance work.
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
          <span className="me-tl__time" aria-hidden="true">
            {s.time}
          </span>
          <span className="sr-only">
            {s.name}, {s.spoken}
          </span>
        </li>
      ))}
    </ol>
  )
}
