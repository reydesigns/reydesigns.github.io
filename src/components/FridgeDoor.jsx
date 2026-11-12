import { useCallback, useEffect, useRef, useState } from 'react'
import { Drawing3DLazy } from '@/components/Drawing3DLazy'
import { MAGNETS, PHOTOS } from '@/data/fridge'
import { useReducedMotion } from '@/lib/useReducedMotion'
import '@/styles/fridge.css'

/* The easter egg's fall: how long the two prints take to reach the foot of
   the page, the room they come to rest in above the footer, and the tilt and
   sideways nudge each lands with. */
const FALL_MS = 1100
const LAND_GAP = 24
const LANDING = {
  waterfall: { rot: -11, dx: -0.18 },
  helmet: { rot: 8, dx: 0.14 },
}
/* Movement before a press on the Spider-Man magnet becomes a drag. */
const PICKUP_PX = 4

/* What the door says where the prints hung, once they have fallen: a
   Spider-Man line, never the one it said the last time the magnet came off
   (remembered across visits where the browser allows, else for this one). */
const QUOTES = [
  { line: 'With great power comes great responsibility.', by: 'Uncle Ben' },
  { line: 'I missed the part where that’s my problem.', by: 'Peter Parker' },
  { line: 'Pizza time!', by: 'Peter Parker' },
  { line: 'You know, I’m something of a scientist myself.', by: 'Norman Osborn' },
  { line: 'Face it, Tiger… you just hit the jackpot!', by: 'Mary Jane Watson' },
  { line: 'Anyone can wear the mask.', by: 'Miles Morales' },
  { line: 'It’s a leap of faith. That’s all it is.', by: 'Peter B. Parker' },
  { line: 'Mr. Stark, I don’t feel so good.', by: 'Peter Parker' },
  { line: 'My spider-sense is tingling!', by: 'Spider-Man' },
  { line: 'Up, up and away, web!', by: 'Peter Parker' },
  { line: 'Underoos!', by: 'Tony Stark' },
  { line: 'Just your friendly neighborhood Spider-Man.', by: 'Spider-Man' },
]
const QUOTE_KEY = 'fridge-quote'
let lastQuote = -1
function nextQuote() {
  try {
    lastQuote = Number(localStorage.getItem(QUOTE_KEY) ?? lastQuote)
  } catch {
    // No storage (a private window, blocked site data): this visit's will do.
  }
  // Any but the last one (if there was a last one).
  const skip = Number.isInteger(lastQuote) && lastQuote >= 0 && lastQuote < QUOTES.length
  let i = Math.floor(Math.random() * (QUOTES.length - (skip ? 1 : 0)))
  if (skip && i >= lastQuote) i += 1
  lastQuote = i
  try {
    localStorage.setItem(QUOTE_KEY, String(i))
  } catch {
    // As above.
  }
  return QUOTES[i]
}

/**
 * Photos stuck to a fridge door: three prints overlapping at angles, each
 * still showing its subject, pinned up by 3D magnets. The Spider-Man head
 * holds the two top prints where they overlap, with the strawberry stuck on
 * just above it; the cat head holds the photo of the cat.
 *
 * Placement is in percentages of the door, so it scales as one piece.
 *
 * An easter egg, hinted at by the spidey sense flickering over the Spider-Man
 * magnet's head: the magnet can be picked up and moved. Let go of
 * it anywhere off the two top prints and, with nothing holding them, they
 * fall down the page and come to rest just above the footer, and where they
 * hung the door says a Spider-Man line, a different one each time (QUOTES).
 * Let go of it still on the prints and it springs back to its place. Under
 * reduced motion the prints are simply down there, with no fall.
 */
