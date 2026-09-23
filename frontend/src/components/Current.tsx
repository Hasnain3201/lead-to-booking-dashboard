import { sankey, sankeyLeft, sankeyLinkHorizontal, type SankeyLink, type SankeyNode } from 'd3-sankey'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FlowRow, InquiryLite } from '../lib/api'
import { integer, OUTCOME_LABELS, prefersReducedMotion, serviceLabel, SOURCE_COLORS, sourceLabel } from '../lib/format'
import { Icon } from './ui'

interface NodeDatum {
  id: string
  label: string
  color: string
  order: number
}
interface LinkDatum {
  source: string
  target: string
  value: number
}
type SNode = SankeyNode<NodeDatum, LinkDatum>
type SLink = SankeyLink<NodeDatum, LinkDatum>

const STAGES: Omit<NodeDatum, 'order'>[] = [
  { id: 'resp:yes', label: 'First response recorded', color: 'var(--c-tide)' },
  { id: 'resp:no', label: 'No response recorded', color: 'var(--c-coral)' },
  { id: 'book:yes', label: 'Booked', color: 'var(--c-sky)' },
  { id: 'book:no', label: 'Never booked', color: 'var(--c-slate)' },
  { id: 'out:completed', label: OUTCOME_LABELS.completed, color: 'var(--c-tide)' },
  { id: 'out:scheduled', label: OUTCOME_LABELS.scheduled, color: 'var(--c-lilac)' },
  { id: 'out:lost', label: OUTCOME_LABELS.lost, color: 'var(--c-coral)' },
]

function pathNodes(source: string, responded: boolean, outcome: string) {
  const nodes = [`src:${source}`, responded ? 'resp:yes' : 'resp:no']
  if (outcome === 'unbooked') return [...nodes, 'book:no']
  return [...nodes, 'book:yes', `out:${outcome}`]
}

function buildGraph(flow: FlowRow[]) {
  const bySource = new Map<string, number>()
  const links = new Map<string, LinkDatum>()
  for (const row of flow) {
    bySource.set(row.source, (bySource.get(row.source) ?? 0) + row.inquiries)
    const nodes = pathNodes(row.source, row.responded, row.outcome)
    for (let i = 0; i < nodes.length - 1; i++) {
      const key = `${nodes[i]}>${nodes[i + 1]}`
      const link = links.get(key) ?? { source: nodes[i], target: nodes[i + 1], value: 0 }
      link.value += row.inquiries
      links.set(key, link)
    }
  }
  const sources = [...bySource.entries()].sort((a, b) => b[1] - a[1]).map(([source]) => source)
  const used = new Set([...links.values()].flatMap((link) => [link.source, link.target]))
  const nodes: NodeDatum[] = [
    ...sources.map((source) => ({
      id: `src:${source}`,
      label: sourceLabel(source),
      color: SOURCE_COLORS[source] ?? 'var(--c-slate)',
    })),
    ...STAGES,
  ]
    .filter((node) => used.has(node.id))
    .map((node, order) => ({ ...node, order }))
  return { nodes, links: [...links.values()], total: [...bySource.values()].reduce((a, b) => a + b, 0) }
}

function seeded(id: string) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

function cssColor(value: string) {
  const match = value.match(/var\((--[\w-]+)\)/)
  return match ? getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim() : value
}

interface Particle {
  id: string
  source: string
  color: string
  links: SLink[]
  nodes: string[]
  u: number
  duration: number
  phase: number
  size: number
  drift: boolean
}

const CYCLE = 3.9
const LINK_SHARE = 0.9

function linkPoint(link: SLink, u: number, t: number): [number, number] {
  const source = link.source as SNode
  const target = link.target as SNode
  const x0 = source.x1!
  const x3 = target.x0!
  const xm = (x0 + x3) / 2
  const y0 = link.y0! + u * link.width!
  const y1 = link.y1! + u * link.width!
  const mt = 1 - t
  const a = mt * mt * mt
  const b = 3 * mt * mt * t
  const c = 3 * mt * t * t
  const d = t * t * t
  return [a * x0 + (b + c) * xm + d * x3, (a + b) * y0 + (c + d) * y1]
}

