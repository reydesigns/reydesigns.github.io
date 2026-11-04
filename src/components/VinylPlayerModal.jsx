import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import vinyls from '@/data/vinyls.json'
import {
  ARM_DRIFT,
  ARM_PLAY,
  ARM_REST,
  DISC,
  PLATTER,
  PLINTH,
  RECORD_R,
  Record,
  RecordPlayer,
  armShadowTransform,
  armTransform,
  cueTransform,
  platterRecordTransform,
} from '@/components/RecordPlayer'
import {
  Q_CLEAR,
  VinylStack,
  coverAt,
  liftPose,
  peekX,
  poseTransform,
  recordPose,
  shadowOffset,
  sleeveSlots,
} from '@/components/VinylStack'
import { setCursorHost } from '@/components/CustomCursor'
import { holdScroll } from '@/lib/scrollLock'
import { SizeGlyph } from '@/components/CaseStudyModal'
import { SongRecs } from '@/components/SongRecs'
import { RECS_ON } from '@/lib/songRecs'
import { useMediaQuery, SM, HOVER } from '@/lib/useMediaQuery'
import { useInView } from '@/lib/useInView'
import { useReducedMotion } from '@/lib/useReducedMotion'

/* ---------------------------------------------------------------------------
   The Vinyl Player: the Works card that opens a little diorama instead of a
   case study. A sage turntable (RecordPlayer) with a stack of records beside
   it (VinylStack); lift a sleeve, drag its record onto the platter, and the
   middle ten seconds of the song play while it spins.

   The songs, covers and preview clips all come from src/data/vinyls.json,
   which scripts/fetch-vinyls.mjs writes from the iTunes Search API. Nothing
   here names a song, and any count from one to five lays out.

   Three parts live in this file, plus the Equaliser, the burgundy backdrop
   that follows the song while a record plays:

     audio     one <audio> per record, each routed through a Web Audio gain
               node so the clip can fade in and out (an element's own volume
               is read-only on iOS). They are created and told to load inside
               the card's click, the one moment iOS Safari will really
               preload, and each is parked on its clip's first frame as soon
               as its length is known, so a drop starts sound within a frame.
     the deck  the scene's state machine and its one requestAnimationFrame
               loop. Pointer moves never touch React: they write a target,
               the loop moves the record towards it and writes transforms
               straight to the SVG nodes the components hand over in `parts`.
               React only hears about the few things it renders: which lifted
               sleeve is on top, and what is playing.
     the pop-up  a native <dialog> (focus trap, Escape and the top layer come
               free), on the FunziePopup pattern: Lenis paused, the custom
               cursor moved inside, a short animated close, and focus handed
               back to the card.

   Under the stack, the pop-up has a "Recommend a song" panel (SongRecs):
   visitors search iTunes and add songs to a public list. It is on when
   src/lib/songRecs.js has its Supabase project set (and always on the dev
   server); otherwise the pop-up is laid out as it was without it.

   Reduced motion keeps every interaction and drops the motion: sleeves and
   records jump to where they are going, the arm moves without swinging, and
   nothing spins.
--------------------------------------------------------------------------- */

const CLIP = 10 // seconds played from the middle of each preview
const FADE = 0.3 // seconds of fade at each end of the clip
const CLOSE_MS = 180
// Maximize / minimize: the frame's move between its two boxes (a FLIP), as
// the case-study window does it.
const RESIZE_MS = 320
const RESIZE_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
// Movement before a press on a sleeve becomes a drag: more for a finger,
// which wanders a little on a tap that is meant to play the record.
const PICKUP_PX = { mouse: 5, pen: 8, touch: 10 }
const LEAVE_MS = 150 // grace before a sleeve the pointer has left drops back
const DROP_GIVE = 0.05 // the drop zone's give at its edges, in sleeve sizes
const SPIN = 0.2 // degrees per ms: 33 1/3 rpm

/* --- audio ----------------------------------------------------------------- */

let engine = null

/** Make the five audio elements and start them loading. Must run inside the
    user gesture that opens the pop-up (the card's click), synchronously. Safe
    to call again: later calls only wake the audio context back up. */
export function prepareVinylAudio() {
  if (engine) {
    if (engine.ctx && engine.ctx.state === 'suspended') engine.ctx.resume().catch(() => {})
    return engine
  }
  let ctx = null
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (Ctx) ctx = new Ctx()
  } catch (err) {
    console.warn('[vinyl] no Web Audio, clips will play without fades', err)
  }
  // One analyser after every clip's gain, so the backdrop (Equaliser) hears
  // exactly what plays, fades included. Only the playing clip has any gain.
  let analyser = null
  if (ctx) {
    try {
      analyser = ctx.createAnalyser()
      // 4096 samples: about 11 Hz a bin, fine enough for a band per column.
      analyser.fftSize = 4096
      analyser.smoothingTimeConstant = 0.7
      analyser.connect(ctx.destination)
    } catch (err) {
      console.warn('[vinyl] no analyser, the backdrop will hold still', err)
      analyser = null
    }
  }
  const tracks = new Map()
  for (const v of vinyls) {
    const el = new Audio()
    // Before src: the previews are served with Access-Control-Allow-Origin,
    // and without this a media element source would output silence.
    el.crossOrigin = 'anonymous'
    el.preload = 'auto'
    el.src = v.previewUrl
    const t = { id: v.id, el, gain: null, clipStart: CLIP, clipEnd: CLIP * 2, timer: 0, halt: 0, run: 0, onEnd: null }
    if (ctx) {
      try {
        const source = ctx.createMediaElementSource(el)
        t.gain = ctx.createGain()
        t.gain.gain.value = 0
        source.connect(t.gain)
        t.gain.connect(analyser ?? ctx.destination)
      } catch (err) {
        console.warn('[vinyl] could not route a preview through Web Audio', err)
        t.gain = null
      }
    }
    // The middle ten seconds of whatever length the preview really is (10 to
    // 20 for the usual 30), and a seek there now, so the bytes around it are
    // what gets buffered.
    el.addEventListener(
      'loadedmetadata',
      () => {
        const d = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : CLIP * 3
        t.clipStart = Math.max(0, d / 2 - CLIP / 2)
        t.clipEnd = Math.min(d, t.clipStart + CLIP)
        if (el.paused) el.currentTime = t.clipStart
      },
      { once: true },
    )
    el.load()
    tracks.set(v.id, t)
  }
  engine = { ctx, tracks, analyser }
  return engine
}

/** Ramp a track's level to `to` over `seconds`: on the audio clock through
    its gain node, or by stepping element volume where there is no Web Audio. */
function level(t, to, seconds) {
  clearInterval(t.volume)
  if (t.gain) {
    const g = t.gain.gain
    const now = engine.ctx.currentTime
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
    if (seconds > 0) g.linearRampToValueAtTime(to, now + seconds)
    else g.setValueAtTime(to, now)
    return
  }
  if (seconds <= 0) {
    t.el.volume = to
    return
  }
  const from = t.el.volume
  const t0 = performance.now()
  t.volume = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / (seconds * 1000))
    t.el.volume = from + (to - from) * k
    if (k >= 1) clearInterval(t.volume)
  }, 16)
}

/** Stop a track, after a fade of `seconds` (0 is at once), and park it back
    on its clip's first frame for next time. */
function halt(t, seconds) {
  clearInterval(t.timer)
  clearTimeout(t.halt)
  if (t.onPlaying) t.el.removeEventListener('playing', t.onPlaying)
  t.onPlaying = null
  t.run += 1
  t.onEnd = null
  t.fading = false
  const park = () => {
    if (!t.el.paused) {
      qa.stoppedAt = t.el.currentTime
      t.el.pause()
    }
    level(t, 0, 0)
    if (t.el.readyState > 0) t.el.currentTime = t.clipStart
  }
  if (seconds > 0 && !t.el.paused) {
    level(t, 0, seconds)
    t.halt = setTimeout(park, seconds * 1000 + 20)
  } else park()
}

