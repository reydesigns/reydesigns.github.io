import { useEffect, useRef } from 'react'
import { ARTICLE, CaseHero, ClientLine, Eyebrow, HEAD, Outro, P, RoleCard, Section, Tags } from './caseStudyParts'
import { useInView } from '@/lib/useInView'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useSaveData } from '@/lib/useSaveData'
import shoreUpLogo from '@assets/brand/icons/clients/shore-up.png'
import globeVideo from '@assets/shore-up/video/globe-720p.webm'
import demoVideo from '@assets/shore-up/video/demo-720p.webm'
import demoPoster from '@assets/shore-up/video/demo-poster.webp'
import goal3 from '@assets/shore-up/images/sdg/goal-03.jpg'
import goal6 from '@assets/shore-up/images/sdg/goal-06.jpg'
import goal11 from '@assets/shore-up/images/sdg/goal-11.jpg'
import goal14 from '@assets/shore-up/images/sdg/goal-14.jpg'

/* ---------------------------------------------------------------------------
   Shore-Up: a one-day hackathon web app for cleaning up local beaches
   together (https://shore-up-danielchahine0-stripe.vercel.app).

   The two videos are recordings of the live app (1280x720 VP9 WebM): the
   globe turning, which is also the Works card, and a demo searching
   Woodbine Beach in Toronto. The four goal tiles are the UN's official SDG
   icons (sdgs.un.org, used unaltered, as the UN's guidelines allow for
   information), laid out after Assets/shore-up/shoreup assets/UN goals shore
   up.png with the targets the app answers to in circles on their corners.
--------------------------------------------------------------------------- */

const OCEAN_STATS = 'https://www.condorferries.co.uk/marine-ocean-pollution-statistics-facts'
const PEW =
  'https://www.pewresearch.org/science/2021/05/26/gen-z-millennials-stand-out-for-climate-change-activism-social-media-engagement-with-issue/'
const UN_GOALS = 'https://sdgs.un.org/goals'

/** The four goals, in the UN's own colours, with the targets Shore-Up meets. */
const GOALS = [
  { n: 3, name: 'Good health and well-being', icon: goal3, colour: '#4c9f38', targets: ['3.9'] },
  { n: 6, name: 'Clean water and sanitation', icon: goal6, colour: '#26bde2', targets: ['6.3', '6.b'] },
  { n: 11, name: 'Sustainable cities and communities', icon: goal11, colour: '#fd9d24', targets: ['11.7'] },
  { n: 14, name: 'Life below water', icon: goal14, colour: '#0a97d9', targets: ['14.1'] },
]

