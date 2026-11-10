import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useMediaQuery } from '@/lib/useMediaQuery'
import '@/styles/expanding-cards.css'

/* ---------------------------------------------------------------------------
   A row of square picture cards. The one the pointer is on (or keyboard focus
   is on) widens into a short rectangle; the room it gains is a white panel on
   the right with the card's title and a few labels. Used for "current vibes",
   the three toys under the case studies (WorksGrid).

     items   [{ slug, title, image, labels: [...], onOpen(event) }]

   onOpen gets the click event, whose currentTarget is the card's button, so
   the pop-up it opens can hand focus back to it.

   Which card is open is React state, not :hover, for two things :hover gets
   wrong. The gap between two cards belongs to neither, so with :hover a
   pointer crossing it would shut both for a moment. With state the open card
   only changes when the pointer reaches another card, so one closes as the
   next opens, on the same curve, and the row's width holds steady. And
   leaving the row is two beats: the text fades, then (SETTLE_MS later) the
   card shrinks; a pointer that comes back to a card in that time takes over
   from the still-open card the same way.

   Below 48rem the cards stack, each with its title and labels under it, and
   a tap opens the pop-up. From 48rem on a touch screen with no hover, the
   first tap opens the card and the second opens the pop-up; a tap anywhere
   else closes it. Geometry and motion are in expanding-cards.css.
--------------------------------------------------------------------------- */

const ROW = '(min-width: 48rem)'

/* How long the text has to fade before a card the pointer has left starts to
   shrink back. */
const SETTLE_MS = 120

export function ExpandingProjectCards({ items, className = '' }) {
  const row = useMediaQuery(ROW, true)
  const [active, setActive] = useState(null)
  const [leaving, setLeaving] = useState(false)
  const rowRef = useRef(null)
  const timer = useRef(0)
  const pointer = useRef('mouse')
  const id = useId()

  const open = useCallback((i) => {
    clearTimeout(timer.current)
    setLeaving(false)
    setActive(i)
  }, [])

  const close = useCallback(() => {
    clearTimeout(timer.current)
    setLeaving(true)
    timer.current = setTimeout(() => {
      setActive(null)
      setLeaving(false)
    }, SETTLE_MS)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  // A card opened by a tap closes on a tap anywhere else.
  useEffect(() => {
    if (active === null) return undefined
    const onDown = (event) => {
      if (!rowRef.current?.contains(event.target)) close()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [active, close])

  // Touch is left out of enter and leave: a tap fires both, and the leave
  // comes as the finger lifts.
  const onRowLeave = (event) => {
    if (event.pointerType !== 'touch' && active !== null) close()
  }

  return (
    <div className={`epc ${className}`}>
      <ul
        ref={rowRef}
        className="epc__row"
        data-leaving={leaving || undefined}
        onPointerLeave={onRowLeave}
        style={{ '--epc-n': items.length }}
      >
        {items.map((item, i) => {
          const titleId = `${id}-title-${i}`
          const labelsId = `${id}-labels-${i}`

          const onClick = (event) => {
            // A tap (not a click, not Enter: those have detail 0 or a mouse)
            // on a card that is not open yet only opens the card.
            const tap = pointer.current === 'touch' && event.detail > 0
            if (row && tap && active !== i) {
              open(i)
              return
            }
            item.onOpen?.(event)
          }

          const onFocus = (event) => {
            // Keyboard focus opens the card; focus from a click does not.
            let visible = false
            try {
              visible = event.currentTarget.matches(':focus-visible')
            } catch {
              visible = false
            }
            if (visible) open(i)
          }

          const onBlur = (event) => {
            if (active === i && !rowRef.current?.contains(event.relatedTarget)) close()
          }

          return (
            <li key={item.slug} className="epc__item" data-slug={item.slug} data-open={active === i || undefined}>
              <button
                type="button"
                className="epc__card"
                aria-haspopup="dialog"
                aria-labelledby={titleId}
                aria-describedby={labelsId}
                onPointerEnter={(event) => event.pointerType !== 'touch' && open(i)}
                onPointerDown={(event) => {
                  pointer.current = event.pointerType
                }}
                onFocus={onFocus}
                onBlur={onBlur}
                onClick={onClick}
              >
                <img className="epc__img" src={item.image} alt="" loading="lazy" decoding="async" />
                <span className="epc__panel">
                  <span className="epc__text">
                    <span id={titleId} className="epc__title">
                      {item.title}
                    </span>
                    <span id={labelsId} className="epc__labels">
                      {item.labels.map((label) => (
                        <span key={label} className="epc__label">
                          {label}
                        </span>
                      ))}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