/** Every record silent, now. The pop-up closing calls this. */
export function stopVinylAudio(seconds = 0.03) {
  if (!engine) return
  for (const t of engine.tracks.values()) halt(t, seconds)
  qa.phase = 'idle'
}

/** Play one record's clip from its start, fading in, and fading out so it
    ends exactly at the clip's end. Anything else playing stops. Call it from
    the gesture that dropped the record: it resumes the audio context there. */
function playClip(id, { onStart, onEnd }) {
  const e = prepareVinylAudio()
  const t = e.tracks.get(id)
  if (!t) return
  if (e.ctx && e.ctx.state !== 'running') {
    e.ctx.resume().catch((err) => console.warn('[vinyl] could not resume audio', err))
  }
  for (const other of e.tracks.values()) if (other !== t) halt(other, 0.08)
  clearInterval(t.timer)
  clearTimeout(t.halt)
  if (t.onPlaying) t.el.removeEventListener('playing', t.onPlaying)
  t.fading = false
  t.onEnd = onEnd
  const run = (t.run += 1)
  if (Math.abs(t.el.currentTime - t.clipStart) > 0.05) t.el.currentTime = t.clipStart
  level(t, 0, 0)
  level(t, 1, FADE)
  t.onPlaying = () => {
    t.onPlaying = null
    onStart?.(t)
  }
  t.el.addEventListener('playing', t.onPlaying, { once: true })

  // However the clip ends (its end, a refusal, a preview that never loads),
  // the record is handed back the same way, once, to whoever holds the clip
  // by then (adoptClip can pass it to a new deck mid-way).
  const end = () => {
    if (t.run !== run) return
    const done = t.onEnd
    halt(t, 0)
    qa.tEnded = performance.now()
    done?.()
  }
  const started = t.el.play()
  if (started) {
    started.catch((err) => {
      console.warn('[vinyl] play() was rejected', err)
      // An interrupted play (another record dropped at once) has already
      // been handed over; a refused one gives the record back.
      if (err?.name !== 'AbortError') end()
    })
  }

  // A 20ms watch rather than timeupdate (which fires about every 250ms): it
  // starts the fade-out so it lands on clipEnd, then stops the clip there. A
  // clip that has not got there long after it should have (offline, a stall)
  // is ended anyway, so a record never spins on in silence.
  const t0 = performance.now()
  t.timer = setInterval(() => {
    const now = t.el.currentTime
    if (!t.fading && now >= t.clipEnd - FADE) {
      t.fading = true
      level(t, 0, Math.max(0.02, t.clipEnd - now))
    }
    if (now >= t.clipEnd - 0.01 || t.el.ended || t.el.error || performance.now() - t0 > (CLIP + 8) * 1000) end()
  }, 20)
}

/** The record whose clip is playing, if one is: its index and track. Its
    end is reported to `onEnd` from now on. A deck made while a clip plays
    (the pop-up switched layout under it, a phone turned on its side) takes
    the record over with this rather than stopping the song. */
function adoptClip(onEnd) {
  if (!engine) return null
  for (let i = 0; i < vinyls.length; i += 1) {
    const t = engine.tracks.get(vinyls[i].id)
    if (t?.onEnd) {
      t.onEnd = onEnd
      return { i, t }
    }
  }
  return null
}

/* A window.__vinyl breadcrumb for the QA scripts, like window.__bootLog. */
const qa = typeof window !== 'undefined' ? (window.__vinyl ||= {}) : {}
qa.ids = vinyls.map((v) => v.id)
qa.audio = (id) => {
  const t = engine?.tracks.get(id)
  return t ? { el: t.el, clipStart: t.clipStart, clipEnd: t.clipEnd } : null
}

/* --- layouts ----------------------------------------------------------------- */

/* The tabletop: one flat rectangle. `bleed` carries it past the scene's
   edges (a share of each side), for the phone pop-up, where the scene is
   letterboxed and the table has to run on under the title and the caption. */
function floorRect(w, h, bleed) {
  return { x: -w * bleed, y: -h * bleed, w: w * (1 + 2 * bleed), h: h * (1 + 2 * bleed) }
}

function layoutOf({ w, h, size, stack, player, bleed = 0 }) {
  return {
    w,
    h,
    size,
    player,
    slots: sleeveSlots({ n: vinyls.length, size, ...stack }),
    floor: floorRect(w, h, bleed),
  }
}

/* Scene units. `player` places the turntable (its own units are the
   plinth's); `stack` is the column the sleeves fan down. The card is the
   Works card's 16:9, `wide` the pop-up from a tablet up (16:10), `tall` a
   phone, where the column runs down the left and the player sits beside it,
   level with its middle, with a small margin of table at either side.

   With song recommendations on (RECS_ON), the pop-up's sleeves are a size
   smaller and the stack ends just above the "Recommend a song" panel
   (SongRecs) at the foot of the left column. The panel's height in scene
   units depends on the window (its text has a smallest size), so the pop-up
   measures where it starts and ends the stack there (wideLayout, stackEnd);
   on a phone the scene is shorter and the panel sits under it. */
const STACK_GAP = 36 // scene units from the stack's end to the panel: the bottom sleeve's tilt and shadow, then clear table
const STACK_END = { min: 640, max: 966, start: 744 }
function wideLayout(stackEnd) {
  return layoutOf({
    w: 1600,
    h: 1000,
    ...(RECS_ON ? { size: 260, stack: { cx: 352, top: 30, bottom: stackEnd } } : { size: 320, stack: { cx: 352, top: 34, bottom: 966 } }),
    player: { x: 660, y: 268, s: 0.86 },
    bleed: 0.04,
  })
}
const LAYOUTS = {
  card: layoutOf({
    w: 1600,
    h: 900,
    size: 262,
    // The stack ends above the card's name chip, bottom left.
    stack: { cx: 300, top: 24, bottom: 764 },
    player: { x: 690, y: 165, s: 0.84 },
  }),
  // The title, the hint and the player are one group, centred top to bottom
  // in the window (global.css places the text to match: .vp-head), and the
  // sleeves sit well in from the left edge, towards the player.
  wide: wideLayout(STACK_END.start),
  tall: RECS_ON
    ? layoutOf({
        w: 1000,
        h: 1160,
        size: 250,
        stack: { cx: 180, top: 30, bottom: 1130, overlap: 0.18 },
        player: { x: 327, y: 349, s: 0.68 },
        bleed: 0.9,
      })
    : layoutOf({
        w: 1000,
        h: 1340,
        size: 290,
        stack: { cx: 196, top: 30, bottom: 1310, overlap: 0.18 },
        player: { x: 327, y: 439, s: 0.68 },
        bleed: 0.9,
      }),
}

/* --- the deck -------------------------------------------------------------- */

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const lerp = (a, b, k) => a + (b - a) * k
const easeOut = (k) => 1 - (1 - k) ** 3
const easeInOut = (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2)
const linear = (k) => k
const r2 = (n) => Math.round(n * 100) / 100

/** A value that eases to a target over a fixed time, and can be re-aimed
    mid-way (it sets off again from wherever it is). */
class Tween {
  constructor(v) {
    this.v = v
    this.to = v
  }
  go(to, ms, ease = easeOut) {
    if (to === this.to) return
    this.from = this.v
    this.to = to
    this.t0 = performance.now()
    this.ms = ms
    this.ease = ease
    if (ms <= 0) this.v = to
  }
  jump(v) {
    this.v = v
    this.to = v
  }
  step(now) {
    if (this.v === this.to) return false
    const k = clamp01((now - this.t0) / this.ms)
    this.v = k >= 1 ? this.to : lerp(this.from, this.to, this.ease(k))
    return true
  }
}

/** Write an attribute only when it changes. */
function put(el, name, value) {
  if (!el) return
  const memo = (el.__vp ||= {})
  if (memo[name] === value) return
  memo[name] = value
  el.setAttribute(name, value)
}

