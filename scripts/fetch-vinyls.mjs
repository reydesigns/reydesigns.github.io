#!/usr/bin/env node
/**
 * Builds src/data/vinyls.json, the records on the vinyl player card: one entry
 * per song in SONGS below, with its album cover and a 30 second preview clip,
 * both looked up on the iTunes Search API (no key needed).
 *
 *   node scripts/fetch-vinyls.mjs
 *
 * To change the records: edit SONGS, run the script, look over what it
 * printed, and commit the JSON. The site only reads the JSON, never the API.
 *
 * Matching is strict and never guesses. A result counts only when its title,
 * with any "(feat. ...)", "(with ...)" or "[...]" taken off, is the requested
 * title; every requested artist is in its artist name or in a feat./with
 * credit; it is not a remix, live take, cover, karaoke, instrumental, sped up
 * or slowed edit, acoustic version, tribute or re-recording; and it has both a
 * preview and artwork. Among those, the original album beats a single, an
 * edition or a compilation, and the explicit version beats the clean one. The
 * search endpoint leaves most explicit tracks out of its results, so when the
 * best match is a clean version the script looks up the same album's explicit
 * release through the artist's catalogue. And when no search finds a song at
 * all (the search index lags behind new releases), the script looks through
 * each requested artist's own songs by artist id before giving up.
 *
 * A song with no confident match is printed as NOT FOUND (or AMBIGUOUS, with
 * the candidates) and left out of the JSON. The rest are still written, and
 * the script exits with code 1 so the gap is hard to miss. If a request keeps
 * failing, nothing is written at all.
 *
 * The API rate limits, so requests go one at a time, about 3s apart, and back
 * off on 403/429/5xx (honouring Retry-After).
 */
import fs from 'node:fs'

/* The records, in shelf order: [title, ...artists]. List every credited
   artist; each one has to show up on the match. */
const SONGS = [
  ['My Eyes', 'Travis Scott'],
  ['Let It Happen', 'Tame Impala'],
  ['Back Home', 'Yeat', 'Joji'],
  ['Rendezvous', 'Don Toliver', 'Yeat'],
  ['Rocketeer', 'Far East Movement'],
]

const OUT = new URL('../src/data/vinyls.json', import.meta.url)
const API = 'https://itunes.apple.com'
const GAP = 3000
const RETRIES = 5

/* ---------- requests ---------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let lastRequest = 0

/** Seconds (or an HTTP date) from a Retry-After header, as milliseconds. */
function retryAfter(res) {
  const v = res.headers.get('retry-after')
  if (!v) return 0
  const s = Number(v)
  if (Number.isFinite(s)) return s * 1000
  const t = Date.parse(v)
  return Number.isFinite(t) ? Math.max(0, t - Date.now()) : 0
}

/** GET an API path as JSON, spaced GAP apart, retrying throttles and 5xx. */
async function api(path, params) {
  const url = `${API}/${path}?${new URLSearchParams(params)}`
  for (let attempt = 0; ; attempt++) {
    await sleep(Math.max(0, lastRequest + GAP - Date.now()))
    lastRequest = Date.now()
    let res
    try {
      res = await fetch(url)
    } catch (err) {
      if (attempt >= RETRIES) throw new Error(`${url}: ${err.message}`)
      const wait = 5000 * 2 ** attempt
      console.log(`  network error (${err.message}), retrying in ${wait / 1000}s`)
      await sleep(wait)
      continue
    }
    if (res.ok) return (await res.json()).results || []
    const retryable = res.status === 403 || res.status === 429 || res.status >= 500
    if (!retryable || attempt >= RETRIES) throw new Error(`${url}: HTTP ${res.status}`)
    const wait = Math.max(retryAfter(res), 10000 * 2 ** attempt)
    console.log(`  HTTP ${res.status}, backing off ${Math.round(wait / 1000)}s`)
    await sleep(wait)
  }
}

const search = (term, limit, extra = {}) =>
  api('search', { term, entity: 'song', limit: String(limit), ...extra })
const lookup = (id, entity) => api('lookup', { id: String(id), entity, limit: '200' })

