import { useEffect, useState } from 'react'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useInView } from '@/lib/useInView'
import aboutMacbook from '@assets/tmu-kpop/images/web/about-macbook.webp'
import aboutPage from '@assets/tmu-kpop/images/web/about-page-long.webp'
import eventsBrowser from '@assets/tmu-kpop/images/web/events-browser.webp'
import performanceCard from '@assets/tmu-kpop/images/web/events-performance-card.webp'

/* ---------------------------------------------------------------------------
   Two mockups from the TMU K-POP case study that move.

   Both are a still screenshot with a live layer on top, positioned in
   percentages of the screenshot so they track it at any width. Each loop runs
   only while its mockup is on screen, and under reduced motion both render as
   the still frame they start on.
--------------------------------------------------------------------------- */

/**
 * The About Us page scrolling inside the MacBook.
 *
 * about-page-long.webp is the top of the About Us page (cut from the MacBook
 * screen, above the photo row) stacked on the lower half of the page from
 * "TMU KPOP MacBook Edited (1).png", scaled to the same width. The screen box
 * below is the MacBook's display: x 327–2704, y 211–1700 of the 3000×2077
 * export, which about-macbook.webp trims to its 2923×1713 artwork from (31, 159). The loop scrolls down until "JOIN OUR
 * DISCORD" fills the screen, holds there, and scrolls back up.
 */
const ABOUT_SCREEN = { left: '10.127%', top: '3.036%', width: '81.355%', height: '86.98%' }

export function AboutScrollMockup() {
  const reduced = useReducedMotion()
  const [ref, inView] = useInView({ threshold: 0.35 })
  return (
    <div ref={ref} className="relative">
      <img
        src={aboutMacbook}
        alt=""
        width={2400}
        height={1407}
        loading="lazy"
        decoding="async"
        className="block h-auto w-full"
      />
      <div className="absolute overflow-hidden" style={ABOUT_SCREEN}>
        <img
          src={aboutPage}
          alt="The new About Us page scrolling from the header down to the Join our Discord section."
          width={1400}
          height={2895}
          loading="lazy"
          decoding="async"
          className="tk-about-scroll block h-auto w-full"
          style={{ animationPlayState: inView && !reduced ? 'running' : 'paused' }}
        />
      </div>
    </div>
  )
}

/**
 * The Current Events carousel, rotating inside the browser mockup.
 *
 * events-browser.webp is the screenshot with its three cards painted out; the
 * cards are rebuilt on top. Slots are the cards' measured places in the
 * original 3000×1671 screenshot: the featured card centred at (50%, 69.9%)
 * and 29.4% wide, the two side cards at 61% of its size, raised to 59.9%.
 *
 * Four cards turn through four slots — left, centre, right, and a hidden one
 * tucked behind the centre — so a card leaving on the left slides back in on
 * the right without ever crossing the front. Performance Night alternates
 * with the two "coming soon" cards.
 */
const SLOTS = [
  { left: '28.37%', top: '59.9%', scale: 0.612, opacity: 0.6, z: 2 }, // left
  { left: '50%', top: '69.9%', scale: 1, opacity: 1, z: 3 }, // centre
  { left: '71.63%', top: '59.9%', scale: 0.612, opacity: 0.6, z: 2 }, // right
  { left: '50%', top: '62%', scale: 0.4, opacity: 0, z: 1 }, // hidden, behind
]

const CARDS = [
  { id: 'perf', kind: 'image' },
  { id: 'tiktok', kind: 'soon', platform: 'TIKTOK' },
  { id: 'perf-2', kind: 'image' },
  { id: 'ig', kind: 'soon', platform: 'INSTAGRAM' },
]

const HOLD_MS = 2600

function SoonCard({ platform }) {
  return (
    <div className="tk-soon-card flex h-full w-full flex-col justify-center">
      <span className="tk-soon-title">COMING SOON!</span>
      <span className="tk-soon-line">FOLLOW US ON {platform}:</span>
      <span className="tk-soon-line">@TMU_KPOP</span>
    </div>
  )
}

export function EventsCarouselMockup() {
  const reduced = useReducedMotion()
  const [ref, inView] = useInView({ threshold: 0.35 })
  // How many places the carousel has turned. Card i sits in slot (i + 1 - step)
  // mod 4, so on step 0 Performance Night is centred, as in the screenshot.
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (reduced || !inView) return undefined
    const t = setInterval(() => setStep((s) => s + 1), HOLD_MS)
    return () => clearInterval(t)
  }, [reduced, inView])

  return (
    <div ref={ref} className="relative">
      <img
        src={eventsBrowser}
        alt=""
        width={2400}
        height={1337}
        loading="lazy"
        decoding="async"
        className="block h-auto w-full"
      />
      <div
        className="absolute inset-0"
        role="img"
        aria-label="The new Current Events page: a carousel featuring Performance Night ’24 on April 2nd, alternating with coming-soon cards that point to TMU K-POP's TikTok and Instagram."
      >
        {CARDS.map((card, i) => {
          const slot = SLOTS[(((i + 1 - step) % 4) + 4) % 4]
          return (
            <div
              key={card.id}
              aria-hidden="true"
              className="tk-carousel-card absolute w-[29.43%] overflow-hidden"
              style={{
                left: slot.left,
                top: slot.top,
                zIndex: slot.z,
                opacity: slot.opacity,
                aspectRatio: '880 / 540',
                transform: `translate(-50%, -50%) scale(${slot.scale})`,
              }}
            >
              {card.kind === 'image' ? (
                <img src={performanceCard} alt="" className="block h-full w-full object-cover" />
              ) : (
                <SoonCard platform={card.platform} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
