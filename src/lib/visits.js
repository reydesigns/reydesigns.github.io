/* ---------------------------------------------------------------------------
   The footer's visitor counter: how many browsers have visited the site, this
   one included. A browser counts once, the first time it comes (it keeps a
   note in localStorage); every visit after that just reads the count.

   The count lives in Supabase (supabase/site_visits.sql, supabase.js). With
   no project set, the dev server keeps a stand-in count in localStorage, and
   a production build shows no counter at all (visitorCount resolves null).
--------------------------------------------------------------------------- */

import { rest, supabaseHeaders, supabaseOn } from '@/lib/supabase'

const SEEN_KEY = 'rd-visited'
const DEV_KEY = 'rd-visits-dev'

function read(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private mode or blocked storage: this browser may be counted again.
  }
}

let pending = null

/** The number of visitors so far, counting this one, or null if it cannot be
    had. Asked once per page load, however many footers mount. */
export function visitorCount() {
  if (pending) return pending
  const first = !read(SEEN_KEY)
  pending = (async () => {
    if (!supabaseOn) {
      if (!import.meta.env.DEV) return null
      const n = Number(read(DEV_KEY) ?? 0) + (first ? 1 : 0)
      write(DEV_KEY, String(n))
      write(SEEN_KEY, '1')
      return n
    }
    const res = await fetch(rest('rpc/count_visit'), {
      method: 'POST',
      headers: supabaseHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ first }),
    })
    if (!res.ok) throw new Error(`the counter answered ${res.status}`)
    const n = Number(await res.json())
    if (!Number.isFinite(n)) throw new Error('the counter sent no number')
    write(SEEN_KEY, '1')
    return n
  })().catch((err) => {
    console.warn('[visits] no count', err)
    return null
  })
  return pending
}