/**
 * The live scene's state machine. Each record is always in exactly one
 * place: in its sleeve (drawn by VinylStack, peeking or not), in the air
 * (dragged, or flying to the platter or home), or on the platter.
 *
 * `parts` holds the SVG nodes; `onOrder` and `onPlaying` are the only two
 * things React is told.
 */
function createDeck({ layout, reduced, parts, onOrder, onPlaying }) {
  const { size, slots, player: P } = layout
  const plat = { x: P.x + PLATTER.x * P.s, y: P.y + PLATTER.y * P.s, r: PLATTER.r * P.s }
  const platterScale = (RECORD_R * P.s) / DISC
  const ms = (t) => (reduced ? 0 : t)

  /* Where a record let go of goes on the platter: anywhere it touches the
     turntable, not just the platter's ring. It plays if the pointer is over
     the turntable, or the record is at least half over it, or either is past
     the drop line (upright, halfway between the stack's right edge, each
     sleeve's tilt included, and the turntable's left edge), which covers the
     gap between the two where there is one. Anywhere else, the record goes
     back to its sleeve. Pointer and record are both asked because the record
     trails the pointer on a quick flick, and either one being on the
     turntable reads as "I put it there". Being in the zone is what lights the
     platter's ring and sends the arm out, and the drop obeys that same state,
     so a lit ring always means the record will play. A little give at the
     edges (DROP_GIVE) keeps a record held right on one from flickering. */
  const stackRight = Math.max(
    ...slots.map((s) => {
      const a = (s.rot * Math.PI) / 180
      return s.x + (size / 2) * (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a)))
    }),
  )
  const dropX = (stackRight + P.x) / 2
  const give = size * DROP_GIVE
  const overLine = (x, was) => (was ? x > dropX - give : x > dropX + give)
  const table = { l: P.x, t: P.y, r: P.x + PLINTH.w * P.s, b: P.y + PLINTH.h * P.s }
  const overTable = (x, y, m) => x > table.l - m && x < table.r + m && y > table.t - m && y < table.b + m
  /** Would record `a` play if let go now, with the pointer at (px, py)? */
  function inZone(px, py, a, was) {
    const m = was ? give : 0
    if (overLine(px, was) || overLine(a.x, was)) return true
    return overTable(px, py, m) || overTable(a.x, a.y, (DISC * a.s) / 2 + m)
  }

  const sleeves = vinyls.map(() => ({ p: new Tween(0), q: new Tween(0), home: true, receiving: false, held: false }))
  const air = vinyls.map(() => ({ shown: false, x: 0, y: 0, s: 1, rot: 0, h: 0, flight: null }))
  const arm = { angle: new Tween(ARM_REST), lift: new Tween(0) }
  const spin = { angle: 0, omega: 0, target: 0 }
  const ring = { v: 0, target: 0, zone: false }
  let hover = null
  let focus = null
  let press = null
  let drag = null
  let onPlatter = null // the record lying on the platter
  let incoming = null // the record on its way there
  let order = vinyls.map((_, i) => i)
  let session = 0
  let tapGuard = 0
  let leaveTimer = 0
  let cued = false // the arm is out over the platter, waiting for a drop
  let cueTimer = 0
  const seqTimers = new Set() // the current play's arm and lift-off steps
  const homeTimers = new Set() // records settling back into sleeves
  let raf = 0
  let last = 0
  let alive = true

  const later = (set, fn, wait) => {
    const id = setTimeout(() => {
      set.delete(id)
      if (alive) fn()
    }, wait)
    set.add(id)
  }
  const clearSeq = () => {
    seqTimers.forEach(clearTimeout)
    seqTimers.clear()
  }

  qa.state = () => ({
    phase: qa.phase,
    onPlatter,
    incoming,
    homes: sleeves.map((s) => s.home),
    lifts: sleeves.map((s) => r2(s.p.v)),
    armAngle: r2(arm.angle.v),
    armLift: r2(arm.lift.v),
    spinning: spin.omega > 0.001,
    ring: r2(ring.v),
  })
  qa.platter = () => {
    const m = parts.svg?.getScreenCTM()
    if (!m) return null
    const c = new DOMPoint(plat.x, plat.y).matrixTransform(m)
    const line = new DOMPoint(dropX, plat.y).matrixTransform(m)
    return { x: c.x, y: c.y, r: plat.r * m.a, dropX: line.x, give: give * m.a }
  }
  qa.phase = 'idle'

  /* --- the loop --------------------------------------------------------- */

  function kick() {
    if (raf || !alive) return
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }

  function frame(now) {
    raf = 0
    const dt = Math.min(64, Math.max(0, now - last))
    last = now
    let busy = false
    for (const s of sleeves) {
      if (s.p.step(now)) busy = true
      if (s.q.step(now)) busy = true
    }
    if (arm.angle.step(now)) busy = true
    if (arm.lift.step(now)) busy = true
    air.forEach((a) => {
      if (a.flight) {
        fly(a, now)
        busy = true
      }
    })
    if (drag?.live && follow(dt)) busy = true
    if (spinStep(dt)) busy = true
    if (ringStep(dt)) busy = true
    draw()
    if (busy && alive) raf = requestAnimationFrame(frame)
  }

  /* The record chases the pointer with a ~30ms lag, which reads as weight
     without ever falling behind a fast flick, and the point it was grabbed
     by drifts to its centre, so it settles under the finger. It grows from
     its sleeve size to its platter size as it nears the platter. */
  function follow(dt) {
    const a = air[drag.i]
    const decay = reduced ? 1 : Math.exp(-dt / 120)
    drag.ox *= decay
    drag.oy *= decay
    const tx = drag.tx - drag.ox
    const ty = drag.ty - drag.oy
    const k = reduced ? 1 : 1 - Math.exp(-dt / 30)
    a.x += (tx - a.x) * k
    a.y += (ty - a.y) * k
    const near = clamp01((plat.r * 3.2 - Math.hypot(a.x - plat.x, a.y - plat.y)) / (plat.r * 2.4))
    const grow = near * near * (3 - 2 * near)
    a.s = lerp(drag.s0, platterScale, grow) * 1.04
    // The ring answers whether a drop now would play (inZone): faint while
    // the record is carried over the stack, fully lit once it touches the
    // turntable.
    const zone = inZone(drag.tx, drag.ty, a, ring.zone)
    if (zone !== ring.zone) cue(zone)
    ring.zone = zone
    ring.target = zone ? 1 : 0.3
    return Math.abs(tx - a.x) + Math.abs(ty - a.y) > 0.05 || Math.abs(drag.ox) + Math.abs(drag.oy) > 0.05
  }

  function spinStep(dt) {
    if (reduced) {
      spin.omega = 0
      return false
    }
    const tau = spin.target > spin.omega ? 260 : 320
    spin.omega += (spin.target - spin.omega) * (1 - Math.exp(-dt / tau))
    if (spin.target === 0 && spin.omega < 0.002) spin.omega = 0
    spin.angle = (spin.angle + spin.omega * dt) % 360
    return spin.omega > 0 || spin.target > 0
  }

  function ringStep(dt) {
    if (ring.v === ring.target) return false
    const k = reduced ? 1 : 1 - Math.exp(-dt / 60)
    ring.v += (ring.target - ring.v) * k
    if (Math.abs(ring.v - ring.target) < 0.004) ring.v = ring.target
    return true
  }

  function fly(a, now) {
    const f = a.flight
    const k = clamp01((now - f.t0) / f.ms)
    const e = f.ease(k)
    a.x = lerp(f.from.x, f.to.x, e)
    a.y = lerp(f.from.y, f.to.y, e)
    a.s = lerp(f.from.s, f.to.s, e)
    a.rot = lerp(f.from.rot, f.to.rot, e)
    a.h = lerp(f.from.h, f.to.h, e) + f.arc * Math.sin(Math.PI * k)
    if (k >= 1) {
      a.flight = null
      f.done?.()
    }
  }

  /** Send a record in the air to `to` ({ x, y, s, rot, h }), then `done`. */
  function launch(i, to, time, ease, arc, done) {
    const a = air[i]
    if (time <= 0) {
      Object.assign(a, to)
      a.flight = null
      done?.()
      kick()
      return
    }
    a.flight = { from: { x: a.x, y: a.y, s: a.s, rot: a.rot, h: a.h }, to, t0: performance.now(), ms: time, ease, arc, done }
    kick()
  }

  function draw() {
    sleeves.forEach((s, i) => {
      const p = s.p.v
      const o = r2(clamp01(p / 0.22))
      put(parts.base?.[i], 'opacity', r2(1 - o))
      const lift = parts.lift?.[i]
      put(lift, 'transform', poseTransform(liftPose(slots[i], p, size)))
      put(lift, 'opacity', o)
      put(lift, 'visibility', o > 0 ? 'visible' : 'hidden')
      const sh = shadowOffset(p, size)
      put(parts.liftShadow?.[i], 'transform', `translate(${sh.x} ${sh.y})`)
      const x = peekX(s.q.v, size)
      put(parts.peek?.[i], 'transform', `translate(${x} 0)`)
      put(parts.peek?.[i], 'display', s.home ? 'inline' : 'none')
      put(parts.peekShadow?.[i], 'cx', x)
      put(parts.peekShadow?.[i], 'display', s.home ? 'inline' : 'none')
      put(parts.focusRing?.[i], 'visibility', focus === i && o > 0 ? 'visible' : 'hidden')
    })
    air.forEach((a, i) => {
      const g = parts.air?.[i]
      put(g, 'display', a.shown ? 'inline' : 'none')
      if (!a.shown) return
      put(g, 'transform', `translate(${r2(a.x)} ${r2(a.y)}) scale(${Math.round(a.s * 1000) / 1000})`)
      put(parts.airDisc?.[i], 'transform', `rotate(${r2(a.rot)})`)
      const d = 3 + 13 * a.h
      put(parts.airShadow?.[i], 'transform', `translate(${r2(d * 0.8)} ${r2(d)})`)
    })
    vinyls.forEach((_, i) => {
      const el = parts.platterRecord?.[i]
      put(el, 'display', onPlatter === i ? 'inline' : 'none')
      if (onPlatter === i) put(el, 'transform', platterRecordTransform(spin.angle))
    })
    put(parts.platterShadow, 'display', onPlatter !== null ? 'inline' : 'none')
    put(parts.platterSheen, 'display', onPlatter !== null ? 'inline' : 'none')
    put(parts.arm, 'transform', armTransform(arm.angle.v))
    put(parts.armShadow, 'transform', armShadowTransform(arm.angle.v, arm.lift.v))
    put(parts.cue, 'transform', cueTransform(arm.lift.v))
    put(parts.ring, 'opacity', r2(ring.v))
    put(parts.ring, 'stroke-width', ring.zone ? 18 : 12)
    put(parts.led, 'class', onPlatter !== null || incoming !== null ? 'vpf-led-on' : 'vpf-led-off')
  }

  /* --- holds: which sleeves are up ---------------------------------------- */

  const userHeld = (i) => hover === i || focus === i || press === i

  function refresh() {
    let raised = false
    sleeves.forEach((s, i) => {
      const held = userHeld(i) || s.receiving
      s.p.go(held ? 1 : 0, ms(250), easeOut)
      if (!s.receiving) s.q.go(held && s.home ? 1 : 0, ms(250), easeOut)
      if (held && !s.held) {
        order = [...order.filter((j) => j !== i), i]
        raised = true
      }
      s.held = held
    })
    if (raised) onOrder(order)
    kick()
  }

  /* --- moves ------------------------------------------------------------ */

  /** Take a sleeve's record out into the air, where it is now. */
  function takeOut(i, h) {
    const s = sleeves[i]
    const at = recordPose(slots[i], s.p.v, s.q.v, size)
    s.home = false
    s.q.jump(0)
    Object.assign(air[i], { shown: true, flight: null, x: at.x, y: at.y, s: at.s, rot: at.rot, h })
    return at
  }

  /** Lift the platter's record off into the air, turned as it was. */
  function liftOff(i) {
    if (onPlatter !== i) return
    onPlatter = null
    Object.assign(air[i], { shown: true, flight: null, x: plat.x, y: plat.y, s: platterScale, rot: spin.angle, h: 0 })
  }

  /** Fly a record in the air back to its sleeve. The sleeve lifts to take
      it; the record lands just clear of the open edge and slides in. */
  function sendHome(i, done) {
    const s = sleeves[i]
    s.receiving = true
    refresh()
    const to = recordPose(slots[i], 1, Q_CLEAR, size)
    const a = air[i]
    const rot = to.rot + 360 * Math.round((a.rot - to.rot) / 360)
    launch(i, { x: to.x, y: to.y, s: to.s, rot, h: 0 }, ms(460), easeInOut, 0.9, () => {
      a.shown = false
      s.home = true
      s.q.jump(Q_CLEAR)
      s.q.go(userHeld(i) ? 1 : 0, ms(300), easeOut)
      later(homeTimers, () => {
        s.receiving = false
        refresh()
        done?.()
      }, ms(300))
      kick()
    })
  }

  function settleIdle() {
    if (onPlatter === null && incoming === null && !drag?.live) qa.phase = 'idle'
  }

  const swingTime = (to) => ms(Math.min(560, 260 + 8 * Math.abs(to - arm.angle.v)))
  const armFree = () => onPlatter === null && incoming === null && seqTimers.size === 0

  /** While a carried record is over the platter the arm gets ready: it lifts
      and swings out over the lead-in, so a drop only has to lower it onto
      the record. Carried away again, it goes back to its rest. Only an idle
      arm does this; one that is playing a record stays where it is. */
  function cue(on) {
    if (on === cued || (on && !armFree())) return
    cued = on
    clearTimeout(cueTimer)
    if (on) {
      arm.lift.go(1, ms(140))
      arm.angle.go(ARM_PLAY, swingTime(ARM_PLAY), easeInOut)
    } else if (armFree()) {
      const back = swingTime(ARM_REST)
      arm.angle.go(ARM_REST, back, easeInOut)
      cueTimer = setTimeout(() => {
        if (!alive || cued || !armFree()) return
        arm.lift.go(0, ms(160))
        kick()
      }, back)
    }
    kick()
  }

  /** Put record `i` (already in the air) on the platter and play it. `from`
      is 'hand' for a drop, 'sleeve' for a click or Enter. */
  function play(i, from) {
    // Sound first, inside this gesture and before any animation work.
    const v = vinyls[i]
    const token = ++session
    clearSeq()
    qa.tDrop = performance.now()
    qa.tPlaying = null
    qa.tEnded = null
    qa.index = i
    qa.id = v.id
    playClip(v.id, {
      onStart: (t) => {
        qa.tPlaying = performance.now()
        qa.startedAt = t.el.currentTime
        qa.clipStart = t.clipStart
        qa.clipEnd = t.clipEnd
      },
      onEnd: () => token === session && finish(i, false),
    })

    // Whatever was on (or landing on) the platter goes back to its sleeve.
    const prev = onPlatter ?? incoming
    if (prev !== null && prev !== i) {
      if (onPlatter === prev) liftOff(prev)
      incoming = null
      sendHome(prev, settleIdle)
    }
    onPlatter = null
    incoming = i
    qa.phase = 'playing'
    onPlaying(i)

    const time = ms(from === 'hand' ? 200 : 520)
    launch(i, { x: plat.x, y: plat.y, s: platterScale, rot: air[i].rot, h: 0 }, time, from === 'hand' ? easeOut : easeInOut, from === 'hand' ? 0 : 0.8, () => {
      if (incoming !== i) return
      incoming = null
      onPlatter = i
      air[i].shown = false
      spin.angle = air[i].rot % 360
      kick()
    })
    spin.target = SPIN

    // The arm lifts, swings over the lead-in, and comes down once the
    // record has landed; then it tracks slowly inwards for the clip. An arm
    // cued during the drag is already out there (or on its way), so it only
    // has to come down, as the record settles: the needle meets the record
    // inside the fade-in.
    const ready = cued && arm.angle.to === ARM_PLAY
    cued = false
    clearTimeout(cueTimer)
    arm.lift.go(1, ms(140))
    const swing = ready ? Math.max(0, arm.angle.t0 + arm.angle.ms - performance.now()) : swingTime(ARM_PLAY)
    arm.angle.go(ARM_PLAY, swing, easeInOut)
    later(seqTimers, () => {
      if (token !== session) return
      arm.lift.go(0, ms(170))
      later(seqTimers, () => {
        if (token !== session || reduced) return
        const t = engine?.tracks.get(v.id)
        const left = t ? Math.max(0.5, t.clipEnd - Math.max(t.el.currentTime, t.clipStart)) : CLIP
        arm.angle.go(ARM_DRIFT, left * 1000, linear)
        kick()
      }, ms(170))
      kick()
    }, ready ? Math.max(swing, time / 2) : Math.max(swing, time))
    refresh()
  }

  /** The clip is over (or stopped): the arm lifts and parks, the platter
      winds down, and the record goes home. */
  function finish(i, quick) {
    const token = ++session
    clearSeq()
    cued = false
    clearTimeout(cueTimer)
    qa.phase = 'ending'
    onPlaying(null)
    spin.target = 0
    arm.lift.go(1, ms(150))
    later(seqTimers, () => {
      if (token !== session) return
      arm.angle.go(ARM_REST, ms(560), easeInOut)
      later(seqTimers, () => token === session && arm.lift.go(0, ms(160)), ms(560))
      kick()
    }, ms(150))
    if (incoming === i) {
      incoming = null
      sendHome(i, settleIdle)
    } else {
      later(seqTimers, () => {
        if (onPlatter !== i) return
        liftOff(i)
        sendHome(i, settleIdle)
      }, ms(quick ? 320 : 720))
    }
    kick()
  }

  function stop() {
    const i = onPlatter ?? incoming
    if (i === null) return
    const t = engine?.tracks.get(vinyls[i].id)
    if (t) halt(t, 0.12)
    finish(i, true)
  }

  /** A click, a tap, Enter or Space on sleeve `i`: play its record, or, if
      it is the one on the platter, take it off. */
  function activate(i) {
    if (onPlatter === i || incoming === i) {
      stop()
      return
    }
    if (!sleeves[i].home || drag?.live) return
    takeOut(i, 0)
    play(i, 'sleeve')
  }

  /* --- input ------------------------------------------------------------ */

  function toScene(e) {
    const m = parts.svg?.getScreenCTM()
    if (!m) return null
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: pt.x, y: pt.y }
  }

  function down(i, e) {
    if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return
    const at = toScene(e)
    if (!at) return
    drag = {
      i,
      id: e.pointerId,
      pickup: PICKUP_PX[e.pointerType] ?? PICKUP_PX.mouse,
      cx: e.clientX,
      cy: e.clientY,
      live: false,
      px: at.x,
      py: at.y,
      tx: at.x,
      ty: at.y,
    }
    try {
      parts.svg.setPointerCapture(e.pointerId)
    } catch {
      // A pointer that is already gone; the next move or up sorts it out.
    }
    press = i
    refresh()
  }

  function move(e) {
    if (!drag || e.pointerId !== drag.id) return
    const at = toScene(e)
    if (!at) return
    if (!drag.live) {
      if (Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) < drag.pickup) return
      // Only a record still in its sleeve can be picked up.
      if (!sleeves[drag.i].home) return
      const from = takeOut(drag.i, 1)
      drag.live = true
      drag.s0 = from.s
      // Where on the record it was pressed, not where the pointer is now: a
      // fast flick can travel a long way before its first move arrives.
      drag.ox = drag.px - from.x
      drag.oy = drag.py - from.y
      press = null
      qa.phase = 'dragging'
      refresh()
    }
    drag.tx = at.x
    drag.ty = at.y
    kick()
  }

  function up(e) {
    if (!drag || e.pointerId !== drag.id) return
    const d = drag
    const lit = ring.zone
    drag = null
    press = null
    ring.target = 0
    ring.zone = false
    if (!d.live) {
      // A press that never moved is a click.
      tapGuard = performance.now() + 600
      refresh()
      activate(d.i)
      return
    }
    // Whether the record is let go of on the turntable, judged the way the
    // ring has been showing it.
    const at = toScene(e) ?? { x: d.tx, y: d.ty }
    if (inZone(at.x, at.y, air[d.i], lit)) play(d.i, 'hand')
    else {
      cue(false)
      sendHome(d.i, settleIdle)
      qa.phase = onPlatter !== null || incoming !== null ? 'playing' : 'returning'
    }
    refresh()
  }

  /** The browser took the pointer away (a system gesture, a lost capture):
      the record goes back to its sleeve. */
  function cancel(e) {
    if (!drag || e.pointerId !== drag.id) return
    const d = drag
    drag = null
    press = null
    ring.target = 0
    ring.zone = false
    if (d.live) {
      cue(false)
      sendHome(d.i, settleIdle)
      qa.phase = onPlatter !== null || incoming !== null ? 'playing' : 'returning'
    }
    refresh()
  }

  function enter(i, e) {
    if (e.pointerType === 'touch' || drag?.live) return
    clearTimeout(leaveTimer)
    if (hover === i) return
    hover = i
    refresh()
  }
  function leave(e) {
    if (e.pointerType === 'touch') return
    clearTimeout(leaveTimer)
    // A moment's grace: a hand cutting a corner on its way from the strip it
    // lifted to the record peeking out should not drop the sleeve under it.
    leaveTimer = setTimeout(() => {
      if (!alive) return
      hover = null
      refresh()
    }, LEAVE_MS)
  }
  function onFocus(i, e) {
    // Keyboard focus peeks the sleeve, like hover; a click's focus does not.
    let visible = true
    try {
      visible = e.currentTarget.matches(':focus-visible')
    } catch {
      // Very old engines: treat all focus as keyboard focus.
    }
    if (!visible) return
    focus = i
    refresh()
  }
  function onBlur(i) {
    if (focus !== i) return
    focus = null
    refresh()
  }
  function key(i, e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!e.repeat) activate(i)
      return
    }
    // One sleeve is the Tab stop; the arrows (and Home, End) move along.
    const n = vinyls.length
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]
    const to = step ? (i + step + n) % n : { Home: 0, End: n - 1 }[e.key]
    if (to !== undefined) {
      e.preventDefault()
      parts.base?.[to]?.focus()
    }
  }
  /** Clicks a screen reader sends (no pointer behind them, so detail 0). A
      real click was already handled on pointerup. */
  function click(i, e) {
    if (e.detail === 0 && performance.now() > tapGuard) activate(i)
  }

  /* A clip already playing when this deck is made (the pop-up changed
     layout mid-song, or reduced motion was switched): the record is on the
     platter, turning, with the arm down where the clip has carried it, and
     the clip's end comes here now. */
  function resume() {
    const token = ++session
    const got = adoptClip(() => token === session && got && finish(got.i, false))
    if (!got) return
    const { i, t } = got
    sleeves[i].home = false
    onPlatter = i
    spin.target = SPIN
    spin.omega = reduced ? 0 : SPIN
    const at = Math.max(t.el.currentTime, t.clipStart)
    const k = clamp01((at - t.clipStart) / Math.max(0.1, t.clipEnd - t.clipStart))
    arm.angle.jump(reduced ? ARM_PLAY : lerp(ARM_PLAY, ARM_DRIFT, k))
    if (!reduced) arm.angle.go(ARM_DRIFT, Math.max(500, (t.clipEnd - at) * 1000), linear)
    qa.phase = 'playing'
    qa.index = i
    qa.id = vinyls[i].id
    onPlaying(i)
    kick()
  }
  resume()

  /* The audio is not stopped here: the pop-up stops it as it closes, and a
     deck that is only being replaced hands its record on (resume). */
  function destroy() {
    alive = false
    cancelAnimationFrame(raf)
    clearTimeout(leaveTimer)
    clearTimeout(cueTimer)
    clearSeq()
    homeTimers.forEach(clearTimeout)
    homeTimers.clear()
  }

  return { down, move, up, cancel, enter, leave, focus: onFocus, blur: onBlur, key, click, stop, draw, destroy }
}

