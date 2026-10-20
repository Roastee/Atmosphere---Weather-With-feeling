import { createTileProxy, type TileProxyResult } from './tileProxy.js'

const OPEN_WEATHER_TILE_BASE_URL = 'https://tile.openweathermap.org/map'
const SUCCESS_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'

export const OPEN_WEATHER_LAYER_MAP = {
  temperature: 'temp_new',
  precipitation: 'precipitation_new',
  wind: 'wind_new',
  cloud: 'clouds_new',
} as const

type ApplicationLayer = keyof typeof OPEN_WEATHER_LAYER_MAP

export interface OpenWeatherTileHandlerOptions {
  fetch?: typeof fetch
  /** Test hook; production reads OPENWEATHER_API_KEY at request time. */
  getApiKey?: () => string | undefined
}

const isApplicationLayer = (value: string | null): value is ApplicationLayer => value !== null && value in OPEN_WEATHER_LAYER_MAP

const readServerEnv = (name: string) => {
  const runtime = globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
  return runtime.process?.env?.[name]
}

const parseCoordinate = (value: string | null) => {
  if (value === null || !/^\d+$/.test(value)) return Number.NaN
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN
}

export const tileProxyResponse = (result: TileProxyResult) => {
  const headers = new Headers({
    'content-type': result.contentType,
    'x-content-type-options': 'nosniff',
  })
  for (const [name, value] of Object.entries(result.cacheHeaders)) headers.set(name, value)
  const body = new ArrayBuffer(result.body.byteLength)
  new Uint8Array(body).set(result.body)
  return new Response(body, { status: result.status, headers })
}

export function createOpenWeatherTileHandler(options: OpenWeatherTileHandlerOptions = {}) {
  const proxy = createTileProxy({
    upstreamBaseUrl: OPEN_WEATHER_TILE_BASE_URL,
    allowedLayers: Object.values(OPEN_WEATHER_LAYER_MAP),
    apiKeyQueryParameter: 'appid',
    successCacheControl: SUCCESS_CACHE_CONTROL,
    fetch: options.fetch,
  })
  const getApiKey = options.getApiKey ?? (() => readServerEnv('OPENWEATHER_API_KEY'))

  return async function handleOpenWeatherTile(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'allow': 'GET', 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' },
      })
    }

    const url = new URL(request.url)
    const applicationLayer = url.searchParams.get('layer')
    const providerLayer = isApplicationLayer(applicationLayer) ? OPEN_WEATHER_LAYER_MAP[applicationLayer] : ''
    const result = await proxy({
      layer: providerLayer,
      z: parseCoordinate(url.searchParams.get('z')),
      x: parseCoordinate(url.searchParams.get('x')),
      y: parseCoordinate(url.searchParams.get('y')),
    }, { apiKey: getApiKey(), signal: request.signal })

    return tileProxyResponse(result)
  }
}