/* ---------- matching ---------- */

/** Lowercase, accents off, punctuation to spaces, single-spaced. */
const fold = (s) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/* A feat./with credit, in round or square brackets. */
const CREDIT = /\s*[([]\s*(?:feat\.?|ft\.?|featuring|with)\s+([^)\]]*)[)\]]/gi

/** The track name without its feat./with credits, as shown on the record. */
const bareTitle = (name) => name.replace(CREDIT, '').trim()

/** The track name folded for comparison: credits and [...] tags dropped. */
const titleKey = (name) => fold(bareTitle(name).replace(/\s*\[[^\]]*\]/g, ''))

/** Everyone credited on a track: its artist name plus feat./with credits. */
const credits = (r) =>
  ` ${fold([r.artistName, ...[...r.trackName.matchAll(CREDIT)].map((m) => m[1])].join(' '))} `

/** The artist line on the record: the track's artist name, plus anyone
    credited only in a feat./with tag on the title (which the record's title
    drops), so "Rendezvous (feat. Yeat)" by Don Toliver still names Yeat.
    Anyone the artist name already credits is not repeated. */
function artistLine(r) {
  const seen = new Set([fold(r.artistName)])
  const named = ` ${fold(r.artistName)} `
  const extra = []
  for (const m of r.trackName.matchAll(CREDIT)) {
    for (const who of m[1].split(/\s*(?:,|&)\s*/)) {
      const key = fold(who)
      if (!key || named.includes(` ${key} `) || seen.has(key)) continue
      seen.add(key)
      extra.push(who.trim())
    }
  }
  if (!extra.length) return r.artistName
  const list = extra.length > 1 ? `${extra.slice(0, -1).join(', ')} & ${extra.at(-1)}` : extra[0]
  return `${r.artistName} feat. ${list}`
}

/** Lowercase words joined by hyphens, for ids. */
const slug = (s) => fold(s).replace(/ /g, '-')

/** The bracketed and " - " suffixed parts of a name, where version tags live
    (feat./with credits aside). */
const tags = (name) =>
  [...[...name.matchAll(/[([]([^)\]]*)[)\]]/g)].map((m) => m[1]), ...name.split(' - ').slice(1)]
    .filter((t) => !/^\s*(feat\.?|ft\.?|featuring|with)\s/i.test(t))

/* Version tags that mean "not the original recording". Checked only inside
   brackets and " - " suffixes, so an album simply called "Live ..." passes. */
const VERSION_TAG =
  /\b(remix(es)?|mix|edit|live|cover|karaoke|instrumental|sped up|speed up|slowed|reverb|nightcore|acoustic|unplugged|tribute|re ?record(ed|ing)?|demo|a ?cappella|8d|lullaby|piano version)\b/
/* Giveaways of a karaoke, tribute or cover release, anywhere in the names. */
const NOT_ORIGINAL =
  /\b(karaoke|tribute|originally performed|in the style of|made famous|as made famous|cover version|lullaby versions?|re ?recorded)\b/

/** Why a result is not this song, or '' when it is. */
function reject(r, [title, ...artists]) {
  if (r.wrapperType !== 'track' || r.kind !== 'song') return 'not a song'
  if (titleKey(r.trackName) !== fold(title)) return 'title differs'
  const who = credits(r)
  const missing = artists.filter((a) => !who.includes(` ${fold(a)} `))
  if (missing.length) return `${missing.join(', ')} not credited`
  for (const name of [r.trackName, r.collectionName]) {
    const tag = tags(name).map(fold).find((t) => VERSION_TAG.test(t))
    if (tag) return `version tag "${tag}"`
  }
  const all = fold([r.trackName, r.collectionName, r.artistName].join(' '))
  const giveaway = all.match(NOT_ORIGINAL)
  if (giveaway) return `"${giveaway[0]}" release`
  if (!r.previewUrl) return 'no preview'
  if (!r.artworkUrl100) return 'no artwork'
  return ''
}

const COMPILATION =
  /\b(greatest hits|best of|hits of|essentials?|anthology|compilation|collection|now that s what)\b/
