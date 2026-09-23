import { motion } from 'motion/react'
import { useState } from 'react'
import type { SourceRow } from '../lib/api'
import { currency, hours, integer, percent, SOURCE_COLORS, sourceLabel } from '../lib/format'
import { Icon, Panel, Segmented } from './ui'

type Key = 'inquiries' | 'conversion' | 'response_hours' | 'completed_jobs' | 'revenue_usd'

const METRICS: { value: Key; label: string; format: (v: number | null) => string; note: string }[] = [
  { value: 'inquiries', label: 'Volume', format: (v) => integer(v ?? 0), note: 'inquiries' },
  { value: 'conversion', label: 'Booked', format: percent, note: 'booked at least once' },
  { value: 'response_hours', label: 'Response', format: hours, note: 'mean first response · fastest first' },
  { value: 'completed_jobs', label: 'Jobs', format: (v) => integer(v ?? 0), note: 'completed jobs' },
  { value: 'revenue_usd', label: 'Job value', format: (v) => currency(v ?? 0), note: 'recorded job value' },
]

export function Sources({
  rows,
  exportUrl,
  onSolo,
  activeSources,
}: {
  rows: SourceRow[]
  exportUrl: string
  onSolo: (source: string) => void
  activeSources: string[]
}) {
  const [key, setKey] = useState<Key>('inquiries')
  const [table, setTable] = useState(false)
  const metric = METRICS.find((m) => m.value === key)!
  const ascending = key === 'response_hours'
  const sorted = [...rows].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    if (av == null) return 1
    if (bv == null) return -1
    return ascending ? av - bv : bv - av
  })
  const max = Math.max(...rows.map((row) => row[key] ?? 0), key === 'conversion' ? 1 : 0.0001)

  return (
    <Panel className="sources">
      <div className="records-tools" style={{ paddingTop: 12 }}>
        <Segmented label="Compare sources by" value={key} onChange={setKey} options={METRICS} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn small ghost" type="button" onClick={() => setTable((v) => !v)} aria-pressed={table}>
            <Icon name="table" size={14} />
            {table ? 'Show bars' : 'Show exact table'}
          </button>
          <a className="btn small" href={exportUrl} download>
            <Icon name="download" size={14} />
            Source metrics CSV
          </a>
        </div>
      </div>
      {rows.length === 0 && (
        <div className="empty">
          <h3>No sources in this view</h3>
          <p>Turn on at least one source and service in the dock below.</p>
        </div>
      )}
      {!table &&
        sorted.map((row) => (
          <motion.button
            layout
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            key={row.source}
            type="button"
            className="source-row"
            onClick={() => onSolo(row.source)}
            aria-label={`${sourceLabel(row.source)}: ${metric.format(row[key])} ${metric.note}${
              key === 'inquiries' ? '' : `, ${row.inquiries} inquiries`
            }. ${
              activeSources.length === 1 ? 'Show all sources' : 'Focus on this source'
            }.`}
          >
            <span className="source-name" style={{ color: SOURCE_COLORS[row.source] }}>
              <span className="swatch" />
              <span style={{ color: 'var(--ink)' }}>
                {sourceLabel(row.source)}
                <small>n = {integer(row.inquiries)}</small>
              </span>
            </span>
            <span className="bar-track" style={{ color: SOURCE_COLORS[row.source] }}>
              <motion.span
                className="bar-fill"
                initial={{ width: 0 }}
                animate={{ width: `${((row[key] ?? 0) / max) * 100}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 22 }}
              />
            </span>
            <span className="source-value num">
              {metric.format(row[key])}
              <span className="source-sub">{metric.note}</span>
            </span>
          </motion.button>
        ))}
      {table && rows.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lead source</th>
                <th className="r">Inquiries</th>
                <th className="r">Booked leads</th>
                <th className="r">Conversion</th>
                <th className="r">Mean response</th>
                <th className="r">Coverage</th>
                <th className="r">Bookings</th>
                <th className="r">Cancellation rate</th>
                <th className="r">No-shows</th>
                <th className="r">Completed jobs</th>
                <th className="r">Recorded job value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.source}>
                  <td>{sourceLabel(row.source)}</td>
                  <td className="r num">{integer(row.inquiries)}</td>
                  <td className="r num">{integer(row.converted)}</td>
                  <td className="r num">{percent(row.conversion)}</td>
                  <td className="r num">{hours(row.response_hours)}</td>
                  <td className="r num">{percent(row.response_coverage)}</td>
                  <td className="r num">{integer(row.bookings)}</td>
                  <td className="r num">{percent(row.cancellation_rate)}</td>
                  <td className="r num">{integer(row.no_shows)}</td>
                  <td className="r num">{integer(row.completed_jobs)}</td>
                  <td className="r num">{currency(row.revenue_usd, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="caveat">
        Compare sample sizes alongside rates: small sources swing widely. Differences describe this
        snapshot and do not establish marketing effectiveness. Job value is not profit, cash collected, or ROI, and
        no advertising costs are included.
      </p>
    </Panel>
  )
}
