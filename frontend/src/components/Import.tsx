import { motion } from 'motion/react'
import { useState } from 'react'
import { api, type ImportFailure, type ReceiptRow } from '../lib/api'
import { csvFromRows, download, integer } from '../lib/format'
import { Icon, Panel } from './ui'

const NAMES = ['inquiries', 'bookings', 'jobs'] as const
type Name = (typeof NAMES)[number]

const todayUtc = () => new Date().toISOString().slice(0, 10)

async function sampleFile(name: string, as: Name) {
  const response = await fetch(api.sampleUrl(name))
  return new File([await response.blob()], `${as}.csv`, { type: 'text/csv' })
}

export function Import({
  enabled,
  busy,
  onSubmit,
}: {
  enabled: boolean
  busy: boolean
  onSubmit: (files: Record<Name, File>, snapshot: string, origin: DOMRect | null) => void
}) {
  const [files, setFiles] = useState<Partial<Record<Name, File>>>({})
  const [snapshot, setSnapshot] = useState(todayUtc)
  const [over, setOver] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const assign = (list: FileList | File[]) => {
    const next = { ...files }
    const unmatched: string[] = []
    for (const file of Array.from(list)) {
      const match = NAMES.find((name) => file.name.toLowerCase().includes(name))
      if (match) next[match] = file
      else unmatched.push(file.name)
    }
    setFiles(next)
    setNote(unmatched.length ? `Drop these onto a slot directly: ${unmatched.join(', ')}` : null)
  }

  const ready = NAMES.every((name) => files[name])

  const loadSamples = async (broken: boolean) => {
    const loaded = {
      inquiries: await sampleFile('inquiries.csv', 'inquiries'),
      bookings: await sampleFile(broken ? 'bookings_orphan.csv' : 'bookings.csv', 'bookings'),
      jobs: await sampleFile('jobs.csv', 'jobs'),
    }
    setFiles(loaded)
    setNote(
      broken
        ? 'Loaded the demo files with a deliberately broken bookings file. Import it to see validation stop the run.'
        : 'Loaded the synthetic demo files. Import them to run the full validation path.',
    )
  }

  return (
    <div
      className={`dropzone ${over ? 'over' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        assign(event.dataTransfer.files)
      }}
    >
      <div className="label">Bring your own files</div>
      <h3>Drop three CSV exports</h3>
      <p style={{ margin: 0, color: 'var(--ink-2)' }}>
        Files are validated and processed in memory by the local Python service and are never written to disk. A failed
        import clears the dashboard rather than leaving old numbers on screen.
      </p>
      {!enabled && (
        <p className="caveat">Uploads are disabled on this deployment. Clone the project to try your own files.</p>
      )}
      <div className="slots">
        {NAMES.map((name) => (
          <label key={name} className={`slot ${files[name] ? 'filled' : ''}`}>
            <span className="label">{name}.csv</span>
            <span className="file">{files[name]?.name ?? 'Choose or drop a file'}</span>
            {files[name] && (
              <span className="check">
                <Icon name="check" />
              </span>
            )}
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={!enabled}
              aria-label={`Choose ${name}.csv`}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) setFiles((current) => ({ ...current, [name]: file }))
              }}
            />
          </label>
        ))}
      </div>
      <div className="import-actions">
        <label className="field">
          <span className="label">Snapshot date (UTC)</span>
          <input type="date" value={snapshot} onChange={(event) => setSnapshot(event.target.value)} disabled={!enabled} />
        </label>
        <button
          className="btn primary"
          type="button"
          disabled={!enabled || !ready || busy || !snapshot}
          onClick={(event) =>
            onSubmit(files as Record<Name, File>, snapshot, event.currentTarget.getBoundingClientRect())
          }
        >
          <Icon name="upload" />
          {busy ? 'Validating…' : 'Validate and import'}
        </button>
      </div>
      <div className="import-actions" style={{ marginTop: 14 }}>
        <button className="btn small ghost" type="button" disabled={!enabled} onClick={() => loadSamples(false)}>
          Load demo files
        </button>
        <button className="btn small ghost" type="button" disabled={!enabled} onClick={() => loadSamples(true)}>
          <Icon name="alert" size={14} />
          Load a broken sample
        </button>
        {NAMES.map((name) => (
          <a key={name} className="btn small ghost" href={api.sampleUrl(`${name}.csv`)} download>
            <Icon name="download" size={14} />
            {name}
          </a>
        ))}
      </div>
      {note && (
        <p className="caveat" role="status">
          {note}
        </p>
      )}
    </div>
  )
}

const LINES: { key: keyof ReceiptRow; label: string }[] = [
  { key: 'input_rows', label: 'Rows read' },
  { key: 'accepted_rows', label: 'Rows accepted' },
  { key: 'duplicates_removed', label: 'Exact duplicates removed' },
  { key: 'whitespace_rows', label: 'Rows with trimmed spaces' },
  { key: 'category_values_normalized', label: 'Category values normalized' },
]

export function Receipt({ rows, label, snapshot, receiptUrl }: { rows: ReceiptRow[]; label: string; snapshot: string; receiptUrl: string }) {
  let line = 0
  const next = () => ({
    initial: { opacity: 0, y: -6 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { delay: 0.05 * line++ },
  })
  return (
    <div>
      <motion.div
        className="receipt"
        initial={{ clipPath: 'inset(0 0 100% 0)' }}
        whileInView={{ clipPath: 'inset(0 0 0% 0)' }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1] }}
      >
        <h4>IMPORT RECEIPT</h4>
        <div style={{ textAlign: 'center', color: 'var(--ink-3)' }}>{label}</div>
        <div style={{ textAlign: 'center', color: 'var(--ink-3)' }}>snapshot {snapshot}</div>
        {rows.map((row) => (
          <div key={row.file}>
            <div className="rule" />
            <motion.div {...next()} style={{ fontWeight: 600, marginBottom: 4 }}>
              {row.file}
            </motion.div>
            {LINES.map(({ key, label }) => (
              <motion.div key={key} className="receipt-row" {...next()}>
                <span>{label}</span>
                <span>{integer(row[key] as number)}</span>
              </motion.div>
            ))}
          </div>
        ))}
        <div className="rule" />
        <div className="receipt-row">
          <span>IDs · relationships · timestamps · statuses · cents</span>
          <span>PASS</span>
        </div>
        <motion.div
          className="stamp ok"
          initial={{ scale: 2.2, opacity: 0, rotate: -20 }}
          whileInView={{ scale: 1, opacity: 0.85, rotate: -9 }}
          viewport={{ once: true }}
          transition={{ delay: 1.2, type: 'spring', stiffness: 400, damping: 18 }}
        >
          VALIDATED
        </motion.div>
      </motion.div>
      <div style={{ marginTop: 26, display: 'flex', gap: 8 }}>
        <a className="btn small" href={receiptUrl} download>
          <Icon name="download" size={14} />
          Import receipt CSV
        </a>
      </div>
    </div>
  )
}

export function ImportFailed({ failure, onDemo }: { failure: ImportFailure; onDemo: () => void }) {
  const shown = failure.issues.length
  return (
    <section className="section">
      <div className="shell">
        <Panel className="failure">
          <div className="label" style={{ color: 'var(--c-coral)' }}>
            Import paused · no metrics shown
          </div>
          <h2 style={{ marginTop: 14 }}>
            {integer(failure.issue_count)} {failure.issue_count === 1 ? 'issue needs' : 'issues need'} <em>fixing</em>
          </h2>
          <p className="section-lede">
            Nothing from these files was loaded. Correct the source export and upload the full bundle again.
            {failure.issue_count > shown && ` Showing the first ${shown} issues.`} Row numbers count CSV records
            with the header as row 1; quoted multi-line values may differ from text-editor lines.
          </p>
          <div className="issue-list">
            {failure.issues.map((issue, i) => (
              <motion.div
                key={i}
                className="issue"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 10) * 0.05 }}
              >
                <div className="where">
                  {issue.file}
                  {issue.row != null && ` · row ${issue.row}`}
                  {issue.column && (
                    <>
                      <br />
                      {issue.column}
                    </>
                  )}
                  <br />
                  <span style={{ color: 'var(--c-coral)' }}>{issue.code}</span>
                </div>
                <div>
                  <div>{issue.issue}</div>
                  <div className="repair">{issue.repair}</div>
                </div>
              </motion.div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn primary" type="button" onClick={onDemo}>
              <Icon name="reset" />
              Return to the synthetic demo
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => download('import-issues.csv', csvFromRows(failure.issues as unknown as Record<string, unknown>[]))}
            >
              <Icon name="download" />
              Download issue report
            </button>
          </div>
        </Panel>
      </div>
    </section>
  )
}
