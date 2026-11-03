import { useCallback, useState } from 'react'
import { Layout } from '@/components/Layout'
import { NavDock } from '@/components/NavDock'
import { BlinkingFace } from '@/components/BlinkingFace'
import { FunzieCard } from '@/components/FunzieCard'
import { FunziePopup } from '@/components/FunziePopup'
import { StickerRoom } from '@/components/StickerRoom'
import { FUNZIES } from '@/data/funzies'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import '@/styles/funzies.css'

/**
 * Design (the page once called Funzies; /funzies redirects here) — side
 * projects, pinned to a board.
 *
 * The headline and intro, then the wall: the projects as photo prints pinned
 * to a messy board, four to a row (two on a phone), each fanning out its
 * other pictures on hover and opening its window on a click (FunziePopup).
 * On wide screens the isometric room sits to the right of the board, level
 * with its middle, with its sticker sheet pinned upright to the room's left
 * (StickerRoom); narrower, the room and sheet follow the board.
 */
export function Funzies() {
  useDocumentMeta({ title: 'Design', description: 'Side projects and playful experiments by Shreya Rudrapatna.' })
  const [open, setOpen] = useState(null)
  const onOpen = useCallback((item) => setOpen(item), [])
  const onClose = useCallback(() => setOpen(null), [])

  return (
    <Layout>
      <div className="fz-page">
        <header className="fz-intro">
          <h1 className="fz-headline font-display">
            a look at my
            <br />
            prefrontal cortex <BlinkingFace />
          </h1>
          <div className="fz-lede">
            <p>
              The most powerful thing you can do for you brain is to exercise it! Creativity is very important to
              me, I make sure to challenge myself to learn new things but also practice what I already know.
            </p>
            <p>
              I come from a design background but that’s not stopping me to learn data science, programming, print,
              3D modelling, package engineering, fine arts, and ALL THINGS DESIGN!
            </p>
          </div>
        </header>

        {/* A nudge that the prints open, set like the case studies' section
            eyebrows (OBJECTIVE, …), over the board's top-left corner. */}
        <p className="fz-hint">Click on me</p>
        <div className="fz-wall">
          <section className="fz-board" aria-label="Projects">
            <ul className="fz-board__list">
              {FUNZIES.map((item, i) => (
                <li key={item.id} className="fz-board__item">
                  <FunzieCard item={item} index={i} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          </section>

          {/* The isometric pixel-art room, and the sheet of stickers to decorate it. */}
          <StickerRoom roomClassName="fz-area-room" sheetClassName="fz-area-stk" />
        </div>
      </div>

      <FunziePopup item={open} onClose={onClose} />
      <NavDock placement="bottom" activePath="/design" />
    </Layout>
  )
}
