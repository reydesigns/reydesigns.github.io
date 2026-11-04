/* ---------------------------------------------------------------------------
   The site's one Supabase project, used straight through its REST API (no
   SDK in the bundle) by the Vinyl Player's song recommendations
   (songRecs.js, supabase/song_recs.sql) and the footer's visitor counter
   (visits.js, supabase/site_visits.sql).

   The two values below are public by design: the key only allows what each
   table's row-level security and grants let anyone do. Paste them in from
   the Supabase dashboard (Project Settings > API: the project URL, and the
   publishable or anon key). Until they are set, the dev server stands in for
   the database with localStorage, and a production build leaves both
   features out.
--------------------------------------------------------------------------- */

export const SUPABASE_URL = ''
export const SUPABASE_KEY = ''

export const supabaseOn = Boolean(SUPABASE_URL && SUPABASE_KEY)

/** A REST API URL: `rest('song_recs')`, `rest('rpc/count_visit')`. */
export const rest = (path) => `${SUPABASE_URL}/rest/v1/${path}`

/** Request headers. A legacy anon key is a JWT and goes in Authorization
    too; the newer publishable keys (sb_publishable_...) go in apikey alone. */
export function supabaseHeaders(extra) {
  const h = { apikey: SUPABASE_KEY, ...extra }
  if (SUPABASE_KEY.startsWith('eyJ')) h.Authorization = `Bearer ${SUPABASE_KEY}`
  return h
}