/* --- the scene ------------------------------------------------------------- */

const register = (parts, key, i) =>
  parts
    ? (el) => {
        ;(parts[key] ||= [])[i] = el
      }
    : undefined

/** The SVG itself, shared by the card's still and the live pop-up. */
function Diorama({ layout, coverPx, still, layer, live, parts, order, tabStop, on, svgEvents, playing, onStop, describedBy, className }) {
  // The card's top layer (see VinylThumb) is only what lies over its
  // spinning record: no table, no stack.
  const onlyTop = layer === 'top'
  const clipId = useId()
  const coverSrc = useCallback((v) => coverAt(v.coverUrl, coverPx), [coverPx])
  const P = layout.player
  return (
    <svg
      ref={
        live
          ? (el) => {
              parts.svg = el
            }
          : undefined
      }
      viewBox={`0 0 ${layout.w} ${layout.h}`}
      preserveAspectRatio={live ? 'xMidYMid meet' : 'xMidYMid slice'}
      className={className}
      role={live ? 'group' : undefined}
      aria-label={live ? 'Turntable and records' : undefined}
      aria-hidden={live ? undefined : 'true'}
      focusable="false"
      {...svgEvents}
    >
      <defs>
        <clipPath id={clipId} clipPathUnits="objectBoundingBox">
          <circle cx="0.5" cy="0.5" r="0.5" />
        </clipPath>
      </defs>
      {/* The card's still sits on a flat grey tabletop. The pop-up's table is
          the frame itself, plain white, so the Equaliser can show through. */}
      {!live && !onlyTop && (
        <rect
          x={layout.floor.x}
          y={layout.floor.y}
          width={layout.floor.w}
          height={layout.floor.h}
          className="vpf-floor"
          pointerEvents="none"
        />
      )}
      <g transform={`translate(${P.x} ${P.y}) scale(${P.s})`}>
        <RecordPlayer
          vinyls={vinyls}
          clipId={clipId}
          coverSrc={coverSrc}
          parts={parts}
          platterIndex={still?.platter ?? null}
          armAngle={still?.arm ?? ARM_REST}
          ledOn={Boolean(still)}
          canStop={playing !== null && playing !== undefined}
          onStop={live ? onStop : undefined}
          layer={layer}
        />
      </g>
      {!onlyTop && (
        <VinylStack
          vinyls={vinyls}
          slots={layout.slots}
          size={layout.size}
          clipId={clipId}
          coverSrc={coverSrc}
          parts={parts}
          order={order}
          tabStop={tabStop}
          on={on}
          still={still}
          describedBy={describedBy}
          playingIndex={playing}
        />
      )}
      {/* Records in the air: carried, or flying to the platter or home. */}
      {live && (
        <g pointerEvents="none" aria-hidden="true">
          {vinyls.map((v, i) => (
            <g key={v.id} ref={register(parts, 'air', i)} display="none">
              <g className="vp-shadow" ref={register(parts, 'airShadow', i)}>
                <circle r={DISC} />
              </g>
              <g ref={register(parts, 'airDisc', i)}>
                <Record clipId={clipId} coverSrc={coverSrc(v)} />
              </g>
            </g>
          ))}
        </g>
      )}
    </svg>
  )
}

