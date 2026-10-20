import { z } from 'zod'
import type { AirQualityData, AirQualityRequest, ForecastData, ForecastRequest, Location } from '../../types/api'
import { ApiError } from './errors'
import { RequestCache } from './cache'
import { RetryPolicy } from './retry'

type Scalar = number | string | null

const locationSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  admin1: z.string().optional(),
  country: z.string().min(1),
  country_code: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().min(1),
})

const scalarSchema = z.union([z.number(), z.string(), z.null()])
const scalarRecordSchema = z.record(z.string(), scalarSchema)
const seriesRecordSchema = z.record(z.string(), z.array(scalarSchema))
const unitsRecordSchema = z.record(z.string(), z.string())

const responseSchema = z.object({
  timezone: z.string().min(1),
  model: z.string().optional(),
  models: z.unknown().optional(),
  current: scalarRecordSchema.optional(),
  current_units: unitsRecordSchema.optional(),
  hourly: seriesRecordSchema.optional(),
  hourly_units: unitsRecordSchema.optional(),
  daily: seriesRecordSchema.optional(),
  daily_units: unitsRecordSchema.optional(),
})

const aqResponseSchema = z.object({
  timezone: z.string().min(1).optional(),
  current: scalarRecordSchema.optional(),
  current_units: unitsRecordSchema.optional(),
  hourly: seriesRecordSchema.optional(),
  hourly_units: unitsRecordSchema.optional(),
  daily: seriesRecordSchema.optional(),
  daily_units: unitsRecordSchema.optional(),
}).passthrough()

const apiMetaSchema = z.object({
  provider: z.string().min(1),
  source: z.string().min(1),
  model: z.string().optional(),
  updatedAt: z.number(),
  cached: z.boolean(),
  stale: z.boolean(),
  warning: z.string().optional(),
})

const forecastDataSchema = z.object({
  current: scalarRecordSchema,
  hourly: seriesRecordSchema,
  daily: seriesRecordSchema,
  timezone: z.string().min(1),
  units: z.object({ current: unitsRecordSchema, hourly: unitsRecordSchema, daily: unitsRecordSchema }),
  meta: apiMetaSchema,
})

const airQualityDataSchema = z.object({
  current: scalarRecordSchema,
  current_units: unitsRecordSchema.optional(),
  hourly: seriesRecordSchema.optional(),
  hourly_units: unitsRecordSchema.optional(),
  daily: seriesRecordSchema.optional(),
  daily_units: unitsRecordSchema.optional(),
  timezone: z.string().min(1),
  meta: apiMetaSchema,
})

const isForecastData = (value: unknown): value is ForecastData => forecastDataSchema.safeParse(value).success
const isAirQualityData = (value: unknown): value is AirQualityData => airQualityDataSchema.safeParse(value).success

const isArray = (value: unknown): value is unknown[] => Array.isArray(value)
const normalize = (record: Record<string, unknown> | undefined) => Object.fromEntries(
  Object.entries(record ?? {}).map(([key, value]) => [key, isArray(value) ? value : value ?? null]),
) as Record<string, Scalar | Scalar[]>

const invalidRequest = (message: string) => new ApiError(message, { code: 'INVALID_QUERY' })

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const isAbortSignal = (value: unknown): value is AbortSignal => isRecord(value)
  && typeof value.aborted === 'boolean'
  && typeof value.addEventListener === 'function'
  && typeof value.removeEventListener === 'function'

const validateSignal = (signal: unknown) => {
  if (signal !== undefined && !isAbortSignal(signal)) throw invalidRequest('Invalid abort signal')
}

const validateBaseRequest = (request: unknown) => {
  if (!isRecord(request)) throw invalidRequest('Invalid API request')
  const { latitude, longitude, timezone, signal, forceRefresh } = request
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw invalidRequest('Latitude must be a finite number between -90 and 90')
  }
  if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw invalidRequest('Longitude must be a finite number between -180 and 180')
  }
  if (timezone !== undefined && (typeof timezone !== 'string' || timezone.trim().length === 0 || timezone.length > 100)) {
    throw invalidRequest('Timezone must be a non-empty string')
  }
  validateSignal(signal)
  if (forceRefresh !== undefined && typeof forceRefresh !== 'boolean') throw invalidRequest('forceRefresh must be a boolean')
}

