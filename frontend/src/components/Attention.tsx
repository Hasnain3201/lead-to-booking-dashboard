import { motion } from 'motion/react'
import type { AttentionRow, BookingRow } from '../lib/api'
import { ageLabel, formatDateTime, integer, serviceLabel, SOURCE_COLORS, sourceLabel, STATUS_LABELS } from '../lib/format'
import { Icon, Numeral, Panel, StatusPill } from './ui'

export function Attention({
  queue,
  failed,
  followUpUrl,
  outcomesUrl,
  onSelect,
}: {
  queue: AttentionRow[]
  failed: BookingRow[]
  followUpUrl: string
  outcomesUrl: string
  onSelect: (id: string) => void
}) {
  const oldest = Math.max(1, ...queue.map((row) => row.age_hours))
  const bySource = queue.reduce<Record<string, number>>((acc, row) => {
    acc[row.source] = (acc[row.source] ?? 0) + 1
    return acc
  }, {})
  const top = Object.entries(bySource).sort((a, b) => b[1] - a[1])[0]
  const cancelled = failed.filter((row) => row.status === 'cancelled').length

  return (
    <div className="two-col">
      <Panel className="list-panel">
        <div className="list-head">
          <div>
            <div className="label" style={{ color: 'var(--c-coral)' }}>Waiting for a first reply</div>
            <h3>Unanswered, unbooked, 24 h or older</h3>
          </div>
          <Numeral value={integer(queue.length)} className="big-count" />
        </div>
        {top && (
          <p style={{ margin: '0 0 12px', color: 'var(--ink-2)', fontSize: 13.5 }}>
            Oldest first. <b style={{ color: SOURCE_COLORS[top[0]] }}>{sourceLabel(top[0])}</b> has the most waiting (
            {top[1]}).
          </p>
        )}
        {queue.length === 0 ? (
          <div className="empty">
            <h3>All caught up</h3>
            <p>No inquiry in this view is waiting more than 24 hours without a response or booking.</p>
          </div>
        ) : (
          <ul className="flare-list" aria-label="Follow-up queue">
            {queue.map((row, i) => (
              <motion.li
                key={row.inquiry_id}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(i, 12) * 0.03 }}
              >
                <button type="button" className="flare" onClick={() => onSelect(row.inquiry_id)}>
                  <span className="flare-dot" style={{ animationDelay: `${(i % 7) * 0.3}s` }} />
                  <span className="num">{row.inquiry_id}</span>
                  <span className="flare-meta">
                    {sourceLabel(row.source)} · {serviceLabel(row.service)}
                  </span>
                  <span style={{ display: 'grid', gap: 4 }}>
                    <span className="num" style={{ fontSize: 12, textAlign: 'right', color: 'var(--ink-2)' }}>
                      {ageLabel(row.age_hours)}
                    </span>
                    <span className="age">
                      <i style={{ width: `${(row.age_hours / oldest) * 100}%` }} />
                    </span>
                  </span>
                </button>
              </motion.li>
            ))}
          </ul>
        )}
        <div className="list-foot">
          <span className="label">Review before contacting · nothing is sent</span>
          <a className="btn small" href={followUpUrl} download>
            <Icon name="download" size={14} />
            Follow-up list CSV
          </a>
        </div>
      </Panel>
      <Panel className="list-panel">
        <div className="list-head">
          <div>
            <div className="label" style={{ color: 'var(--c-beam)' }}>Bookings that fell through</div>
            <h3>Cancelled or missed</h3>
          </div>
          <Numeral value={integer(failed.length)} className="big-count" />
        </div>
        <p style={{ margin: '0 0 12px', color: 'var(--ink-2)', fontSize: 13.5 }}>
          {cancelled} cancelled · {failed.length - cancelled} no-shows, linked to the selected inquiries regardless of
          appointment date.
        </p>
        {failed.length === 0 ? (
          <div className="empty">
            <h3>Nothing fell through</h3>
            <p>No cancelled or no-show bookings belong to this view.</p>
          </div>
        ) : (
          <div className="table-wrap flare-list">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Inquiry</th>
                  <th>Status</th>
                  <th>Scheduled for</th>
                </tr>
              </thead>
              <tbody>
                {failed.map((row) => (
                  <tr
                    key={row.booking_id}
                    className="clickable"
                    tabIndex={0}
                    onClick={() => onSelect(row.inquiry_id)}
                    onKeyDown={(event) => event.key === 'Enter' && onSelect(row.inquiry_id)}
                  >
                    <td className="num">{row.booking_id}</td>
                    <td className="num">{row.inquiry_id}</td>
                    <td>
                      <StatusPill status={row.status}>{STATUS_LABELS[row.status]}</StatusPill>
                    </td>
                    <td className="num" style={{ color: 'var(--ink-2)' }}>
                      {formatDateTime(row.scheduled_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="list-foot">
          <span className="label">A cancellation is not proof of an empty slot</span>
          <a className="btn small" href={outcomesUrl} download>
            <Icon name="download" size={14} />
            Booking outcomes CSV
          </a>
        </div>
      </Panel>
    </div>
  )
}
