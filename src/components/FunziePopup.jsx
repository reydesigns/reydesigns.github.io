import { useCallback, useEffect, useRef, useState } from 'react'
import { WindowBar, CYCLE_MS } from './FunzieWindow'
import { setCursorHost } from './CustomCursor'
import { useReducedMotion } from '@/lib/useReducedMotion'

const CLOSE_MS = 180

/**
 * The window a Funzies tile opens: a native <dialog> (focus trap, Escape and
 * focus return come free), dressed in the same title bar as the tiles. The red
 * dot closes it, as does Escape or a click on the backdrop.
 *
 * Left: the piece, shown whole — never cropped — with generous padding, and
 * advancing on its own every CYCLE_MS when there is more than one. Right: the
 * write-up, left-aligned and top-aligned with the picture — Pixelta header,
 * "Tools:" line, body copy, and for the PC build, its floating parts.
 *
 * A window with `folders` (TMU K-POP) adds a Finder-style sidebar on the far
 * left. Picking a folder swaps in that folder's slides and adds its own line
 * under the body; `openFolder` is the one open on arrival.
 *
 * A modal dialog sits in the browser's top layer, above everything else on
 * the page — including the custom cursor, which would vanish behind it. So
 * while it is open the cursor is portalled into the dialog (setCursorHost).
 *
 * Lenis is paused while it is open, and the dialog carries
 * `data-lenis-prevent`, so a two-finger swipe on the trackpad scrolls the
 * slides rather than the page behind.
 */
export function FunziePopup({ item, onClose }) {
  const ref = useRef(null)
  const [closing, setClosing] = useState(false)
  const [slide, setSlide] = useState(0)
  const [folderName, setFolderName] = useState(null)

  useEffect(() => {
    const dialog = ref.current
    if (!item || !dialog) return undefined
    setClosing(false)
    setSlide(0)
    setFolderName(item.openFolder ?? item.folders?.[0]?.name ?? null)
    if (!dialog.open) dialog.showModal()
    setCursorHost(dialog)
    window.__lenis?.stop()
    return () => {
      setCursorHost(null)
      window.__lenis?.start()
    }
  }, [item])

  const close = useCallback(() => {
    setClosing(true)
    setTimeout(() => {
      ref.current?.close()
      onClose()
    }, CLOSE_MS)
  }, [onClose])

  if (!item) return null

  const folder = item.folders?.find((f) => f.name === folderName) ?? item.folders?.[0]
  const media = folder?.media ?? item.media
  const body = folder?.body ? `${item.body}\n\n${folder.body}` : item.body
  const openFolder = (name) => {
    setFolderName(name)
    setSlide(0)
  }

  return (
    <dialog
      ref={ref}
      className="fz-pop"
      data-folders={item.folders ? true : undefined}
      data-closing={closing || undefined}
      data-lenis-prevent
      aria-labelledby="fz-pop-label"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      // A click that lands on the dialog element itself is on the backdrop.
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="fz-pop__window">
        <WindowBar label={item.label} onClose={close} id="fz-pop-label" />
        <div className="fz-pop__body" data-center-media={item.centerMedia || undefined}>
          {folder && <Sidebar folders={item.folders} active={folder.name} onOpen={openFolder} />}
          <div className="fz-pop__media">
            {folder && (
              <p className="fz-finder__path">
                <FolderIcon />
                <span className="fz-finder__path-name">{folder.name}</span>
                <span className="fz-finder__path-count">{folder.media.length} items</span>
              </p>
            )}
            {item.stack ? (
              <Stack media={item.stack} title={item.title} />
            ) : (
              <Slides
                key={`${item.id}/${folder?.name ?? ''}`}
                media={media}
                title={folder ? `${item.title} ${folder.name}` : item.title}
                onIndex={setSlide}
              />
            )}
          </div>
          <div className="fz-pop__text">
            <h2 className="fz-pop__title">{item.title}</h2>
            <div className="fz-pop__tools">
              <span className="fz-pop__tools-label">Tools:</span>
              {/* Icons only; the name is the alt text and the hover tooltip. */}
              <ul className="fz-pop__tool-list">
                {item.tools.map((t) => (
                  <li key={t.name} className="fz-pop__tool" title={t.name}>
                    <img src={t.icon} alt={t.name} width="36" height="36" draggable={false} />
                  </li>
                ))}
              </ul>
            </div>
            {/* A picture's own description, when it has one, else the window's. */}
            <Copy text={media[slide]?.body ?? body} />
            {item.games && <Games games={item.games} />}
            {item.parts && <Parts parts={item.parts} label={item.partsLabel} />}
          </div>
        </div>
      </div>
    </dialog>
  )
}

