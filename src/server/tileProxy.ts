const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_MAX_ZOOM = 22
const DEFAULT_API_KEY_QUERY_PARAMETER = 'api_key'
const TILE_PATH_SUFFIX = '.png'

const layerNamePattern = /^[A-Za-z0-9_-]{1,64}$/
const queryParameterPattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/

/**
 * The default names are intentionally provider-neutral. A caller can supply a
 * narrower allowlist for the fixed upstream configured for its application.
 */
export const DEFAULT_ALLOWED_LAYERS = ['temperature', 'precipitation', 'wind', 'cloud', 'air'] as const

const cacheHeaderNames = [
  'cache-control',
  'cdn-cache-control',
  'surrogate-control',
  'etag',
  'expires',
  'last-modified',
  'age',
  'vary',
] as const

export interface TileProxyRequest {
  readonly layer: string
  readonly z: number
  readonly x: number
  readonly y: number
}

/**
 * Values supplied by a server adapter for one invocation. The API key is
 * deliberately not part of the long-lived proxy configuration: an adapter can
 * resolve its server secret immediately before calling the handler.
 */
export interface TileProxyCallOptions {
  readonly apiKey?: string
  readonly signal?: AbortSignal
}

export interface TileProxyConfig {
  /** A trusted, fixed HTTPS/HTTP base URL. It is never taken from a tile request. */
  readonly upstreamBaseUrl: string
  readonly allowedLayers?: readonly string[]
  readonly maxZoom?: number
  readonly timeoutMs?: number
  /** The fixed query parameter used to authenticate the configured upstream. */
  readonly apiKeyQueryParameter?: string
  /** Optional cache policy used when a successful upstream omits cache-control. */
  readonly successCacheControl?: string
  /** Injected for adapters and tests; no platform-specific fetch API is used. */
  readonly fetch?: typeof fetch
}

export interface TileProxyResult {
  readonly status: number
  readonly contentType: string
  readonly body: Uint8Array
  readonly cacheHeaders: Readonly<Record<string, string>>
}

export type TileProxyHandler = (
  request: unknown,
  call?: TileProxyCallOptions,
) => Promise<TileProxyResult>

export type DirectTileProxyOptions = TileProxyConfig & TileProxyCallOptions

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const invalidConfiguration = () => new TypeError('Invalid tile proxy configuration')

const normalizeBaseUrl = (value: string) => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw invalidConfiguration()
  }

  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password || url.hash) {
    throw invalidConfiguration()
  }

  return url
}

const normalizeAllowedLayers = (values: readonly string[] | undefined) => {
  const layers = values ?? DEFAULT_ALLOWED_LAYERS
  if (layers.length === 0 || layers.some(layer => typeof layer !== 'string' || !layerNamePattern.test(layer))) {
    throw invalidConfiguration()
  }
  return new Set(layers)
}

const normalizeIntegerOption = (value: number | undefined, fallback: number, maximum: number) => {
  if (value === undefined) return fallback
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) throw invalidConfiguration()
  return value
}

const normalizeTimeout = (value: number | undefined) => {
  if (value === undefined) return DEFAULT_TIMEOUT_MS
  if (!Number.isFinite(value) || value <= 0) throw invalidConfiguration()
  return Math.max(1, Math.floor(value))
}

const normalizeQueryParameter = (value: string | undefined) => {
  const parameter = value ?? DEFAULT_API_KEY_QUERY_PARAMETER
  if (!queryParameterPattern.test(parameter)) throw invalidConfiguration()
  return parameter
}

const normalizeCacheControl = (value: string | undefined) => {
  if (value === undefined) return undefined
  if (value.length > 512 || /[\r\n]/.test(value)) throw invalidConfiguration()
  return value
}

const jsonBody = (message: string) => new TextEncoder().encode(JSON.stringify({ error: message }))

const errorResult = (status: number, message: string): TileProxyResult => ({
  status,
  contentType: 'application/json; charset=utf-8',
  body: jsonBody(message),
  cacheHeaders: { 'cache-control': 'no-store' },
})

const readCacheHeaders = (headers: Headers) => {
  const result: Record<string, string> = {}
  for (const name of cacheHeaderNames) {
    const value = headers.get(name)
    if (value !== null) result[name] = value
  }
  return result
}

const responseResult = async (response: Response, successCacheControl?: string): Promise<TileProxyResult> => {
  const cacheHeaders = readCacheHeaders(response.headers)
  if (response.ok && !cacheHeaders['cache-control'] && successCacheControl) cacheHeaders['cache-control'] = successCacheControl
  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    body: new Uint8Array(await response.arrayBuffer()),
    cacheHeaders,
  }
}

const isValidTileCoordinate = (value: unknown, maximum: number): value is number => (
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum
)

