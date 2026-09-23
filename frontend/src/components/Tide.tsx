import { scaleLinear } from 'd3-scale'
import { area, curveMonotoneX, line } from 'd3-shape'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Day } from '../lib/api'
import { addDays, daysBetween, formatDate, formatShortDate, integer } from '../lib/format'
import { Segmented } from './ui'

const HEIGHT = 230
const PAD = { top: 26, right: 8, bottom: 28, left: 30 }

type Drag = { mode: 'new' | 'start' | 'end' | 'move'; origin: number; a: number; b: number }

export function Tide({
  timeline,
  firstDate,
  lastDate,
  start,
  end,
  onChange,
}: {
  timeline: Day[]
  firstDate: string
  lastDate: string
  start: string
  end: string
  onChange: (start: string, end: string) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(900)
  const [draft, setDraft] = useState<[number, number] | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<Drag | null>(null)
  const commitTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(wrapRef.current!)
    return () => observer.disconnect()
  }, [])

  useEffect(() => () => window.clearTimeout(commitTimer.current), [start, end, firstDate, lastDate])

  const span = daysBetween(firstDate, lastDate)
  const days = useMemo(() => {
    const byDate = new Map(timeline.map((day) => [day.date, day]))
    return Array.from({ length: span + 1 }, (_, i) => {
      const date = addDays(firstDate, i)
      return byDate.get(date) ?? { date, inquiries: 0, booked_leads: 0, completed_leads: 0 }
    })
  }, [timeline, firstDate, span])

  const x = scaleLinear()
    .domain([0, span + 1])
    .range([PAD.left, width - PAD.right])
  const max = days.reduce((largest, day) => Math.max(largest, day.inquiries), 4)
  const y = scaleLinear()
    .domain([0, max * 1.1])
    .range([HEIGHT - PAD.bottom, PAD.top])
  const mid = (i: number) => x(i + 0.5)

  const inquiriesArea = area<Day>()
    .x((_, i) => mid(i))
    .y0(y(0))
    .y1((day) => y(day.inquiries))
    .curve(curveMonotoneX)
  const bookedArea = area<Day>()
    .x((_, i) => mid(i))
    .y0(y(0))
    .y1((day) => y(day.booked_leads))
    .curve(curveMonotoneX)
  const completedLine = line<Day>()
    .x((_, i) => mid(i))
    .y((day) => y(day.completed_leads))
    .curve(curveMonotoneX)

  const committed: [number, number] = [daysBetween(firstDate, start), daysBetween(firstDate, end)]
  const [a, b] = draft ?? committed
  const clampDay = (value: number) => Math.max(0, Math.min(span, value))

  const dayAt = (clientX: number) => {
    const rect = wrapRef.current!.getBoundingClientRect()
    return clampDay(Math.floor(x.invert(clientX - rect.left)))
  }

  const commit = (range: [number, number]) => {
    window.clearTimeout(commitTimer.current)
    const [lo, hi] = [Math.min(...range), Math.max(...range)]
    setDraft(null)
    onChange(addDays(firstDate, lo), addDays(firstDate, hi))
  }

  const onPointerDown = (event: React.PointerEvent, mode: Drag['mode']) => {
    event.stopPropagation()
    window.clearTimeout(commitTimer.current)
    const day = dayAt(event.clientX)
    ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
    drag.current = { mode, origin: day, a, b }
    setDragging(true)
    if (mode === 'new') setDraft([day, day])
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const day = dayAt(event.clientX)
    if (event.pointerType === 'mouse') setHover(day)
    const current = drag.current
    if (!current) return
    if (current.mode === 'new') setDraft([current.origin, day])
    if (current.mode === 'start') setDraft([day, current.b])
    if (current.mode === 'end') setDraft([current.a, day])
    if (current.mode === 'move') {
      const width = current.b - current.a
      const shift = Math.max(-current.a, Math.min(span - current.b, day - current.origin))
      setDraft([current.a + shift, current.a + shift + width])
    }
  }

  const onPointerUp = () => {
    if (drag.current && draft) commit(draft)
    drag.current = null
    setDragging(false)
  }

  const onHandleKey = (event: React.KeyboardEvent, edge: 'start' | 'end') => {
    const step = event.shiftKey ? 7 : 1
    const delta = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
    if (!delta) return
    event.preventDefault()
    const next: [number, number] =
      edge === 'start' ? [clampDay(Math.min(a + delta, b)), b] : [a, clampDay(Math.max(b + delta, a))]
    setDraft(next)
    window.clearTimeout(commitTimer.current)
    commitTimer.current = window.setTimeout(() => commit(next), 450)
  }

  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  const selectionX0 = x(lo)
  const selectionX1 = x(hi + 1)
  const preset =
    hi - lo === span ? 'all' : hi === span && hi - lo === 27 ? '28' : hi === span && hi - lo === 13 ? '14' : ''
  const ticks = days
    .map((day, i) => ({ day, i }))
    .filter(({ day }) => new Date(`${day.date}T00:00:00Z`).getUTCDay() === 1)
  const hovered = hover != null && !dragging ? days[hover] : null

  return (
    <div className="tide panel">
      <div className="tide-head">
        <div>
          <div className="label">Inquiry creation dates · UTC · drag to select</div>
          <div className="tide-range" aria-live="polite">
            {formatDate(addDays(firstDate, lo))}
            <span className="arrow">→</span>
            {formatDate(addDays(firstDate, hi))}
            <span className="num" style={{ fontSize: 14, color: 'var(--ink-3)', marginLeft: 12 }}>
              {hi - lo + 1} days
            </span>
          </div>
        </div>
        <Segmented
          label="Date range presets"
          value={preset}
          onChange={(value) => {
            if (value === 'all') commit([0, span])
            if (value === '28') commit([Math.max(0, span - 27), span])
            if (value === '14') commit([Math.max(0, span - 13), span])
          }}
          options={[
            { value: 'all', label: 'All weeks' },
            { value: '28', label: 'Last 28 days' },
            { value: '14', label: 'Last 14 days' },
          ]}
        />
      </div>
      <div
        ref={wrapRef}
        style={{ position: 'relative', touchAction: 'pan-y' }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null
          setDragging(false)
          setDraft(null)
        }}
        onPointerLeave={() => setHover(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          height={HEIGHT}
          onPointerDown={(event) => onPointerDown(event, 'new')}
          role="group"
          aria-label="Daily inquiry timeline with date range selection"
        >
          <defs>
            <linearGradient id="tide-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--c-sky)', stopOpacity: 0.45 }} />
              <stop offset="100%" style={{ stopColor: 'var(--c-sky)', stopOpacity: 0 }} />
            </linearGradient>
            <linearGradient id="tide-booked" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--c-tide)', stopOpacity: 0.7 }} />
              <stop offset="100%" style={{ stopColor: 'var(--c-tide)', stopOpacity: 0.05 }} />
            </linearGradient>
            <clipPath id="tide-clip">
              <rect x={selectionX0} y={0} width={Math.max(0, selectionX1 - selectionX0)} height={HEIGHT} />
            </clipPath>
          </defs>
          {y.ticks(4).map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} style={{ stroke: 'var(--line)' }} />
              <text className="tide-axis" x={PAD.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle">
                {tick}
              </text>
            </g>
          ))}
          <g style={{ opacity: 0.28 }}>
            <path d={inquiriesArea(days) ?? ''} style={{ fill: 'url(#tide-fill)' }} />
            <path d={bookedArea(days) ?? ''} style={{ fill: 'url(#tide-booked)' }} />
          </g>
          <g clipPath="url(#tide-clip)">
            <path d={inquiriesArea(days) ?? ''} style={{ fill: 'url(#tide-fill)' }} />
            <path
              d={inquiriesArea.lineY1()(days) ?? ''}
              style={{ fill: 'none', stroke: 'var(--c-sky)', strokeWidth: 1.6 }}
            />
            <path d={bookedArea(days) ?? ''} style={{ fill: 'url(#tide-booked)' }} />
            <path
              d={bookedArea.lineY1()(days) ?? ''}
              style={{
                fill: 'none',
                stroke: 'var(--c-tide)',
                strokeWidth: 1.8,
                filter: 'drop-shadow(0 0 var(--glow) var(--c-tide))',
              }}
            />
            <path
              d={completedLine(days) ?? ''}
              style={{ fill: 'none', stroke: 'var(--c-beam)', strokeWidth: 1.4, strokeDasharray: '3 4' }}
            />
          </g>
          <rect
            x={selectionX0}
            y={PAD.top - 12}
            width={Math.max(0, selectionX1 - selectionX0)}
            height={HEIGHT - PAD.bottom - PAD.top + 12}
            rx={10}
            style={{
              fill: 'var(--c-tide)',
              fillOpacity: 0.05,
              stroke: 'var(--c-tide)',
              strokeOpacity: 0.35,
              cursor: 'grab',
            }}
            onPointerDown={(event) => onPointerDown(event, 'move')}
          />
          {(['start', 'end'] as const).map((edge) => {
            const hx = edge === 'start' ? selectionX0 : selectionX1
            const day = edge === 'start' ? lo : hi
            return (
              <g
                key={edge}
                className="brush-handle"
                tabIndex={0}
                role="slider"
                aria-label={edge === 'start' ? 'Start date' : 'End date'}
                aria-valuemin={0}
                aria-valuemax={span}
                aria-valuenow={day}
                aria-valuetext={formatDate(addDays(firstDate, day))}
                onKeyDown={(event) => onHandleKey(event, edge)}
                onPointerDown={(event) => onPointerDown(event, edge)}
              >
                <line
                  x1={hx}
                  x2={hx}
                  y1={PAD.top - 12}
                  y2={HEIGHT - PAD.bottom}
                  style={{ stroke: 'var(--c-tide)', strokeWidth: 1.5 }}
                />
                <rect
                  x={hx - 7}
                  y={(HEIGHT - PAD.bottom + PAD.top) / 2 - 20}
                  width={14}
                  height={40}
                  rx={7}
                  style={{ fill: 'var(--panel-strong)', stroke: 'var(--c-tide)', strokeWidth: 1.5 }}
                />
                <rect x={hx - 16} y={0} width={32} height={HEIGHT} style={{ fill: 'transparent' }} />
              </g>
            )
          })}
          {ticks.map(({ day, i }) => (
            <text
              key={day.date}
              className="tide-axis"
              x={x(i)}
              y={HEIGHT - 8}
              textAnchor={i === 0 ? 'start' : 'middle'}
            >
              {formatShortDate(`${day.date}T00:00:00Z`)}
            </text>
          ))}
          {hovered && hover != null && (
            <line
              x1={mid(hover)}
              x2={mid(hover)}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              style={{ stroke: 'var(--ink-3)', strokeDasharray: '2 3', pointerEvents: 'none' }}
            />
          )}
        </svg>
        {hovered && hover != null && (
          <div
            className="particle-tip"
            style={{ left: Math.min(mid(hover), width - 190), top: 60, transform: 'translate(12px, 0)' }}
          >
            <div className="label" style={{ marginBottom: 4 }}>
              {formatDate(`${hovered.date}T00:00:00Z`)}
            </div>
            <div>
              <b className="num">{integer(hovered.inquiries)}</b> inquiries
            </div>
            <div style={{ color: 'var(--c-tide)' }}>
              <b className="num">{integer(hovered.booked_leads)}</b> booked
            </div>
            <div style={{ color: 'var(--c-beam)' }}>
              <b className="num">{integer(hovered.completed_leads)}</b> completed a job
            </div>
          </div>
        )}
      </div>
      <div className="legend" style={{ marginTop: 6 }}>
        <span style={{ color: 'var(--c-sky)' }}>
          <i />
          <span style={{ color: 'var(--ink-2)' }}>Inquiries per day</span>
        </span>
        <span style={{ color: 'var(--c-tide)' }}>
          <i />
          <span style={{ color: 'var(--ink-2)' }}>Of those, booked by the snapshot</span>
        </span>
        <span style={{ color: 'var(--c-beam)' }}>
          <i />
          <span style={{ color: 'var(--ink-2)' }}>Completed a job by the snapshot</span>
        </span>
      </div>
      <p className="caveat">
        Recent days have had less time to book and finish work, so their lower outcome lines are expected, not a
        decline. Use the arrow keys on a handle to move it by a day (Shift for a week).
      </p>
    </div>
  )
}
