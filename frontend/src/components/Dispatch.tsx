import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Icon } from './ui'

/** Renders the deterministic brief produced by the Python service; no text is generated here. */
function render(markdown: string) {
  const blocks: ReactNode[] = []
  let bullets: string[] = []
  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={blocks.length}>
          {bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>,
      )
      bullets = []
    }
  }
  for (const line of markdown.split('\n')) {
    if (line.startsWith('- ')) {
      bullets.push(line.slice(2))
      continue
    }
    flush()
    if (!line.trim()) continue
    if (line.startsWith('# ')) blocks.push(<h3 key={blocks.length}>{line.slice(2)}</h3>)
    else if (line.startsWith('Suggested action:'))
      blocks.push(
        <p key={blocks.length} className="action">
          <b>Suggested action.</b> {line.slice('Suggested action:'.length).trim()}
        </p>,
      )
    else if (line.startsWith('SYNTHETIC') || line.startsWith('Uploaded')) continue
    else if (line.startsWith('Recent cohorts'))
      blocks.push(
        <p key={blocks.length} className="muted">
          {line}
        </p>,
      )
    else blocks.push(<p key={blocks.length}>{line}</p>)
  }
  flush()
  return blocks
}

export function Dispatch({ brief, synthetic, url }: { brief: string; synthetic: boolean; url: string }) {
  return (
    <div className="dispatch-wrap">
      <motion.article
        className="dispatch"
        initial={{ opacity: 0, y: 40, rotate: -3 }}
        whileInView={{ opacity: 1, y: 0, rotate: -0.6 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="stamp">{synthetic ? 'SYNTHETIC DEMO' : 'UPLOADED DATA'}</div>
        {render(brief)}
      </motion.article>
      <div>
        <div className="label">How this brief is built</div>
        <p style={{ color: 'var(--ink-2)', marginTop: 10 }}>
          It uses the last complete Monday–Sunday week before the snapshot’s current week and compares it with the week
          before. It follows the source and service filters but ignores the custom date range, so both weeks stay
          complete.
        </p>
        <p style={{ color: 'var(--ink-2)' }}>
          Every sentence comes from fixed rules in the Python service. There is no AI writing and no causal claim.
        </p>
        <a className="btn" href={url} download style={{ marginTop: 8 }}>
          <Icon name="download" />
          Download brief (.md)
        </a>
      </div>
    </div>
  )
}
