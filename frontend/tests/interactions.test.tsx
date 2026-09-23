import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { useResource } from '../src/lib/useResource'
import { Palette } from '../src/components/Palette'
import { Tide } from '../src/components/Tide'
import { Import } from '../src/components/Import'

it('ignores an obsolete response even when the transport ignores cancellation', async () => {
  let finishOld!: (value: string) => void
  const old = () =>
    new Promise<string>((resolve) => {
      finishOld = resolve
    })
  const fresh = () => Promise.resolve('new workspace')
  const { result, rerender } = renderHook(({ name, load }) => useResource(name, load), {
    initialProps: { name: 'old', load: old },
  })
  await act(async () => rerender({ name: 'new', load: fresh }))
  expect(result.current.value).toBe('new workspace')
  await act(async () => finishOld('obsolete workspace'))
  expect(result.current.value).toBe('new workspace')
})

it('contains palette focus, runs keyboard results, and restores the trigger', async () => {
  const user = userEvent.setup()
  const trigger = document.createElement('button')
  document.body.append(trigger)
  trigger.focus()
  const close = vi.fn(),
    run = vi.fn()
  const { unmount } = render(
    <Palette
      open
      onClose={close}
      commands={[{ id: 'overview', label: 'Overview', group: 'Go to', run }]}
      inquiries={[]}
      onSelect={vi.fn()}
    />,
  )
  const input = screen.getByRole('combobox')
  expect(input).toHaveFocus()
  await user.tab({ shift: true })
  expect(screen.getByRole('option')).toHaveFocus()
  await user.tab()
  expect(input).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(run).toHaveBeenCalledOnce()
  expect(close).toHaveBeenCalledOnce()
  unmount()
  expect(trigger).toHaveFocus()
  trigger.remove()
})

it('cancels an old date-handle timer when a preset is chosen', () => {
  vi.useFakeTimers()
  const change = vi.fn()
  const { unmount } = render(
    <Tide
      timeline={[]}
      firstDate="2026-09-01"
      lastDate="2026-09-30"
      start="2026-09-01"
      end="2026-09-30"
      onChange={change}
    />,
  )
  fireEvent.keyDown(screen.getByRole('slider', { name: 'Start date' }), { key: 'ArrowRight' })
  fireEvent.click(screen.getByRole('button', { name: 'Last 14 days' }))
  act(() => vi.advanceTimersByTime(1000))
  expect(change).toHaveBeenCalledExactlyOnceWith('2026-09-17', '2026-09-30')
  unmount()
  vi.useRealTimers()
})

it('reports sample download errors instead of an unhandled rejection', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
  render(<Import enabled busy={false} onSubmit={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Load sample files' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Could not load inquiries.csv')
  vi.unstubAllGlobals()
})


it('carries rounded hours into days instead of displaying 24 hours', async () => {
  const { ageLabel } = await import('../src/lib/format')
  expect(ageLabel(71.9)).toBe('3 d 0 h')
  expect(ageLabel(47.9)).toBe('2 d 0 h')
})
