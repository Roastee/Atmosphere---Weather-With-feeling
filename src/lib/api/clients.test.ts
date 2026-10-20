import { afterEach, describe, expect, it, vi } from 'vitest'
import { AirQualityApiClient, GeocodingApiClient, WeatherApiClient } from './clients'
import { RequestCache } from './cache'
import { ApiError } from './errors'
import { RetryPolicy } from './retry'
import type { ForecastData, ForecastRequest } from '../../types/api'

const jsonResponse = (body: unknown, status = 200, headers?: Record<string, string>) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
const forecastBody = (current: Record<string, unknown> = { time: '2026-10-13T10:00', temperature_2m: 24 }, hourly = { time: ['2026-10-13T10:00'], temperature_2m: [24] }, daily = { time: ['2026-10-13'], temperature_2m_max: [28], temperature_2m_min: [19] }) => ({ timezone: 'Asia/Kolkata', current, hourly, daily })

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('Open-Meteo clients', () => {
  it('searches locations and returns empty results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ results: [{ id: 1, name: 'Bengaluru', country: 'India', country_code: 'IN', latitude: 12.9, longitude: 77.5, timezone: 'Asia/Kolkata' }] })).mockResolvedValueOnce(jsonResponse({})))
    const client = new GeocodingApiClient('https://example.test/search')
    await expect(client.search('Bengaluru')).resolves.toHaveLength(1)
    await expect(client.search('unknown')).resolves.toEqual([])
  })

  it('validates malformed forecast responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ timezone: 'Asia/Kolkata', hourly: {} })))
    const client = new WeatherApiClient('https://example.test/forecast', undefined, new RequestCache({ storageKey: undefined }))
    await expect(client.getForecast({ latitude: 1, longitude: 2 })).rejects.toMatchObject({ code: 'SCHEMA_ERROR' })
  })

  it('retries rate limiting and accepts optional missing fields', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ error: true }, 429, { 'Retry-After': '0' })).mockResolvedValueOnce(jsonResponse(forecastBody()))
    vi.stubGlobal('fetch', fetchMock)
    const client = new WeatherApiClient('https://example.test/forecast', undefined, new RequestCache({ storageKey: undefined }))
    const result = await client.getForecast({ latitude: 1, longitude: 2 })
    expect(result.current.temperature_2m).toBe(24)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('falls back to the last successful cached forecast on timeout', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(forecastBody())).mockRejectedValueOnce(new TypeError('offline'))
    vi.stubGlobal('fetch', fetchMock)
    const cache = new RequestCache<ForecastData>({ storageKey: undefined, ttlMs: 0, staleMs: 60_000 })
    const client = new WeatherApiClient('https://example.test/forecast', undefined, cache)
    await client.getForecast({ latitude: 1, longitude: 2 })
    const result = await client.getForecast({ latitude: 1, longitude: 2, forceRefresh: true })
    expect(result.meta.stale).toBe(true)
    expect(result.meta.cached).toBe(true)
    expect(result.meta.warning).toBeTruthy()
  })

  it('supports manual air quality refresh and preserves timezone', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ timezone: 'Europe/London', current: { time: '2026-10-13T10:00', us_aqi: 22 } }))
    vi.stubGlobal('fetch', fetchMock)
    const client = new AirQualityApiClient('https://example.test/air', undefined, new RequestCache({ storageKey: undefined }))
    await client.getAirQuality({ latitude: 51.5, longitude: -0.1, timezone: 'Europe/London' })
    await client.getAirQuality({ latitude: 51.5, longitude: -0.1, timezone: 'Europe/London', forceRefresh: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('requests the available current air-quality fields and keeps partial readings', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      timezone: 'Europe/London',
      current: { time: '2026-10-13T10:00', european_aqi: 18, pm2_5: 4.2 },
      current_units: { european_aqi: 'EAQI', pm2_5: 'μg/m³' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const client = new AirQualityApiClient('https://example.test/air', undefined, new RequestCache({ storageKey: undefined }))
    const result = await client.getAirQuality({ latitude: 51.5, longitude: -0.1, timezone: 'Europe/London' })
    const request = new URL(fetchMock.mock.calls[0][0] as string)
    expect(request.searchParams.get('current')).toBe('european_aqi,us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,dust,aerosol_optical_depth,uv_index')
    expect(result.current.european_aqi).toBe(18)
    expect(result.current.pm10).toBeUndefined()
    expect(result.current_units?.pm2_5).toBe('μg/m³')
  })

  it('accepts an air-quality response with no current object', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ timezone: 'Europe/London' })))
    const client = new AirQualityApiClient('https://example.test/air', undefined, new RequestCache({ storageKey: undefined }))
    await expect(client.getAirQuality({ latitude: 51.5, longitude: -0.1, timezone: 'Europe/London' })).resolves.toMatchObject({ current: {}, timezone: 'Europe/London' })
  })

  it('surfaces aborted requests without retrying', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, init: RequestInit) => new Promise((_resolve, reject) => { init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true }) })))
    const client = new GeocodingApiClient('https://example.test/search')
    const request = client.search('London', controller.signal)
    controller.abort()
    await expect(request).rejects.toMatchObject({ code: 'ABORTED' } satisfies Partial<ApiError>)
  })

  it('rejects invalid request values before calling the provider', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const client = new WeatherApiClient('https://example.test/forecast', new RetryPolicy({ maxRetries: 0 }), new RequestCache({ storageKey: undefined }))

    await expect(client.getForecast({ latitude: 91, longitude: 2 })).rejects.toMatchObject({ code: 'INVALID_QUERY' })
    await expect(client.getForecast({ latitude: 1, longitude: 2, forecastDays: 17 } as unknown as ForecastRequest)).rejects.toMatchObject({ code: 'INVALID_QUERY' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('validates series values instead of accepting malformed provider data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      timezone: 'Asia/Kolkata',
      hourly: { time: ['2026-10-13T10:00'], temperature_2m: 24 },
      daily: { time: ['2026-10-13'], temperature_2m_max: [28] },
    })))
    const client = new WeatherApiClient('https://example.test/forecast', new RetryPolicy({ maxRetries: 0 }), new RequestCache({ storageKey: undefined }))

    await expect(client.getForecast({ latitude: 1, longitude: 2 })).rejects.toMatchObject({ code: 'SCHEMA_ERROR' })
  })

  it('normalizes provider failures into safe API errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private transport detail')))
    const client = new GeocodingApiClient('https://example.test/search', new RetryPolicy({ maxRetries: 0 }))

    await expect(client.search('London')).rejects.toMatchObject({ code: 'NETWORK_ERROR', message: 'Network request failed' })
  })

  it('reports invalid JSON without exposing the parser error as the public message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{', { status: 200 })))
    const client = new GeocodingApiClient('https://example.test/search', new RetryPolicy({ maxRetries: 0 }))

    await expect(client.search('London')).rejects.toMatchObject({ code: 'INVALID_JSON', message: 'Response was not valid JSON' })
  })

  it('does not start another retry after cancellation during exponential backoff', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: true }, 503))
    vi.stubGlobal('fetch', fetchMock)
    const client = new GeocodingApiClient('https://example.test/search', new RetryPolicy({ maxRetries: 2, baseDelayMs: 100 }))
    const request = client.search('London', controller.signal)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    controller.abort()
    await expect(request).rejects.toMatchObject({ code: 'ABORTED' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('deduplicates identical forecast requests through the public client', async () => {
    let resolveResponse!: (response: Response) => void
    const response = new Promise<Response>(resolve => { resolveResponse = resolve })
    const fetchMock = vi.fn(() => response)
    vi.stubGlobal('fetch', fetchMock)
    const client = new WeatherApiClient('https://example.test/forecast', new RetryPolicy({ maxRetries: 0 }), new RequestCache({ storageKey: undefined }))
    const request = { latitude: 1, longitude: 2 }

    const first = client.getForecast(request)
    const second = client.getForecast(request)
    await Promise.resolve()
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    resolveResponse(jsonResponse(forecastBody()))

    await expect(first).resolves.toMatchObject({ meta: { cached: false, stale: false } })
    await expect(second).resolves.toMatchObject({ meta: { cached: false, stale: false } })
  })
})
