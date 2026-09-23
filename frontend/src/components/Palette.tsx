import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { InquiryLite } from '../lib/api'
import { OUTCOME_LABELS, sourceLabel } from '../lib/format'
import { Icon } from './ui'

export interface Command {
  id: string
  label: string
  group: string
  hint?: string
  run: () => void
}

export function Palette({
  open,
  onClose,
  commands,
  inquiries,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  commands: Command[]
  inquiries: InquiryLite[]
  onSelect: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matched = commands.filter((command) => !needle || command.label.toLowerCase().includes(needle))
    const records: Command[] = needle
      ? inquiries
          .filter((row) => row.inquiry_id.toLowerCase().includes(needle))
          .slice(0, 8)
          .map((row) => ({
            id: `inq-${row.inquiry_id}`,
            group: 'Inquiries in this view',
            label: row.inquiry_id,
            hint: `${sourceLabel(row.source)} · ${OUTCOME_LABELS[row.outcome]}`,
            run: () => onSelect(row.inquiry_id),
          }))
      : []
    return [...records, ...matched]
  }, [query, commands, inquiries, onSelect])

  const run = (command: Command | undefined) => {
    if (!command) return
    onClose()
    command.run()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => Math.min(results.length - 1, i + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (event.key === 'Enter') {
      run(results[active])
    } else if (event.key === 'Escape') {
      onClose()
    }
  }

  let lastGroup = ''
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="palette"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -16, scale: 0.97, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: -10, scale: 0.98, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <div className="palette-input">
              <Icon name="search" size={18} />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActive(0)
                }}
                onKeyDown={onKeyDown}
                placeholder="Type an inquiry ID or a command…"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                aria-activedescendant={results[active] ? `pal-${results[active].id}` : undefined}
              />
              <kbd>esc</kbd>
            </div>
            <ul className="palette-list" id="palette-list" role="listbox">
              {results.length === 0 && <li className="empty">Nothing matches “{query}”.</li>}
              {results.map((command, i) => {
                const header = command.group !== lastGroup
                lastGroup = command.group
                return (
                  <li key={command.id} role="presentation">
                    {header && <div className="palette-group label">{command.group}</div>}
                    <button
                      id={`pal-${command.id}`}
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      className="palette-item"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => run(command)}
                    >
                      <span className={command.group.startsWith('Inquiries') ? 'num' : undefined}>{command.label}</span>
                      {command.hint && <span className="hint">{command.hint}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