function validateForecastRequest(request: unknown): asserts request is ForecastRequest {
  validateBaseRequest(request)
  const value = request as Record<string, unknown>
  const { forecastDays, temperatureUnit, windSpeedUnit, precipitationUnit } = value
  if (forecastDays !== undefined && (typeof forecastDays !== 'number' || !Number.isInteger(forecastDays) || forecastDays < 1 || forecastDays > 16)) {
    throw invalidRequest('forecastDays must be an integer between 1 and 16')
  }
  if (temperatureUnit !== undefined && temperatureUnit !== 'celsius' && temperatureUnit !== 'fahrenheit') {
    throw invalidRequest('Invalid temperature unit')
  }
  if (windSpeedUnit !== undefined && !['kmh', 'ms', 'mph', 'kn'].includes(windSpeedUnit as string)) {
    throw invalidRequest('Invalid wind speed unit')
  }
  if (precipitationUnit !== undefined && precipitationUnit !== 'mm' && precipitationUnit !== 'inch') {
    throw invalidRequest('Invalid precipitation unit')
  }
}

function validateAirQualityRequest(request: unknown): asserts request is AirQualityRequest {
  validateBaseRequest(request)
}

const normalizeSearchQuery = (query: unknown) => {
  if (typeof query !== 'string') throw invalidRequest('Search query must be a string')
  const normalized = query.trim()
  if (normalized.length === 0 || normalized.length > 200) throw invalidRequest('Search query must contain 1 to 200 characters')
  return normalized
}

const buildUrl = (baseUrl: string, params: URLSearchParams) => {
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch (error) {
    throw new ApiError('Invalid API endpoint', { code: 'CONFIG_ERROR', cause: error })
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ApiError('Invalid API endpoint', { code: 'CONFIG_ERROR' })
  }
  params.forEach((value, key) => url.searchParams.set(key, value))
  return url.toString()
}

type FetchOptions = Omit<RequestInit, 'signal'> & { signal?: AbortSignal }

const isAbortError = (error: unknown) => {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') return true
  return isRecord(error) && error.name === 'AbortError'
}

const wait = (milliseconds: number, signal?: AbortSignal) => {
  if (signal?.aborted) return Promise.reject(new ApiError('Request aborted', { code: 'ABORTED' }))
  if (milliseconds <= 0) return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
    const abort = () => {
      cleanup()
      reject(new ApiError('Request aborted', { code: 'ABORTED' }))
    }
    const timer = setTimeout(() => {
      cleanup()
      resolve()
    }, milliseconds)
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
  })
}