/** Position and opacity of a particle at a given time, or null when it is between cycles. */
function locate(p: Particle, time: number): [number, number, number] | null {
  const local = (time / p.duration + p.phase * CYCLE) % CYCLE
  const journey = p.links.length - (1 - LINK_SHARE)
  const fadeIn = Math.min(1, local / 0.12)
  if (local < journey) {
    const seg = Math.floor(local)
    const within = local - seg
    const link = p.links[seg]
    if (within < LINK_SHARE) {
      const [x, y] = linkPoint(link, p.u, within / LINK_SHARE)
      return [x, y, fadeIn]
    }
    const next = p.links[seg + 1]
    const [ax, ay] = linkPoint(link, p.u, 1)
    const [bx, by] = linkPoint(next, p.u, 0)
    const k = (within - LINK_SHARE) / (1 - LINK_SHARE)
    return [ax + (bx - ax) * k, ay + (by - ay) * k, 1]
  }
  const tail = (local - journey) / 0.75
  if (tail >= 1) return null
  const last = p.links[p.links.length - 1]
  const [x, y] = linkPoint(last, p.u, 1)
  const node = last.target as SNode
  if (p.drift) return [x + tail * 60, y + tail * tail * 46, (1 - tail) * 0.85]
  return [x + tail * (node.x1! - node.x0! + 4), y, 1 - tail]
}

