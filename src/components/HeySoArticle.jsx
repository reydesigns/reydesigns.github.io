import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/lib/useReducedMotion'
import {
  ARTICLE,
  Accent,
  CaseHero,
  ClientLine,
  Eyebrow,
  HEAD,
  NumberedList,
  Outro,
  P,
  Section,
  Tags,
} from './caseStudyParts'
import heysoVideo from '@assets/heyso/video/walkthrough-1080p.webm'
import heysoLogo from '@assets/brand/icons/clients/heyso.png'
import imgRole from '@assets/heyso/images/figures/01-role-team-tools.png'
import imgThemes from '@assets/heyso/images/figures/02-theme-brainstorm.png'
import imgKeywords from '@assets/heyso/images/figures/03-research-figjam-board.png'
import imgPersona from '@assets/heyso/images/figures/06-user-persona.png'
import imgFlows from '@assets/heyso/images/figures/07-user-flows.png'
import imgWireframes from '@assets/heyso/images/figures/08-lofi-wireframes.png'
import imgVoting from '@assets/heyso/images/figures/10-voting.png'
import imgScreens from '@assets/heyso/images/figures/11-imessage-screens.png'
import finalVision from '@assets/heyso/images/figures/final/01-event-vision.png'
import finalLove from '@assets/heyso/images/figures/final/02-what-you-love.png'
import finalSummary from '@assets/heyso/images/figures/final/03-curation-summary.png'
import gifVision from '@assets/heyso/video/2.gif'
import gifLove from '@assets/heyso/video/1.gif'
import gifSummary from '@assets/heyso/video/3.gif'

/* ---------------------------------------------------------------------------
   Copy is transcribed from Assets/heyso/images/case-study.png, verbatim —
   including "Qualititative", "itnerary" and "Our teams response", which are
   the client's own spellings. Nothing here is written, only copied.

   Type sizes were measured off that comp by row-profiling the ink of each
   line (cap height and leading) rather than eyeballed. The comp resolves to
   a hero and one heading style; section headings and sub-headings were
   unified to the same size at the client's request.

   IMAGES. Every figure is re-cut from the comp at native resolution into
   Assets/heyso/images/figures/, tight to the artwork. The earlier slices were
   exported against the text column's rhythm rather than the artwork's real
   bounds, which (a) left a band of the comp's own page ground baked in beside
   several cards — the grey rectangles peeking out from behind them — and
   (b) cut the bottom off the keyword board and the caption strip off the lo-fi
   wireframes. Nothing in CSS was clipping anything; the pixels were missing.

   SPACING. Nothing in this file sets a vertical margin. Sections are `cs-flow`
   containers and the whole rhythm comes from the scale in case-study.css.
--------------------------------------------------------------------------- */

/* One heading style for both levels — see caseStudyParts. */
const H2 = HEAD
const H3 = HEAD

/**
 * An image block from the comp.
 *
 * Every one carries its native pixel size, so the box is reserved before the
 * bytes arrive and nothing below it moves when they do — which also keeps the
 * IntersectionObserver that drives the nav honest.
 *
 * `inset` marks the narrower cards; the comp pulls those in ~9.5% on each side
 * while the boards and mockups run the full column.
 *
 * `tab` is the measured pixel width of the folder tab painted into the left of
 * the slice. The comp aligns the card with the body column and lets the tab
 * hang outside it, so the figure is widened and pulled left by the tab's share
 * of its own width — see .cs-figure--tab in case-study.css.
 */
function Figure({ src, width, height, alt, inset = false, tab = 0 }) {
  const k = tab / width
  return (
    <figure
      className={`cs-figure m-0 p-0${tab ? ' cs-figure--tab' : ''}${inset ? ' cs-figure--inset' : ''}`}
      style={tab ? { '--cs-tab-k': `${((100 * k) / (1 - k)).toFixed(3)}%` } : undefined}
    >
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className="block h-auto w-full"
        style={{ aspectRatio: `${width} / ${height}` }}
      />
    </figure>
  )
}

/**
 * How far a block has been read into view, 0–1, from an IntersectionObserver
 * rather than a scroll handler: the browser does the geometry off the main
 * thread and nothing runs on every frame of a Lenis glide.
 *
 * The value only ever climbs. A quote arrives and stays arrived — fading it
 * back out on the way past would be a different effect from the one asked for.
 * Under reduced motion the observer is never created and the block is fully
 * opaque from the first paint.
 */
