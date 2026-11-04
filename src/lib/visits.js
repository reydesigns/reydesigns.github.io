/* ---------------------------------------------------------------------------
   The footer's visitor counter: how many times the site has been visited,
   this visit included. A visit is a tab opened on the live site: it counts
   once, however many pages are seen or reloads made in that tab (it keeps a
   note in sessionStorage, which lasts as long as the tab does), and a new tab
   or a later return counts again. Visits to the dev server, and the test
   scripts, only read the count.

   The count lives in Supabase (supabase/site_visits.sql, supabase.js); its
   count_visit(first) adds one when `first` is true (this visit is new) and
   returns the total either way. With no project set, the dev server keeps a
   stand-in count in sessionStorage's place, and a production build shows no
   counter at all (visitorCount resolves null).
--------------------------------------------------------------------------- */

import { rest, supabaseHeaders, supabaseOn } from '@/lib/supabase'

const VISIT_KEY = 'rd-visit-counted'
const DEV_KEY = 'rd-visits-dev'

function read(store, key) {
  try {
    return window[store].getItem(key)
  } catch {
    return null
  }
}
function write(store, key, value) {
  try {
    window[store].setItem(key, value)
  } catch {
    // Private mode or blocked storage: a reload in this tab may count again.
  }
}

let pending = null

/** The number of visits so far, counting this one, or null if it cannot be
    had. Asked once per page load, however many footers mount. */
export function visitorCount() {
  if (pending) return pending
  const fresh = !read('sessionStorage', VISIT_KEY)
  // Only the live site counts: the dev server and the test scripts only read
  // the number, so working on the site never adds to it.
  const count = import.meta.env.PROD && fresh
  pending = (async () => {
    if (!supabaseOn) {
      if (!import.meta.env.DEV) return null
      const n = Number(read('localStorage', DEV_KEY) ?? 0) + (fresh ? 1 : 0)
      write('localStorage', DEV_KEY, String(n))
      write('sessionStorage', VISIT_KEY, '1')
      return n
    }
    const res = await fetch(rest('rpc/count_visit'), {
      method: 'POST',
      headers: supabaseHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ first: count }),
    })
    if (!res.ok) throw new Error(`the counter answered ${res.status}`)
    const n = Number(await res.json())
    if (!Number.isFinite(n)) throw new Error('the counter sent no number')
    write('sessionStorage', VISIT_KEY, '1')
    return n
  })().catch((err) => {
    console.warn('[visits] no count', err)
    return null
  })
  return pending
}