const EDITION = /\b(deluxe|expanded|anniversary|edition|bonus|special|complete|remaster(ed)?|reissue|version)\b/

/** The album name with " - Single"/" - EP" and edition brackets taken off. */
const albumKey = (name) =>
  fold(
    name
      .replace(/\s+-\s+(single|ep)$/i, '')
      .replace(/\s*[([][^)\]]*[)\]]/g, (m) => (EDITION.test(fold(m)) ? '' : m)),
  )

/** Ranking, best first: compared element by element. */
function score(r, [, firstArtist]) {
  const various =
    r.collectionArtistName === 'Various Artists' || COMPILATION.test(fold(r.collectionName))
  const type = / - single$/i.test(r.collectionName) ? 0 : / - ep$/i.test(r.collectionName) ? 1 : 2
  const explicit = { explicit: 2, notExplicit: 1, cleaned: 0 }
  const edition = tags(r.collectionName).some((t) => EDITION.test(fold(t)))
  return [
    various ? 0 : 1,
    type,
    explicit[r.trackExplicitness] ?? 0,
    explicit[r.collectionExplicitness] ?? 0,
    edition ? 0 : 1,
    fold(r.artistName).startsWith(fold(firstArtist)) ? 1 : 0,
  ]
}

const compare = (a, b) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i]
  return 0
}

const describe = (r) =>
  `"${r.trackName}" by ${r.artistName} on ${r.collectionName} (${r.trackExplicitness}, id ${r.trackId})`

/** The search strategies for one song, most specific first. */
function queries([title, ...artists]) {
  const list = [
    [`${title} ${artists.join(' ')}`, 25],
    [`${title} ${artists[0]}`, 25],
    ...artists.slice(1).map((a) => [`${title} ${a}`, 25]),
    [`${title} ${artists.join(' ')}`, 200],
    [title, 200],
    // Last resort: each artist's own catalogue, for a title that ranks badly.
    ...artists.map((a) => [a, 200, { attribute: 'artistTerm' }]),
  ]
  const seen = new Set()
  return list.filter(([term, limit, extra]) => {
    const k = JSON.stringify([term, limit, extra])
    return seen.has(k) ? false : seen.add(k)
  })
}

/**
 * The search endpoint hides most explicit tracks, so for a clean match look
 * for an explicit release of the same album in the artist's catalogue and the
 * same song on it. Returns the explicit track, or null.
 */
async function explicitTwin(clean, song) {
  const albums = (await lookup(clean.artistId, 'album')).filter(
    (a) =>
      a.wrapperType === 'collection' &&
      a.collectionExplicitness === 'explicit' &&
      fold(a.collectionName) === fold(clean.collectionName),
  )
  albums.sort((a, b) => (b.trackCount === clean.trackCount) - (a.trackCount === clean.trackCount))
  for (const album of albums.slice(0, 3)) {
    const twin = (await lookup(album.collectionId, 'song'))
      .filter((t) => t.trackExplicitness === 'explicit' && !reject(t, song))
      .sort((a, b) => (b.trackNumber === clean.trackNumber) - (a.trackNumber === clean.trackNumber))[0]
    if (twin) return twin
  }
  return null
}

/**
 * The search endpoint can miss a song outright, most often a recent one: in
 * November 2026 no search returned "Back Home" by Yeat and Joji (ADL, March
 * 2026), though the song, its album and its preview were all on iTunes. So
 * when every search comes up empty, go through each requested artist's own
 * songs by artist id (the up to three artists whose name is exactly that
 * one; several unrelated acts share some names). Every song found there is
 * judged by the same rules as a search result, through `consider`.
 */
async function fromCatalogue([, ...artists], consider, done, tried) {
  for (const name of artists) {
    const acts = (await api('search', { term: name, entity: 'musicArtist', limit: '10' }))
      .filter((a) => fold(a.artistName) === fold(name))
      .slice(0, 3)
    for (const act of acts) {
      tried.push(`the catalogue of ${act.artistName} (id ${act.artistId})`)
      const songs = await lookup(act.artistId, 'song')
      const count = songs.filter((s) => s.wrapperType === 'track').length
      console.log(`  catalogue of ${act.artistName} (id ${act.artistId}): ${count} songs`)
      songs.forEach(consider)
    }
    if (done()) return
  }
}