/**
 * Pictures stacked down the media column instead of slides (the magazine):
 * the first shown whole, scaled to fill whatever height the column has left;
 * the rest at full column width under it.
 */
function Stack({ media, title }) {
  return (
    <div className="fz-stack">
      {media.map((m, i) => (
        <img
          key={m.src}
          src={m.src}
          alt={`${title}, ${i + 1} of ${media.length}`}
          decoding="async"
          draggable={false}
        />
      ))}
    </div>
  )
}

/**
 * The Finder sidebar: a "Folders" heading over one row per folder, each with
 * the blue macOS folder glyph. The open folder gets the grey selection pill.
 */
function Sidebar({ folders, active, onOpen }) {
  return (
    <nav className="fz-finder" aria-label="Folders">
      <p className="fz-finder__heading">Folders</p>
      <ul className="fz-finder__list">
        {folders.map((f) => (
          <li key={f.name}>
            <button
              type="button"
              className="fz-finder__item"
              aria-current={f.name === active || undefined}
              onClick={() => onOpen(f.name)}
            >
              <FolderIcon />
              {f.name}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** A macOS (Big Sur and later) folder — a darker back with its tab, a lighter
    front — in the site's burgundy (coloured in funzies.css). */
function FolderIcon() {
  return (
    <svg className="fz-folder-icon" viewBox="0 0 20 16" aria-hidden="true">
      <path
        className="fz-folder-icon__back"
        d="M1.5 3A1.5 1.5 0 0 1 3 1.5h4.4c.45 0 .87.2 1.15.55l1.05 1.25H17A1.5 1.5 0 0 1 18.5 4.8V13A1.5 1.5 0 0 1 17 14.5H3A1.5 1.5 0 0 1 1.5 13Z"
      />
      <path
        className="fz-folder-icon__front"
        d="M1.5 5.9a1.4 1.4 0 0 1 1.4-1.4h14.2a1.4 1.4 0 0 1 1.4 1.4V13a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 13Z"
      />
      <path className="fz-folder-icon__lip" d="M2.9 4.5h14.2a1.4 1.4 0 0 1 1.4 1.4v.5H1.5v-.5a1.4 1.4 0 0 1 1.4-1.4Z" />
    </svg>
  )
}

/**
 * Body copy from plain text: blank lines separate paragraphs, and a paragraph
 * made entirely of "- " lines is a bulleted list.
 */
function Copy({ text }) {
  return (
    <div className="fz-pop__copy">
      {text.split(/\n{2,}/).map((block, i) => {
        const lines = block.split('\n')
        return lines.every((l) => l.startsWith('- ')) ? (
          <ul key={i}>
            {lines.map((l) => (
              <li key={l}>{l.slice(2)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{block}</p>
        )
      })}
    </div>
  )
}

/**
 * A scroll-snap strip. Native scrolling is the whole of the swipe: trackpad,
 * touch and shift-wheel all just work, with the platform's own momentum. The
 * autoplay, arrows and dots drive the same scroll, and the active index is
 * read back from it, so there is only ever one source of truth — and a manual
 * swipe restarts the autoplay clock from wherever it lands.
 *
 * Each picture is fitted whole inside a square stage and pinned to its top,
 * so the write-up beside it lines up with the picture's top edge.
 */
function Slides({ media, title, onIndex }) {
  const track = useRef(null)
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const many = media.length > 1

  const go = useCallback((i) => {
    const el = track.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }, [])

  const onScroll = () => {
    const el = track.current
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  // Autoplay: hold each picture CYCLE_MS (a video for one full play), then
  // move on, wrapping back to the first.
  useEffect(() => {
    if (!many || reduced) return undefined
    const video = media[index]?.type === 'video' && track.current?.querySelector(`video[data-slide="${index}"]`)
    let t
    const schedule = () => {
      const hold = video && video.duration ? Math.max(CYCLE_MS, video.duration * 1000) : CYCLE_MS
      t = setTimeout(() => go((index + 1) % media.length), hold)
    }
    // A video on the opening slide may not know its length yet; wait for it,
    // or it would be cut off after CYCLE_MS.
    if (video && !video.duration) video.addEventListener('loadedmetadata', schedule, { once: true })
    else schedule()
    return () => {
      clearTimeout(t)
      if (video) video.removeEventListener('loadedmetadata', schedule)
    }
  }, [index, many, reduced, media, go])

  useEffect(() => onIndex?.(index), [index, onIndex])

  // Only the slide on screen plays, from the top.
  useEffect(() => {
    track.current?.querySelectorAll('video').forEach((v) => {
      if (Number(v.dataset.slide) === index) {
        v.currentTime = 0
        v.play().catch(() => {})
      } else v.pause()
    })
  }, [index])

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(Math.min(media.length - 1, index + 1)) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(Math.max(0, index - 1)) }
  }

  return (
    <div className="fz-slides" onKeyDown={many ? onKeyDown : undefined}>
      <div
        ref={track}
        className="fz-slides__track"
        onScroll={onScroll}
        tabIndex={many ? 0 : undefined}
        role={many ? 'region' : undefined}
        aria-roledescription={many ? 'carousel' : undefined}
        aria-label={many ? `${title}, ${media.length} slides` : undefined}
      >
        {media.map((m, i) => (
          <div
            className="fz-slides__slide"
            key={m.src}
            aria-hidden={many && i !== index ? true : undefined}
          >
            {m.type === 'video' ? (
              <video src={m.src} data-slide={i} muted loop playsInline preload="metadata" />
            ) : (
              <img
                src={m.src}
                alt={many ? `${title}, ${i + 1} of ${media.length}` : title}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                draggable={false}
              />
            )}
          </div>
        ))}
      </div>

      {many && (
        <>
          <button
            type="button"
            className="fz-slides__arrow fz-slides__arrow--prev"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            type="button"
            className="fz-slides__arrow fz-slides__arrow--next"
            onClick={() => go(index + 1)}
            disabled={index === media.length - 1}
            aria-label="Next"
          >
            ›
          </button>
          <div className="fz-slides__dots">
            {media.map((m, i) => (
              <button
                type="button"
                key={m.src}
                className="fz-slides__dot"
                aria-current={i === index || undefined}
                aria-label={`Slide ${i + 1}`}
                onClick={() => go(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** A row of game covers, in place of a text list. Names surface on hover. */
function Games({ games }) {
  return (
    <ul className="fz-games" aria-label="Games played">
      {games.map((g) => (
        <li key={g.name} className="fz-game" title={g.name}>
          <img src={g.src} alt={g.name} draggable={false} />
        </li>
      ))}
    </ul>
  )
}

/**
 * Cut-out parts floating under the write-up. Each one bobs gently on its own
 * offset, and on hover tilts towards the pointer in 3D and drifts right, with
 * its name surfacing underneath.
 */
function Parts({ parts, label }) {
  const onMove = (e) => {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--rx', `${(-y * 22).toFixed(1)}deg`)
    el.style.setProperty('--ry', `${(x * 28).toFixed(1)}deg`)
  }
  const onLeave = (e) => {
    e.currentTarget.style.removeProperty('--rx')
    e.currentTarget.style.removeProperty('--ry')
  }

  return (
    <>
      {label && <p className="fz-parts__label">{label}</p>}
      <ul className="fz-parts" aria-label="Parts">
        {parts.map((p, i) => (
          <li key={p.name} className="fz-part" style={{ '--i': i }} onPointerMove={onMove} onPointerLeave={onLeave}>
            <span className="fz-part__float">
              <img src={p.src} alt="" draggable={false} />
            </span>
            <span className="fz-part__name">{p.name}</span>
          </li>
        ))}
      </ul>
    </>
  )
}