export function Current({
  flow,
  inquiries,
  theme,
  activeSources,
  allSources,
  onSelect,
  onSolo,
}: {
  flow: FlowRow[]
  inquiries: InquiryLite[]
  theme: string
  activeSources: string[]
  allSources: string[]
  onSelect: (id: string) => void
  onSolo: (source: string) => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [hoverNode, setHoverNode] = useState<string | null>(null)
  const [tip, setTip] = useState<{ x: number; y: number; row: InquiryLite } | null>(null)
  const [paused, setPaused] = useState(prefersReducedMotion)
  const hoverRef = useRef<{ node: string | null; particle: number }>({ node: null, particle: -1 })
  const positions = useRef<Float32Array>(new Float32Array(0))

  useEffect(() => {
    const stage = stageRef.current!
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) })
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  const graph = useMemo(() => buildGraph(flow), [flow])

  const layout = useMemo(() => {
    if (!size.width || !graph.links.length) return null
    const narrow = size.width < 640
    const generator = sankey<NodeDatum, LinkDatum>()
      .nodeId((node) => node.id)
      .nodeAlign(sankeyLeft)
      .nodeWidth(narrow ? 8 : 12)
      .nodePadding(narrow ? 14 : 20)
      .nodeSort((a, b) => a.order - b.order)
      .extent([
        [1, 10],
        [size.width - 1, size.height - 10],
      ])
    return generator({
      nodes: graph.nodes.map((node) => ({ ...node })),
      links: graph.links.map((link) => ({ ...link })),
    })
  }, [graph, size])

  const particles = useMemo<Particle[]>(() => {
    if (!layout) return []
    const linkMap = new Map<string, SLink>()
    for (const link of layout.links) {
      linkMap.set(`${(link.source as SNode).id}>${(link.target as SNode).id}`, link)
    }
    return inquiries.map((row) => {
      const random = seeded(row.inquiry_id)
      const nodes = pathNodes(row.source, row.responded, row.outcome)
      const links = nodes.slice(1).map((node, i) => linkMap.get(`${nodes[i]}>${node}`)!)
      return {
        id: row.inquiry_id,
        source: row.source,
        color: SOURCE_COLORS[row.source] ?? 'var(--c-slate)',
        links,
        nodes,
        u: (random() - 0.5) * 0.86,
        duration: 2.6 + random() * 1.6,
        phase: random(),
        size: 1.3 + random() * 1.4,
        drift: row.outcome === 'unbooked',
      }
    })
  }, [layout, inquiries])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !layout) return
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size.width * dpr
    canvas.height = size.height * dpr
    const colors = new Map<string, string>()
    for (const p of particles) if (!colors.has(p.color)) colors.set(p.color, cssColor(p.color))
    const night = theme === 'night'
    positions.current = new Float32Array(particles.length * 3)
    let visible = true
    let frame = 0
    const observer = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting))
    observer.observe(canvas)

    const draw = (time: number, trails: boolean) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (trails) {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.fillStyle = 'rgba(0,0,0,0.3)'
        ctx.fillRect(0, 0, size.width, size.height)
      } else {
        ctx.clearRect(0, 0, size.width, size.height)
      }
      ctx.globalCompositeOperation = night ? 'lighter' : 'source-over'
      const { node, particle } = hoverRef.current
      const store = positions.current
      particles.forEach((p, i) => {
        const at = locate(p, time)
        if (!at) {
          store[i * 3 + 2] = 0
          return
        }
        const [x, y, alpha] = at
        const dim = node && !p.nodes.includes(node) ? 0.07 : 1
        store[i * 3] = x
        store[i * 3 + 1] = y
        store[i * 3 + 2] = alpha * dim
        ctx.globalAlpha = alpha * dim * (night ? 0.95 : 0.85)
        ctx.fillStyle = colors.get(p.color)!
        ctx.beginPath()
        ctx.arc(x, y, i === particle ? p.size + 2.5 : p.size, 0, Math.PI * 2)
        ctx.fill()
        if (i === particle) {
          ctx.globalAlpha = 1
          ctx.strokeStyle = colors.get(p.color)!
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(x, y, p.size + 7, 0, Math.PI * 2)
          ctx.stroke()
        }
      })
      ctx.globalAlpha = 1
    }

    if (paused) {
      draw(0, false)
      const redraw = () => draw(0, false)
      canvas.addEventListener('redraw', redraw)
      return () => {
        observer.disconnect()
        canvas.removeEventListener('redraw', redraw)
      }
    }
    const loop = (now: number) => {
      if (visible && !document.hidden) draw(now / 1000, true)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [layout, particles, size, theme, paused])

  const requestRedraw = () => canvasRef.current?.dispatchEvent(new Event('redraw'))

  const setNodeHover = (node: string | null) => {
    hoverRef.current.node = node
    setHoverNode(node)
    requestRedraw()
  }

  const byId = useMemo(() => new Map(inquiries.map((row) => [row.inquiry_id, row])), [inquiries])

  const onPointerMove = (event: React.PointerEvent) => {
    const rect = stageRef.current!.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const store = positions.current
    let best = -1
    let bestDistance = 12 * 12
    for (let i = 0; i < particles.length; i++) {
      if (store[i * 3 + 2] < 0.3) continue
      const dx = store[i * 3] - x
      const dy = store[i * 3 + 1] - y
      const distance = dx * dx + dy * dy
      if (distance < bestDistance) {
        bestDistance = distance
        best = i
      }
    }
    hoverRef.current.particle = best
    requestRedraw()
    const row = best >= 0 ? byId.get(particles[best].id) : undefined
    setTip(row ? { x, y, row } : null)
  }

  const onPointerLeave = () => {
    hoverRef.current.particle = -1
    setTip(null)
    requestRedraw()
  }

  const onClick = () => {
    const index = hoverRef.current.particle
    if (index >= 0) onSelect(particles[index].id)
  }

  const totals = useMemo(() => {
    const sum = (outcome: string) =>
      flow.filter((row) => row.outcome === outcome).reduce((total, row) => total + row.inquiries, 0)
    return { completed: sum('completed'), scheduled: sum('scheduled'), lost: sum('lost'), unbooked: sum('unbooked') }
  }, [flow])

  const connected = (link: SLink) => {
    if (!hoverNode) return true
    const source = (link.source as SNode).id
    const target = (link.target as SNode).id
    return source === hoverNode || target === hoverNode
  }

  const solo = activeSources.length === 1
  const linkPath = sankeyLinkHorizontal()

  return (
    <div className="current panel">
      <p className="section-lede" style={{ marginTop: 0, maxWidth: 'none', fontSize: 16 }}>
        Of <b className="num">{integer(graph.total)}</b> inquiries,{' '}
        <b className="num" style={{ color: 'var(--c-tide)' }}>{integer(totals.completed)}</b> reached a completed job,{' '}
        <b className="num" style={{ color: 'var(--c-lilac)' }}>{integer(totals.scheduled)}</b> are still scheduled,{' '}
        <b className="num" style={{ color: 'var(--c-coral)' }}>{integer(totals.lost)}</b> fell through after booking, and{' '}
        <b className="num">{integer(totals.unbooked)}</b> never booked.
      </p>
      <div className="current-scroll">
      <div className="stage-heads label" aria-hidden="true" style={{ marginTop: 18 }}>
        <span>Lead source</span>
        <span>First response</span>
        <span>Booking</span>
        <span>Furthest outcome</span>
      </div>
      <div
        className="current-stage"
        ref={stageRef}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onClick={onClick}
        style={{ cursor: tip ? 'pointer' : 'default' }}
      >
        {!layout && graph.links.length === 0 && (
          <div className="empty">
            <h3>No inquiries in this view</h3>
            <p>Widen the date range or turn a source back on.</p>
          </div>
        )}
        {layout && (
          <>
            <svg viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true">
              <defs>
                {layout.links.map((link, i) => (
                  <linearGradient
                    key={i}
                    id={`lg-${i}`}
                    gradientUnits="userSpaceOnUse"
                    x1={(link.source as SNode).x1}
                    x2={(link.target as SNode).x0}
                  >
                    <stop offset="0%" style={{ stopColor: (link.source as SNode).color }} />
                    <stop offset="100%" style={{ stopColor: (link.target as SNode).color }} />
                  </linearGradient>
                ))}
              </defs>
              {layout.links.map((link, i) => (
                <path
                  key={i}
                  d={linkPath(link) ?? undefined}
                  fill="none"
                  stroke={`url(#lg-${i})`}
                  strokeWidth={Math.max(1, link.width ?? 1)}
                  style={{
                    opacity: connected(link) ? (hoverNode ? 0.32 : 'var(--link-opacity)') : 0.03,
                    transition: 'opacity .35s',
                  }}
                />
              ))}
            </svg>
            <canvas ref={canvasRef} style={{ pointerEvents: 'none' }} />
            <svg viewBox={`0 0 ${size.width} ${size.height}`} style={{ pointerEvents: 'none' }}>
              {layout.nodes.map((node) => {
                const isSource = node.id.startsWith('src:')
                const source = node.id.slice(4)
                const right = (node.depth ?? 0) < 3
                const height = Math.max(2, node.y1! - node.y0!)
                const faded = isSource && !activeSources.includes(source)
                const labelX = right ? node.x1! + 10 : node.x0! - 10
                const midY = (node.y0! + node.y1!) / 2
                return (
                  <g
                    key={node.id}
                    style={{ pointerEvents: 'all', cursor: isSource ? 'pointer' : 'default' }}
                    onPointerEnter={() => setNodeHover(node.id)}
                    onPointerLeave={() => setNodeHover(null)}
                    onFocus={() => setNodeHover(node.id)}
                    onBlur={() => setNodeHover(null)}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (isSource) onSolo(source)
                    }}
                    onKeyDown={(event) => {
                      if (isSource && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault()
                        onSolo(source)
                      }
                    }}
                    tabIndex={isSource ? 0 : -1}
                    role={isSource ? 'button' : undefined}
                    aria-label={
                      isSource
                        ? `${node.label}: ${node.value} inquiries. ${solo && activeSources[0] === source ? 'Show all sources' : 'Focus on this source'}.`
                        : undefined
                    }
                  >
                    <rect
                      x={node.x0! - 6}
                      y={node.y0! - 4}
                      width={node.x1! - node.x0! + 12}
                      height={height + 8}
                      fill="transparent"
                    />
                    <rect
                      x={node.x0}
                      y={node.y0}
                      width={node.x1! - node.x0!}
                      height={height}
                      rx={3}
                      style={{
                        fill: node.color,
                        filter: `drop-shadow(0 0 ${hoverNode === node.id ? 'calc(var(--glow) + 6px)' : 'var(--glow)'} ${node.color})`,
                        opacity: faded ? 0.3 : 1,
                        transition: 'filter .3s, opacity .3s',
                      }}
                    />
                    <text
                      className="node-label"
                      x={labelX}
                      y={midY - (height > 26 ? 6 : 0)}
                      dominantBaseline="middle"
                      textAnchor={right ? 'start' : 'end'}
                      style={{ paintOrder: 'stroke', stroke: 'var(--bg)', strokeWidth: 4, strokeLinejoin: 'round' }}
                    >
                      {node.label}
                    </text>
                    {height > 26 && (
                      <text
                        className="node-count"
                        x={labelX}
                        y={midY + 10}
                        dominantBaseline="middle"
                        textAnchor={right ? 'start' : 'end'}
                        style={{ paintOrder: 'stroke', stroke: 'var(--bg)', strokeWidth: 4 }}
                      >
                        {integer(node.value ?? 0)} · {((100 * (node.value ?? 0)) / graph.total).toFixed(1)}%
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          </>
        )}
        {tip && (
          <div className="particle-tip" style={{ left: tip.x, top: tip.y }}>
            <div className="num" style={{ fontSize: 15 }}>{tip.row.inquiry_id}</div>
            <div style={{ color: 'var(--ink-2)' }}>
              {sourceLabel(tip.row.source)} · {serviceLabel(tip.row.service)}
            </div>
            <div style={{ color: 'var(--ink-3)', fontSize: 11.5 }}>
              {OUTCOME_LABELS[tip.row.outcome]} · click for the full record
            </div>
          </div>
        )}
      </div>
      </div>
      <table className="sr-only">
        <caption>Inquiry flow by source, response, and furthest outcome</caption>
        <thead>
          <tr>
            <th>Source</th>
            <th>Responded</th>
            <th>Outcome</th>
            <th>Inquiries</th>
          </tr>
        </thead>
        <tbody>
          {flow.map((row, i) => (
            <tr key={i}>
              <td>{sourceLabel(row.source)}</td>
              <td>{row.responded ? 'Yes' : 'No'}</td>
              <td>{OUTCOME_LABELS[row.outcome]}</td>
              <td>{row.inquiries}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="current-foot">
        <div className="legend">
          {allSources.map((source) => (
            <span key={source} style={{ color: SOURCE_COLORS[source] }}>
              <i />
              <span style={{ color: 'var(--ink-2)' }}>{sourceLabel(source)}</span>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="label hide-sm">Each dot is one real inquiry record</span>
          <button className="btn small" type="button" onClick={() => setPaused((value) => !value)}>
            <Icon name={paused ? 'play' : 'pause'} size={14} />
            {paused ? 'Play the current' : 'Pause'}
          </button>
        </div>
      </div>
    </div>
  )
}