/** Finds one song. Returns { record } or { problem } for the report. */
async function find(song) {
  const [title, ...artists] = song
  console.log(`\n${title}, ${artists.join(' and ')}`)
  const accepted = new Map()
  const nearMisses = new Map()
  const tried = []
  const consider = (r) => {
    const why = reject(r, song)
    if (!why) accepted.set(r.trackId, r)
    else if (r.trackName && titleKey(r.trackName) === fold(title)) nearMisses.set(r.trackId, [r, why])
  }
  for (const [term, limit, extra] of queries(song)) {
    const label = `"${term}"${extra ? ' as artist' : ''} limit ${limit}`
    tried.push(label)
    const results = await search(term, limit, extra)
    console.log(`  search ${label}: ${results.length} results`)
    results.forEach(consider)
    if (accepted.size) break
  }
  if (!accepted.size) await fromCatalogue(song, consider, () => accepted.size > 0, tried)

  if (!accepted.size) {
    /* Spell out the rejects that credit one of the artists; the same title
       by strangers only gets counted. */
    const misses = [...nearMisses.values()]
    const close = misses.filter(([r]) => artists.some((a) => credits(r).includes(` ${fold(a)} `)))
    const strangers = misses.length - close.length
    return {
      problem: [
        `NOT FOUND  ${title}, ${artists.join(' and ')}`,
        `    searched ${tried.join(', ')}`,
        ...close.map(([r, why]) => `    rejected ${describe(r)}: ${why}`),
        misses.length
          ? `    ${strangers} other results had this title by other artists`
          : '    no result had this title',
      ],
    }
  }

  const ranked = [...accepted.values()].sort((a, b) => compare(score(a, song), score(b, song)))
  const top = ranked.filter((r) => !compare(score(r, song), score(ranked[0], song)))
  if (new Set(top.map((r) => albumKey(r.collectionName))).size > 1) {
    return {
      problem: [
        `AMBIGUOUS  ${title}, ${artists.join(' and ')}: equally good matches on different albums`,
        ...top.map((r) => `    candidate ${describe(r)}`),
      ],
    }
  }

  let best = ranked[0]
  if (best.trackExplicitness === 'cleaned') {
    const twin = await explicitTwin(best, song)
    if (twin) {
      console.log(`  clean ${best.trackId} swapped for explicit ${twin.trackId}`)
      best = twin
    } else console.log('  no explicit release found, keeping the clean version')
  }
  console.log(`  MATCH  ${describe(best)}`)

  const name = bareTitle(best.trackName)
  return {
    record: {
      id: slug(name),
      title: name,
      artist: artistLine(best),
      album: best.collectionName,
      coverUrl: best.artworkUrl100.replace('100x100', '600x600'),
      previewUrl: best.previewUrl,
    },
  }
}

const records = []
const problems = []
try {
  for (const song of SONGS) {
    const { record, problem } = await find(song)
    if (record) records.push(record)
    else problems.push(problem)
  }
} catch (err) {
  console.error(`\nRequest failed, ${OUT.pathname} left as it was:\n  ${err.message}`)
  process.exit(1)
}

/* The ids key each record's audio and its place in the page, so no two may
   match: a song whose title another one already has gets its artist added,
   and then a number if even that is taken. */
const ids = new Set()
for (const r of records) {
  let id = r.id
  if (ids.has(id)) id = `${r.id}-${slug(r.artist)}`
  for (let k = 2; ids.has(id); k += 1) id = `${r.id}-${k}`
  ids.add(id)
  r.id = id
}

fs.writeFileSync(OUT, `${JSON.stringify(records, null, 2)}\n`)
console.log(`\nWrote ${records.length} of ${SONGS.length} records to src/data/vinyls.json`)
for (const lines of problems) console.log(lines.join('\n'))
if (problems.length) process.exit(1)