/* The card shows the player mid-song: the first record on the platter, the
   arm down a little way in, and the next sleeve lifted with its record
   peeking out. */
const STILL = {
  platter: 0,
  empty: 0,
  lift: vinyls.length > 1 ? 1 : null,
  arm: ARM_PLAY + (ARM_DRIFT - ARM_PLAY) * 0.4,
}

/** A share of `of`, as a CSS percentage. */
const pct = (v, of) => `${r2((v / of) * 100)}%`

/** One record on its own, centred in its box, for the card to spin. */
function LoneRecord({ v, coverPx }) {
  const clipId = useId()
  return (
    <svg viewBox={`${-DISC} ${-DISC} ${DISC * 2} ${DISC * 2}`} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clipId} clipPathUnits="objectBoundingBox">
          <circle cx="0.5" cy="0.5" r="0.5" />
        </clipPath>
      </defs>
      <Record clipId={clipId} coverSrc={coverAt(v.coverUrl, coverPx)} sheen={false} />
    </svg>
  )
}

/**
 * The Works card's thumbnail: the scene mid-song, nothing interactive, with
 * the record on the platter turning while the card is on screen (the way the
 * other cards' walkthroughs play only in view), and holding still under
 * reduced motion.
 *
 * The spin is three layers, not one animated SVG: the scene without that
 * record, the record alone in an HTML box over its place on the platter, and
 * what lies over it (sheen, spindle, arm) on top. The box turns with a CSS
 * animation, which the browser runs on its compositor, so the card never has
 * to be repainted while it spins (an animated SVG repaints every frame, and
 * slowed the other cards' hover fades); an HTML box also turns about its own
 * centre in every browser. The card is 16:9 like its scene, so the box's
 * percentages line up with the platter exactly.
 */
