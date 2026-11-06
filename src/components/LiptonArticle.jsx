import { useEffect, useRef } from 'react'
import { useScrollMotion } from '@/lib/useScrollMotion'
import { useInView } from '@/lib/useInView'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useSaveData } from '@/lib/useSaveData'
import {
  ARTICLE,
  CaseHero,
  ClientLine,
  Eyebrow,
  HEAD,
  Outro,
  P,
  RoleCard,
  Section,
  Tags,
} from './caseStudyParts'
import liptonVideo from '@assets/lipton/video/walkthrough-1080p.mp4'
import walkVideo from '@assets/lipton/video/app-walkthrough.mp4'
import walkPoster from '@assets/lipton/video/app-walkthrough-poster.webp'
import liptonLogo from '@assets/brand/icons/clients/lipton.png'
import f1a from '@assets/lipton/Images/web/f1-a.webp'
import f1b from '@assets/lipton/Images/web/f1-b.webp'
import f2l from '@assets/lipton/Images/web/f2-l.webp'
import f2c from '@assets/lipton/Images/web/f2-c.webp'
import f2r from '@assets/lipton/Images/web/f2-r.webp'
import p1 from '@assets/lipton/Images/web/p-1.webp'
import p2 from '@assets/lipton/Images/web/p-2.webp'
import p3 from '@assets/lipton/Images/web/p-3.webp'
import p4 from '@assets/lipton/Images/web/p-4.webp'
import brandIdentity from '@assets/lipton/Images/web/brand-identity.webp'

/* ---------------------------------------------------------------------------
   Lipton Tea — mobile app re-vamp.

   Layout and copy follow Assets/lipton/lipton tea case study.png (6912×14008,
   4× a 1728pt frame). The three screen compositions are positioned from the
   comp in percentages of the article column, so they keep their overlaps at
   any width; the phones themselves are cut from the comp at full resolution
   (Assets/lipton/Images/web/, made by scripts/prep-lipton-images.mjs).
   Two departures, so the grey cards sit the same way in both features
   (client: they looked all over the place): each card is centred on its
   phones' height and starts just behind the last phone, and the dashboard
   trio is set at 86% of the comp's size (centred), which leaves its card a
   readable measure.

   Motion: each composition reads its progress through the viewport as `--p`
   (useScrollMotion) and every transform is derived from it in case-study.css —
   phones rise and settle, the dashboard trio fans out from behind the centre
   screen, the product row lands in a staggered wave. Reduced motion shows the
   final layout.

   Two additions on top of the comp: the app walkthrough video before the
   branding (client request), and the brand identity board under the empty
   "Lipton Tea branding assets" heading.

   The article carries `lp-article`, which opens up the shared spacing scale
   for this study alone (client: more room between each header and section).
--------------------------------------------------------------------------- */

const H2 = HEAD

/**
 * The maroon tab, tucked behind the phone it labels. `at` is that phone's own
 * [left, top] in the composition; case-study.css hangs the tab off it by the
 * same amount in every stage, so the three tabs line up the same way.
 */
function Tab({ children, at }) {
  const [x, y] = at
  return (
    <span aria-hidden="true" className="lp-tab" style={{ '--lp-tab-x': x, '--lp-tab-y': y }}>
      <span className="lp-tab-label">{children}</span>
    </span>
  )
}

/** A phone cut from the comp, placed in % of its composition. */
function Phone({ src, alt, size, at, className = '' }) {
  const [left, top, width] = at
  return (
    <img
      src={src}
      alt={alt}
      width={size[0]}
      height={size[1]}
      loading="lazy"
      decoding="async"
      className={`lp-phone ${className}`}
      style={{ left, top, width }}
    />
  )
}

function Stage({ aspect, label, children, className = '' }) {
  const ref = useScrollMotion()
  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      className={`lp-stage cs-figure ${className}`}
      style={{ aspectRatio: aspect }}
    >
      {children}
    </div>
  )
}

/* The nine screens, in the order a tea drinker meets them; the video draws
   them in this order (scripts/make-lipton-walkthrough.mjs). */
const WALK = [
  'Dashboard',
  'Your updates',
  'About our tea',
  'Monthly consumption',
  'Additives in your tea',
  'Shop',
  'Browse teas',
  'Your cart',
  'Subscriptions',
]

/**
 * The app walkthrough: a short looping video of every screen in order, the
 * one on show large in the middle, the row gliding on to the next every
 * couple of seconds (scripts/make-lipton-walkthrough.mjs). Nothing to scroll
 * or press: it plays on its own while it is on screen and pauses when it
 * leaves. Reduced motion, or data saver, shows its first frame with the
 * player's controls, to play it by choice.
 */
function Walkthrough() {
  const videoRef = useRef(null)
  const [boxRef, inView] = useInView({ threshold: 0.35 })
  const reduced = useReducedMotion()
  const saveData = useSaveData()
  const still = reduced || saveData

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    if (!inView) el.pause()
    else if (!still) el.play().catch(() => {})
  }, [inView, still])

  return (
    <div ref={boxRef} className="cs-wide lp-walk">
      <video
        ref={videoRef}
        src={walkVideo}
        poster={walkPoster}
        width={1600}
        height={900}
        loop
        muted
        playsInline
        controls={still}
        preload={still ? 'none' : 'metadata'}
        aria-label={`App walkthrough video, ${WALK.length} screens in order: ${WALK.join(', ')}`}
        className="lp-walk-video"
      />
    </div>
  )
}

