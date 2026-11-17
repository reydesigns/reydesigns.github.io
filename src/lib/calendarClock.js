/**
 * The clock behind the strawberry cat's block calendar (catCalendar.js): what
 * month and year it is where the visitor is, and when that might change.
 *
 * Everything is the visitor's local time (`new Date()`): the calendar shows
 * MM YYYY as six digits, the month zero-padded (01-12). It can only change at
 * a local midnight, so instead of polling, one timeout is set for the next
 * one; when it fires the digits are worked out again and the next midnight is
 * timed. A background tab's timers are slowed or held, so when the tab comes
 * back into view the date is checked again and the timer reset.
 *
 * In development, `?mockDate=2026-12-31T23:59:55` (local time, no zone) sets
 * the clock running from that moment, to watch a month or a year turn over
 * without waiting for one.
 */

/** How long past midnight the check runs, so a timer that is a hair early
    still lands on the new day. */
const PAST_MIDNIGHT_MS = 50

/** The fake clock's offset from the real one, in development only. */
const offset = (() => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return 0
  const mock = new URLSearchParams(window.location.search).get('mockDate')
  if (!mock) return 0
  const t = new Date(mock).getTime()
  if (Number.isNaN(t)) {
    console.warn(`calendar: could not read mockDate=${mock}`)
    return 0
  }
  return t - Date.now()
})()

/** Now, on the visitor's clock (or the fake one). */
export function calendarNow() {
  return new Date(Date.now() + offset)
}

/** MM YYYY as six digits: [m, m, y, y, y, y]. */
export function calendarDigits(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = String(date.getFullYear()).padStart(4, '0').slice(-4)
  return [...mm, ...yyyy].map(Number)
}

/** Milliseconds from `date` to the next local midnight (DST-safe: the
    midnight is built from the local calendar date, not by adding 24 h). */
export function msToNextMidnight(date) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  return next.getTime() - date.getTime()
}

/**
 * Watches the calendar date. `onChange(digits, previous)` is called once at
 * once with `previous` null (show these, no animation), and again whenever a
 * check finds different digits: at each local midnight, and when the tab
 * comes back into view. A check that runs while the tab is hidden is put off
 * until it is shown, so the change is seen. Returns a function that stops it.
 */
export function watchCalendar(onChange) {
  let digits = calendarDigits(calendarNow())
  let timer = 0
  let stopped = false
  onChange(digits, null)

  const check = () => {
    if (stopped || document.hidden) return
    const next = calendarDigits(calendarNow())
    if (next.some((d, i) => d !== digits[i])) {
      const previous = digits
      digits = next
      onChange(next, previous)
    }
  }

  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      check()
      schedule()
    }, msToNextMidnight(calendarNow()) + PAST_MIDNIGHT_MS)
  }

  const onVisible = () => {
    if (document.hidden) return
    check()
    schedule()
  }

  schedule()
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    stopped = true
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