const validateTileRequest = (
  value: unknown,
  allowedLayers: ReadonlySet<string>,
  maxZoom: number,
): TileProxyRequest | undefined => {
  if (!isRecord(value) || typeof value.layer !== 'string' || !allowedLayers.has(value.layer)) return undefined
  if (!isValidTileCoordinate(value.z, maxZoom)) return undefined

  const tileCount = 2 ** value.z
  if (!isValidTileCoordinate(value.x, tileCount - 1) || !isValidTileCoordinate(value.y, tileCount - 1)) return undefined

  return {
    layer: value.layer,
    z: value.z,
    x: value.x,
    y: value.y,
  }
}

const buildUpstreamUrl = (
  baseUrl: URL,
  request: TileProxyRequest,
  apiKeyQueryParameter: string,
  apiKey: string,
) => {
  const url = new URL(baseUrl.toString())
  const basePath = url.pathname.replace(/\/+$/, '')
  url.pathname = `${basePath}/${encodeURIComponent(request.layer)}/${request.z}/${request.x}/${request.y}${TILE_PATH_SUFFIX}`
  url.searchParams.set(apiKeyQueryParameter, apiKey)
  url.hash = ''
  return url.toString()
}

const timeoutMarker = Symbol('tile-proxy-timeout')
const cancellationMarker = Symbol('tile-proxy-cancellation')

const createHandler = (config: TileProxyConfig): TileProxyHandler => {
  const baseUrl = normalizeBaseUrl(config.upstreamBaseUrl)
  const allowedLayers = normalizeAllowedLayers(config.allowedLayers)
  const maxZoom = normalizeIntegerOption(config.maxZoom, DEFAULT_MAX_ZOOM, 30)
  const timeoutMs = normalizeTimeout(config.timeoutMs)
  const apiKeyQueryParameter = normalizeQueryParameter(config.apiKeyQueryParameter)
  const successCacheControl = normalizeCacheControl(config.successCacheControl)

  return async (candidate, call = {}) => {
    const request = validateTileRequest(candidate, allowedLayers, maxZoom)
    if (!request) return errorResult(400, 'Invalid tile request')

    const apiKey = call.apiKey
    if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return errorResult(503, 'Tile service is unavailable')
    }

    if (call.signal?.aborted) return errorResult(499, 'Tile request cancelled')

    const fetchImplementation = config.fetch ?? globalThis.fetch
    if (typeof fetchImplementation !== 'function') return errorResult(503, 'Tile service is unavailable')

    const upstreamUrl = buildUpstreamUrl(baseUrl, request, apiKeyQueryParameter, apiKey)
    const controller = new AbortController()
    let timedOut = false
    let cancelled = false
    let operationSettled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let onExternalAbort: (() => void) | undefined

    const operation = (async () => {
      const response = await fetchImplementation(upstreamUrl, { signal: controller.signal })
      if (!response.ok) return errorResult(response.status, 'Tile upstream unavailable')
      return responseResult(response, successCacheControl)
    })()

    void operation.then(
      () => { operationSettled = true },
      () => { operationSettled = true },
    )

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true
        controller.abort()
        reject(timeoutMarker)
      }, timeoutMs)
    })

    let cancellationPromise: Promise<never> | undefined
    if (call.signal) {
      cancellationPromise = new Promise<never>((_, reject) => {
        onExternalAbort = () => {
          cancelled = true
          controller.abort()
          reject(cancellationMarker)
        }
        call.signal?.addEventListener('abort', onExternalAbort, { once: true })
        if (call.signal?.aborted) onExternalAbort()
      })
    }

    try {
      const pending = [operation, timeoutPromise]
      if (cancellationPromise) pending.push(cancellationPromise)
      return await Promise.race(pending)
    } catch (error) {
      if (cancelled || error === cancellationMarker) return errorResult(499, 'Tile request cancelled')
      if (timedOut || error === timeoutMarker) return errorResult(504, 'Tile request timed out')
      return errorResult(502, 'Tile upstream unavailable')
    } finally {
      if (timer !== undefined) clearTimeout(timer)
      if (onExternalAbort && call.signal) call.signal.removeEventListener('abort', onExternalAbort)
      if (!operationSettled) controller.abort()
    }
  }
}

/**
 * Build a reusable framework-neutral handler. Adapters only need to translate
 * their incoming request into TileProxyRequest and their secret store into the
 * per-call apiKey value, then translate TileProxyResult into their response.
 */
export const createTileProxy = createHandler

/**
 * Convenience form for adapters that do not need to retain a configured
 * handler. The upstream URL and allowlist remain trusted configuration; only
 * the API key and cancellation signal are per-call values.
 */
export const proxyTile = async (
  request: unknown,
  options: DirectTileProxyOptions,
): Promise<TileProxyResult> => {
  const { apiKey, signal, ...config } = options
  return createHandler(config)(request, { apiKey, signal })
}