export function VinylThumb() {
  const reduced = useReducedMotion()
  const [viewRef, inView] = useInView({ threshold: 0 })
  const L = LAYOUTS.card
  const P = L.player
  const r = RECORD_R * P.s
  const cx = P.x + PLATTER.x * P.s
  const cy = P.y + PLATTER.y * P.s
  const box = { left: pct(cx - r, L.w), top: pct(cy - r, L.h), width: pct(2 * r, L.w), height: pct(2 * r, L.h) }
  return (
    <div ref={viewRef} className="absolute inset-0">
      <Diorama layout={L} coverPx={200} still={STILL} layer="base" className="absolute inset-0 block h-full w-full" />
      <div className="vp-card-record" data-spin={(inView && !reduced) || undefined} style={box}>
        <LoneRecord v={vinyls[STILL.platter]} coverPx={200} />
      </div>
      <Diorama layout={L} coverPx={200} still={STILL} layer="top" className="absolute inset-0 block h-full w-full" />
    </div>
  )
}

/**
 * The live scene. It is remade when the pop-up changes layout (a phone turned
 * on its side), so `carry` (a ref the pop-up keeps) takes what has to outlive
 * it across: which sleeve, or the stop key, had keyboard focus. A playing
 * record crosses on its own (the new deck resumes it).
 */
function LiveScene({ layout, hintId, onPlaying, carry }) {
  const reduced = useReducedMotion()
  const parts = useMemo(() => ({}), [])
  const [order, setOrder] = useState(() => vinyls.map((_, i) => i))
  const [playing, setPlaying] = useState(null)
  const [tabStop, setTabStop] = useState(0)
  const deck = useRef(null)

  // A layout effect's clean-up runs while the old nodes are still in the
  // page, so it can still see where focus is. Only a scene replaced inside
  // an open pop-up hands focus on; a closing one has already given it back.
  useLayoutEffect(
    () => () => {
      const el = document.activeElement
      if (!el || !parts.svg?.contains(el) || !parts.svg.closest('dialog')?.open) return
      if (el.dataset.vpSleeve !== undefined) carry.current = { sleeve: Number(el.dataset.vpSleeve) }
      else if (el.hasAttribute('data-vp-stop')) carry.current = { stop: true }
    },
    [parts, carry],
  )

  useEffect(() => {
    const d = createDeck({
      layout,
      reduced,
      parts,
      onOrder: setOrder,
      onPlaying: (i) => {
        setPlaying(i)
        onPlaying(i)
      },
    })
    deck.current = d
    d.draw()
    const back = carry.current
    carry.current = null
    if (back) {
      const stop = back.stop && qa.phase === 'playing' && parts.svg?.querySelector('[data-vp-stop]')
      const el = stop || parts.base?.[back.sleeve ?? 0]
      el?.focus({ preventScroll: true })
    }
    return () => {
      d.destroy()
      deck.current = null
      setPlaying(null)
      onPlaying(null)
    }
  }, [layout, reduced, parts, onPlaying, carry])

  const on = useMemo(
    () => ({
      down: (i, e) => deck.current?.down(i, e),
      enter: (i, e) => deck.current?.enter(i, e),
      leave: (e) => deck.current?.leave(e),
      focus: (i, e) => {
        setTabStop(i)
        deck.current?.focus(i, e)
      },
      blur: (i, e) => deck.current?.blur(i, e),
      key: (i, e) => deck.current?.key(i, e),
      click: (i, e) => deck.current?.click(i, e),
    }),
    [],
  )
  const svgEvents = useMemo(
    () => ({
      onPointerMove: (e) => deck.current?.move(e),
      onPointerUp: (e) => deck.current?.up(e),
      onPointerCancel: (e) => deck.current?.cancel(e),
      onLostPointerCapture: (e) => deck.current?.cancel(e),
    }),
    [],
  )
  const onStop = useCallback(() => deck.current?.stop(), [])

  return (
    <Diorama
      layout={layout}
      coverPx={600}
      live
      parts={parts}
      order={order}
      tabStop={tabStop}
      on={on}
      svgEvents={svgEvents}
      playing={playing}
      onStop={onStop}
      describedBy={hintId}
      className="vp-svg"
    />
  )
}

