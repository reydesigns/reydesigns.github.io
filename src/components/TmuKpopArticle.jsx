import { AttendanceChart, ATTENDANCE_AVERAGES } from './AttendanceChart'
import { AboutScrollMockup, EventsCarouselMockup } from './TmuMockups'
import {
  ARTICLE,
  CaseHero,
  ClientLine,
  Eyebrow,
  HEAD,
  NumberedList,
  Outro,
  P,
  RoleCard,
  Section,
  Tags,
} from './caseStudyParts'
import tmuVideo from '@assets/tmu-kpop/video/walkthrough-1080p.mp4'
import tmuLogo from '@assets/brand/icons/clients/tmu-kpop.png'
import homeMacbook from '@assets/tmu-kpop/images/web/home-macbook.webp'
import faqMacbook from '@assets/tmu-kpop/images/web/faq-macbook.webp'
import teamComposite from '@assets/tmu-kpop/images/web/team-composite.webp'
import cardAbout from '@assets/tmu-kpop/images/web/card-about.webp'
import cardEvents from '@assets/tmu-kpop/images/web/card-events.webp'
import cardTeam from '@assets/tmu-kpop/images/web/card-team.webp'
import cardFaq from '@assets/tmu-kpop/images/web/card-faq.webp'

/* ---------------------------------------------------------------------------
   TMU K-POP revamp.

   Layout and copy follow Assets/tmu-kpop/tmukpop case study.png (6912×24000,
   4× a 1728pt frame). The last section, "PROCESS" in the comp, is ROI by
   client request, and its content — the attendance chart, the conclusion and
   the three changes — was added on top of the comp.

   The page screens break out of the article column into a wide band, as in the
   comp: each is a mockup on the left with an OLD / SKETCH card on the right.
   The band is centred on the article (which is itself offset right of the
   fixed nav), so it lands where the comp puts it — 13–91% of the frame.

   Images were prepared from the client's exports in Assets/tmu-kpop/images/
   into images/web/ (resized WebP). The OLD/SKETCH cards and the Meet the Team
   composite (laptop + phone) only exist in the comp, so they are cut from it
   with the comp's page ground made transparent.
--------------------------------------------------------------------------- */

const H2 = HEAD


/**
 * One page of the new site: heading, mockup, and the OLD / SKETCH card.
 * `mock` places the mockup inside the left column ([left offset, width] as a
 * share of that column), measured off the comp row by row.
 */
function ScreenRow({ title, card, cardAlt, cardSize, mock: [x, w], children }) {
  return (
    <div className="cs-wide tk-row">
      <h3 className={`${HEAD} tk-row-head uppercase`}>{title}</h3>
      <div className="tk-row-mock" style={{ '--mock-x': x, '--mock-w': w }}>
        {children}
      </div>
      <img
        src={card}
        alt={cardAlt}
        width={cardSize[0]}
        height={cardSize[1]}
        loading="lazy"
        decoding="async"
        className="tk-row-card block h-auto"
      />
    </div>
  )
}

/** A still page screen. */
function Still({ src, alt, size }) {
  return (
    <img
      src={src}
      alt={alt}
      width={size[0]}
      height={size[1]}
      loading="lazy"
      decoding="async"
      className="block h-auto w-full"
    />
  )
}

