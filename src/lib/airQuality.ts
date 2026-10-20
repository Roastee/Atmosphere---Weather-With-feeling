import type { AirQualityData } from '../types/api'

export const AIR_QUALITY_GUIDANCE_URL = 'https://www.who.int/health-topics/air-pollution'

export type AirQualityScale = 'european' | 'us'
export type AirQualityTone = 'good' | 'fair' | 'moderate' | 'poor' | 'very-poor' | 'unhealthy' | 'hazardous' | 'unknown'

export interface AirQualityCategory {
  label: string
  tone: AirQualityTone
  guidance: string
  informational: true
  officialGuidanceUrl: string
}

export type AirQualityPollutantKey =
  | 'pm2_5'
  | 'pm10'
  | 'carbon_monoxide'
  | 'nitrogen_dioxide'
  | 'sulphur_dioxide'
  | 'ozone'
  | 'dust'
  | 'aerosol_optical_depth'
  | 'uv_index'

export interface AirQualityPollutantDefinition {
  key: AirQualityPollutantKey
  label: string
  description: string
  defaultUnit: string
  decimals: number
  /** A neutral reference used only to compare the returned readings. */
  comparisonScale?: number
}

export const AIR_QUALITY_POLLUTANTS: readonly AirQualityPollutantDefinition[] = [
  { key: 'pm2_5', label: 'PM2.5', description: 'Fine particulate matter', defaultUnit: 'μg/m³', decimals: 1, comparisonScale: 15 },
  { key: 'pm10', label: 'PM10', description: 'Coarse particulate matter', defaultUnit: 'μg/m³', decimals: 1, comparisonScale: 45 },
  { key: 'ozone', label: 'Ozone', description: 'Ground-level ozone', defaultUnit: 'μg/m³', decimals: 1, comparisonScale: 100 },
  { key: 'nitrogen_dioxide', label: 'Nitrogen dioxide', description: 'NO₂ concentration', defaultUnit: 'μg/m³', decimals: 1, comparisonScale: 40 },
  { key: 'sulphur_dioxide', label: 'Sulphur dioxide', description: 'SO₂ concentration', defaultUnit: 'μg/m³', decimals: 1, comparisonScale: 40 },
  { key: 'carbon_monoxide', label: 'Carbon monoxide', description: 'CO concentration', defaultUnit: 'μg/m³', decimals: 0, comparisonScale: 4000 },
  { key: 'dust', label: 'Dust', description: 'Suspended dust', defaultUnit: 'μg/m³', decimals: 1, comparisonScale: 100 },
  { key: 'aerosol_optical_depth', label: 'Aerosol optical depth', description: 'Aerosol column indicator', defaultUnit: 'index', decimals: 2, comparisonScale: 1 },
  { key: 'uv_index', label: 'UV index', description: 'Ultraviolet index', defaultUnit: 'index', decimals: 1 },
]

const usBands: readonly [number, string, AirQualityTone, string][] = [
  [50, 'Good', 'good', 'This index is in its lowest band; the reported pollution level is low on the US AQI scale.'],
  [100, 'Moderate', 'moderate', 'This index is in a middle band; conditions can vary by pollutant and location.'],
  [150, 'Unhealthy for sensitive groups', 'unhealthy', 'This index is in a higher band; check local public-health updates for context about current conditions.'],
  [200, 'Unhealthy', 'unhealthy', 'This index is in a high band; use local public-health information when interpreting current conditions.'],
  [300, 'Very unhealthy', 'very-poor', 'This index is in a very high band; consult local official updates for the most relevant context.'],
  [Infinity, 'Hazardous', 'hazardous', 'This index is in the highest US AQI band; consult local official updates for current conditions.'],
]

const europeanBands: readonly [number, string, AirQualityTone, string][] = [
  [20, 'Good', 'good', 'This index is in its lowest band; the reported pollution level is low on the European AQI scale.'],
  [40, 'Fair', 'fair', 'This index is in a lower-middle band; conditions can vary by pollutant and location.'],
  [60, 'Moderate', 'moderate', 'This index is in a middle band; check local public-health updates for context about current conditions.'],
  [80, 'Poor', 'poor', 'This index is in a higher band; use local public-health information when interpreting current conditions.'],
  [100, 'Very poor', 'very-poor', 'This index is in a very high band; consult local official updates for the most relevant context.'],
  [Infinity, 'Extremely poor', 'hazardous', 'This index is in the highest European AQI band; consult local official updates for current conditions.'],
]

const unavailableCategory = (message: string): AirQualityCategory => ({
  label: 'Not available',
  tone: 'unknown',
  guidance: message,
  informational: true,
  officialGuidanceUrl: AIR_QUALITY_GUIDANCE_URL,
})

export function numericAirQualityValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function getAirQualityCategory(value: unknown, scale: AirQualityScale = 'us'): AirQualityCategory {
  const numeric = numericAirQualityValue(value)
  if (numeric === null) return unavailableCategory('No air-quality index was returned for this location or time. Individual pollutant readings may still be available.')
  const bands = scale === 'european' ? europeanBands : usBands
  const band = bands.find(([upperBound]) => numeric <= upperBound)
  if (!band) return unavailableCategory('The returned index could not be placed in a known public-health communication band.')
  return { label: band[1], tone: band[2], guidance: band[3], informational: true, officialGuidanceUrl: AIR_QUALITY_GUIDANCE_URL }
}

/** Alias kept readable for call sites that prefer the verb "classify". */
export const classifyAirQuality = getAirQualityCategory

export function getAirQualityGuidance(value: unknown, scale: AirQualityScale = 'us'): string {
  return getAirQualityCategory(value, scale).guidance
}

export function getPrimaryPollutant(current: AirQualityData['current'] | undefined): AirQualityPollutantDefinition | null {
  if (!current) return null
  return AIR_QUALITY_POLLUTANTS
    .filter((pollutant) => pollutant.comparisonScale !== undefined)
    .map((pollutant) => ({ pollutant, value: numericAirQualityValue(current[pollutant.key]), score: numericAirQualityValue(current[pollutant.key]) === null ? -1 : numericAirQualityValue(current[pollutant.key])! / pollutant.comparisonScale! }))
    .filter(({ value }) => value !== null)
    .sort((a, b) => b.score - a.score)[0]?.pollutant ?? null
}
