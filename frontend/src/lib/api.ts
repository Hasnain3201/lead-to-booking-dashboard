export type Outcome = 'completed' | 'scheduled' | 'lost' | 'unbooked'

export interface Metrics {
  inquiries: number
  converted: number
  conversion: number | null
  response_hours: number | null
  response_coverage: number | null
  bookings: number
  cancellations: number
  cancellation_rate: number | null
  no_shows: number
  completed_jobs: number
  revenue_usd: number
  revenue_cents: number
}

export interface SourceRow extends Omit<Metrics, 'revenue_cents'> {
  source: string
}

export interface FlowRow {
  source: string
  responded: boolean
  outcome: Outcome
  inquiries: number
}

export interface InquiryLite {
  inquiry_id: string
  created_at: string
  source: string
  service: string
  response_hours: number | null
  bookings: number
  completed_jobs: number
  revenue_cents: number
  responded: boolean
  outcome: Outcome
}

export interface Day {
  date: string
  inquiries: number
  booked_leads: number
  completed_leads: number
}

export interface AttentionRow {
  inquiry_id: string
  source: string
  service: string
  created_at: string
  age_hours: number
}

export interface BookingRow {
  booking_id: string
  inquiry_id: string
  booked_at: string
  scheduled_at: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  source: string
  service: string
  job_id: string | null
  completed_at: string | null
  revenue_usd: number | null
}

export interface ReceiptRow {
  file: string
  input_rows: number
  accepted_rows: number
  duplicates_removed: number
  whitespace_rows: number
  category_values_normalized: number
}

export interface Meta {
  id: string
  label: string
  sample: boolean
  snapshot: string
  reporting_timezone: string
  sources: string[]
  services: string[]
  first_date: string | null
  last_date: string | null
  inquiries: number
  import_receipt: ReceiptRow[]
  uploads_enabled: boolean
}

export interface View {
  metrics: Metrics
  sources: SourceRow[]
  flow: FlowRow[]
  inquiries: InquiryLite[]
  timeline: Day[]
  attention: AttentionRow[]
  failed_bookings: BookingRow[]
  brief: string
}

export interface InquiryRecord {
  inquiry_id: string
  created_at: string
  source: string
  service: string
  first_response_at: string | null
  response_hours: number | null
  bookings: number
  cancellations: number
  no_shows: number
  completed_jobs: number
  revenue_cents: number
  revenue_usd: number
  outcome: Outcome
}

export interface Detail {
  inquiry: InquiryRecord
  bookings: BookingRow[]
}

export interface Issue {
  file: string
  row: number | null
  column: string
  code: string
  issue: string
  repair: string
}

export interface ImportFailure {
  issue_count: number
  issues: Issue[]
}

export interface Filters {
  start: string
  end: string
  sources: string[]
  services: string[]
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(response.status, body.detail ?? `Request failed (${response.status})`)
  }
  return response.json()
}

export function filterQuery(filters: Filters): string {
  const params = new URLSearchParams({
    start: filters.start,
    end: filters.end,
    sources: filters.sources.join(','),
    services: filters.services.join(','),
  })
  return params.toString()
}

export const api = {
  meta: (dataset: string, signal?: AbortSignal) => request<Meta>(`/api/datasets/${dataset}`, { signal }),
  view: (dataset: string, filters: Filters, signal?: AbortSignal) =>
    request<View>(`/api/datasets/${dataset}/view?${filterQuery(filters)}`, { signal }),
  detail: (dataset: string, inquiry: string, signal?: AbortSignal) =>
    request<Detail>(`/api/datasets/${dataset}/inquiries/${encodeURIComponent(inquiry)}`, { signal }),
  exportUrl: (dataset: string, kind: string, filters: Filters) =>
    `/api/datasets/${dataset}/exports/${kind}?${filterQuery(filters)}`,
  sampleUrl: (name: string) => `/api/samples/${name}`,
  async upload(files: Record<string, File>, snapshot: string) {
    const form = new FormData()
    for (const [name, file] of Object.entries(files)) form.append(name, file, `${name}.csv`)
    form.append('snapshot', snapshot)
    const response = await fetch('/api/datasets', { method: 'POST', body: form })
    const body = await response.json().catch(() => ({}))
    if (response.status === 422) return { ok: false as const, failure: body as ImportFailure }
    if (!response.ok) throw new ApiError(response.status, body.detail ?? 'Upload failed')
    return { ok: true as const, id: body.id as string }
  },
}
