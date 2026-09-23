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
import { api, type Filters, type ImportFailure, type Meta, type View } from './lib/api'
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
  const [meta, setMeta] = useState<Meta | null>(null)
  const [filters, setFilters] = useState<Filters | null>(null)
  const [view, setView] = useState<View | null>(null)
  const [loading, setLoading] = useState(false)
  const [failure, setFailure] = useState<ImportFailure | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [palette, setPalette] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const themeButton = useRef<HTMLButtonElement>(null)
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 30 })

  useEffect(() => {
    if (!dataset) return
    let live = true
    setMeta(null)
    setView(null)
    setFilters(null)
    api
      .meta(dataset)
      .then((value) => {
        if (!live) return
        setMeta(value)
        setFilters(value.first_date ? defaults(value) : null)
      })
      .catch((reason) => live && setError(reason.message))
    return () => {
      live = false
    }
  }, [dataset])

  useEffect(() => {
    if (!dataset || !filters) return
    const controller = new AbortController()
    setLoading(true)
    api
      .view(dataset, filters, controller.signal)
      .then((value) => {
        setView(value)
        setLoading(false)
      })
      .catch((reason) => {
        if (reason.name === 'AbortError') return
        setError(reason.message)
        setLoading(false)
      })
    return () => controller.abort()
  }, [dataset, filters])

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
        setPalette((open) => !open)
      } else if (event.key === '/' && !typing) {
        event.preventDefault()
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
    setFailure(null)
    setError(null)
    setDataset('demo')
  }, [])

  const upload = async (files: Record<string, File>, snapshot: string, origin: DOMRect | null) => {
    setBusy(true)
    try {
      const result = await api.upload(files, snapshot)
      if (result.ok) {
        setFailure(null)
        setDataset(result.id)
        burst(origin)
        setToast('Validated and imported. The dashboard now shows your files.')
      } else {
        setDataset(null)
        setMeta(null)
        setView(null)
        setFailure(result.failure)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch (reason) {
      setToast((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const closeDrawer = useCallback(() => setSelected(null), [])

  const url = (kind: string) => (dataset && filters ? api.exportUrl(dataset, kind, filters) : '#')

  const commands = useMemo<Command[]>(() => {
    const download = (kind: string) => () => {
      if (dataset && filters) window.open(api.exportUrl(dataset, kind, filters), '_self')
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
      { id: 'theme', group: 'Actions', label: `Switch to ${theme === 'night' ? 'light' : 'dark'} theme`, run: toggleTheme },
      {
        id: 'reset',
        group: 'Actions',
        label: 'Reset all filters',
        run: () => meta && setFilters(defaults(meta)),
      },
      { id: 'demo', group: 'Actions', label: 'Return to the synthetic demo', run: returnToDemo },
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
  }, [theme, toggleTheme, meta, returnToDemo, dataset, filters])

  const ready = meta && filters && view && dataset

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
              <span className={`badge ${meta.synthetic ? '' : 'live'}`}>
                <span className="dot" />
                {meta.synthetic ? 'Synthetic demo' : 'Uploaded · in memory'}
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

      <main>
        {failure && <ImportFailed failure={failure} onDemo={returnToDemo} />}
        {error && !failure && (
          <section className="section">
            <div className="shell empty">
              <h3>Something interrupted the connection</h3>
              <p>{error}</p>
              <button className="btn primary" type="button" onClick={returnToDemo}>
                Return to the synthetic demo
              </button>
            </div>
          </section>
        )}
        {!ready && !failure && !error && (
          <div className="empty" style={{ minHeight: '70vh' }}>
            <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}>
              <BrandMark size={56} />
            </motion.div>
            <p className="label">Reading the tide…</p>
          </div>
        )}
        {ready && meta.inquiries === 0 && (
          <section className="section">
            <div className="shell empty">
              <h3>The files are valid but contain no inquiries</h3>
              <p>Add records to see metrics.</p>
            </div>
          </section>
        )}
        {ready && (
          <>
            <Hero meta={meta} metrics={view.metrics} onPalette={() => setPalette(true)} />
            <Kpis metrics={view.metrics} days={view.timeline} start={filters.start} end={filters.end} />

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
                    activeSources={filters.sources}
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
                    start={filters.start}
                    end={filters.end}
                    onChange={(start, end) => setFilters({ ...filters, start, end })}
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
                  <Sources rows={view.sources} exportUrl={url('source-metrics.csv')} onSolo={solo} activeSources={filters.sources} />
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
                <Dispatch brief={view.brief} synthetic={meta.synthetic} url={url('weekly-brief.md')} />
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
        {failure && (
          <section className="section" id="intake">
            <div className="shell">
              <Import enabled busy={busy} onSubmit={upload} />
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <div className="shell">
          <div className="footer-grid">
            <div>
              <h5 className="label">About this project</h5>
              <p>
                Leadflow is a portfolio project by Hasnain Shahzad. Harbor Home Services is fictional and every
                included record is synthetic; no real business outcomes are claimed.
              </p>
              <p>
                Python and DuckDB SQL compute every number. This interface only displays what the local service
                returns.
              </p>
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
              <h5 className="label">What is not claimed</h5>
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
          onChange={setFilters}
          onReset={() => setFilters(defaults(meta))}
        />
      )}
      {dataset && <Drawer dataset={dataset} inquiryId={selected} onClose={closeDrawer} />}
      <Palette
        open={palette}
        onClose={() => setPalette(false)}
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
