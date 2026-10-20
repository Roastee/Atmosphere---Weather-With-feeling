import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTileProxy, proxyTile } from './tileProxy'

const upstreamBaseUrl = 'https://tiles.example.test/weather'
const apiKey = 'server-only-test-key'

const bytes = (value: string) => new TextEncoder().encode(value)
const text = (value: Uint8Array) => new TextDecoder().decode(value)
const response = (body: string, status = 200, headers: Record<string, string> = {}) => new Response(body, {
  status,
  headers,
})

const makeProxy = (fetch: typeof globalThis.fetch, overrides: Partial<Parameters<typeof createTileProxy>[0]> = {}) => createTileProxy({
  upstreamBaseUrl,
  allowedLayers: ['temperature', 'wind'],
  fetch,
  ...overrides,
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('tile proxy core', () => {
  it('validates a tile, builds the fixed upstream URL at call time, and returns the tile', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('png-bytes', 200, {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=300',
      etag: '"tile-v1"',
    }))
    const proxy = makeProxy(fetchMock)

    const result = await proxy({ layer: 'temperature', z: 3, x: 2, y: 1 }, { apiKey })

    expect(result).toMatchObject({
      status: 200,
      contentType: 'image/png',
      cacheHeaders: {
        'cache-control': 'public, max-age=300',
        etag: '"tile-v1"',
      },
    })
    expect(Array.from(result.body)).toEqual(Array.from(bytes('png-bytes')))

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe('https://tiles.example.test/weather/temperature/3/2/1.png')
    expect(parsed.searchParams.get('api_key')).toBe(apiKey)
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('resolves the API key per call instead of storing it in the handler', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response('first'))
      .mockResolvedValueOnce(response('second'))
    const proxy = makeProxy(fetchMock)

    await proxy({ layer: 'wind', z: 0, x: 0, y: 0 }, { apiKey: 'first-secret' })
    await proxy({ layer: 'wind', z: 0, x: 0, y: 0 }, { apiKey: 'second-secret' })

    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.get('api_key')).toBe('first-secret')
    expect(new URL(fetchMock.mock.calls[1][0] as string).searchParams.get('api_key')).toBe('second-secret')
  })

  it('rejects a layer outside the allowlist without calling upstream', async () => {
    const fetchMock = vi.fn()
    const proxy = makeProxy(fetchMock)

    const result = await proxy({ layer: 'radar', z: 2, x: 1, y: 1 }, { apiKey })

    expect(result.status).toBe(400)
    expect(text(result.body)).toBe(JSON.stringify({ error: 'Invalid tile request' }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['negative zoom', { layer: 'temperature', z: -1, x: 0, y: 0 }],
    ['fractional zoom', { layer: 'temperature', z: 1.5, x: 0, y: 0 }],
    ['x outside the zoom range', { layer: 'temperature', z: 2, x: 4, y: 0 }],
    ['y outside the zoom range', { layer: 'temperature', z: 2, x: 0, y: 4 }],
    ['negative x', { layer: 'temperature', z: 2, x: -1, y: 0 }],
    ['numeric string coordinate', { layer: 'temperature', z: 2, x: '1', y: 0 }],
  ])('rejects %s without calling upstream', async (_name, request) => {
    const fetchMock = vi.fn()
    const proxy = makeProxy(fetchMock)

    const result = await proxy(request, { apiKey })

    expect(result.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns a safe configuration error when the server key is missing', async () => {
    const fetchMock = vi.fn()
    const proxy = makeProxy(fetchMock)

    const result = await proxy({ layer: 'temperature', z: 1, x: 0, y: 1 })

    expect(result.status).toBe(503)
    expect(result.contentType).toBe('application/json; charset=utf-8')
    expect(text(result.body)).toBe(JSON.stringify({ error: 'Tile service is unavailable' }))
    expect(result.cacheHeaders).toEqual({ 'cache-control': 'no-store' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns a generic upstream error without forwarding provider body details', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('upstream denied', 429, {
      'content-type': 'text/plain',
      'cache-control': 'private, max-age=0',
      'last-modified': 'Tue, 20 Oct 2026 12:00:00 GMT',
    }))
    const proxy = makeProxy(fetchMock)

    const result = await proxy({ layer: 'temperature', z: 2, x: 1, y: 1 }, { apiKey })

    expect(result).toMatchObject({
      status: 429,
      contentType: 'application/json; charset=utf-8',
      cacheHeaders: { 'cache-control': 'no-store' },
    })
    expect(text(result.body)).toBe(JSON.stringify({ error: 'Tile upstream unavailable' }))
    expect(text(result.body)).not.toContain('upstream denied')
  })

  it('normalizes a network error without returning its private detail', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error(`transport failed for ${apiKey}`))
    const proxy = makeProxy(fetchMock)

    const result = await proxy({ layer: 'temperature', z: 2, x: 1, y: 1 }, { apiKey })

    expect(result.status).toBe(502)
    expect(text(result.body)).toBe(JSON.stringify({ error: 'Tile upstream unavailable' }))
    expect(text(result.body)).not.toContain(apiKey)
  })

  it('returns a timeout result and aborts the upstream fetch', async () => {
    vi.useFakeTimers()
    let upstreamSignal: AbortSignal | undefined
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      upstreamSignal = init.signal as AbortSignal
      return new Promise<Response>(() => undefined)
    })
    const proxy = makeProxy(fetchMock, { timeoutMs: 25 })
    const request = proxy({ layer: 'temperature', z: 2, x: 1, y: 1 }, { apiKey })

    await vi.advanceTimersByTimeAsync(26)
    const result = await request

    expect(result.status).toBe(504)
    expect(text(result.body)).toBe(JSON.stringify({ error: 'Tile request timed out' }))
    expect(upstreamSignal?.aborted).toBe(true)
  })

  it('honors caller cancellation and forwards an abort signal to upstream', async () => {
    let upstreamSignal: AbortSignal | undefined
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      upstreamSignal = init.signal as AbortSignal
      return new Promise<Response>(() => undefined)
    })
    const controller = new AbortController()
    const proxy = makeProxy(fetchMock, { timeoutMs: 5_000 })
    const request = proxy({ layer: 'temperature', z: 2, x: 1, y: 1 }, { apiKey, signal: controller.signal })

    controller.abort()
    const result = await request

    expect(result.status).toBe(499)
    expect(text(result.body)).toBe(JSON.stringify({ error: 'Tile request cancelled' }))
    expect(upstreamSignal?.aborted).toBe(true)
  })

  it('uses a safe binary content type when upstream omits content-type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(bytes('binary tile')))
    const proxy = makeProxy(fetchMock)

    const result = await proxy({ layer: 'temperature', z: 0, x: 0, y: 0 }, { apiKey })

    expect(result.contentType).toBe('application/octet-stream')
  })

  it('applies an adapter-provided cache policy when a successful tile omits one', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('tile', 200, { 'content-type': 'image/png' }))
    const proxy = makeProxy(fetchMock, { successCacheControl: 'public, max-age=60, s-maxage=300' })

    const result = await proxy({ layer: 'temperature', z: 1, x: 1, y: 0 }, { apiKey })

    expect(result.cacheHeaders['cache-control']).toBe('public, max-age=60, s-maxage=300')
  })

  it('rejects unsafe cache policy configuration', () => {
    expect(() => makeProxy(vi.fn(), { successCacheControl: 'public\r\nset-cookie: leaked' })).toThrow('Invalid tile proxy configuration')
  })

  it('forwards only cache-related headers and never forwards unrelated or secret headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('tile', 200, {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=120',
      etag: '"cacheable"',
      expires: 'Tue, 20 Oct 2026 12:02:00 GMT',
      'x-upstream-secret': apiKey,
      'set-cookie': 'session=private',
    }))
    const proxy = makeProxy(fetchMock)

    const result = await proxy({ layer: 'wind', z: 1, x: 1, y: 0 }, { apiKey })

    expect(result.cacheHeaders).toEqual({
      'cache-control': 'public, max-age=120',
      etag: '"cacheable"',
      expires: 'Tue, 20 Oct 2026 12:02:00 GMT',
    })
    expect(JSON.stringify(result)).not.toContain(apiKey)
    expect(JSON.stringify(result)).not.toContain('session=private')
  })

  it('does not log or return the server key on generated failures', async () => {
    const consoleError = vi.spyOn(console, 'error')
    const fetchMock = vi.fn().mockRejectedValue(new Error(`secret=${apiKey}`))

    const result = await proxyTile(
      { layer: 'temperature', z: 1, x: 0, y: 0 },
      { upstreamBaseUrl, allowedLayers: ['temperature'], fetch: fetchMock, apiKey },
    )

    expect(consoleError).not.toHaveBeenCalled()
    expect(JSON.stringify(result)).not.toContain(apiKey)
    expect(text(result.body)).toBe(JSON.stringify({ error: 'Tile upstream unavailable' }))
  })
})