function useReadIn(reduced) {
  const ref = useRef(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (reduced) return undefined
    const el = ref.current
    if (!el) return undefined

    let peak = 0
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Full opacity once the block is 60% on screen, so a quote finishes
          // arriving while it is still being read rather than as it leaves.
          const v = Math.min(1, entry.intersectionRatio / 0.6)
          if (v > peak) {
            peak = v
            setProgress(v)
          }
        }
        if (peak >= 1) io.disconnect()
      },
      { threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reduced])

  return [ref, reduced ? 1 : progress]
}

/** A maroon Pixelta pull-quote with the speaker set small and grey beside it. */
function Quote({ children, who }) {
  const reduced = useReducedMotion()
  const [ref, progress] = useReadIn(reduced)
  const from = 0.15

  return (
    <div
      ref={ref}
      className="cs-reveal flex items-start justify-between gap-[var(--cs-5)]"
      style={{ opacity: from + (1 - from) * progress }}
    >
      <p className="m-0 max-w-[82%] text-[length:var(--text-h1)] leading-[1.16] font-normal text-[var(--color-maroon)]">
        <span className="quote-mark">&ldquo;</span>
        <Accent>{children}</Accent>
        <span className="quote-mark">&rdquo;</span>
      </p>
      <span className="shrink-0 pt-[0.35em] text-[length:var(--text-body)] text-[var(--color-ink-muted)] opacity-70">
        {who}
      </span>
    </div>
  )
}

/** The comp numbers its lists in maroon Pixelta, hanging left of the text. */

/* ---------------------------------------------------------------------------
   Statistics and insights.

   Both were flat pictures of a card in the comp export. They are markup now,
   so the figures can be set at --cs-stat, every row shares one baseline grid,
   and the rules between rows are real hairlines rather than pixels.

   "80-100" and "22-31" keep plain hyphens: Pixelta has no dash glyph, and an
   en dash would silently fall back mid-word.
--------------------------------------------------------------------------- */
const STATISTICS = [
  ['80-100', '...of interactions are needed to become close friends'],
  ['No Personal Time', '22-31 year olds have the lowest amount of leisure time'],
  ['47%', '...of Canadians lose touch with a few friends after 12 months'],
]

const INSIGHTS = [
  ['😴', 'Working young adults are too busy or have no social battery left to plan hangouts with friends'],
  ['🫥', 'Some have nerves while trying to start off a message or sending questions to friends'],
  ['👥', 'The greater the group is, the harder it is to manage information overload'],
]

function Statistics() {
  return (
    <div className="cs-figure cs-card cs-rows">
      {STATISTICS.map(([figure, note]) => (
        <div
          key={figure}
          className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-center gap-[var(--cs-5)]"
        >
          <span className="font-display text-[length:var(--cs-stat)] leading-[1.02] text-[var(--color-maroon)]">
            {figure}
          </span>
          <P>{note}</P>
        </div>
      ))}
    </div>
  )
}