export function FridgeDoor({ className = '' }) {
  const reduced = useReducedMotion()
  const prints = useRef({})
  const spidey = useRef(null)
  const [dropped, setDropped] = useState(false)
  const [quote, setQuote] = useState(null)

  /* Where each fallen print lies: straight down from where it hung, its foot
     LAND_GAP above the footer's top, nudged apart sideways. Worked out from
     the page as it is now, so it is redone whenever the page changes size.

     They must land in the clear, below the cat print that stays up, so when
     the page is too short for that the door takes a margin under it that
     pushes the footer down far enough (`room`). The margin only moves the
     footer once this column is the page's longest, so it is grown until the
     footer has actually moved. */
  const door = useRef(null)
  const footerTop = () => {
    const footer = document.querySelector('footer')
    return footer ? footer.getBoundingClientRect().top + window.scrollY : document.documentElement.scrollHeight
  }
  const room = useCallback(() => {
    const el = door.current
    const cat = el?.querySelector('.fridge__print--cat')
    if (!el || !cat) return
    el.style.marginBottom = '0px'
    const tall = Math.max(...Object.values(prints.current).map((p) => p?.offsetHeight ?? 0)) * 1.08
    const need = cat.getBoundingClientRect().bottom + window.scrollY + LAND_GAP * 1.5 + tall + LAND_GAP
    let extra = 0
    for (let i = 0; i < 4; i += 1) {
      const short = need - footerTop()
      if (short <= 1) break
      extra += short
      el.style.marginBottom = `${Math.ceil(extra)}px`
    }
  }, [])
  const landing = useCallback(() => {
    const bottom = footerTop()
    const out = {}
    for (const [key, el] of Object.entries(prints.current)) {
      if (!el) continue
      // Its box as it hangs, without the fall's transform (offsetTop and
      // friends ignore transforms), measured against the document.
      const door = el.offsetParent.getBoundingClientRect()
      const top = door.top + window.scrollY + el.offsetTop
      const dy = bottom - LAND_GAP - (top + el.offsetHeight)
      out[key] = { dy: Math.max(0, dy), dx: LANDING[key].dx * el.offsetWidth, rot: LANDING[key].rot }
    }
    return out
  }, [])

  const drop = useCallback(() => {
    setQuote(nextQuote())
    setDropped(true)
    room()
    const to = landing()
    for (const [key, el] of Object.entries(prints.current)) {
      if (!el || !to[key]) continue
      const { dx, dy, rot } = to[key]
      const end = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`
      el.style.zIndex = '4'
      if (reduced) {
        el.style.transform = end
        continue
      }
      const from = getComputedStyle(el).transform
      // Gravity: slow off the door, fast at the bottom, a small bounce, and a
      // turn as it goes. The waterfall print lets go a beat after the helmet.
      el.animate(
        [
          { transform: from, offset: 0, easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)' },
          { transform: `translate(${dx}px, ${dy}px) rotate(${rot * 1.6}deg)`, offset: 0.82, easing: 'ease-out' },
          { transform: `translate(${dx}px, ${dy - 14}px) rotate(${rot * 0.85}deg)`, offset: 0.92, easing: 'ease-in' },
          { transform: end, offset: 1 },
        ],
        { duration: FALL_MS, delay: key === 'waterfall' ? 90 : 0, fill: 'backwards' },
      )
      el.style.transform = end
    }
  }, [landing, reduced, room])

  // Once fallen, the prints stay at the foot of the page through resizes.
  useEffect(() => {
    if (!dropped) return undefined
    const settle = () => {
      room()
      const to = landing()
      for (const [key, el] of Object.entries(prints.current)) {
        if (el && to[key]) el.style.transform = `translate(${to[key].dx}px, ${to[key].dy}px) rotate(${to[key].rot}deg)`
      }
    }
    window.addEventListener('resize', settle)
    return () => window.removeEventListener('resize', settle)
  }, [dropped, landing, room])

  /* --- moving the Spider-Man magnet ---------------------------------------
     The press lands on the 3D drawing's canvas (which turns the magnet as it
     is dragged, so it looks picked up) and bubbles here; the magnet's box
     follows the pointer. On release it stays put if it is off both top
     prints, which then fall, or springs back if it is still on them. */
  const grab = useRef(null)
  const onDown = (e) => {
    if (dropped || (e.pointerType === 'mouse' && e.button !== 0)) return
    const box = spidey.current.getBoundingClientRect()
    if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) return
    grab.current = { id: e.pointerId, x: e.clientX, y: e.clientY, live: false }
  }
  const onMove = (e) => {
    const g = grab.current
    if (!g || e.pointerId !== g.id) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (!g.live && Math.hypot(dx, dy) < PICKUP_PX) return
    g.live = true
    const el = spidey.current
    el.dataset.held = ''
    el.style.setProperty('--mx', `${dx}px`)
    el.style.setProperty('--my', `${dy}px`)
  }
  const onUp = (e) => {
    const g = grab.current
    if (!g || e.pointerId !== g.id) return
    grab.current = null
    const el = spidey.current
    delete el.dataset.held
    if (!g.live) return
    const m = el.getBoundingClientRect()
    const cx = (m.left + m.right) / 2
    const cy = (m.top + m.bottom) / 2
    const onAPrint = Object.values(prints.current).some((p) => {
      const r = p?.getBoundingClientRect()
      return r && cx > r.left && cx < r.right && cy > r.top && cy < r.bottom
    })
    if (onAPrint) {
      el.style.setProperty('--mx', '0px')
      el.style.setProperty('--my', '0px')
    } else drop()
  }

  return (
    <div ref={door} className={`fridge ${className}`} data-dropped={dropped || undefined}>
      <Print
        photo={PHOTOS.waterfall}
        className="fridge__print--waterfall"
        innerRef={(el) => {
          prints.current.waterfall = el
        }}
      />
      <Print
        photo={PHOTOS.helmet}
        className="fridge__print--helmet"
        innerRef={(el) => {
          prints.current.helmet = el
        }}
      />
      <Print photo={PHOTOS.catDesk} className="fridge__print--cat" />

      {/* Where the two prints hung, once they have fallen. */}
      <p className="fridge__oops" aria-live="polite">
        {dropped && quote && (
          <>
            “{quote.line}”<span className="fridge__oops-by">— {quote.by}</span>
          </>
        )}
      </p>

      <Magnet id="strawberry" className="fridge__magnet--strawberry" />
      <Magnet
        id="spidey"
        className="fridge__magnet--spidey"
        innerRef={spidey}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <SpideySense />
      </Magnet>
      <Magnet id="cat" className="fridge__magnet--cat" />
    </div>
  )
}

function Print({ photo, className, innerRef }) {
  return (
    <figure ref={innerRef} className={`fridge__print ${className}`}>
      <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" />
    </figure>
  )
}

/** The box is the magnet's visible size; the canvas hangs over every edge,
    as the landing page's drawings do, since the camera frames the art at
    ~65%. */
function Magnet({ id, className, innerRef, children, ...events }) {
  return (
    <div ref={innerRef} className={`fridge__magnet ${className}`} {...events}>
      <Drawing3DLazy {...MAGNETS[id]} depth={1} className="absolute inset-[-25%]" />
      {children}
    </div>
  )
}

/* Spidey sense: comic lightning squiggles fanning out over the Spider-Man
   magnet's head, flickering on a loop, the hint that it can be picked up.
   Each is a zigzag from the head outwards, in a 100 x 50 box whose foot is
   the top of the head; they flash one after another (fridge.css). */
const SENSE = [
  'M50 46 L47 34 L53 26 L48 14 L52 4',
  'M40 46 L31 38 L34 30 L23 24 L24 15',
  'M60 46 L69 38 L66 30 L77 24 L76 15',
  'M31 48 L20 46 L19 39 L8 37 L4 30',
  'M69 48 L80 46 L81 39 L92 37 L96 30',
]
function SpideySense() {
  return (
    <svg className="fridge__sense" viewBox="0 0 100 50" aria-hidden="true" focusable="false">
      {SENSE.map((d, i) => (
        <path key={d} d={d} style={{ '--i': i }} />
      ))}
    </svg>
  )
}
