import { AnimatePresence, motion, MotionConfig, useScroll, useSpring } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Attention } from './components/Attention'
import { Current } from './components/Current'
import { Dispatch } from './components/Dispatch'
import { Dock } from './components/Dock'
import { Drawer } from './components/Drawer'
import { Import, ImportFailed, Receipt } from './components/Import'
import { Hero, Kpis } from './components/Overview'
import { Palette, type Command } from './components/Palette'
import { Records } from './components/Records'
import { Sources } from './components/Sources'
import { Tide } from './components/Tide'
import { BrandMark, Icon, Reveal, SectionHead } from './components/ui'
import { api, type Filters, type ImportFailure, type Meta } from './lib/api'
import { useResource } from './lib/useResource'
import { burst, revealTheme } from './lib/effects'
import { formatDateTime } from './lib/format'

type Theme = 'night' | 'day'

const defaults = (meta: Meta): Filters => ({
  start: meta.first_date!,
  end: meta.last_date!,
  sources: meta.sources,
  services: meta.services,
})

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme) ?? 'day')
  const [dataset, setDataset] = useState<string | null>('demo')
  const [revision, setRevision] = useState(0)
  const [chosenFilters, setFilters] = useState<Filters | null>(null)
  const [failure, setFailure] = useState<ImportFailure | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [palette, setPalette] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const themeButton = useRef<HTMLButtonElement>(null)
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 30 })

  const loadMeta = useCallback((signal: AbortSignal) => api.meta(dataset!, signal), [dataset])
  const metadata = useResource(dataset ? `${dataset}:${revision}` : null, loadMeta)
  const meta = metadata.value
  const filters = useMemo(() => chosenFilters ?? (meta?.first_date ? defaults(meta) : null), [chosenFilters, meta])
  const loadView = useCallback(
    (signal: AbortSignal) => api.view(dataset!, filters!, signal).then((data) => ({ data, filters: filters! })),
    [dataset, filters],
  )
  const result = useResource(
    dataset && filters && meta ? `${dataset}:${revision}:${JSON.stringify(filters)}` : null,
    loadView,
  )
  const displayed =
    result.value ?? (result.previous?.key.startsWith(`${dataset}:${revision}:`) ? result.previous.value : null)
  const view = displayed?.data ?? null
  const displayFilters = displayed?.filters ?? filters
  const error = metadata.error ?? result.error
  const loading = metadata.loading || result.loading

  const openDataset = useCallback((id: string | null) => {
    setDataset(id)
    setRevision((value) => value + 1)
    setFilters(null)
    setSelected(null)
    setFailure(null)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof Element && event.target.closest('input, textarea, select')
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSelected(null)
        setPalette((open) => !open)
      } else if (event.key === '/' && !typing) {
        event.preventDefault()
        setSelected(null)
        setPalette(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'night' ? 'day' : 'night'
    revealTheme(themeButton.current, () => {
      document.documentElement.dataset.theme = next
      try {
        localStorage.setItem('leadflow-theme-v2', next)
      } catch {
        /* storage unavailable */
      }
      setTheme(next)
    })
  }, [theme])

  const solo = useCallback(
    (source: string) => {
      if (!filters || !meta) return
      const only = filters.sources.length === 1 && filters.sources[0] === source
      setFilters({ ...filters, sources: only ? meta.sources : [source] })
    },
    [filters, meta],
  )

  const returnToDemo = useCallback(() => {
    openDataset('demo')
  }, [openDataset])

  const upload = async (files: Record<string, File>, snapshot: string, origin: DOMRect | null) => {
    setBusy(true)
    try {
      const result = await api.upload(files, snapshot)
      if (result.ok) {
        openDataset(result.id)
        burst(origin)
        setToast('Validated and imported. The dashboard now shows your files.')
      } else {
        openDataset(null)
        setFailure(result.failure)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch (reason) {
      openDataset(null)
      setFailure({
        issue_count: 1,
        issues: [
          {
            file: 'Upload',
            row: null,
            column: '',
            code: 'upload_failed',
            issue: (reason as Error).message,
            repair: 'Check the connection and file sizes, then try the complete bundle again.',
          },
        ],
      })
    } finally {
      setBusy(false)
    }
  }

  const closeDrawer = useCallback(() => setSelected(null), [])
  const closePalette = useCallback(() => setPalette(false), [])

  const url = (kind: string) => (dataset && displayFilters ? api.exportUrl(dataset, kind, displayFilters) : '#')

  const commands = useMemo<Command[]>(() => {
    const download = (kind: string) => () => {
      if (dataset && displayFilters) window.open(api.exportUrl(dataset, kind, displayFilters), '_self')
    }
    const jump = (id: string, label: string, hint?: string): Command => ({
      id: `go-${id}`,
      group: 'Go to',
      label,
      hint,
      run: () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }),
    })
    return [
      jump('top', 'Overview', 'KPIs and conversion'),
      jump('current', 'The current', 'Every inquiry, source to outcome'),
      jump('tide', 'Tide chart', 'Choose dates'),
      jump('sources', 'Lead sources'),
      jump('attention', 'Needs attention', 'Unanswered and cancelled'),
      jump('records', 'Records'),
      jump('brief', 'Weekly dispatch'),
      jump('intake', 'Data intake', 'Upload or inspect the receipt'),
      {
        id: 'theme',
        group: 'Actions',
        label: `Switch to ${theme === 'night' ? 'light' : 'dark'} theme`,
        run: toggleTheme,
      },
      {
        id: 'reset',
        group: 'Actions',
        label: 'Reset all filters',
        run: () => meta?.first_date && setFilters(defaults(meta)),
      },
      { id: 'demo', group: 'Actions', label: 'Open the sample workspace', run: returnToDemo },
      {
        id: 'dl-brief',
        group: 'Downloads',
        label: 'Download weekly brief',
        hint: '.md',
        run: download('weekly-brief.md'),
      },
      {
        id: 'dl-follow',
        group: 'Downloads',
        label: 'Download follow-up list',
        hint: '.csv',
        run: download('follow-up.csv'),
      },
    ]
  }, [theme, toggleTheme, meta, returnToDemo, dataset, displayFilters])

  const ready = meta && displayFilters && filters && view && dataset && !error
  const empty = meta?.inquiries === 0 && !error

  return (
    <MotionConfig reducedMotion="user">
      <div className="atmosphere" aria-hidden="true">
        <div className="aurora" />
        <div className="chart-grid" />
        <div className="grain" />
      </div>
      <AnimatePresence>
        {loading && (
          <motion.div
            className="loading-bar"
            initial={{ width: '0%', opacity: 1 }}
            animate={{ width: '80%' }}
            exit={{ width: '100%', opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        )}
      </AnimatePresence>
      <header className="topbar">
        <div className="shell topbar-inner">
          <a className="brand" href="#top" aria-label="Leadflow, back to top">
            <BrandMark />
            <span className="brand-word">Leadflow</span>
          </a>
          <div className="topbar-meta">
            {meta && (
              <span className={`badge ${meta.sample ? '' : 'live'}`}>
                <span className="dot" />
                {meta.sample ? 'Sample workspace' : 'Your files · in memory'}
              </span>
            )}
            {meta && <span className="badge hide-sm">Outcomes through {formatDateTime(meta.snapshot)}</span>}
            <button className="kbd-btn hide-sm" type="button" onClick={() => setPalette(true)}>
              Search <kbd>⌘K</kbd>
            </button>
            <button
              ref={themeButton}
              className="icon-btn"
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'night' ? 'light' : 'dark'} theme`}
            >
              <Icon name={theme === 'night' ? 'sun' : 'moon'} size={17} />
            </button>
          </div>
        </div>
        <motion.div className="scroll-progress" style={{ scaleX: progress }} aria-hidden="true" />
      </header>

      <main aria-busy={loading}>
        {failure && <ImportFailed failure={failure} onDemo={returnToDemo} />}
        {error && !failure && (
          <section className="section">
            <div className="shell empty">
              <h3>Something interrupted the connection</h3>
              <p>{error}</p>
              <button className="btn primary" type="button" onClick={returnToDemo}>
                Open the sample workspace
              </button>
            </div>
          </section>
        )}
        {!ready && !empty && !failure && !error && (
          <div className="empty" style={{ minHeight: '70vh' }}>
            <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}>
              <BrandMark size={56} />
            </motion.div>
            <p className="label">Reading the tide…</p>
          </div>
        )}
        {empty && (
          <section className="section">
            <div className="shell empty">
              <h3>The files are valid but contain no inquiries</h3>
              <p>Add records to see metrics, or explore the sample workspace.</p>
              <button className="btn primary" type="button" onClick={returnToDemo}>
                Open the sample workspace
              </button>
            </div>
          </section>
        )}
        {ready && (
          <>
            <Hero meta={meta} metrics={view.metrics} onPalette={() => setPalette(true)} />
            <Kpis metrics={view.metrics} days={view.timeline} start={displayFilters!.start} end={displayFilters!.end} />

            <section className="section" id="current">
              <div className="shell">
                <SectionHead
                  index="01"
                  title={
                    <>
                      The <em>current</em>
                    </>
                  }
                  lede="Every dot is one inquiry, flowing from its lead source through first response and booking to the furthest outcome it reached. Hover a dot to identify it, click it to open the record, or click a source to focus on it."
                />
                <Reveal>
                  <Current
                    flow={view.flow}
                    inquiries={view.inquiries}
                    theme={theme}
                    activeSources={displayFilters!.sources}
                    allSources={meta.sources}
                    onSelect={setSelected}
                    onSolo={solo}
                  />
                </Reveal>
              </div>
            </section>

            <section className="section" id="tide">
              <div className="shell">
                <SectionHead
                  index="02"
                  title={
                    <>
                      The <em>tide</em> chart
                    </>
                  }
                  lede="Inquiries arriving each day across the whole period. Drag across the chart, or move the handles, to choose which inquiry cohort the dashboard describes."
                />
                <Reveal>
                  <Tide
                    timeline={view.timeline}
                    firstDate={meta.first_date!}
                    lastDate={meta.last_date!}
                    start={displayFilters!.start}
                    end={displayFilters!.end}
                    onChange={(start, end) => setFilters((current) => ({ ...(current ?? defaults(meta)), start, end }))}
                  />
                </Reveal>
              </div>
            </section>

            <section className="section" id="sources">
              <div className="shell">
                <SectionHead
                  index="03"
                  title={
                    <>
                      Where the good leads <em>come from</em>
                    </>
                  }
                  lede="Each source's inquiries, conversion, response speed, and completed work, attributed to the original inquiry. Click a source to focus the whole dashboard on it."
                />
                <Reveal>
                  <Sources
                    rows={view.sources}
                    exportUrl={url('source-metrics.csv')}
                    onSolo={solo}
                    activeSources={displayFilters!.sources}
                  />
                </Reveal>
              </div>
            </section>

            <section className="section" id="attention">
              <div className="shell">
                <SectionHead
                  index="04"
                  title={
                    <>
                      Signals that <em>need a hand</em>
                    </>
                  }
                  lede="Leads still waiting for a first reply, and bookings that were cancelled or missed. Click any row to see the full history."
                />
                <Reveal>
                  <Attention
                    queue={view.attention}
                    failed={view.failed_bookings}
                    followUpUrl={url('follow-up.csv')}
                    outcomesUrl={url('booking-outcomes.csv')}
                    onSelect={setSelected}
                  />
                </Reveal>
              </div>
            </section>

            <section className="section" id="records">
              <div className="shell">
                <SectionHead
                  index="05"
                  title={
                    <>
                      Every <em>record</em>, traceable
                    </>
                  }
                  lede="Each number above traces back to these rows. Open one to see its inquiry, response, every booking, and any completed job."
                />
                <Reveal>
                  <Records rows={view.inquiries} exportUrl={url('inquiries.csv')} onSelect={setSelected} />
                </Reveal>
              </div>
            </section>

            <section className="section" id="brief">
              <div className="shell">
                <SectionHead
                  index="06"
                  title={
                    <>
                      The weekly <em>dispatch</em>
                    </>
                  }
                  lede="A one-page summary of the last full week for the Monday check-in, with one rule-based next step."
                />
                <Dispatch brief={view.brief} sample={meta.sample} url={url('weekly-brief.md')} />
              </div>
            </section>

            <section className="section" id="intake">
              <div className="shell">
                <SectionHead
                  index="07"
                  title={
                    <>
                      Data <em>intake</em>
                    </>
                  }
                  lede="How the current files were accepted, and where to bring new ones. Strict contracts stop an import rather than guessing."
                />
                <div className="import-grid">
                  <Import enabled={meta.uploads_enabled} busy={busy} onSubmit={upload} />
                  <Receipt
                    rows={meta.import_receipt}
                    label={meta.label}
                    snapshot={formatDateTime(meta.snapshot)}
                    receiptUrl={url('import-receipt.csv')}
                  />
                </div>
              </div>
            </section>
          </>
        )}
        {(failure || empty) && (
          <section className="section" id="intake">
            <div className="shell">
              <Import enabled={meta?.uploads_enabled ?? true} busy={busy} onSubmit={upload} />
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <div className="shell">
          <div className="footer-grid">
            <div>
              <h5 className="label">About Leadflow</h5>
              <p>
                Lead-to-booking analytics for home-service businesses. Bring three everyday exports and see which leads
                are waiting, where bookings fall through, and which sources turn into finished work.
              </p>
              <p>Python and DuckDB SQL compute every number. Files stay on your computer. Built by Hasnain Shahzad.</p>
            </div>
            <div>
              <h5 className="label">Definitions that matter</h5>
              <dl>
                <dt>Inquiry cohort</dt>
                <dd>Dates select when inquiries arrived. Their outcomes count through the snapshot.</dd>
                <dt>One row per inquiry</dt>
                <dd>Repeat bookings never double-count a lead or its response time.</dd>
              </dl>
            </div>
            <div>
              <h5 className="label">What the numbers don’t say</h5>
              <dl>
                <dt>No empty-slot inference</dt>
                <dd>A cancellation is not proof an appointment went unfilled.</dd>
                <dt>No financial uplift</dt>
                <dd>Job value is not profit, cash collected, or return on ad spend.</dd>
              </dl>
            </div>
          </div>
          <div className="footer-word" aria-hidden="true">
            Leadflow
          </div>
        </div>
      </footer>

      {ready && (
        <Dock
          meta={meta}
          filters={filters}
          count={view.metrics.inquiries}
          loading={loading}
          onChange={setFilters}
          onReset={() => setFilters(defaults(meta))}
        />
      )}
      {dataset && <Drawer dataset={dataset} inquiryId={selected} onClose={closeDrawer} />}
      <Palette
        key={String(palette)}
        open={palette}
        onClose={closePalette}
        commands={commands}
        inquiries={view?.inquiries ?? []}
        onSelect={setSelected}
      />
      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            role="status"
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 10, x: '-50%' }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  )
}
