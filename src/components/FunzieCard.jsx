import { useEffect } from 'react'
import { boardPicturesOf } from '@/data/funzies'
import { useInView } from '@/lib/useInView'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useSaveData } from '@/lib/useSaveData'

/* The board is messy on purpose: each card is tipped, nudged and pinned a
   little off centre by its own amount (deg, px, px). Fixed values rather than
   random ones, so the board is the same on every visit. */
const MESS = [
  { rot: -2.4, dx: 0, dy: 4, pin: -7 },
  { rot: 1.9, dx: -6, dy: 26, pin: 5 },
  { rot: -1.2, dx: 8, dy: -6, pin: 0 },
  { rot: 2.8, dx: -4, dy: 16, pin: -4 },
  { rot: 1.5, dx: 10, dy: 10, pin: 6 },
  { rot: -2.1, dx: -8, dy: -2, pin: -2 },
  { rot: -0.8, dx: 4, dy: 20, pin: 3 },
  { rot: 2.3, dx: -10, dy: 0, pin: -5 },
]

/**
 * The pinned print when it is a clip (print's press running): muted, looping,
 * no controls, like a GIF. It plays only while it is on screen. Under reduced
 * motion or data saver it stays on its poster, the clip's first frame, and
 * isn't downloaded.
 */
function BoardVideo({ pic }) {
  const reduced = useReducedMotion()
  const saveData = useSaveData()
  const still = reduced || saveData
  const [ref, inView] = useInView({ threshold: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (inView && !still) el.play().catch(() => {})
    else el.pause()
  }, [ref, inView, still])

  return (
    <video
      ref={ref}
      className="fz-card__print fz-card__photo"
      src={pic.src}
      poster={pic.poster}
      muted
      loop
      playsInline
      disablePictureInPicture
      preload={still ? 'none' : 'auto'}
      aria-hidden="true"
    />
  )
}

/**
 * One project on the Design board: its photo, printed with a white border
 * and stuck to the board with a chrome push pin, with the project's other
 * pictures hanging behind it on the same pin.
 *
 * Hover (or keyboard focus) fans those pictures out from behind it, swinging
 * on the pin (funzies.css); a click opens the project's window. On touch
 * there is no hover: a tap opens the window straight away.
 */
export function FunzieCard({ item, index, onOpen }) {
  const [front, ...under] = boardPicturesOf(item)
  const m = MESS[index % MESS.length]
  return (
    <button
      type="button"
      className="fz-card"
      aria-haspopup="dialog"
      aria-label={item.title}
      data-fz-card={item.id}
      onClick={() => onOpen(item)}
      style={{ '--rot': `${m.rot}deg`, '--dx': `${m.dx}px`, '--dy': `${m.dy}px`, '--pin-x': `${m.pin}px` }}
    >
      <span className="fz-card__pivot">
        {under.map((p, i) => (
          <img
            key={p.src}
            className="fz-card__print fz-card__under"
            style={{ '--i': i }}
            src={p.src}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        ))}
        {front.type === 'video' ? (
          <BoardVideo pic={front} />
        ) : (
          <img className="fz-card__print fz-card__photo" src={front.src} alt="" decoding="async" draggable={false} />
        )}
        <span className="fz-pin" aria-hidden="true" />
      </span>
    </button>
  )
}
