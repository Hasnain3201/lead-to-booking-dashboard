import { useMemo, useState } from 'react'
import type { InquiryLite, Outcome } from '../lib/api'
import { centsToCurrency, formatDateTime, hours, integer, OUTCOME_LABELS, serviceLabel, SOURCE_COLORS, sourceLabel } from '../lib/format'
import { Icon, Panel, Segmented, StatusPill } from './ui'

const PAGE = 12

export function Records({
  rows,
  exportUrl,
  onSelect,
}: {
  rows: InquiryLite[]
  exportUrl: string
  onSelect: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [outcome, setOutcome] = useState<Outcome | 'all'>('all')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows
      .filter((row) => outcome === 'all' || row.outcome === outcome)
      .filter((row) => !needle || row.inquiry_id.toLowerCase().includes(needle))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [rows, query, outcome])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const current = Math.min(page, pages - 1)
  const visible = filtered.slice(current * PAGE, current * PAGE + PAGE)

  return (
    <Panel className="records">
      <div className="records-tools">
        <label className="search">
          <Icon name="search" />
          <span className="sr-only">Search inquiry ID</span>
          <input
            value={query}
            placeholder="Search an inquiry ID, e.g. I0412"
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(0)
            }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Segmented
            label="Filter by furthest outcome"
            value={outcome}
            onChange={(value) => {
              setOutcome(value)
              setPage(0)
            }}
            options={[
              { value: 'all', label: 'All' },
              { value: 'completed', label: 'Completed' },
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'lost', label: 'Fell through' },
              { value: 'unbooked', label: 'Never booked' },
            ]}
          />
          <a className="btn small" href={exportUrl} download>
            <Icon name="download" size={14} />
            Selected inquiries CSV
          </a>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Inquiry</th>
              <th>Received</th>
              <th>Source</th>
              <th>Service</th>
              <th className="r">First response</th>
              <th className="r">Bookings</th>
              <th className="r">Jobs</th>
              <th className="r">Job value</th>
              <th>Furthest outcome</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.inquiry_id}
                className="clickable"
                tabIndex={0}
                onClick={() => onSelect(row.inquiry_id)}
                onKeyDown={(event) => event.key === 'Enter' && onSelect(row.inquiry_id)}
              >
                <td className="num">{row.inquiry_id}</td>
                <td className="num" style={{ color: 'var(--ink-2)' }}>
                  {formatDateTime(row.created_at)}
                </td>
                <td>
                  <span style={{ color: SOURCE_COLORS[row.source] }}>●</span> {sourceLabel(row.source)}
                </td>
                <td>{serviceLabel(row.service)}</td>
                <td className="r num" style={{ color: row.responded ? undefined : 'var(--c-coral)' }}>
                  {row.responded ? hours(row.response_hours) : 'None recorded'}
                </td>
                <td className="r num">{row.bookings}</td>
                <td className="r num">{row.completed_jobs}</td>
                <td className="r num">{row.revenue_cents ? centsToCurrency(row.revenue_cents) : '—'}</td>
                <td>
                  <StatusPill status={row.outcome}>{OUTCOME_LABELS[row.outcome]}</StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div className="empty">
            <h3>No matching records</h3>
            <p>Try a different ID or outcome.</p>
          </div>
        )}
      </div>
      <div className="pager">
        <span className="num">
          {integer(filtered.length)} records · page {current + 1} of {pages}
        </span>
        <button className="btn small" type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>
          Previous
        </button>
        <button className="btn small" type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
          Next
        </button>
      </div>
    </Panel>
  )
}
