import { motion } from 'motion/react'
import type { Day, Meta, Metrics } from '../lib/api'
import { currency, formatDate, hours, integer, percent } from '../lib/format'
import { Icon, Info, Numeral, Panel } from './ui'

const words = (text: string, offset = 0, className = 'word') =>
  text.split(' ').map((word, i) => (
    <motion.span
      key={`${word}-${i}`}
      className={className}
      initial={{ opacity: 0, y: '0.5em', filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 1, delay: 0.08 * (i + offset), ease: [0.16, 1, 0.3, 1] }}
    >
      {word}&nbsp;
    </motion.span>
  ))

export function Hero({ meta, metrics, onPalette }: { meta: Meta; metrics: Metrics; onPalette: () => void }) {
  const conversion = metrics.conversion ?? 0
  const radius = 150
  const circumference = 2 * Math.PI * radius
  return (
    <section className="hero" id="top">
      <div className="beam" aria-hidden="true" />
      <div className="shell hero-grid">
        <div>
          <motion.div
            className="hero-kicker label"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            <span className="rule" />
            {meta.label}
          </motion.div>
          <h1>
            {words('From first')}
            <em>{words('hello', 2, 'word shimmer')}</em>
            {words('to finished job.', 3)}
          </h1>
          <motion.p
            className="hero-copy"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.6 }}
          >
            Leadflow joins three spreadsheets, <strong>inquiries, bookings, and completed jobs</strong>, so a service
            business owner can see which leads are slipping, where bookings fall through, and which sources turn into
            real work.{' '}
            {meta.synthetic && <strong>Every record here is synthetic.</strong>}
          </motion.p>
          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.75 }}
          >
            <a className="btn primary" href="#current">
              Follow the current <Icon name="arrow" />
            </a>
            <a className="btn" href="#attention">
              See who is waiting
            </a>
            <button className="btn ghost hide-sm" type="button" onClick={onPalette}>
              Jump anywhere <kbd>⌘K</kbd>
            </button>
          </motion.div>
        </div>
        <motion.div
          className="hero-instrument"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="gauge">
            <svg viewBox="-180 -180 360 360" aria-hidden="true">
              <defs>
                <linearGradient id="gauge-grad" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" style={{ stopColor: 'var(--c-tide)' }} />
                  <stop offset="60%" style={{ stopColor: 'var(--c-sky)' }} />
                  <stop offset="100%" style={{ stopColor: 'var(--c-beam)' }} />
                </linearGradient>
              </defs>
              <motion.g
                animate={{ rotate: 360 }}
                transition={{ duration: 180, repeat: Infinity, ease: 'linear' }}
              >
                {Array.from({ length: 72 }, (_, i) => (
                  <line
                    key={i}
                    x1={0}
                    x2={0}
                    y1={-172}
                    y2={i % 6 === 0 ? -160 : -166}
                    transform={`rotate(${i * 5})`}
                    style={{ stroke: 'var(--ink-3)', strokeWidth: i % 6 === 0 ? 1.4 : 0.8, opacity: 0.6 }}
                  />
                ))}
              </motion.g>
              <circle r={radius} style={{ fill: 'none', stroke: 'var(--line)', strokeWidth: 10 }} />
              <motion.circle
                r={radius}
                transform="rotate(-90)"
                style={{
                  fill: 'none',
                  stroke: 'url(#gauge-grad)',
                  strokeWidth: 10,
                  strokeLinecap: 'round',
                  filter: 'drop-shadow(0 0 12px var(--c-tide))',
                }}
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: circumference * (1 - conversion) }}
                transition={{ duration: 1.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              />
              <circle r={122} style={{ fill: 'none', stroke: 'var(--line)', strokeDasharray: '2 6' }} />
            </svg>
            <div className="gauge-center">
              <span className="label">Booked at least once</span>
              <Numeral value={percent(metrics.conversion)} className="gauge-value" />
              <span className="gauge-sub">
                {integer(metrics.converted)} of {integer(metrics.inquiries)} inquiries in this view booked an appointment
              </span>
            </div>
            <span className="coord" style={{ top: 0, left: 0 }}>
              Cohort · {integer(metrics.inquiries)}
            </span>
            <span className="coord" style={{ bottom: 0, right: 0, textAlign: 'right' }}>
              Outcomes through
              <br />
              {formatDate(meta.snapshot)}
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function Spark({ days }: { days: Day[] }) {
  if (days.length < 2) return <div className="kpi-viz" />
  const max = Math.max(1, ...days.map((day) => day.inquiries))
  const points = days.map((day, i) => `${(i / (days.length - 1)) * 100},${34 - (day.inquiries / max) * 30}`)
  return (
    <svg className="kpi-viz" viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true" width="100%">
      <polyline
        points={points.join(' ')}
        style={{ fill: 'none', stroke: 'var(--c-sky)', strokeWidth: 1.5, vectorEffect: 'non-scaling-stroke' }}
      />
      <polygon points={`0,36 ${points.join(' ')} 100,36`} style={{ fill: 'var(--c-sky)', opacity: 0.12 }} />
    </svg>
  )
}

function Split({ parts }: { parts: { value: number; color: string; label: string }[] }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0)
  return (
    <div className="kpi-viz" style={{ display: 'flex', alignItems: 'center' }} aria-hidden="true">
      <div style={{ display: 'flex', width: '100%', height: 8, borderRadius: 99, overflow: 'hidden', gap: 2 }}>
        {parts.map((part) => (
          <motion.div
            key={part.label}
            title={part.label}
            initial={false}
            animate={{ flexGrow: total ? part.value : 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 22 }}
            style={{ flexBasis: 0, background: part.color, boxShadow: `0 0 12px ${part.color}`, minWidth: part.value ? 2 : 0 }}
          />
        ))}
      </div>
    </div>
  )
}

export function Kpis({ metrics, days, start, end }: { metrics: Metrics; days: Day[]; start: string; end: string }) {
  const inRange = days.filter((day) => day.date >= start && day.date <= end)
  const other = metrics.bookings - metrics.cancellations - metrics.no_shows
  const cards = [
    {
      label: 'Inquiries',
      value: integer(metrics.inquiries),
      info: 'Unique accepted inquiry IDs created in the selected dates. Exact duplicate rows are removed on import.',
      viz: <Spark days={inRange} />,
      foot: (
        <>
          Created <b>{formatDate(`${start}T00:00:00Z`)}</b> to <b>{formatDate(`${end}T00:00:00Z`)}</b>
        </>
      ),
    },
    {
      label: 'Booked at least once',
      value: percent(metrics.conversion),
      info: 'Inquiries with one or more bookings, divided by inquiries. Repeat bookings count once; a cancelled booking still means the lead booked.',
      viz: (
        <Split
          parts={[
            { value: metrics.converted, color: 'var(--c-tide)', label: 'Booked' },
            { value: metrics.inquiries - metrics.converted, color: 'var(--line)', label: 'Not booked' },
          ]}
        />
      ),
      foot: (
        <>
          <b>{integer(metrics.converted)}</b> of {integer(metrics.inquiries)} leads
        </>
      ),
    },
    {
      label: 'Avg. first response',
      value: hours(metrics.response_hours),
      info: 'Mean elapsed hours from inquiry to recorded first response. Missing responses are excluded, never treated as zero.',
      viz: (
        <Split
          parts={[
            { value: Math.round((metrics.response_coverage ?? 0) * metrics.inquiries), color: 'var(--c-sky)', label: 'Response recorded' },
            {
              value: metrics.inquiries - Math.round((metrics.response_coverage ?? 0) * metrics.inquiries),
              color: 'var(--c-coral)',
              label: 'No response recorded',
            },
          ]}
        />
      ),
      foot: (
        <>
          <b>{percent(metrics.response_coverage)}</b> have a recorded response
        </>
      ),
    },
    {
      label: 'Completed jobs',
      value: integer(metrics.completed_jobs),
      info: 'Completed-job records belonging to these inquiries, one per booking. Job value is not profit or cash collected.',
      viz: (
        <div className="kpi-viz num" style={{ display: 'flex', alignItems: 'center', color: 'var(--c-beam)', fontSize: 18 }}>
          {currency(metrics.revenue_usd)}
        </div>
      ),
      foot: <>Recorded job value, not profit</>,
    },
    {
      label: 'Cancelled bookings',
      value: percent(metrics.cancellation_rate),
      info: 'Cancelled bookings divided by all bookings from these inquiries, including scheduled ones. No-shows are reported separately.',
      viz: (
        <Split
          parts={[
            { value: metrics.cancellations, color: 'var(--c-coral)', label: 'Cancelled' },
            { value: metrics.no_shows, color: 'var(--c-beam)', label: 'No-show' },
            { value: other, color: 'var(--c-tide)', label: 'Completed or scheduled' },
          ]}
        />
      ),
      foot: (
        <>
          <b>{integer(metrics.cancellations)}</b> of {integer(metrics.bookings)} bookings · {integer(metrics.no_shows)} no-shows
        </>
      ),
    },
  ]
  return (
    <div className="shell kpis">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 + i * 0.08, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <Panel className="kpi" style={{ height: '100%' }}>
            <div className="kpi-top">
              <span className="label">{card.label}</span>
              <Info label={card.label}>{card.info}</Info>
            </div>
            <Numeral value={card.value} className="kpi-value" />
            {card.viz}
            <div className="kpi-foot">{card.foot}</div>
          </Panel>
        </motion.div>
      ))}
    </div>
  )
}