export function LiptonArticle({ next }) {
  return (
    <article className={`${ARTICLE} lp-article`}>
      <CaseHero src={liptonVideo} aspect="2584 / 1582" label="Walkthrough of the Lipton Tea app re-vamp" />

      <ClientLine logo={liptonLogo}>Lipton Tea</ClientLine>

      <h1 className="font-display m-0 mt-[var(--cs-2)] text-[length:var(--text-hero)] leading-[0.95] text-[var(--color-ink)]">
        LIPTON TEA
      </h1>

      <Tags tags={['MOBILE', 'RE-VAMP', 'CLASS PROJECT']} />

      {/* ------------------------------ objective ------------------------- */}
      <Section id="objective">
        <Eyebrow>Objective</Eyebrow>
        <P>
          Revamp an already existing brand website/mobile application
          <br />
          For GCM 810 &ndash; Creativity, Clients, &amp; Design.
        </P>
        <RoleCard
          cells={[
            ['My role', ['UX/UI Designer']],
            ['Duration', ['2 Weeks', 'Report', 'Presentation']],
            ['Team', ['Lone Designer but collaborated effectively']],
            ['Tools', ['Figma', 'Illustrator', 'Photoshop']],
          ]}
        />
      </Section>

      {/* --------------------------- research outcome --------------------- */}
      <Section id="research-outcome">
        <Eyebrow>Research outcome</Eyebrow>

        <h2 className={H2}>Monthly Consumption</h2>
        <Stage aspect="2931 / 1567" label="Key feature 1: monthly consumption" className="lp-f1">
          <Tab at={['0.27%', '0.3%']}>
            #1 Key feature
          </Tab>
          <div className="lp-card" style={{ left: '52.89%' }}>
            <P>
              Considering the target consumer age ranges from 25&ndash;35 and categorizing this market
              to consume the most caffeine (avg. 3&ndash;7 cups per week) in these years (statistic).
            </P>
            <P>
              This alluded to adding a monthly consumption statistic the user can reference towards
              safe caffeine drinking habits!
            </P>
          </div>
          <Phone
            src={f1a}
            size={[759, 1562]}
            at={['0.27%', '0.3%', '25.86%']}
            className="lp-f1-a"
            alt="Monthly consumption screen: 60 black tea bags in November, averaging 2 bags a day."
          />
          <Phone
            src={f1b}
            size={[760, 1566]}
            at={['29.96%', '0%', '25.93%']}
            className="lp-f1-b"
            alt="Additives in your tea: caffeine, sugar and milk levels against the recommended amount."
          />
        </Stage>

        <h2 className={H2}>Dashboard your tea!</h2>
        <Stage aspect="2931 / 1608" label="Key feature 2: the tea dashboard" className="lp-f2">
          <Tab at={['-1.94%', '8.23%']}>
            #2 Key feature
          </Tab>
          <div className="lp-card" style={{ left: '56.23%' }}>
            <P>The user is able to access all tea-tools on the Lipton Tea dashboard.</P>
            <P>
              These include: Daily tea data input, cup full of information on tea, and the ability
              to subscribe to a monthly subscription box for everyday Lipton Tea drinkers.
            </P>
          </div>
          <Phone
            src={f2l}
            size={[624, 1518]}
            at={['-1.94%', '8.23%', '18.28%']}
            className="lp-f2-l"
            alt="Dashboard: Hi, Jade! with tea tools and a daily tea log."
          />
          <Phone
            src={f2r}
            size={[691, 1522]}
            at={['38.99%', '8.28%', '20.24%']}
            className="lp-f2-r"
            alt="About our tea, with green and lemon ginger teas and recipes."
          />
          <Phone
            src={f2c}
            size={[760, 1592]}
            at={['16.42%', '7%', '22.51%']}
            className="lp-f2-c"
            alt="Your updates: tea of November, and a subscription box expiring in 3 days."
          />
        </Stage>

        <h2 className={H2}>Product buying and subscription</h2>
        {/* The four phones run to the bottom of their bezels (comp y 9904–11278). */}
        <Stage aspect="2931 / 1374" label="Product buying and subscription" className="lp-p">
          <Tab at={['0%', '0%']}>Product</Tab>
          <Phone src={p1} size={[662, 1373]} at={['0%', '0%', '22.59%']} className="lp-p-1" alt="Shop: most popular green tea, bags and cans." />
          <Phone src={p2} size={[670, 1371]} at={['25.14%', '0.29%', '22.86%']} className="lp-p-2" alt="Browse teas with prices." />
          <Phone src={p3} size={[662, 1360]} at={['51.79%', '0.95%', '22.55%']} className="lp-p-3" alt="Your cart, with subtotal, tax and total." />
          <Phone src={p4} size={[659, 1355]} at={['77.62%', '1.38%', '22.45%']} className="lp-p-4" alt="Subscriptions: weekly, monthly and yearly boxes." />
        </Stage>

        <h2 className={H2}>Walk through the app</h2>
        <P>Every screen in the order a tea drinker meets them, from the dashboard to checkout.</P>
        <Walkthrough />
      </Section>

      {/* ------------------------------- branding ------------------------- */}
      <Section id="branding" className="lp-branding">
        <h2 className={H2}>Lipton Tea branding assets</h2>
        <img
          src={brandIdentity}
          alt="Lipton brand identity: the colour palette, Helvetica type specimen, and brand photography of tea leaves and Lipton boxes."
          width={2400}
          height={1280}
          loading="lazy"
          decoding="async"
          className="cs-figure block h-auto rounded-[var(--radius-card)]"
        />
      </Section>

      <Outro next={next} />
    </article>
  )
}
