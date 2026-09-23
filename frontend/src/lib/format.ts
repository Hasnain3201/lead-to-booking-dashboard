import type { Outcome } from './api'

export const SOURCE_LABELS: Record<string, string> = {
  google_ads: 'Google Ads',
  organic_search: 'Organic search',
  referral: 'Referrals',
  social: 'Social',
  walk_in: 'Walk-ins',
  unknown: 'Unknown',
}

export const SOURCE_COLORS: Record<string, string> = {
  google_ads: 'var(--c-sky)',
  organic_search: 'var(--c-tide)',
  referral: 'var(--c-beam)',
  social: 'var(--c-rose)',
  walk_in: 'var(--c-lilac)',
  unknown: 'var(--c-slate)',
}

export const OUTCOME_LABELS: Record<Outcome, string> = {
  completed: 'Completed a job',
  scheduled: 'Still scheduled',
  lost: 'Cancelled or no-show',
  unbooked: 'Never booked',
}

export const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
}

export const sourceLabel = (source: string) => SOURCE_LABELS[source] ?? source
export const serviceLabel = (service: string) => service.charAt(0).toUpperCase() + service.slice(1)

export const percent = (value: number | null | undefined) =>
  value == null ? 'N/A' : `${(value * 100).toFixed(1)}%`

export const hours = (value: number | null | undefined) =>
  value == null ? 'N/A' : `${value.toFixed(1)} h`

export const integer = (value: number) => value.toLocaleString('en-US')

export const currency = (value: number, digits = 0) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })

export const centsToCurrency = (cents: number) => currency(cents / 100, 2)

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})

const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

export const formatDate = (iso: string) => dateFormat.format(new Date(iso))
export const formatShortDate = (iso: string) => shortDate.format(new Date(iso))
export const formatDateTime = (iso: string) => `${dateTimeFormat.format(new Date(iso))} UTC`

export function ageLabel(hoursOld: number) {
  if (hoursOld < 48) return `${Math.round(hoursOld)} h`
  return `${Math.floor(hoursOld / 24)} d ${Math.round(hoursOld % 24)} h`
}

export function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000)
}

export function csvFromRows(rows: Record<string, unknown>[]) {
  if (!rows.length) return ''
  const columns = Object.keys(rows[0])
  const cell = (value: unknown) => {
    let text = value == null ? '' : String(value)
    if (/^\s*[=+\-@]/.test(text)) text = `'${text}`
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return [columns.join(','), ...rows.map((row) => columns.map((c) => cell(row[c])).join(','))].join('\n')
}

export function download(filename: string, contents: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const link = Object.assign(document.createElement('a'), { href: url, download: filename })
  link.click()
  URL.revokeObjectURL(url)
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