function Insights() {
  return (
    <div className="cs-figure cs-card cs-rows">
      {INSIGHTS.map(([emoji, note]) => (
        <div key={note} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-[var(--cs-5)]">
          <span aria-hidden="true" className="text-[length:var(--cs-emoji)] leading-none">
            {emoji}
          </span>
          <P>{note}</P>
        </div>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Final product.

   Each screen is a screen-recorded GIF (Assets/heyso/video/, 1920×1208: a
   phone in a wide white frame). The grid below wants a portrait slot, and the
   exports are not uniform: each carries a black double rule along its bottom
   edge, and 1.gif's phone is ~5% wider and ~6% taller than the other two. So
   every GIF is cropped to its own phone. `phone` is that phone's bounding box
   in GIF pixels (measured from a frame, excluding the frame border and the
   rule); phoneStyle() scales it to one shared height inside the slot and
   keeps the rule just outside it. Re-measure if a GIF is re-exported.

   `gif` is matched to the still it replaces by content (1.gif opens on the
   interests screen, 2.gif the event vision, 3.gif the summary), not by number.

   A GIF can't be paused, so under prefers-reduced-motion the <picture> swaps
   in the original still instead (a plain portrait image, so the crop vars are
   dropped by the motion-reduce classes below). The GIF's white frame is
   multiplied into the card so no pale rectangle shows around it.
--------------------------------------------------------------------------- */
const GIF_SIZE = [1920, 1208]
/** The slot the old stills filled. */
const STILL_SIZE = [500, 1040]
/** Phone height as a share of the slot, and the gap above it. The bottom gap
 *  is what is left (1.5%). It must stay under ~2.3%: the GIFs' baked-in rule
 *  is 27 GIF px under 1.gif's phone (y 1199), and a bigger gap would show it. */
const PHONE_H = 0.94
const PHONE_TOP = 0.045

/** Width, left and top (as CSS vars) that place a GIF's phone in the slot. */
function phoneStyle([x0, y0, x1, y1]) {
  const slotH = STILL_SIZE[1] / STILL_SIZE[0] // slot height in slot widths
  const k = (PHONE_H * slotH) / (y1 - y0) // slot widths per GIF pixel
  const pct = (n) => `${(n * 100).toFixed(3)}%`
  return {
    '--gw': pct(GIF_SIZE[0] * k),
    '--gl': pct(0.5 - ((x0 + x1) / 2) * k),
    '--gt': pct((PHONE_TOP * slotH - y0 * k) / slotH),
  }
}

const FINAL_PRODUCT = [
  {
    gif: gifVision,
    still: finalVision,
    phone: [704, 75, 1214, 1122],
    alt: "The heyso event flow: what's your event vision (chill and chat, mingle and munch, or dine and discover), then who is attending, then how heyso should curate the event.",
  },
  {
    gif: gifLove,
    still: finalLove,
    phone: [690, 67, 1228, 1172],
    alt: 'The heyso interests flow: what do you love to do (instruments, hike, boxing, singing, comedy, bouldering, movies, candles, drawing, concert, tech, swimming, wine tasting, rollerskating, shopping, dancing, biking), a thank-you, then what the group is feeling for lunch.',
  },
  {
    gif: gifSummary,
    still: finalSummary,
    phone: [704, 75, 1214, 1122],
    alt: 'The heyso curation summary sent back into the group chat: three event options with dates and times and a prompt that you are one step closer to planning your event, then the results.',
  },
]

function FinalProduct() {
  return (
    <figure className="cs-figure cs-card--surface m-0 rounded-[var(--radius-card)] px-[4%] py-[2.4%]">
      <ul className="m-0 grid list-none grid-cols-3 place-items-center p-0">
        {FINAL_PRODUCT.map((shot) => (
          <li key={shot.gif} className="w-[63%]">
            <div
              className="relative overflow-hidden"
              style={{ aspectRatio: `${STILL_SIZE[0]} / ${STILL_SIZE[1]}` }}
            >
              <picture>
                <source media="(prefers-reduced-motion: reduce)" srcSet={shot.still} />
                <img
                  src={shot.gif}
                  alt={shot.alt}
                  width={GIF_SIZE[0]}
                  height={GIF_SIZE[1]}
                  loading="lazy"
                  decoding="async"
                  className="absolute left-[var(--gl)] top-[var(--gt)] block h-auto w-[var(--gw)] max-w-none object-cover mix-blend-multiply motion-reduce:left-0 motion-reduce:top-0 motion-reduce:h-full motion-reduce:w-full"
                  style={phoneStyle(shot.phone)}
                />
              </picture>
            </div>
          </li>
        ))}
      </ul>
    </figure>
  )
}

export function HeySoArticle({ next }) {
  return (
    /* The masthead is three one-off relationships rather than a rhythm, so it
       is not a cs-flow — it names its steps from the scale directly. */
    <article className={ARTICLE}>
      <CaseHero
        src={heysoVideo}
        aspect="2584 / 1582"
        label="Walkthrough of the Heyso iMessage extension"
      />

      <ClientLine logo={heysoLogo}>WITM: WeDesignTech Hackathon 2023</ClientLine>

      {/* Tucked up under the event label so the two read as one unit. */}
      <h1 className="font-display m-0 mt-[var(--cs-2)] text-[length:var(--text-hero)] leading-[0.95] text-[var(--color-ink)]">
        Heyso...
      </h1>

      <Tags tags={['UX RESEARCH', 'MOBILE', 'DESIGNATHON']} />

      {/* ------------------------------ objective ------------------------- */}
      <Section id="objective">
        <Eyebrow>Objective</Eyebrow>
        <P>
          My friends and I teamed up to compete in the annual WITM &ndash; WeDesignTech Hackathon
          2023 competition. Over 80 teams have participated to create a product that mediates an
          information society between its benefits and disadvantages.
        </P>
        <P className="font-bold">
          Using technology, your challenge is to mediate between the benefits of an information
          society and the disadvantages it comes with.
        </P>
        <Figure
          src={imgRole}
          width={2084}
          height={978}
          inset
          alt="My role: product designer, researcher, brand designer. Duration: 1 day sprint, 13 hours. Team: Stella, Miguel, Curtis. Tools: Figma, FigJam."
        />
      </Section>

      {/* ------------------------------- problem -------------------------- */}
      <Section id="problem">
        <Eyebrow>Problem</Eyebrow>
        <h2 className={H2}>Struggles of scheduling plans as an adult</h2>
        <P>
          Our teams response to this theme resulted in{' '}
          <Accent className="text-[length:calc(var(--text-body)*1.45)]">Heyso...</Accent>
        </P>
        <P>
          An innovative social event planning app that revolutionizes the way friends coordinate and
          experience gatherings, leveraging AI-driven scheduling, personalized activity suggestions,
          and interactive features to transform group decision-making into a seamless, enjoyable
          journey.
        </P>
      </Section>

      {/* ------------------------------- research ------------------------- */}
      <Section id="research">
        <Eyebrow>Research</Eyebrow>
        <h2 className={H2}>
          With the broad theme given, we branched through different zones within the{' '}
          <Accent>information overload</Accent> problem space.
        </h2>
        <Figure
          src={imgThemes}
          width={2775}
          height={3011}
          tab={197}
          alt="Three candidate zones — overstimulation of information, balance between work and life, efficiency for student plus study life — above the team's 10-minute FigJam brainstorm on life in an information society."
        />

        <h2 className={H2}>
          With three problem spaces in mind, we finalized with one using a voting system based on
          feasibility.
        </h2>
        <P>
          We found that the ideas that were voted the most, all add one topic in common: time/info
          management. This alluded to three main branches tackling students, young professionals,
          and overall overstimulation of information. We followed this by voting between the three
          in a summarized manner.
        </P>
        <Figure
          src={imgVoting}
          width={2783}
          height={976}
          tab={199}
          alt="The 3/3 voting board: how to leverage efficiency with students and their studies, creating balance between work and personal life with young professionals, and how to mitigate overstimulation in the news sector."
        />

        <h2 className={H2}>
          Confirming assumptions through qualitative and quantitative research.
        </h2>
        <P>
          There were numerous assumptions based on the topic we chose. This influenced important
          questions we addressed during the beginning stages of our research.
        </P>
        <NumberedList
          items={[
            'What current event planning apps already exist? Are they reviewed well by users?',
            'What factors prevent people from planning events with friends?',
            'How much time are people spending planning events with friends?',
            'Is planning events for young professionals even a relevant problem?',
          ]}
        />

        <h3 className={H3}>Quantitative research &ndash; keyword searching</h3>
        <P>
          There were numerous assumptions based on the topic we chose. This influenced important
          questions we addressed during the beginning stages of our research.
        </P>
        <Figure
          src={imgKeywords}
          width={2783}
          height={1293}
          tab={199}
          alt="The team's keyword-searching FigJam board, with findings collected per person and a summary of the benefits and challenges of planning activities with friends."
        />
        <Statistics />

        <h3 className={H3}>Qualititative research &ndash; user interviews</h3>
        <P>I conducted user interviews with my three teammates.</P>
        <P>
          To have a deeper empathic understanding with the user, I asked my three teammates: Stella,
          Curtis, and Miguel three questions. These relevant users are working part-time Co-Op roles
          and are all aged between 21-24.
        </P>
        <P>
          Analyzing key points and observations (through empathy maps) highlighted a few recurring
          themes:
        </P>
        <div className="flex flex-col gap-[var(--cs-6)]">
          <Quote who="Miguel">
            Whenever me and my friends try planning something in the group chat, it usually is never
            ending since we have busy schedules
          </Quote>
          <Quote who="Curtis">We can never seem to find an interesting place to hang...</Quote>
          <Quote who="Stella">
            As an introvert, I still like to hangout with friends but I usually feel overwhelmed
            when I initiate
          </Quote>
        </div>

        <h3 className={H3}>Validating our research</h3>
        <Insights />

        <h2 className={H2}>Who is our targeted user? &ndash; pain points &amp; goals</h2>
        <P>
          The utilization of Frank was an important step forward into understanding further of who
          our target market really is and how might this product impact their lives positively.
        </P>
        <Figure
          src={imgPersona}
          width={2781}
          height={1315}
          tab={197}
          alt="User persona: Frankie Frank, the busy bee. 25 years old, working full-time. Pain points: planning social hangouts is a chore, scheduling conflicts, decision fatigue. Goals: plan social hangouts with a breeze, gain quick consensus in group discussions, curation of social activities relevant for a group."
        />
      </Section>

      {/* ------------------------------- solution ------------------------- */}
      <Section id="solution">
        <Eyebrow>Solution</Eyebrow>
        <P>
          After concluding three pain points from the research we have gathered, our team began
          brainstorming solutions &ndash; basically our key features.
        </P>
        <P>
          These ideas were then voted for three focused key features. You&apos;ll notice we chose to
          use AI as a significant trait of the app. We believed that because of the sudden rise of
          AI application in interfaces, we decided to utilize this opportunity of building new
          innovative AI systems. In this particular case, AI is a valid implementation due to its
          ability of easing common troubles consumers face while using an interface.
        </P>

        <h2 className={H2}>How will Frank use our in-app feature?</h2>
        <P>Assumptions:</P>
        <ul className="m-0 flex list-none flex-col gap-[var(--cs-1)] p-0">
          <li className="text-[length:var(--text-body)] leading-[1.3] text-[var(--color-ink)]">
            <span aria-hidden="true">💬</span> Everyone has iMessage (iOS) on their iphones
          </li>
          <li className="text-[length:var(--text-body)] leading-[1.3] text-[var(--color-ink)]">
            <span aria-hidden="true">📅</span> Everyone has an account in Heyso and their google
            calendars are synced
          </li>
        </ul>
        <Figure
          src={imgFlows}
          width={2824}
          height={2787}
          tab={244}
          alt="Three user flows: Frank's before-app state, the iMessage state across pre-event, during event and post-event, and the Heyso state from downloading the app to an AI-recommended homepage."
        />

        <h3 className={H3}>Ideating + Iterating</h3>
        <P>
          We used the user flow and key features to split up the work from here. Curtis, Stella, and
          I were responsible with curating the prototype.
        </P>
        <p className={HEAD}>
          Specifically, I was responsible in designing the{' '}
          <span className="quote-mark">&quot;</span>
          <Accent>iMessage Screens.</Accent>
          <span className="quote-mark">&quot;</span>
        </p>
        <P>
          During the iteration process, I would ask my teammates questions for feedback while
          sketching to ensure we are all on the same page and understand how our extension works in
          iMessage.
        </P>
        <Figure
          src={imgWireframes}
          width={2584}
          height={722}
          alt="Lo-fi wireframes, before and after, for place/activity selection, the invite of heyso sent, and the poll system plus finalized itnerary."
        />
        <Figure
          src={imgScreens}
          width={2584}
          height={866}
          alt="The hi-fi iMessage screens in sequence: the invite, picking what we're feeling, confirming, the live results, and the finalized lunch hangout."
        />
      </Section>

      {/* ---------------------------- final product ----------------------- */}
      <Section id="final-product">
        <Eyebrow>Final product</Eyebrow>
        <FinalProduct />
      </Section>

      {/* ------------------------------- lessons -------------------------- */}
      <Section id="lessons">
        <Eyebrow>Lessons</Eyebrow>
        <h2 className={H2}>What did I learn and what would I change?</h2>
        <NumberedList
          items={[
            "Unfortunately, we didn't win this hackathon. Despite not winning, it doesn't mean this product is worth nothing. Here are some things I learned during this journey:",
            [
              'Figure out how to utilize the tagging filtration system better – The tags are a good way to filter out places and personalities in the friend group; however, I definitely think showing how it benefits the consumer would have been a better approach.',
              'Go more in-depth with competitive analysis – Due to time restrictions, we could not perform a traditional competitive analysis. I did search apps in the market and compare a few features but never visually (more detailed) mapped it out.',
            ],
            'Research more about AI implementation and collaborate with system engineers – If I had the ability, I would definitely cross check with software engineers and cybersecurity professionals to see how safe and secure this specific AI system can be.',
          ]}
        />
      </Section>

      <Outro next={next} />
    </article>
  )
}
