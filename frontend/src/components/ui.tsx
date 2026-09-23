import { AnimatePresence, motion } from 'motion/react'
import { useId, type CSSProperties, type ElementType, type ReactNode } from 'react'

/** Characters slide from the old value to the new one; no intermediate numbers are shown. */
export function Numeral({ value, className = '' }: { value: string; className?: string }) {
  const chars = [...value]
  return (
    <span className={`numeral num ${className}`}>
      <span className="sr-only">{value}</span>
      {chars.map((char, index) => (
        <span key={`${chars.length - index}`} aria-hidden="true" style={{ position: 'relative' }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={char}
              style={{ display: 'inline-block' }}
              initial={{ y: '0.9em', opacity: 0, filter: 'blur(4px)' }}
              animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
              exit={{ y: '-0.9em', opacity: 0, filter: 'blur(4px)' }}
              transition={{ type: 'spring', stiffness: 420, damping: 32, delay: index * 0.025 }}
            >
              {char}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  )
}

function trackSpotlight(event: React.PointerEvent<HTMLElement>) {
  const target = event.currentTarget
  const rect = target.getBoundingClientRect()
  target.style.setProperty('--mx', `${event.clientX - rect.left}px`)
  target.style.setProperty('--my', `${event.clientY - rect.top}px`)
}

export function Panel({
  as: Tag = 'div',
  className = '',
  children,
  style,
  ...rest
}: {
  as?: ElementType
  className?: string
  children: ReactNode
  style?: CSSProperties
} & Record<string, unknown>) {
  return (
    <Tag className={`panel spotlight ${className}`} onPointerMove={trackSpotlight} style={style} {...rest}>
      {children}
    </Tag>
  )
}

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function SectionHead({
  index,
  title,
  lede,
  tools,
}: {
  index: string
  title: ReactNode
  lede?: ReactNode
  tools?: ReactNode
}) {
  return (
    <Reveal className="section-head">
      <div className="section-index">{index}</div>
      <div>
        <h2 className="section-title">{title}</h2>
        {lede && <p className="section-lede">{lede}</p>}
      </div>
      {tools && <div className="section-tools">{tools}</div>}
    </Reveal>
  )
}

export function Info({ children, label }: { children: ReactNode; label: string }) {
  const id = useId()
  return (
    <button type="button" className="info" aria-label={`About ${label}`} aria-describedby={id}>
      i
      <span className="tip" role="tooltip" id={id}>
        {children}
      </span>
    </button>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  const id = useId()
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.value === value && (
            <motion.span
              className="seg-pill"
              layoutId={`seg-${id}`}
              transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            />
          )}
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function StatusPill({ status, children }: { status: string; children: ReactNode }) {
  return <span className={`status-pill s-${status}`}>{children}</span>
}

const paths: Record<string, ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 20h14" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  upload: (
    <>
      <path d="M12 16V5" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 20h14" />
    </>
  ),
  reset: (
    <>
      <path d="M4 12a8 8 0 1 0 3-6.2" />
      <path d="M4 4v5h5" />
    </>
  ),
  check: <path d="m5 12 5 5 9-10" />,
  pause: <path d="M8 5v14M16 5v14" />,
  play: <path d="M7 5l12 7-12 7z" />,
  alert: (
    <>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 10v10" />
    </>
  ),
}

export function Icon({ name, size = 16 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M8 16c16 0 20 16 36 16" fill="none" stroke="var(--c-sky)" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M8 32h36" fill="none" stroke="var(--c-beam)" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M8 48c16 0 20-16 36-16" fill="none" stroke="var(--c-rose)" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="50" cy="32" r="7" fill="var(--c-tide)" />
    </svg>
  )
}
