import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { coverAt } from '@/components/VinylStack'
import { addRec, listRecs, searchSongs, songKey } from '@/lib/songRecs'

/* ---------------------------------------------------------------------------
   "Recommend a song", under the Vinyl Player's record stack: a search box
   that looks songs up on iTunes as you type (the source the records come
   from), and a fanned pile of the covers visitors have added, newest on top,
   each a link to the song on Apple Music. Pointing at a cover lifts it to
   the top of the pile and names it in the line underneath.

   The search box is an ARIA combobox: the arrow keys move through the
   results, Enter adds the highlighted one (or the top one), and Escape shuts
   the results (and only then the pop-up). Picking a song adds it at once; it
   shows in the strip straight away and is taken back out if it could not be
   saved. src/lib/songRecs.js does the talking.
--------------------------------------------------------------------------- */

const MIN_CHARS = 2
const DEBOUNCE_MS = 250
const NOTE_MS = 4500
const GHOSTS = 5

// What the strip showed last time, so reopening the pop-up shows it at once
// while it is fetched again.
let cached = null

export function SongRecs() {
  const labelId = useId()
  const listId = useId()
  const inputRef = useRef(null)
  const stripRef = useRef(null)
  const [recs, setRecs] = useState(cached)
  const [loadFailed, setLoadFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [search, setSearch] = useState('idle') // idle | loading | done | error
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [shown, setShown] = useState(null) // the cover pointed at
  const [note, setNote] = useState('')
  const [flash, setFlash] = useState(null)
  const [more, setMore] = useState(false)
  const noteTimer = useRef(0)

  useEffect(() => {
    let gone = false
    listRecs().then(
      (list) => {
        if (gone) return
        cached = list
        setRecs(list)
        setLoadFailed(false)
      },
      (err) => {
        console.warn('[recs] could not load the list', err)
        if (!gone) setLoadFailed(true)
      },
    )
    return () => {
      gone = true
      clearTimeout(noteTimer.current)
    }
  }, [])

  // The search, a moment after typing stops. A newer query aborts the last.
  useEffect(() => {
    const term = query.trim()
    if (term.length < MIN_CHARS) {
      setResults([])
      setSearch('idle')
      return undefined
    }
    setSearch('loading')
    const ctl = new AbortController()
    const t = setTimeout(() => {
      searchSongs(term, ctl.signal).then(
        (found) => {
          setResults(found)
          setActive(-1)
          setSearch('done')
        },
        (err) => {
          if (err?.name === 'AbortError') return
          console.warn('[recs] search failed', err)
          setResults([])
          setSearch('error')
        },
      )
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(t)
      ctl.abort()
    }
  }, [query])

  // A mouse wheel scrolls the strip sideways. Native, because React's wheel
  // listener is passive and cannot keep the wheel from doing anything else.
  // While there is more strip to the right, its end fades out (data-more).
  useEffect(() => {
    const el = stripRef.current
    if (!el) return undefined
    const measure = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    el.addEventListener('scroll', measure, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', measure)
      el.removeEventListener('wheel', onWheel)
    }
  }, [recs])

  const say = useCallback((text) => {
    clearTimeout(noteTimer.current)
    setNote(text)
    if (text) noteTimer.current = setTimeout(() => setNote(''), NOTE_MS)
  }, [])

  /** Light up a cover in the strip and bring it into view. */
  const point = useCallback((trackId) => {
    setFlash(trackId)
    setTimeout(() => setFlash((f) => (f === trackId ? null : f)), 1600)
    requestAnimationFrame(() => {
      stripRef.current
        ?.querySelector(`[data-track="${trackId}"]`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    })
  }, [])

  const pick = useCallback(
    async (song) => {
      setOpen(false)
      setQuery('')
      setActive(-1)
      inputRef.current?.focus()
      const there = (recs ?? []).find((r) => songKey(r) === songKey(song))
      if (there) {
        say(`${song.title} is already on the list. Good taste.`)
        point(there.trackId)
        return
      }
      setRecs((list) => [song, ...(list ?? [])])
      point(song.trackId)
      say(`Adding ${song.title}…`)
      try {
        const how = await addRec(song)
        say(how === 'already' ? `${song.title} is already on the list. Good taste.` : `Added ${song.title}. Thanks for the rec!`)
        setRecs((list) => {
          cached = list
          return list
        })
      } catch (err) {
        console.warn('[recs] could not add', err)
        setRecs((list) => (list ?? []).filter((r) => r.trackId !== song.trackId))
        say(`Couldn't add ${song.title} just now. Try again in a moment?`)
      }
    },
    [recs, say, point],
  )

  const showList = open && query.trim().length >= MIN_CHARS
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!showList) {
        setOpen(true)
        return
      }
      if (!results.length) return
      const n = results.length
      const down = e.key === 'ArrowDown'
      setActive((a) => (down ? (a >= n - 1 ? 0 : a + 1) : a <= 0 ? n - 1 : a - 1))
      return
    }
    if (e.key === 'Enter') {
      if (!showList || !results.length) return
      e.preventDefault()
      pick(results[Math.max(0, active)])
      return
    }
    if (e.key === 'Escape' && showList) {
      // Shut the results, and keep the pop-up open: preventing the key's
      // default is what stops the dialog's cancel.
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      setActive(-1)
    }
  }

  const onList = new Set((recs ?? []).map(songKey))
  const count = recs?.length ?? 0
  const pointed = shown !== null ? recs?.[shown] : null
  let caption = ''
  if (pointed) caption = `${pointed.title} by ${pointed.artist}`
  else if (loadFailed && !recs) caption = "The list isn't loading right now."
  else if (recs) caption = count ? `${count} ${count === 1 ? 'song' : 'songs'} recommended by visitors` : 'No picks yet. Be the first!'

  return (
    <section className="vp-recs" aria-labelledby={labelId}>
      <h3 id={labelId} className="vp-recs__label">
        Recommend a song
      </h3>
      <div className="vp-recs__search">
        <svg className="vp-recs__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <circle cx="6.75" cy="6.75" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.75" />
          <path d="M10.4 10.4 14.25 14.25" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="vp-recs__input"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 && results[active] ? `${listId}-${active}` : undefined}
          aria-labelledby={labelId}
          placeholder="Song or artist"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          maxLength={80}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        <ul id={listId} role="listbox" aria-label="Songs found" className="vp-recs__results" hidden={!showList}>
          {search === 'loading' && !results.length && <li className="vp-recs__status">Searching…</li>}
          {search === 'error' && <li className="vp-recs__status">Search isn't answering. Try again in a moment.</li>}
          {search === 'done' && !results.length && <li className="vp-recs__status">No songs found</li>}
          {results.map((s, i) => (
            <li
              key={s.trackId}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className="vp-recs__option"
              data-active={i === active || undefined}
              // Keep focus in the box, so the list does not shut before the click.
              onPointerDown={(e) => e.preventDefault()}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(i)}
              onClick={() => pick(s)}
            >
              <img src={coverAt(s.cover, 80)} alt="" width="40" height="40" className="vp-recs__option-cover" />
              <span className="vp-recs__option-text">
                <span className="vp-recs__option-title">{s.title}</span>
                <span className="vp-recs__option-artist">{s.artist}</span>
              </span>
              {onList.has(songKey(s)) && <span className="vp-recs__tag">On the list</span>}
            </li>
          ))}
        </ul>
      </div>
      {/* Before the first pick (or while the list loads), empty slots hold
          the strip's place, so the panel is the same height either way. */}
      {count === 0 && (
        <ul className="vp-recs__strip vp-recs__strip--ghosts" aria-hidden="true">
          {Array.from({ length: GHOSTS }, (_, i) => (
            <li key={i}>
              <span className="vp-recs__ghost" />
            </li>
          ))}
        </ul>
      )}
      {count > 0 && (
        <ul
          ref={stripRef}
          className="vp-recs__strip"
          data-more={more || undefined}
          aria-label="Recommended by visitors"
          style={{ '--n': count }}
        >
          {recs.map((s, i) => (
            <li key={s.trackId} data-track={s.trackId} data-flash={flash === s.trackId || undefined} style={{ '--i': i }}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="vp-recs__cover"
                aria-label={`${s.title} by ${s.artist}, on Apple Music`}
                onPointerEnter={(e) => e.pointerType === 'mouse' && setShown(i)}
                onPointerLeave={() => setShown(null)}
                onFocus={() => setShown(i)}
                onBlur={() => setShown(null)}
              >
                <img src={coverAt(s.cover, 120)} alt="" width="60" height="60" loading="lazy" draggable="false" />
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="vp-recs__note">
        <span aria-live="polite">{note}</span>
        {!note && <span aria-hidden="true">{caption}</span>}
      </p>
    </section>
  )
}
