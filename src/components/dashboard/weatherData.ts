import type { ForecastData } from '../../types/api'

export const numeric = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null
export function formatValue(value: unknown, unit = '', decimals = 0) {
  const number = numeric(value)
  return number === null ? '—' : `${number.toFixed(decimals)}${unit}`
}
export function reading(record: ForecastData['current'] | undefined, ...keys: string[]) {
  return keys.map(key => record?.[key]).find(value => value !== undefined && value !== null)
}
export function series(record: ForecastData['hourly'] | undefined, key: string): (number | string | null)[] { return record?.[key] || [] }

// Open-Meteo ISO values are destination-local wall times, not browser-local instants.
export function localStamp(timezone: string, now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
    const part = (key: string) => parts.find(p => p.type === key)?.value || ''
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
  } catch { return now.toISOString().slice(0, 16) }
}
export function wallTime(raw: unknown, timezone: string, hourOnly = false) {
  if (typeof raw !== 'string') return '—'
  const match = raw.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})(?::\d{2})?$/)
  if (match) return hourOnly ? `${match[1]}:00` : `${match[1]}:${match[2]}`
  const date = new Date(raw)
  if (!Number.isFinite(date.getTime())) return '—'
  try { return new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: '2-digit', ...(hourOnly ? {} : { minute: '2-digit' }) }).format(date) } catch { return '—' }
}
export function dayLabel(raw: unknown, timezone: string) {
  if (typeof raw !== 'string') return '—'
  if (raw.slice(0, 10) === localStamp(timezone).slice(0, 10)) return 'Today'
  const date = new Date(`${raw.slice(0, 10)}T12:00:00Z`)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' }).format(date) : '—'
}
export function currentHourIndex(data: ForecastData) {
  const stamp = localStamp(data.timezone).slice(0, 13)
  return series(data.hourly, 'time').findIndex(time => typeof time === 'string' && time.slice(0, 13) === stamp)
}
export function todayIndex(data: ForecastData) {
  const stamp = localStamp(data.timezone).slice(0, 10)
  return series(data.daily, 'time').findIndex(time => typeof time === 'string' && time.slice(0, 10) === stamp)
}
export function direction(raw: unknown) {
  const degrees = numeric(raw)
  if (degrees === null) return '—'
  return `${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((degrees % 360 + 360) % 360) / 45) % 8]} ${Math.round(degrees)}°`
}
