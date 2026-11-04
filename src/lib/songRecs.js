/* ---------------------------------------------------------------------------
   Song recommendations for the Vinyl Player: visitors search iTunes for a
   song and add it to a public list everyone sees, under the record stack.

   The list lives in a Supabase table (supabase/song_recs.sql sets it up; the
   project's URL and key are in supabase.js), and the table's checks hold
   every row to a real iTunes cover and an Apple Music link.

   With no project set, the dev server keeps the list in this browser's
   localStorage, so the panel can still be tried on :5173, and a production
   build leaves the panel out (RECS_ON) and lays the pop-up out as before.
--------------------------------------------------------------------------- */

import { rest, supabaseHeaders, supabaseOn } from '@/lib/supabase'

const TABLE = 'song_recs'
const LIST_LIMIT = 60
const DEV_KEY = 'vp-recs-dev'

const live = supabaseOn
export const RECS_ON = live || import.meta.env.DEV

/* --- iTunes search ---------------------------------------------------------- */

/** Apple Music links come with an affiliate-style `uo=4`; the `i=` (which
    track on the album) has to stay. */
function cleanUrl(url) {
  try {
    const u = new URL(url)
    u.searchParams.delete('uo')
    return u.toString()
  } catch {
    return url
  }
}

const fold = (s) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** One song however many albums it is on: its title and artist, folded.
    The table holds each song once by this too (supabase/song_recs.sql). */
export const songKey = (s) => `${s.title.toLowerCase()}|${s.artist.toLowerCase()}`

/* iTunes puts karaoke, kids', lullaby and piano-cover versions of a hit
   high up, often above the song itself, so they are sent down the list
   (not out of it: someone may really mean one). A remix, live take or other
   version goes down a little. */
const KNOCKOFF =
  /karaoke|originally performed|in the style of|made famous|backing track|tribute|kidz bop|lullab|for babies|lullapop|music box|8 bit|nightcore|string quartet|smooth jazz|lofi|lo fi|piano (?:version|cover|arrangement|rendition)|instrumental|the voice performance|sped up|slowed/
const VARIANT = /\b(?:remix|live|acoustic|version|edit|demo|session|sessions|reprise|mix)\b/

/** Songs matching `term`, best first: { trackId, title, artist, cover, url }.
    Rejects on a network error or a refusal (the API rate limits). */
export async function searchSongs(term, signal) {
  // No `media=music`: with it, an iPhone or iPad gets a redirect to the Music
  // app (musics://...) instead of results. `entity=song` alone is enough.
  const q = new URLSearchParams({ term, entity: 'song', limit: '25' })
  const res = await fetch(`https://itunes.apple.com/search?${q}`, { signal })
  if (!res.ok) throw new Error(`iTunes search answered ${res.status}`)
  const data = await res.json()
  const words = fold(term).split(' ').filter((w) => w.length > 1)
  const ranked = []
  ;(data.results ?? []).forEach((r, i) => {
    if (r.kind !== 'song' || !r.trackId || !r.trackName || !r.artistName || !r.artworkUrl100 || !r.trackViewUrl) return
    const title = fold(r.trackName)
    const named = ` ${title} ${fold(r.artistName)} `
    let score = 0
    // Every word typed is in the title or the artist (not just the album).
    if (words.length && words.every((w) => named.includes(` ${w}`))) score += 2
    if (KNOCKOFF.test(`${named} ${fold(r.collectionName ?? '')}`)) score -= 3
    else if (VARIANT.test(title)) score -= 1
    ranked.push({ score, i, r })
  })
  ranked.sort((a, b) => b.score - a.score || a.i - b.i)
  const seen = new Set()
  const out = []
  for (const { r } of ranked) {
    const song = { trackId: r.trackId, title: r.trackName, artist: r.artistName, cover: r.artworkUrl100, url: cleanUrl(r.trackViewUrl) }
    // The same song from the single, the album and the deluxe edition.
    if (seen.has(songKey(song))) continue
    seen.add(songKey(song))
    out.push(song)
    if (out.length === 6) break
  }
  return out
}

/* --- the shared list -------------------------------------------------------- */

const fromRow = (r) => ({ trackId: Number(r.track_id), title: r.title, artist: r.artist, cover: r.cover_url, url: r.track_url })

function devList() {
  try {
    return JSON.parse(localStorage.getItem(DEV_KEY) ?? '[]')
  } catch {
    return []
  }
}

/** The most recent recommendations, newest first. */
export async function listRecs() {
  if (!live) return devList()
  const q = new URLSearchParams({
    select: 'track_id,title,artist,cover_url,track_url',
    order: 'created_at.desc',
    limit: String(LIST_LIMIT),
  })
  const res = await fetch(`${rest(TABLE)}?${q}`, { headers: supabaseHeaders() })
  if (!res.ok) throw new Error(`the list answered ${res.status}`)
  return (await res.json()).map(fromRow)
}

/** Add a song. Resolves 'added', or 'already' if it is on the list; rejects
    if it could not be saved. */
export async function addRec(song) {
  if (!live) {
    const list = devList()
    if (list.some((s) => songKey(s) === songKey(song))) return 'already'
    try {
      localStorage.setItem(DEV_KEY, JSON.stringify([song, ...list].slice(0, LIST_LIMIT)))
    } catch {
      // Private mode or full storage: the dev list just won't outlive the page.
    }
    return 'added'
  }
  const res = await fetch(rest(TABLE), {
    method: 'POST',
    headers: supabaseHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({
      track_id: song.trackId,
      title: song.title,
      artist: song.artist,
      cover_url: song.cover,
      track_url: song.url,
    }),
  })
  // 409: a unique key (the track, or the same title and artist): someone
  // recommended it first.
  if (res.status === 409) return 'already'
  if (!res.ok) throw new Error(`adding answered ${res.status}`)
  return 'added'
}
