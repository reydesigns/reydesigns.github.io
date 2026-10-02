import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useInView } from '@/lib/useInView'

/* ---------------------------------------------------------------------------
   ROI: students per event, the school year before the TMU K-POP relaunch
   against the year after it.

   Styled after the client's reference (Assets/tmu-kpop/bar graph example.jpg):
   flat, square-cornered solid bars with generous gaps; a left axis of short
   tick dashes with no numbers; one heavy baseline; each bar labelled inside
   its top in a bold condensed face (the club site's Bebas Neue) with its value
   set small inside its foot; and a huge headline stat beside the bars — the
   change in average attendance, computed from the data.

   Form: one pair of columns per month — the same event a year apart — so each
   pair reads as before/after directly. The two years are coloured by period
   (validated pair, see --chart-before / --chart-after in tokens.css), with a
   legend, a per-column tooltip on hover, tap and keyboard focus, and the full
   numbers in a table under the chart.

   PLACEHOLDER DATA: these attendance figures follow the ranges the client gave
   (about 20–50 a night before, 100–200 after) and should be replaced with the
   club's real sign-in counts.
--------------------------------------------------------------------------- */

const MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr']

const YEARS = [
  {
    id: 'before',
    label: '2022–23 · old site',
    color: 'var(--chart-before)',
    // In-bar text: ink reads at 7.2:1 on the light coral.
    ink: 'var(--color-ink)',
    events: [
      ['Fall Orientation', 46],
      ['Hallyuween', 31],
      ['Running Man', 34],
      ['Holiday Party', 42],
      ['Dance workshop', 22],
      ['Dance workshop', 27],
      ['Dance workshop', 35],
      ['Spring social', 49],
    ],
  },
  {
    id: 'after',
    label: '2023–24 · new site',
    color: 'var(--chart-after)',
    // White reads at 5.2:1 on the club red; ink would only manage 3.6:1.
    ink: 'var(--color-surface)',
    events: [
      ['Fall Orientation', 108],
      ['Hallyuween', 121],
      ['Running Man', 133],
      ['Holiday Party', 146],
      ['Dance workshop', 139],
      ['Dance workshop', 158],
      ['Dance workshop', 171],
      ["Performance Night '24", 196],
    ],
  },
]

// Below this chart width there is no room beside a column for the tooltip.
const COMPACT_BELOW = 520
const TIP_BAND = 60
const TIP_W_WIDE = 168 // px; beside a column, long names wrap
const TIP_W = 232 // px; the longest line, "Performance Night '24 · Apr 2024", stays on one line
// From this figure width the headline stat sits beside the bars, as in the
// example; below it, it sits above them. The case-study column tops out near
// 600px, and beside the stat sixteen columns would be too thin to carry their
// in-bar labels, so in this layout the stat sits above at every viewport; the
// side arrangement is kept for a wider column.
const SIDE_FROM = 860

const Y_MAX = 200
// The example's axis: a short dash every step, no numbers. The values live in
// the bars themselves (and the tooltip and table).
const TICK_STEP = 10
const BASE_W = 3 // the heavy baseline
const PAIR_GAP = 2 // surface gap between the two columns of a pair

const sum = (y) => y.events.reduce((a, [, n]) => a + n, 0)
const avg = (y) => Math.round(sum(y) / y.events.length)
export const ATTENDANCE_AVERAGES = { before: avg(YEARS[0]), after: avg(YEARS[1]) }
// The change in average attendance, from the raw totals rather than the
// rounded averages (both years have eight events, so totals compare directly).
const CHANGE = Math.round((sum(YEARS[1]) / sum(YEARS[0]) - 1) * 100)

const yearOf = (yi, mi) => 2022 + yi + (mi >= 4 ? 1 : 0)