const fetchJson = async (url: string, init: FetchOptions, policy: RetryPolicy, timeoutMs: number) => {
  for (let attempt = 0; ; attempt += 1) {
    const externalSignal = init.signal
    if (externalSignal?.aborted) throw new ApiError('Request aborted', { code: 'ABORTED' })

    const controller = new AbortController()
    let timedOut = false
    const onAbort = () => controller.abort()
    externalSignal?.addEventListener('abort', onAbort, { once: true })
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)

    try {
      const response = await fetch(url, { ...init, signal: controller.signal })
      if (!response.ok) {
        if (attempt < policy.maxRetries && policy.shouldRetry(response.status)) {
          clearTimeout(timer)
          await wait(policy.delay(attempt, response.headers.get('Retry-After')), externalSignal)
          continue
        }
        throw new ApiError(`HTTP ${response.status}`, {
          status: response.status,
          code: response.status === 429 ? 'RATE_LIMITED' : 'HTTP_ERROR',
        })
      }

      let body: unknown
      try {
        body = await response.json() as unknown
      } catch (error) {
        if (externalSignal?.aborted) throw new ApiError('Request aborted', { code: 'ABORTED', cause: error })
        if (timedOut || isAbortError(error)) throw new ApiError('Request timed out', { code: 'TIMEOUT', cause: error })
        throw new ApiError('Response was not valid JSON', { code: 'INVALID_JSON', cause: error })
      }
      if (externalSignal?.aborted) throw new ApiError('Request aborted', { code: 'ABORTED' })
      if (timedOut) throw new ApiError('Request timed out', { code: 'TIMEOUT' })
      return body
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (externalSignal?.aborted) throw new ApiError('Request aborted', { code: 'ABORTED', cause: error })
      if (timedOut || isAbortError(error)) {
        if (attempt < policy.maxRetries && policy.shouldRetry(undefined, error)) {
          clearTimeout(timer)
          await wait(policy.delay(attempt), externalSignal)
          continue
        }
        throw new ApiError('Request timed out', { code: 'TIMEOUT', cause: error })
      }
      if (attempt < policy.maxRetries && policy.shouldRetry(undefined, error)) {
        clearTimeout(timer)
        await wait(policy.delay(attempt), externalSignal)
        continue
      }
      throw new ApiError('Network request failed', { code: 'NETWORK_ERROR', cause: error })
    } finally {
      clearTimeout(timer)
      externalSignal?.removeEventListener('abort', onAbort)
    }
  }
}

const hourly = ['temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'precipitation', 'rain', 'showers', 'snowfall', 'snow_depth', 'weather_code', 'pressure_msl', 'surface_pressure', 'cloud_cover', 'visibility', 'evapotranspiration', 'et0_fao_evapotranspiration', 'vapour_pressure_deficit', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'uv_index', 'uv_index_clear_sky', 'is_day']
const daily = ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'apparent_temperature_max', 'apparent_temperature_min', 'sunrise', 'sunset', 'daylight_duration', 'sunshine_duration', 'uv_index_max', 'uv_index_clear_sky_max', 'precipitation_sum', 'rain_sum', 'showers_sum', 'snowfall_sum', 'precipitation_hours', 'precipitation_probability_max', 'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant', 'shortwave_radiation_sum', 'et0_fao_evapotranspiration']
// Open-Meteo includes `time` in the current response automatically; it is not
// a valid member of the current= query list.
const airQualityCurrent = ['european_aqi', 'us_aqi', 'pm2_5', 'pm10', 'carbon_monoxide', 'nitrogen_dioxide', 'sulphur_dioxide', 'ozone', 'dust', 'aerosol_optical_depth', 'uv_index']

export class GeocodingApiClient {
  constructor(private readonly baseUrl = 'https://geocoding-api.open-meteo.com/v1/search', private readonly policy = new RetryPolicy()) {}

  async search(query: string, signal?: AbortSignal): Promise<Location[]> {
    const name = normalizeSearchQuery(query)
    validateSignal(signal)
    const params = new URLSearchParams({ name, count: '10', language: 'en', format: 'json' })
    const raw = z.object({ results: z.array(locationSchema).optional() }).safeParse(
      await fetchJson(buildUrl(this.baseUrl, params), { signal }, this.policy, 12_000),
    )
    if (!raw.success) throw new ApiError('Invalid geocoding response', { code: 'SCHEMA_ERROR', details: raw.error })
    return raw.data.results ?? []
  }
}

export class WeatherApiClient {
  readonly cache: RequestCache<ForecastData>

  constructor(
    private readonly baseUrl = 'https://api.open-meteo.com/v1/forecast',
    private readonly policy = new RetryPolicy(),
    cache?: RequestCache<ForecastData>,
  ) {
    this.cache = cache ?? new RequestCache({ storageKey: 'open-meteo-forecast-v1', validate: isForecastData })
  }