/** A reference link, opening in a new tab. */
function Ref({ href, children }) {
  return (
    <a className="cs-link" href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

/**
 * The demo: a recording of the app in use, with the player's controls. It
 * plays (muted) while half of it is on screen and pauses when it leaves;
 * under reduced motion or data saver it waits on its poster for a press of
 * play.
 */
function DemoVideo({ src, poster, label }) {
  const videoRef = useRef(null)
  const reduced = useReducedMotion()
  const saveData = useSaveData()
  const still = reduced || saveData
  const [boxRef, inView] = useInView({ threshold: 0.5 })

  useEffect(() => {
    const el = videoRef.current
    if (!el || still) return
    if (inView) el.play().catch(() => {})
    else el.pause()
  }, [inView, still])

  return (
    <div ref={boxRef} className="cs-figure su-demo">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        controls
        preload={still ? 'none' : 'metadata'}
        aria-label={label}
      />
    </div>
  )
}

export function ShoreUpArticle({ next }) {
  return (
    <article className={`${ARTICLE} su-article`}>
      <CaseHero src={globeVideo} aspect="16 / 9" label="The Shore-Up globe, turning, with beach clean-ups pinned around the world" />

      <ClientLine logo={shoreUpLogo}>Hackathon project</ClientLine>

      {/* Tucked up under the client label so the two read as one unit. */}
      <h1 className="font-display m-0 mt-[var(--cs-2)] text-[length:var(--text-hero)] leading-[0.95] text-[var(--color-ink)]">
        Shore-Up
      </h1>

      <Tags tags={['HACKATHON', 'WEB APP', 'SUSTAINABILITY']} />

      {/* ------------------------------- facts ---------------------------- */}
      <Section id="overview">
        <RoleCard
          cells={[
            ['My role', ['UX Researcher', 'UI Designer', 'Brand Designer']],
            ['Duration', ['1 Day Sprint', '6 Hours']],
            ['Team', ['Myself', 'Daniel Chahine']],
            ['Tools', ['Figma', 'Claude Code', 'Google Slides']],
          ]}
        />
      </Section>

      {/* ------------------------------ problem --------------------------- */}
      <Section id="problem">
        <Eyebrow>Problem statement</Eyebrow>
        <h2 className={HEAD}>
          How can we bring together communities around the world to help clean local polluted beaches?
        </h2>
      </Section>

      {/* ------------------------------ solution -------------------------- */}
      <Section id="solution">
        <Eyebrow>Solution statement</Eyebrow>
        <h2 className={HEAD}>Well here’s how, show up to shore up!</h2>
        <P>
          We created a website that encourages users to clean up local beach shores alongside a community, users
          also have direct connections with global cleaners to stay connected and motivate each other to keep our
          beaches clean.
        </P>
      </Section>

      {/* ------------------------------ research -------------------------- */}
      <Section id="research">
        <Eyebrow>Research</Eyebrow>
        <P>
          An estimated <Ref href={OCEAN_STATS}>8 million tons</Ref> of trash enters the ocean every year. Of
          what’s already there, about 15% ends up on beaches.
        </P>
        <P>
          Pew Research Center found that among social media users, nearly seven-in-ten Gen-Zers (69%) say they
          felt <Ref href={PEW}>anxious about the future</Ref> the most recent time they saw content about
          addressing climate change online.
        </P>
        <P>
          Shore-Up gives that worry somewhere to go: a cleanup at a beach nearby is something to do this weekend,
          and seeing people clean shores around the world shows each person the difference they are making
          together.
        </P>

        <h3 className={HEAD}>UN Sustainable Development Goals</h3>
        <P>
          The hackathon was built around the UN’s 17 <Ref href={UN_GOALS}>Sustainable Development Goals</Ref>.
          Shore-Up targets four of them: 3, 6, 11 and 14.
        </P>
        <figure className="cs-figure su-goals">
          <ul className="su-goals__list">
            {GOALS.map((g) => (
              <li key={g.n} className="su-goal" style={{ '--goal': g.colour }}>
                <img src={g.icon} alt={`Goal ${g.n}: ${g.name}`} width="466" height="466" loading="lazy" decoding="async" />
                <span
                  className="su-goal__targets"
                  aria-label={`${g.targets.length > 1 ? 'Targets' : 'Target'} ${g.targets.join(' and ')}`}
                >
                  {g.targets.map((t) => (
                    <span key={t} className="su-goal__target" aria-hidden="true">
                      {t}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <figcaption className="su-goals__credit">
            Goal icons: <Ref href={UN_GOALS}>United Nations</Ref>
          </figcaption>
        </figure>
      </Section>

      {/* -------------------------------- demo ---------------------------- */}
      <Section id="demo">
        <Eyebrow>Demo</Eyebrow>
        <h2 className={HEAD}>Searching Woodbine Beach, Toronto</h2>
        <P>
          Search a beach and the map flies in to it. Each zone of the shore is scored by how clean it is and
          whether the water is safe, with cleanups to join or host and posts from people who have cleaned it.
        </P>
        <DemoVideo
          src={demoVideo}
          poster={demoPoster}
          label="Demo: searching Woodbine Beach in Shore-Up, then looking through its zones, cleanups and community posts"
        />
      </Section>

      <Outro next={next} />
    </article>
  )
}