/** Plot geometry for a given pixel width. */
function layout(width) {
  // On phones the tooltip is pinned in a band above the plot (see TIP_BAND), so
  // it can never cover a column.
  const compact = width < COMPACT_BELOW
  const height = Math.round(Math.max(220, Math.min(360, width * 0.62))) + (compact ? TIP_BAND : 0)
  // Wide, every label is inside its bar and the baseline is the svg's bottom
  // edge; compact bars are too narrow for that, so months sit under the line.
  const pad = { top: 10 + (compact ? TIP_BAND : 0), right: 0, bottom: compact ? 22 : 0, left: 24 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom - BASE_W
  // Eight pairs with generous gaps between them, as in the example.
  const group = plotW / 8
  const gap = Math.max(8, group * 0.26)
  const barW = (group - gap - PAIR_GAP) / 2
  const left = (yi, mi) => pad.left + mi * group + gap / 2 + yi * (barW + PAIR_GAP)
  const x = (yi, mi) => left(yi, mi) + barW / 2
  const base = pad.top + plotH
  const y = (v) => pad.top + plotH * (1 - v / Y_MAX)
  // In-bar labels only where the bar is wide enough to hold them upright.
  const inside = barW >= 22
  const labelSize = Math.min(24, Math.max(13, barW * 0.56))
  const detailSize = barW >= 34 ? 11 : 10
  return { width, height, compact, pad, plotW, plotH, group, gap, barW, left, x, y, base, inside, labelSize, detailSize }
}

/** The example's arrow: a straight shaft with an open chevron head. */
function UpArrow() {
  return (
    <svg
      viewBox="0 0 40 72"
      aria-hidden="true"
      className="block h-[0.66em] w-auto shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="butt"
    >
      <path d="M20 72V5M3 22 20 5l17 17" />
    </svg>
  )
}

export function AttendanceChart() {
  const reduced = useReducedMotion()
  const outerRef = useRef(null)
  const boxRef = useRef(null)
  const [outer, setOuter] = useState(640)
  const [ref, seen] = useInView({ threshold: 0.4, once: true })
  const [hover, setHover] = useState(null) // { yi, mi }

  useLayoutEffect(() => {
    const el = outerRef.current
    if (!el) return undefined
    const write = () => setOuter(el.clientWidth || 640)
    write()
    const ro = new ResizeObserver(write)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Beside the bars the stat takes about a third of the figure, like the
  // example; above them it spans the width.
  const side = outer >= SIDE_FROM
  const statW = side ? Math.round(outer * 0.32) : outer
  const sideGap = side ? Math.round(outer * 0.04) : 0
  const g = layout(side ? outer - statW - sideGap : outer)
  // Sized so "+310%" and the arrow fill the stat's width (Bebas runs ~0.4em a
  // glyph), capped so it never towers over the bars.
  const statSize = side ? Math.min(statW / 2.75, g.height * 0.62) : Math.min(statW / 3.4, 104)
  const grown = seen || reduced

  // A tap outside the chart dismisses the tooltip; touch has no pointerleave
  // to do it, and the svg ignores that event for touch (see onPointerLeave).
  useEffect(() => {
    if (!hover) return undefined
    const away = (e) => {
      if (!boxRef.current?.contains(e.target)) setHover(null)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [hover])

  // The column nearest the pointer, so a touch anywhere in a column's half of
  // its pair (and the gap beside it) lands on it, not just on the paint.
  const pick = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left
    const py = e.clientY - r.top
    if (px < g.pad.left || px > g.width - g.pad.right || py < g.pad.top || py > g.base + 24) {
      return null
    }
    let best = null
    let bestD = Infinity
    for (let yi = 0; yi < 2; yi++) {
      for (let mi = 0; mi < 8; mi++) {
        const d = Math.abs(px - g.x(yi, mi))
        if (d < bestD) {
          bestD = d
          best = { yi, mi }
        }
      }
    }
    return best
  }
  const point = (e) => {
    const next = pick(e)
    if (next || e.pointerType === 'mouse') {
      setHover((h) => (h && next && h.yi === next.yi && h.mi === next.mi ? h : next))
    }
  }

  const tip = hover && (() => {
    const yr = YEARS[hover.yi]
    const [name, n] = yr.events[hover.mi]
    const cx = g.x(hover.yi, hover.mi)
    return { yr, name, n, cx, top: g.y(n) }
  })()

  const stat = (
    <div
      className="flex shrink-0 flex-col text-[var(--color-ink)]"
      style={{ width: side ? statW : undefined, fontFamily: 'var(--font-tk-display)' }}
    >
      <p className="m-0 text-[length:var(--text-cs-head)] leading-[0.95] uppercase">
        Average students
        <br />
        per event
      </p>
      {/* aria-label spells out what the glyphs only imply. */}
      <p
        className="m-0 mt-[0.08em] flex items-center gap-[0.06em] leading-[0.8]"
        style={{ fontSize: statSize }}
        aria-label={`Up ${CHANGE} percent`}
      >
        <span aria-hidden="true">+{CHANGE}%</span>
        <UpArrow />
      </p>
      <p
        className="m-0 mt-[var(--cs-2)] text-[length:var(--text-eyebrow)] text-[var(--color-ink-muted)] tabular-nums"
        style={{ fontFamily: 'var(--font-brand)' }}
      >
        {ATTENDANCE_AVERAGES.before} a night before the relaunch, {ATTENDANCE_AVERAGES.after} after
      </p>
    </div>
  )

  return (
    // No card: the chart sits straight on the page background like the rest of
    // the study's figures (client, round 3: "not white"). The palette was
    // re-validated against --color-bg; "before" drops to 2.3:1, still relieved
    // by the in-bar values, the tooltip and the table.
    <figure ref={ref} className="cs-figure m-0">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-[var(--cs-5)] gap-y-[var(--cs-2)]">
        <span className="text-[length:var(--text-body)] font-bold text-[var(--color-ink)]">
          Students per event
        </span>
        {/* Legend: always present for two series. Swatches mirror the square mark. */}
        <span className="flex flex-wrap gap-x-[var(--cs-4)] gap-y-[var(--cs-1)] text-[length:var(--text-eyebrow)] text-[var(--color-ink-muted)]">
          {YEARS.map((yr) => (
            <span key={yr.id} className="inline-flex items-center gap-[0.45em]">
              <span
                aria-hidden="true"
                className="inline-block h-[0.75em] w-[0.75em]"
                style={{ background: yr.color }}
              />
              {yr.label}
            </span>
          ))}
        </span>
      </figcaption>

      <div
        ref={outerRef}
        // Side by side, the heavy baseline runs under the stat as well, as in
        // the example — so it is this row's border, and the bars stand on it.
        className={
          side
            ? 'mt-[var(--cs-5)] flex items-end border-b-[3px] border-[var(--color-ink)]'
            : 'mt-[var(--cs-4)] flex flex-col'
        }
        style={{ columnGap: sideGap }}
      >
        {!side && stat}

        <div ref={boxRef} className={`relative ${side ? '' : 'mt-[var(--cs-4)]'}`} style={{ width: g.width }}>
          <svg
            width={g.width}
            height={side ? g.base : g.height}
            viewBox={`0 0 ${g.width} ${side ? g.base : g.height}`}
            className="block overflow-visible"
            role="img"
            aria-label={`Column chart of students per event, each month's event a year apart. The 2022–23 school year on the old site averaged ${ATTENDANCE_AVERAGES.before} students an event; after the relaunch, 2023–24 averaged ${ATTENDANCE_AVERAGES.after}, up ${CHANGE} percent, rising to 196 at Performance Night '24. Full figures in the table below.`}
            onPointerDown={point}
            onPointerMove={(e) => e.pointerType === 'mouse' && point(e)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
          >
            {/* the axis: tick dashes only */}
            {Array.from({ length: Y_MAX / TICK_STEP }, (_, i) => (i + 1) * TICK_STEP).map((t) => (
              <line
                key={t}
                x1={0}
                x2={12}
                y1={g.y(t)}
                y2={g.y(t)}
                stroke="var(--color-ink)"
                strokeWidth="2"
                shapeRendering="crispEdges"
              />
            ))}

            {/* Side by side the row's border is the baseline; here it is drawn. */}
            {!side && (
              <rect x={0} y={g.base} width={g.width} height={BASE_W} fill="var(--color-ink)" />
            )}

            {MONTHS.map((m, mi) => (
              <g key={m}>
                {YEARS.map((yr, yi) => {
                  const [name, n] = yr.events[mi]
                  const l = g.left(yi, mi)
                  const top = g.y(n)
                  const h = g.base - top
                  const active = hover && hover.yi === yi && hover.mi === mi
                  const inset = Math.max(4, Math.min(8, g.barW * 0.14))
                  return (
                    <g key={yr.id}>
                      <rect
                        x={l}
                        y={top}
                        width={g.barW}
                        height={h}
                        fill={yr.color}
                        opacity={hover && !active ? 0.55 : 1}
                        className="tk-col"
                        // Grows up from the baseline the first time it is seen.
                        style={{
                          transformOrigin: `${l}px ${g.base}px`,
                          transform: grown ? 'scaleY(1)' : 'scaleY(0)',
                          // The stagger applies to the grow-in only, so the
                          // hover dim still answers immediately.
                          transition: reduced
                            ? 'none'
                            : `transform 700ms var(--ease-brand) ${(mi * 2 + yi) * 45}ms, opacity 160ms linear`,
                        }}
                      />

                      {/* In-bar labels, as in the example: the month inside the
                          top of the taller (after) column, the value inside the
                          foot of each. They arrive once the columns have grown. */}
                      {grown && g.inside && (
                        <g className="tk-col-label pointer-events-none" fill={yr.ink}>
                          {yi === 1 && (
                            <text
                              x={l + inset}
                              y={top + inset + g.labelSize * 0.72}
                              fontSize={g.labelSize}
                              style={{ fontFamily: 'var(--font-tk-display)' }}
                            >
                              {m.toUpperCase()}
                            </text>
                          )}
                          {h >= g.detailSize + inset * 2 && (
                            <text
                              x={l + inset}
                              y={g.base - inset}
                              fontSize={g.detailSize}
                              fontWeight="700"
                              className="tabular-nums"
                            >
                              {n}
                            </text>
                          )}
                        </g>
                      )}

                      {/* hit target: this column's half of the pair slot */}
                      <rect
                        x={g.pad.left + mi * g.group + yi * (g.group / 2)}
                        y={g.pad.top}
                        width={g.group / 2}
                        height={g.plotH}
                        fill="transparent"
                        tabIndex={0}
                        role="img"
                        aria-label={`${m} ${yearOf(yi, mi)}, ${name}: ${n} students`}
                        onFocus={() => setHover({ yi, mi })}
                        onBlur={() => setHover(null)}
                        className="cursor-default outline-none"
                      />
                    </g>
                  )
                })}

                {/* Compact: no room inside, so the month sits under the line. */}
                {!g.inside && (
                  <text
                    x={g.pad.left + mi * g.group + g.group / 2}
                    y={g.base + BASE_W + 15}
                    textAnchor="middle"
                    fontSize="13"
                    fill="var(--color-ink)"
                    style={{ fontFamily: 'var(--font-tk-display)' }}
                  >
                    {m.toUpperCase()}
                  </text>
                )}
              </g>
            ))}
          </svg>

          {g.compact && !tip && (
            <p
              aria-hidden="true"
              className="pointer-events-none absolute top-[10px] left-0 m-0 text-[length:var(--text-eyebrow)] text-[var(--color-ink-muted)]"
            >
              Tap a column for the count
            </p>
          )}

          {tip && (
            <div
              aria-hidden="true"
              // Wide: beside the column rather than above it, so it never covers
              // the legend or its label (left of it on the right half, right of
              // it on the left), clamped inside the chart. Narrow: pinned in the
              // band above the plot, centred, so it fits any phone width.
              className="pointer-events-none absolute z-10 rounded-[10px] bg-[var(--color-surface)] px-[0.75rem] py-[0.4rem] shadow-[0_6px_20px_-6px_color-mix(in_srgb,var(--color-ink)_30%,transparent)] ring-1 ring-[var(--chart-grid)]"
              style={
                g.compact
                  ? {
                      left: g.width / 2,
                      top: 2,
                      width: Math.min(TIP_W, g.width),
                      transform: 'translateX(-50%)',
                    }
                  : {
                      left: Math.min(
                        Math.max(
                          tip.cx + (tip.cx > g.width / 2 ? -(g.barW / 2 + 10) : g.barW / 2 + 10),
                          tip.cx > g.width / 2 ? TIP_W_WIDE : 0,
                        ),
                        tip.cx > g.width / 2 ? g.width : g.width - TIP_W_WIDE,
                      ),
                      top: Math.max(tip.top + 24, g.pad.top + 24),
                      width: TIP_W_WIDE,
                      transform: `translate(${tip.cx > g.width / 2 ? '-100%' : '0'}, -50%)`,
                    }
              }
            >
              <div className="text-[1.05rem] leading-tight font-bold text-[var(--color-ink)]">
                {tip.n} students
              </div>
              <div className="mt-[2px] flex items-center gap-[0.4em] text-[0.75rem] leading-tight text-[var(--color-ink-muted)]">
                <span
                  className="inline-block h-[0.6em] w-[0.6em] shrink-0"
                  style={{ background: tip.yr.color }}
                />
                {tip.name} · {MONTHS[hover.mi]} {yearOf(hover.yi, hover.mi)}
              </div>
            </div>
          )}
        </div>

        {side && stat}
      </div>

      {/* table view: every value reachable without hovering */}
      <details className="mt-[var(--cs-3)] text-[length:var(--text-eyebrow)] text-[var(--color-ink-muted)]">
        <summary className="inline-flex min-h-11 cursor-pointer items-center select-none">View as table</summary>
        <table className="mt-[var(--cs-2)] w-full border-collapse text-left tabular-nums">
          <thead>
            <tr>
              <th className="py-1 pr-2 font-semibold">Month</th>
              <th className="py-1 pr-2 font-semibold">2022–23 (old site)</th>
              <th className="py-1 font-semibold">2023–24 (new site)</th>
            </tr>
          </thead>
          <tbody>
            {MONTHS.map((m, mi) => (
              <tr key={m} className="border-t border-[var(--chart-grid)]">
                <td className="py-1 pr-2">{m}</td>
                <td className="py-1 pr-2">
                  {YEARS[0].events[mi][1]} · {YEARS[0].events[mi][0]}
                </td>
                <td className="py-1">
                  {YEARS[1].events[mi][1]} · {YEARS[1].events[mi][0]}
                </td>
              </tr>
            ))}
            <tr className="border-t border-[var(--chart-grid)] font-semibold text-[var(--color-ink)]">
              <td className="py-1 pr-2">Average</td>
              <td className="py-1 pr-2">{ATTENDANCE_AVERAGES.before}</td>
              <td className="py-1">
                {ATTENDANCE_AVERAGES.after} (+{CHANGE}%)
              </td>
            </tr>
          </tbody>
        </table>
      </details>
    </figure>
  )
}