/* --- the backdrop that listens --------------------------------------------- */

const EQ_TONES = 5 // flat colour steps, --vp-eq-1 (palest) to --vp-eq-5 (darkest)
const EQ_REACH = 0.72 // the tallest a bar grows, as a share of the frame: the title stays on white
const EQ_LOW = 50 // Hz in the outermost columns
const EQ_HIGH = 11000 // Hz in the middle ones
// A 4x4 ordered (Bayer) dither: what turns flat steps into a pixelled gradient.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)

/** '#rrggbb' as [r, g, b], maroon if it is anything else. */
function rgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const n = m ? parseInt(m[1], 16) : 0x2d0510
  return [n >> 16, (n >> 8) & 255, n & 255]
}

/**
 * While a record plays, a faint grey equaliser in fine square pixels rises
 * behind the scene. It is a canvas with one pixel per cell, scaled up with
 * hard edges and laid on at --vp-eq-alpha (global.css), under the scene.
 *
 * One column per frequency band (about 220 bands across a desktop pop-up, 100
 * on a phone), mirrored: the bass at both outer edges and the treble meeting
 * in the middle, so the liveliest bars are the ones that show round the
 * stack and the player. Each rises from the foot of the frame,
 * fast on a beat and slowly back. The colour belongs to the frame, not the
 * bar: darkest at the foot, paler with height, in five flat steps dithered
 * into each other. A loose pixel above each bar marks its recent peak.
 *
 * The analyser taps the mix after the clip's gain, so the bars fade in and
 * out with the sound. Under reduced motion (or with no Web Audio) it shows
 * one still frame instead of following the song.
 */
function Equaliser({ on, reduced }) {
  const ref = useRef(null)
  // The grid and the bars outlive the effect below, which re-runs whenever a
  // record starts or stops: the bars of a clip that has just ended keep
  // falling from where they were instead of vanishing.
  const grid = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const g = canvas?.getContext('2d')
    if (!canvas || !g) return undefined
    const css = getComputedStyle(canvas)
    const tones = Array.from({ length: EQ_TONES }, (_, i) => rgb(css.getPropertyValue(`--vp-eq-${i + 1}`)))
    const analyser = engine?.analyser ?? null
    const bins = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
    const still = reduced || !analyser

    const s = (grid.current ||= { cols: 0, rows: 0, img: null, levels: new Float32Array(0), peaks: new Float32Array(0) })
    const size = () => {
      // The canvas's own box (it fills the scene's canvas, or on a phone the
      // whole frame), not its parent's: on a phone the parent is
      // `display: contents` and has no box of its own.
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      // Fine cells: about 2.7px across on a desktop pop-up, 1.9px on a phone.
      const cell = Math.max(1.5, w / (w < 640 ? 200 : 440))
      const c = Math.max(8, Math.round(w / cell))
      const r = Math.max(6, Math.round(h / cell))
      if (c === s.cols && r === s.rows) return
      s.cols = c
      s.rows = r
      canvas.width = c
      canvas.height = r
      s.img = g.createImageData(c, r)
      const half = Math.ceil(c / 2)
      const keep = s.levels
      s.levels = new Float32Array(half)
      s.peaks = new Float32Array(half)
      s.levels.set(keep.subarray(0, half))
    }

    const paint = () => {
      const { cols, rows, img, levels, peaks } = s
      const d = img.data
      d.fill(0)
      const reach = rows * EQ_REACH
      for (let x = 0; x < cols; x += 1) {
        const k = Math.min(levels.length - 1, Math.min(x, cols - 1 - x))
        const top = levels[k] * reach
        const peak = Math.round(peaks[k] * reach)
        for (let y = 0; y < rows; y += 1) {
          const up = rows - 1 - y // rows above the foot of the frame
          let tone = -1
          if (up < top) {
            const t = 1 - up / reach // 1 at the foot, 0 at the bars' reach
            tone = Math.round(t * (EQ_TONES - 1) + BAYER[(y & 3) * 4 + (x & 3)] - 0.5)
            tone = Math.min(EQ_TONES - 1, Math.max(0, tone))
          } else if (!still && peak > 1 && up === peak) tone = 1
          if (tone < 0) continue
          const [r, gr, b] = tones[tone]
          const o = (y * cols + x) * 4
          d[o] = r
          d[o + 1] = gr
          d[o + 2] = b
          d[o + 3] = 255
        }
      }
      g.putImageData(img, 0, 0)
    }

    size()
    if (still) {
      // One calm frame: a low swell, highest at the edges.
      if (on) {
        const half = s.levels.length
        for (let k = 0; k < half; k += 1) s.levels[k] = 0.22 + 0.3 * Math.cos((k / half) * (Math.PI / 2)) ** 2
        s.peaks.fill(0)
        paint()
      }
      qa.eq = { on, still, cols: s.cols, rows: s.rows, frames: 1 }
      return undefined
    }

    const hz = analyser.context.sampleRate / analyser.fftSize
    const span = EQ_HIGH / EQ_LOW
    let raf = 0
    let last = performance.now()
    const stats = (qa.eq = { on, still, cols: s.cols, rows: s.rows, frames: 0, sum: 0 })
    const tick = (now) => {
      const dt = Math.min(64, now - last)
      last = now
      if (on) analyser.getByteFrequencyData(bins)
      const { levels, peaks } = s
      const half = levels.length
      let busy = false
      let sum = 0
      for (let k = 0; k < half; k += 1) {
        let target = 0
        if (on) {
          // The band's edges, in (fractional) bins. A band narrower than one
          // bin (the bass, where columns are only a few Hz apart) reads the
          // spectrum between its two nearest bins, so neighbouring columns
          // never just repeat each other; a wider one takes its loudest bin.
          const f0 = (EQ_LOW * span ** (k / half)) / hz
          const f1 = (EQ_LOW * span ** ((k + 1) / half)) / hz
          let v = 0
          if (f1 - f0 < 1) {
            const p = (f0 + f1) / 2
            const b = Math.floor(p)
            const u = p - b
            v = bins[b] * (1 - u) + (bins[b + 1] ?? bins[b]) * u
          } else {
            for (let b = Math.floor(f0); b < Math.ceil(f1) && b < bins.length; b += 1) v = Math.max(v, bins[b])
          }
          // The treble carries less energy than the bass: tilt it up so the
          // middle moves too.
          target = clamp01((v / 255) ** 1.6 * (0.9 + 0.7 * (k / half)))
        }
        const cur = levels[k]
        levels[k] = target > cur ? cur + (target - cur) * Math.min(1, dt / 40) : Math.max(target, cur - dt / 900)
        peaks[k] = Math.max(levels[k], peaks[k] - dt / 1600)
        if (levels[k] > 0.002 || peaks[k] > 0.002) busy = true
        sum += levels[k]
      }
      paint()
      stats.frames += 1
      stats.sum = r2(sum)
      // Off, it runs on only until the bars have fallen (the canvas fades
      // out over the same time).
      raf = on || busy ? requestAnimationFrame(tick) : 0
    }
    raf = requestAnimationFrame(tick)
    const ro = new ResizeObserver(size)
    ro.observe(canvas)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [on, reduced])

  return <canvas ref={ref} className="vp-eq" data-on={on || undefined} aria-hidden="true" />
}