  async getForecast(req: ForecastRequest): Promise<ForecastData> {
    validateForecastRequest(req)
    const params = new URLSearchParams({
      latitude: String(req.latitude),
      longitude: String(req.longitude),
      timezone: req.timezone ?? 'auto',
      forecast_days: String(req.forecastDays ?? 16),
      temperature_unit: req.temperatureUnit ?? 'celsius',
      wind_speed_unit: req.windSpeedUnit ?? 'kmh',
      precipitation_unit: req.precipitationUnit ?? 'mm',
      current: ['temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day', 'precipitation', 'rain', 'showers', 'snowfall', 'weather_code', 'cloud_cover', 'pressure_msl', 'surface_pressure', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m'].join(','),
      hourly: hourly.join(','),
      daily: daily.join(','),
    })
    const key = params.toString()
    const url = buildUrl(this.baseUrl, params)
    const result = await this.cache.getOrFetch(key, async signal => {
      const parsed = responseSchema.safeParse(await fetchJson(url, { signal }, this.policy, 15_000))
      if (!parsed.success || !parsed.data.hourly || !parsed.data.daily) {
        throw new ApiError('Invalid forecast response', {
          code: 'SCHEMA_ERROR',
          details: parsed.success ? undefined : parsed.error,
        })
      }

      const ensureArrays = (record: Record<string, unknown>) => {
        const lengths = Object.values(record).map(value => (Array.isArray(value) ? value.length : -1))
        if (!Array.isArray(record.time) || lengths.some(length => length < 0 || length !== lengths[0])) {
          throw new ApiError('Forecast arrays are not aligned', { code: 'SCHEMA_ERROR' })
        }
        return normalize(record)
      }

      return {
        current: normalize(parsed.data.current) as ForecastData['current'],
        hourly: ensureArrays(parsed.data.hourly) as ForecastData['hourly'],
        daily: ensureArrays(parsed.data.daily) as ForecastData['daily'],
        timezone: parsed.data.timezone,
        units: {
          current: parsed.data.current_units ?? {},
          hourly: parsed.data.hourly_units ?? {},
          daily: parsed.data.daily_units ?? {},
        },
        meta: {
          provider: 'open-meteo',
          source: this.baseUrl,
          model: parsed.data.model,
          updatedAt: Date.now(),
          cached: false,
          stale: false,
        },
      }
    }, { forceRefresh: req.forceRefresh, signal: req.signal })

    return {
      ...result.value,
      meta: { ...result.value.meta, cached: result.cached, stale: result.stale, warning: result.warning },
    }
  }
}

export class AirQualityApiClient {
  readonly cache: RequestCache<AirQualityData>

  constructor(
    private readonly baseUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality',
    private readonly policy = new RetryPolicy(),
    cache?: RequestCache<AirQualityData>,
  ) {
    this.cache = cache ?? new RequestCache({ storageKey: 'open-meteo-air-quality-v1', validate: isAirQualityData })
  }

  async getAirQuality(req: AirQualityRequest): Promise<AirQualityData> {
    validateAirQualityRequest(req)
    const params = new URLSearchParams({
      latitude: String(req.latitude),
      longitude: String(req.longitude),
      timezone: req.timezone ?? 'auto',
      current: airQualityCurrent.join(','),
    })
    const result = await this.cache.getOrFetch(params.toString(), async signal => {
      const parsed = aqResponseSchema.safeParse(await fetchJson(buildUrl(this.baseUrl, params), { signal }, this.policy, 15_000))
      if (!parsed.success) throw new ApiError('Invalid air quality response', { code: 'SCHEMA_ERROR', details: parsed.error })
      return {
        current: normalize(parsed.data.current) as AirQualityData['current'],
        current_units: parsed.data.current_units ?? {},
        timezone: parsed.data.timezone ?? req.timezone ?? 'auto',
        meta: {
          provider: 'open-meteo',
          source: this.baseUrl,
          updatedAt: Date.now(),
          cached: false,
          stale: false,
        },
      }
    }, { forceRefresh: req.forceRefresh, signal: req.signal })

    return {
      ...result.value,
      meta: { ...result.value.meta, cached: result.cached, stale: result.stale, warning: result.warning },
    }
  }
}
