/** Pure, presentation-oriented calculations for forecast visualizations. */

export type NullableNumber = number | null | undefined
export type HourlySeries = Record<string, readonly unknown[] | undefined>

const number = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

export type AlignedHourlyPoint = {
  index: number
  time: string
  values: Record<string, unknown>
}

/** Keeps all fields at the same source index, even when a field is shorter. */
export function alignedHourlyPoints(series: HourlySeries | null | undefined): AlignedHourlyPoint[] {
  const times = series?.time
  if (!Array.isArray(times)) return []
  return times.flatMap((rawTime, index) => {
    if (typeof rawTime !== 'string' || !rawTime) return []
    const values: Record<string, unknown> = {}
    for (const [key, valuesAtKey] of Object.entries(series ?? {})) values[key] = valuesAtKey?.[index] ?? null
    return [{ index, time: rawTime, values }]
  })
}

/** Formats an ISO instant or an Open-Meteo local wall-time in its destination zone. */
export function formatLocalTimeLabel(
  raw: unknown,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' },
): string {
  if (typeof raw !== 'string' || !raw || !timeZone) return '—'
  // Forecast APIs commonly return local ISO wall-times without an offset. Parsing those
  // as UTC would move the displayed hour and break midnight/DST boundaries.
  const wall = raw.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})(?::\d{2})?$/)
  if (wall) return options.hour || options.minute ? `${wall[1]}:${wall[2]}` : raw.slice(0, 10)
  const date = new Date(raw)
  if (!Number.isFinite(date.getTime())) return '—'
  try { return new Intl.DateTimeFormat(undefined, { ...options, timeZone }).format(date) } catch { return '—' }
}

export type TemperatureExtrema = { min: number | null; max: number | null; range: number | null; minIndex: number | null; maxIndex: number | null }
export function temperatureExtrema(values: readonly NullableNumber[] | null | undefined): TemperatureExtrema {
  let min: number | null = null, max: number | null = null, minIndex: number | null = null, maxIndex: number | null = null
  values?.forEach((value, index) => { const n = number(value); if (n === null) return; if (min === null || n < min) { min = n; minIndex = index } if (max === null || n > max) { max = n; maxIndex = index } })
  return { min, max, range: min !== null && max !== null ? max - min : null, minIndex, maxIndex }
}

export type PrecipitationSummary = { probabilityMax: number | null; probabilityAverage: number | null; quantityTotal: number | null; quantityMax: number | null; probabilityCount: number; quantityCount: number }
export function precipitationSummary(probabilities?: readonly NullableNumber[] | null, quantities?: readonly NullableNumber[] | null): PrecipitationSummary {
  const probs = (probabilities ?? []).map(number).filter((v): v is number => v !== null)
  const amounts = (quantities ?? []).map(number).filter((v): v is number => v !== null)
  return { probabilityMax: probs.length ? Math.max(...probs) : null, probabilityAverage: probs.length ? probs.reduce((a, b) => a + b, 0) / probs.length : null, quantityTotal: amounts.length ? amounts.reduce((a, b) => a + b, 0) : null, quantityMax: amounts.length ? Math.max(...amounts) : null, probabilityCount: probs.length, quantityCount: amounts.length }
}

export type WindSummary = { speed: number | null; beaufort: number | null; beaufortLabel: string; direction: string; degrees: number | null }
const beaufortLabels = ['Calm', 'Light air', 'Light breeze', 'Gentle breeze', 'Moderate breeze', 'Fresh breeze', 'Strong breeze', 'High wind', 'Gale', 'Strong gale', 'Storm', 'Violent storm', 'Hurricane force']
export function windSummary(speed: NullableNumber, degrees?: NullableNumber): WindSummary {
  const value = number(speed), angle = number(degrees)
  const scale = value === null ? null : Math.min(12, Math.max(0, Math.floor(Math.pow(value / 3.6 / 0.836, 2 / 3))))
  const direction = angle === null ? '—' : `${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((((angle % 360) + 360) % 360) / 45) % 8]} ${Math.round(angle)}°`
  return { speed: value, beaufort: scale, beaufortLabel: scale === null ? '—' : beaufortLabels[scale], direction, degrees: angle }
}

export type UvRisk = 'low' | 'moderate' | 'high' | 'very high' | 'extreme'
export function uvRiskCategory(value: NullableNumber): UvRisk | null {
  const uv = number(value); if (uv === null) return null
  return uv < 3 ? 'low' : uv < 6 ? 'moderate' : uv < 8 ? 'high' : uv < 11 ? 'very high' : 'extreme'
}

export function formatDaylightDuration(seconds: NullableNumber): string {
  const value = number(seconds); if (value === null || value < 0) return '—'
  const minutes = Math.round(value / 60), hours = Math.floor(minutes / 60), remainder = minutes % 60
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : `${remainder}m`
}

export type TrendCards = { high: number | null; low: number | null; average: number | null; change: number | null; direction: 'up' | 'down' | 'steady' | '—' }
export function trendCardCalculations(values: readonly NullableNumber[] | null | undefined): TrendCards {
  const valid = (values ?? []).map(number).filter((v): v is number => v !== null), extrema = temperatureExtrema(valid)
  const average = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null
  const change = valid.length > 1 ? valid[valid.length - 1] - valid[0] : null
  return { high: extrema.max, low: extrema.min, average, change, direction: change === null ? '—' : change > 0 ? 'up' : change < 0 ? 'down' : 'steady' }
}

export type OutdoorWindow = { start: string; end: string; durationHours: number; score: number } | null
export function bestOutdoorWindow(points: readonly { time: string; temperature?: NullableNumber; precipitationProbability?: NullableNumber; precipitation?: NullableNumber; isDay?: boolean | number }[] | null | undefined, options: { minTemperature?: number; maxTemperature?: number; maxProbability?: number; maxPrecipitation?: number; minHours?: number } = {}): OutdoorWindow {
  const min = options.minTemperature ?? -Infinity, max = options.maxTemperature ?? Infinity, probabilityLimit = options.maxProbability ?? 30, precipitationLimit = options.maxPrecipitation ?? 0.1, minHours = options.minHours ?? 1
  let best: OutdoorWindow = null, run: typeof points = []
  const consider = () => { if (!run?.length || run.length < minHours) return; const score = run.reduce((sum, point) => sum + (number(point.temperature) === null ? 0 : 1), 0) / run.length; const candidate = { start: run[0].time, end: run[run.length - 1].time, durationHours: run.length, score }; if (!best || candidate.score > best.score || candidate.durationHours > best.durationHours) best = candidate }
  for (const point of points ?? []) { const temp = number(point.temperature), probability = number(point.precipitationProbability), precipitation = number(point.precipitation); const eligible = (point.isDay === undefined || point.isDay === true || point.isDay === 1) && temp !== null && temp >= min && temp <= max && (probability === null || probability <= probabilityLimit) && (precipitation === null || precipitation <= precipitationLimit); if (eligible) run = [...(run ?? []), point]; else { consider(); run = [] } }
  consider(); return best
}

// Descriptive aliases keep the helpers easy to discover for callers.
export const calculateTrendCards = trendCardCalculations
export const getBestOutdoorWindow = bestOutdoorWindow
export const getAlignedHourlyPoints = alignedHourlyPoints
export const formatLocalTime = formatLocalTimeLabel
export const getTemperatureExtrema = temperatureExtrema
export const summarizePrecipitation = precipitationSummary
export const getWindSummary = windSummary
export const getUvRiskCategory = uvRiskCategory