/* --- the pop-up ------------------------------------------------------------ */

/**
 * The pop-up. `open` mounts and shows it; `onClose` runs once it has
 * animated away; `returnFocus` (a ref) is the card, which gets focus back
 * (Safari never focuses a clicked button, so the dialog cannot rely on it).
 */
export function VinylPlayerModal({ open, onClose, returnFocus }) {
  const ref = useRef(null)
  const downOnBackdrop = useRef(false)
  const closingRef = useRef(false)
  const [closing, setClosing] = useState(false)
  const [nowPlaying, setNowPlaying] = useState(null)
  const reduced = useReducedMotion()
  const phone = !useMediaQuery(SM, true)
  const hover = useMediaQuery(HOVER, true)
  const hintId = useId()
  const titleId = useId()
  const carry = useRef(null)
  const frameRef = useRef(null)
  // 'window' or 'full': the green dot maximizes the window to the screen and
  // back. Phones are always full screen and have no green dot.
  const [size, setSize] = useState('window')
  const canvasRef = useRef(null)
  const [stackEnd, setStackEnd] = useState(STACK_END.start)

  // Where the stack ends (see wideLayout): STACK_GAP above the top of the
  // "Recommend a song" panel, in scene units, kept up to date as the window
  // resizes. A ratio of the two boxes, so the opening animation's scale and
  // the maximize FLIP do not throw it. Rounded to 8 units, so a resize does
  // not remake the deck for every pixel.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const panel = canvas?.querySelector('.vp-recs')
    if (!open || phone || !canvas || !panel) return undefined
    const measure = () => {
      const c = canvas.getBoundingClientRect()
      const p = panel.getBoundingClientRect()
      if (!c.height) return
      const end = Math.floor((((p.top - c.top) / c.height) * 1000 - STACK_GAP) / 8) * 8
      setStackEnd(Math.max(STACK_END.min, Math.min(STACK_END.max, end)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(canvas)
    ro.observe(panel)
    return () => ro.disconnect()
  }, [open, phone])
  const wide = useMemo(() => wideLayout(stackEnd), [stackEnd])

  const toggle = useCallback(() => {
    const frame = frameRef.current
    const before = frame?.getBoundingClientRect()
    flushSync(() => setSize((s) => (s === 'full' ? 'window' : 'full')))
    if (!frame || !before || reduced) return
    const after = frame.getBoundingClientRect()
    if (!after.width || !after.height) return
    frame.animate(
      [
        {
          transformOrigin: '0 0',
          transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / after.width}, ${before.height / after.height})`,
        },
        { transformOrigin: '0 0', transform: 'translate(0px, 0px) scale(1, 1)' },
      ],
      { duration: RESIZE_MS, easing: RESIZE_EASE },
    )
  }, [reduced])

  useEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return undefined
    closingRef.current = false
    setClosing(false)
    setSize('window')
    // Normally already done in the card's click; this covers any other way in.
    prepareVinylAudio()
    if (!dialog.open) dialog.showModal()
    setCursorHost(dialog)
    // The page behind holds still, Lenis or not (there is none under reduced
    // motion), until the last pop-up holding it lets go (scrollLock.js).
    const release = holdScroll()
    return () => {
      setCursorHost(null)
      release()
      // Gone without closing (the route changed under it): silence anyway.
      stopVinylAudio(0)
    }
  }, [open])

  const finishClose = useCallback(() => {
    if (ref.current?.open) ref.current.close()
    // Nothing is playing now; let the audio hardware sleep until the card's
    // next click wakes it (prepareVinylAudio resumes it inside that gesture).
    engine?.ctx?.suspend().catch(() => {})
    onClose()
    const card = returnFocus?.current
    if (card && (document.activeElement === document.body || !document.activeElement)) {
      card.focus({ preventScroll: true })
    }
  }, [onClose, returnFocus])

  const close = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    // The music stops the moment the visitor asks to leave, not after the fade.
    stopVinylAudio()
    setClosing(true)
    setTimeout(finishClose, reduced ? 0 : CLOSE_MS)
  }, [finishClose, reduced])

  if (!open) return null

  const playing = nowPlaying !== null ? vinyls[nowPlaying] : null
  const layout = phone ? LAYOUTS.tall : RECS_ON ? wide : LAYOUTS.wide
  // One line, set in capitals by global.css, so it is kept short: the touch
  // wording has to fit beside the close button on a phone.
  const hint = hover ? 'Drag a record onto the turntable, or click one' : 'Drag or tap a record to play it'

  return (
    <dialog
      ref={ref}
      className="vp-pop"
      data-size={phone ? undefined : size}
      data-closing={closing || undefined}
      data-lenis-prevent
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      // Closed some other way (a second Escape the browser will not let us
      // intercept): still stop the music and tidy up.
      onClose={() => {
        if (closingRef.current) return
        closingRef.current = true
        stopVinylAudio()
        finishClose()
      }}
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget
      }}
      // A click that starts and ends on the dialog element itself is on the
      // backdrop. (A drag that ends out there is not: it started on a sleeve.)
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdrop.current) close()
      }}
    >
      <div ref={frameRef} className="vp-frame">
        {/* The title bar, as on the case-study and Funzies windows: red
            closes, green maximizes the window to the screen and back. */}
        <div className="vp-bar">
          <div className="vp-bar__controls">
            <button type="button" className="vp-dot vp-dot--close" onClick={close} aria-label="Close" title="Close">
              <span aria-hidden="true">×</span>
            </button>
            {!phone && (
              <button
                type="button"
                data-vp-toggle=""
                className="vp-dot vp-dot--size"
                onClick={toggle}
                aria-label={size === 'full' ? 'Minimize' : 'Maximize'}
                title={size === 'full' ? 'Minimize' : 'Maximize'}
              >
                <SizeGlyph full={size === 'full'} />
              </button>
            )}
          </div>
        </div>
        {/* The scene's 16:10 box. In a maximized window it is centred in the
            screen, at the largest size that fits under the bar. */}
        <div ref={canvasRef} className="vp-canvas">
          <Equaliser on={Boolean(playing)} reduced={reduced} />
          <div className="vp-head">
            <h2 id={titleId} className="vp-title font-display">
              Vinyl Player
            </h2>
            <p className="vp-hint">{hint}</p>
            <p id={hintId} className="sr-only">
              Press Enter to put this record on the turntable and play it, and Enter again to take it off. The arrow
              keys move between records.
            </p>
          </div>
          <div className="vp-stage" style={{ '--vp-aspect': `${layout.w} / ${layout.h}` }}>
            <LiveScene key={phone ? 'tall' : 'wide'} layout={layout} hintId={hintId} onPlaying={setNowPlaying} carry={carry} />
          </div>
          {/* In a small diorama there is no room for the hint over the player,
              so it sits in the caption's place below it until a record plays
              (global.css shows one or the other, never both). */}
          <p className="vp-hint vp-hint--foot" hidden={Boolean(playing)}>
            {hint}
          </p>
          <p className="vp-caption" aria-live="polite">
            {playing && (
              <span className="vp-caption__pill">
                <span className="vp-caption__label">Now playing</span>{' '}
                <span className="vp-caption__title">{playing.title}</span>{' '}
                <span className="vp-caption__label">by</span>{' '}
                <span className="vp-caption__artist">{playing.artist}</span>
              </span>
            )}
          </p>
          {RECS_ON && <SongRecs />}
        </div>
      </div>
    </dialog>
  )
}
