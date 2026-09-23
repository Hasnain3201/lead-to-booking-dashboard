import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { api, type Meta, type View } from '../src/lib/api'

vi.mock('../src/lib/api', async (original) => {
  const actual = await original<typeof import('../src/lib/api')>()
  return { ...actual, api: { ...actual.api, meta: vi.fn(), view: vi.fn(), upload: vi.fn(), detail: vi.fn() } }
})
vi.mock('../src/components/Current', () => ({ Current: () => <div>Flow chart</div> }))
const empty: Meta = {
  id: 'demo',
  label: 'Sample',
  sample: true,
  snapshot: '2026-09-21T00:00:00Z',
  reporting_timezone: 'UTC',
  sources: [],
  services: [],
  first_date: null,
  last_date: null,
  inquiries: 0,
  import_receipt: [],
  uploads_enabled: true,
}
const populated: Meta = {
  ...empty,
  inquiries: 1,
  first_date: '2026-09-01',
  last_date: '2026-09-01',
  sources: ['referral'],
  services: ['cleaning'],
}
const view: View = {
  metrics: {
    inquiries: 1,
    converted: 0,
    conversion: 0,
    response_hours: null,
    response_coverage: 0,
    bookings: 0,
    cancellations: 0,
    cancellation_rate: null,
    no_shows: 0,
    completed_jobs: 0,
    revenue_usd: 0,
    revenue_cents: 0,
  },
  sources: [],
  flow: [],
  inquiries: [],
  timeline: [],
  attention: [],
  failed_bookings: [],
  brief: 'Weekly brief',
}

beforeEach(() => {
  vi.mocked(api.meta).mockReset()
  vi.mocked(api.view).mockReset()
  vi.mocked(api.upload).mockReset()
})

describe('workspace recovery', () => {
  it('shows a recoverable empty workspace instead of an endless loader', async () => {
    vi.mocked(api.meta).mockResolvedValue(empty)
    render(<App />)
    expect(await screen.findByText('The files are valid but contain no inquiries')).toBeVisible()
    expect(screen.getByLabelText('Choose inquiries.csv')).toBeEnabled()
    expect(screen.queryByText('Reading the tide…')).not.toBeInTheDocument()
    expect(api.view).not.toHaveBeenCalled()
  })

  it('retries metadata even when the sample workspace is already selected', async () => {
    vi.mocked(api.meta).mockRejectedValueOnce(new Error('Disconnected')).mockResolvedValue(empty)
    render(<App />)
    expect(await screen.findByText('Disconnected')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Open the sample workspace' }))
    expect(await screen.findByText('The files are valid but contain no inquiries')).toBeVisible()
    expect(api.meta).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('Disconnected')).not.toBeInTheDocument()
  })

  it('recovers from a failed metrics request without showing stale errors', async () => {
    vi.mocked(api.meta).mockResolvedValue(populated)
    vi.mocked(api.view).mockRejectedValueOnce(new Error('View unavailable')).mockResolvedValue(view)
    render(<App />)
    await screen.findByText('View unavailable')
    await userEvent.click(screen.getByRole('button', { name: 'Open the sample workspace' }))
    expect(await screen.findByText('Flow chart')).toBeInTheDocument()
    expect(screen.queryByText('View unavailable')).not.toBeInTheDocument()
  })

  it('clears the previous dashboard on transport failures during import', async () => {
    vi.mocked(api.meta).mockResolvedValue(populated)
    vi.mocked(api.view).mockResolvedValue(view)
    vi.mocked(api.upload).mockRejectedValue(new Error('File too large'))
    render(<App />)
    await screen.findByText('Flow chart')
    for (const name of ['inquiries', 'bookings', 'jobs']) {
      fireEvent.change(screen.getByLabelText(`Choose ${name}.csv`), {
        target: { files: [new File(['header'], `${name}.csv`)] },
      })
    }
    await userEvent.click(screen.getByRole('button', { name: 'Validate and import' }))
    await waitFor(() => expect(screen.queryByText('Flow chart')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('File too large')).toBeVisible())
  })
})

it('keeps a record drawer open after selecting an inquiry with Enter', async () => {
  const inquiry = {
    inquiry_id: 'I001',
    created_at: '2026-09-01T00:00:00Z',
    source: 'referral',
    service: 'cleaning',
    response_hours: null,
    bookings: 0,
    completed_jobs: 0,
    revenue_cents: 0,
    responded: false,
    outcome: 'unbooked' as const,
  }
  vi.mocked(api.meta).mockResolvedValue(populated)
  vi.mocked(api.view).mockResolvedValue({ ...view, inquiries: [inquiry] })
  vi.mocked(api.detail).mockResolvedValue({
    inquiry: { ...inquiry, first_response_at: null, cancellations: 0, no_shows: 0, revenue_usd: 0 },
    bookings: [],
  })
  const user = userEvent.setup()
  render(<App />)
  await screen.findByText('Flow chart')
  await user.click(screen.getByRole('button', { name: 'Search ⌘K' }))
  await user.type(screen.getByRole('combobox'), 'I001{Enter}')
  expect(await screen.findByRole('dialog', { name: 'Inquiry I001' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Close record' })).toHaveFocus()
  await user.tab()
  expect(screen.getByRole('button', { name: 'Close record' })).toHaveFocus()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})
