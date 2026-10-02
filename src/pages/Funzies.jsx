import { useCallback, useState } from 'react'
import { Layout } from '@/components/Layout'
import { NavDock } from '@/components/NavDock'
import { BlinkingFace } from '@/components/BlinkingFace'
import { FunzieWindow } from '@/components/FunzieWindow'
import { FunziePopup } from '@/components/FunziePopup'
import { StickerRoom } from '@/components/StickerRoom'
import { funzie } from '@/data/funzies'
import { useDocumentMeta } from '@/lib/useDocumentMeta'
import '@/styles/funzies.css'

/**
 * Funzies — side projects, laid out after Assets/funzies/funzies page.png.
 *
 * The windows form one bento grid — four columns, square rows, one gap — in a
 * compact column centred on the page, which the headline and intro share so
 * all their edges line up. Below 48rem it folds to two columns.
 *
 * On the grid's right side, the isometric room and, under it, its sticker
 * sheet (StickerRoom).
 */
export function Funzies() {
  useDocumentMeta({ title: 'Funzies', description: 'Side projects and playful experiments by Shreya Rudrapatna.' })
  const [open, setOpen] = useState(null)
  const onOpen = useCallback((item) => setOpen(item), [])
  const onClose = useCallback(() => setOpen(null), [])

  // `delay` staggers each tile's first picture change so they don't all flip at once.
  const win = (id, area, delay) => (
    <FunzieWindow item={funzie(id)} className={`fz-area-${area}`} delay={delay} onOpen={onOpen} />
  )

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

        {/* A nudge that the windows open, set like the case studies' section
            eyebrows (OBJECTIVE, …), over the grid's top-left corner. */}
        <p className="fz-hint">Click on me</p>
        <section className="fz-bento" aria-label="Projects">
          {win('magazine', 'mag', 0)}
          {win('pc-build', 'pc', 1200)}
          {win('tmukpop', 'tmu', 600)}
          {win('sdz', 'sdz', 300)}
          {win('print', 'prt', 1800)}
          {win('infographics', 'inf', 400)}

          {/* The isometric pixel-art room, and the sheet of stickers to decorate it. */}
          <StickerRoom roomClassName="fz-area-room" sheetClassName="fz-area-stk" />
        </section>
      </div>

      <FunziePopup item={open} onClose={onClose} />
      <NavDock placement="bottom" activePath="/funzies" />
    </Layout>
  )
}
