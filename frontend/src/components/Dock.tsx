import { motion } from 'motion/react'
import type { Filters, Meta } from '../lib/api'
import { formatShortDate, integer, serviceLabel, SOURCE_COLORS, sourceLabel } from '../lib/format'
import { Icon } from './ui'

export function Dock({
  meta,
  filters,
  count,
  loading = false,
  onChange,
  onReset,
}: {
  meta: Meta
  filters: Filters
  count: number
  loading?: boolean
  onChange: (filters: Filters) => void
  onReset: () => void
}) {
  const toggle = (key: 'sources' | 'services', value: string) => {
    const current = filters[key]
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    onChange({ ...filters, [key]: next })
  }
  const pristine =
    filters.sources.length === meta.sources.length &&
    filters.services.length === meta.services.length &&
    filters.start === meta.first_date &&
    filters.end === meta.last_date

  return (
    <motion.nav
      className="dock"
      aria-label="Filters"
      initial={{ y: 120, x: '-50%', opacity: 0 }}
      animate={{ y: 0, x: '-50%', opacity: 1 }}
      transition={{ delay: 1, type: 'spring', stiffness: 200, damping: 26 }}
    >
      <div className="dock-group" role="group" aria-label="Lead sources">
        {meta.sources.map((source) => (
          <button
            key={source}
            type="button"
            className="chip"
            aria-pressed={filters.sources.includes(source)}
            onClick={() => toggle('sources', source)}
          >
            <span className="pip-wrap" style={{ color: SOURCE_COLORS[source] }}>
              <span className="pip" />
            </span>
            {sourceLabel(source)}
          </button>
        ))}
      </div>
      <span className="dock-sep" />
      <div className="dock-group" role="group" aria-label="Services">
        {meta.services.map((service) => (
          <button
            key={service}
            type="button"
            className="chip"
            aria-pressed={filters.services.includes(service)}
            onClick={() => toggle('services', service)}
          >
            {serviceLabel(service)}
          </button>
        ))}
      </div>
      <span className="dock-sep" />
      <a className="dock-range" href="#tide" title="Change dates on the tide chart">
        {formatShortDate(`${filters.start}T00:00:00Z`)} – {formatShortDate(`${filters.end}T00:00:00Z`)}
      </a>
      <span className="dock-count" aria-live="polite">
        {loading ? 'Updating…' : `${integer(count)} inquiries`}
      </span>
      <button className="chip" type="button" onClick={onReset} disabled={pristine} aria-label="Reset all filters">
        <Icon name="reset" size={14} />
      </button>
    </motion.nav>
  )
}
