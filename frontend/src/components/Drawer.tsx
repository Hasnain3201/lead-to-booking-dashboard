import { AnimatePresence, motion } from 'motion/react'
import { useCallback } from 'react'
import { useDialog } from '../lib/useDialog'
import { useResource } from '../lib/useResource'
import { api } from '../lib/api'
import {
  centsToCurrency,
  currency,
  formatDateTime,
  hours,
  OUTCOME_LABELS,
  serviceLabel,
  SOURCE_COLORS,
  sourceLabel,
  STATUS_LABELS,
} from '../lib/format'
import { Icon, StatusPill } from './ui'

const STATUS_COLORS: Record<string, string> = {
  completed: 'var(--c-tide)',
  scheduled: 'var(--c-sky)',
  cancelled: 'var(--c-coral)',
  no_show: 'var(--c-beam)',
}

export function Drawer({
  dataset,
  inquiryId,
  onClose,
}: {
  dataset: string
  inquiryId: string | null
  onClose: () => void
}) {
  const load = useCallback((signal: AbortSignal) => api.detail(dataset, inquiryId!, signal), [dataset, inquiryId])
  const { value: detail, error } = useResource(inquiryId ? `${dataset}:${inquiryId}` : null, load)
  const dialogRef = useDialog(Boolean(inquiryId), onClose)

  const inquiry = detail?.inquiry

  return (
    <AnimatePresence>
      {inquiryId && (
        <>
          <motion.div
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={dialogRef}
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`Inquiry ${inquiryId}`}
            initial={{ x: '105%', opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '105%', opacity: 0.6 }}
            transition={{ type: 'spring', stiffness: 300, damping: 34 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <div className="label">Voyage log · one inquiry</div>
                <div className="drawer-id" style={{ marginTop: 10 }}>
                  {inquiryId}
                </div>
              </div>
              <button className="icon-btn" type="button" onClick={onClose} aria-label="Close record">
                <Icon name="close" />
              </button>
            </div>
            {error && <p style={{ color: 'var(--c-coral)' }}>{error}</p>}
            {!detail && !error && <div className="skeleton" style={{ height: 320, marginTop: 24 }} />}
            {inquiry && detail && (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                  <span className="badge" style={{ color: SOURCE_COLORS[inquiry.source] }}>
                    <span
                      className="dot"
                      style={{ background: 'currentColor', boxShadow: '0 0 var(--glow) currentColor' }}
                    />
                    <span style={{ color: 'var(--ink)' }}>{sourceLabel(inquiry.source)}</span>
                  </span>
                  <span className="badge">{serviceLabel(inquiry.service)}</span>
                  <StatusPill status={inquiry.outcome}>{OUTCOME_LABELS[inquiry.outcome]}</StatusPill>
                </div>
                <div className="detail-grid">
                  <div>
                    <span className="label">First response</span>
                    <span className="num">{hours(inquiry.response_hours)}</span>
                  </div>
                  <div>
                    <span className="label">Bookings</span>
                    <span className="num">{inquiry.bookings}</span>
                  </div>
                  <div>
                    <span className="label">Completed jobs</span>
                    <span className="num">{inquiry.completed_jobs}</span>
                  </div>
                  <div>
                    <span className="label">Job value</span>
                    <span className="num">{centsToCurrency(inquiry.revenue_cents)}</span>
                  </div>
                </div>
                <ol className="voyage">
                  <motion.span
                    className="voyage-line"
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                  />
                  <Event delay={0.1} color="var(--c-sky)" when={inquiry.created_at} title="Inquiry received">
                    {sourceLabel(inquiry.source)} · {serviceLabel(inquiry.service)}
                  </Event>
                  {inquiry.first_response_at ? (
                    <Event
                      delay={0.2}
                      color="var(--c-tide)"
                      when={inquiry.first_response_at}
                      title="First response recorded"
                    >
                      {hours(inquiry.response_hours)} after the inquiry arrived
                    </Event>
                  ) : (
                    <Event delay={0.2} color="var(--c-coral)" title="No first response recorded">
                      Missing timestamps are excluded from the response average, never counted as zero.
                    </Event>
                  )}
                  {detail.bookings.map((booking, i) => (
                    <Event
                      key={booking.booking_id}
                      delay={0.3 + i * 0.1}
                      color={STATUS_COLORS[booking.status]}
                      when={booking.booked_at}
                      title={`Booking ${booking.booking_id} · ${STATUS_LABELS[booking.status]}`}
                    >
                      Appointment {formatDateTime(booking.scheduled_at)}
                      {booking.job_id && booking.completed_at && (
                        <>
                          <br />
                          Job {booking.job_id} completed {formatDateTime(booking.completed_at)}
                          {booking.revenue_usd != null && ` · ${currency(booking.revenue_usd, 2)}`}
                        </>
                      )}
                    </Event>
                  ))}
                  {detail.bookings.length === 0 && (
                    <Event delay={0.3} color="var(--c-slate)" title="No bookings recorded">
                      Through the snapshot, this inquiry never booked an appointment.
                    </Event>
                  )}
                </ol>
                <p className="caveat">
                  Each booking is listed separately, so repeat bookings are visible without double-counting the lead.
                </p>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function Event({
  title,
  when,
  color,
  delay,
  children,
}: {
  title: string
  when?: string
  color: string
  delay: number
  children: React.ReactNode
}) {
  return (
    <motion.li
      style={{ ['--dot' as string]: color }}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {when && <div className="when">{formatDateTime(when)}</div>}
      <h4>{title}</h4>
      <p>{children}</p>
    </motion.li>
  )
}