export function TmuKpopArticle({ next }) {
  const { before, after } = ATTENDANCE_AVERAGES
  return (
    <article className={ARTICLE}>
      <CaseHero src={tmuVideo} aspect="2584 / 1582" label="Walkthrough of the new TMU K-POP website" />

      <ClientLine logo={tmuLogo}>TMU-KPOP</ClientLine>

      {/* Tucked up under the client label so the two read as one unit. */}
      <h1 className="font-display m-0 mt-[var(--cs-2)] text-[length:var(--text-hero)] leading-[0.95] text-[var(--color-ink)]">
        TMU-KPOP
        <br />
        revamp
      </h1>

      <Tags tags={['WEB DESIGN', 'RESPONSIVE', 'RE-VAMP']} />

      {/* ------------------------------ objective ------------------------- */}
      <Section id="objective">
        <Eyebrow>Objective</Eyebrow>
        <P>
          Revamping the TMU K-POP website before the official start of the school year. This was a
          time challenge in the sense where it pushed me to really work as fast with high quality
          stakes.
        </P>
        <P>
          The overall targeted demographic were students at TMU, this website produced a positive
          ROI by the end of the semester and received many compliments from students of how
          beneficial this re-vamp was.
        </P>
        <RoleCard
          cells={[
            ['My role', ['Website Designer', 'Graphic Designer']],
            ['Duration', ['2 Weeks']],
            ['Team', ['Myself']],
            ['Tools', ['WIX', 'Procreate']],
          ]}
        />
      </Section>

      {/* ------------------------------- process -------------------------- */}
      <Section id="process">
        <Eyebrow>Process</Eyebrow>
        <P>
          Revamping the TMU K-POP website before the official start of the school year. This was a
          challenge where it pushed me to really work as fast with high quality stakes before
          student orientation.
        </P>
        <P>
          The overall targeted demographic were students at TMU, this website produced a positive
          ROI by the end of the semester and received many compliments from students of how
          beneficial this re-vamp was.
        </P>

        <div className="cs-wide tk-home">
          <Still
            src={homeMacbook}
            size={[2400, 1402]}
            alt="The new TMU K-POP home page on a MacBook: “We are TMU K-POP!” over a red-to-black gradient, a group photo, and the club's Spotify playlist."
          />
        </div>

        <ScreenRow
          title="About us"
          mock={['10.4%', '89.6%']}
          card={cardAbout}
          cardSize={[900, 1222]}
          cardAlt="Old: the previous Weebly About page, white text on black. Sketch: a hand-drawn About Us layout with a brief description, a team photo, and three focus cards for music, food and RPD."
        >
          <AboutScrollMockup />
        </ScreenRow>

        <ScreenRow
          title="Current events"
          mock={['0%', '97.7%']}
          card={cardEvents}
          cardSize={[900, 1222]}
          cardAlt="Old: the previous Fall 2022 events page, a grid of event posters. Sketch: a hand-drawn Past Events grid with titles under each poster."
        >
          <EventsCarouselMockup />
        </ScreenRow>

        <ScreenRow
          title="Meet the team"
          mock={['0%', '105%']}
          card={cardTeam}
          cardSize={[900, 1080]}
          cardAlt="Old: the previous Presidential Team page. Sketch: a hand-drawn team page with a photo and bio for each member."
        >
          <Still
            src={teamComposite}
            size={[2400, 1373]}
            alt="The new Meet the Team page on a MacBook, with the Admin Team's photos and roles, beside a phone showing the Directors' bios."
          />
        </ScreenRow>

        <ScreenRow
          title="FAQ"
          mock={['11.4%', '82.8%']}
          card={cardFaq}
          cardSize={[900, 1080]}
          cardAlt="Old: the previous FAQ – General page. Sketch: a hand-drawn FAQ with membership policies as cards and questions as an accordion."
        >
          <Still
            src={faqMacbook}
            size={[2400, 1403]}
            alt="The new FAQ page on a MacBook: questions on membership, event fees and RSVPs as a grid of cards, each with a large red quotation mark."
          />
        </ScreenRow>
      </Section>

      {/* --------------------------------- ROI ---------------------------- */}
      <Section id="roi">
        <Eyebrow>ROI</Eyebrow>
        <h2 className={H2}>Four times as many students at every event</h2>
        <P>
          In the school year before the re-vamp, a typical event drew 20 to 50 students. In the
          first year on the new site, the same events drew 100 to 200, an average of {after}{' '}
          a night against {before} the year before, with Performance Night &rsquo;24 bringing in
          196.
        </P>
        <AttendanceChart />

        <h2 className={H2}>Conclusion</h2>
        <P>
          Students enjoy using the new site, and the feedback we heard most was that it is simply
          easier, especially registering for events. Everything a new member needs is now
          one click from the home page: what the club is, what&rsquo;s coming up, who runs it, and
          how to RSVP.
        </P>
        <P>
          I started by auditing the old site page by page, then sketched each new page on paper
          (the sketches beside each screen above) before building it in the club&rsquo;s red and
          black. Every page was checked on desktop and on a phone before orientation, since that
          is where most students first find us.
        </P>

        <h2 className={H2}>Why Wix</h2>
        <P>
          The old site ran on Weebly and could only show information. It couldn&rsquo;t
          sign anyone up. Wix gave the club member log-in and event RSVPs built in, page layouts I
          could tune separately for phones, and a drag-and-drop editor that any future executive
          can update without writing code. For one designer with two weeks before orientation, it
          was the fastest way to ship something the club could keep running after me.
        </P>

        <h2 className={H2}>What I would change now</h2>
        <NumberedList
          items={[
            'Test with first-year students before launch – I gathered feedback after the site went live; a handful of short usability sessions beforehand would have caught friction in the RSVP flow sooner.',
            'Let RSVPs sync to students’ own calendars – a registration is easy to forget, and a calendar invite with a reminder would turn more sign-ups into people at the door.',
            'Leave a small design system behind – documented colours, type and card styles inside Wix, so the executives who inherit the site keep new pages consistent with the rest.',
          ]}
        />
      </Section>

      <Outro next={next} />
    </article>
  )
}
