import { describe, expect, it, vi } from 'vitest'
import { createOpenWeatherTileHandler, OPEN_WEATHER_LAYER_MAP } from './openWeatherTile'

const key = 'server-only-openweather-test-key'
const tileResponse = (body = 'tile', status = 200, headers: Record<string, string> = {}) => new Response(body, { status, headers })
const request = (query: string, method = 'GET') => new Request(`https://atmosphere.example/api/map-tile?${query}`, { method })

describe('Vercel OpenWeather tile adapter', () => {
  it('maps an application layer to a fixed OpenWeather layer and keeps the key server-side', async () => {
    const fetchMock = vi.fn().mockResolvedValue(tileResponse('png', 200, { 'content-type': 'image/png' }))
    const handler = createOpenWeatherTileHandler({ fetch: fetchMock, getApiKey: () => key })

    const response = await handler(request('layer=temperature&z=3&x=2&y=1'))
    const [url] = fetchMock.mock.calls[0] as [string]
    const parsed = new URL(url)

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('png')
    expect(parsed.pathname).toBe(`/map/${OPEN_WEATHER_LAYER_MAP.temperature}/3/2/1.png`)
    expect(parsed.searchParams.get('appid')).toBe(key)
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('adds the configured cache policy to successful tiles without provider cache headers', async () => {
    const handler = createOpenWeatherTileHandler({ fetch: vi.fn().mockResolvedValue(tileResponse('png', 200, { 'content-type': 'image/png' })), getApiKey: () => key })

    const response = await handler(request('layer=precipitation&z=0&x=0&y=0'))

    expect(response.headers.get('cache-control')).toBe('public, max-age=60, s-maxage=300, stale-while-revalidate=600')
  })

  it('rejects unsupported layers and invalid tile coordinates before upstream access', async () => {
    const fetchMock = vi.fn()
    const handler = createOpenWeatherTileHandler({ fetch: fetchMock, getApiKey: () => key })

    const unsupported = await handler(request('layer=air&z=2&x=1&y=1'))
    const invalid = await handler(request('layer=wind&z=2&x=4&y=1'))

    expect(unsupported.status).toBe(400)
    expect(invalid.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns safe configuration errors when the key is absent', async () => {
    const fetchMock = vi.fn()
    const handler = createOpenWeatherTileHandler({ fetch: fetchMock, getApiKey: () => undefined })

    const response = await handler(request('layer=cloud&z=1&x=0&y=1'))

    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain(key)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns safe upstream failures and rejects non-GET methods', async () => {
    const handler = createOpenWeatherTileHandler({ fetch: vi.fn().mockResolvedValue(tileResponse('private upstream body', 500)), getApiKey: () => key })

    const upstreamFailure = await handler(request('layer=wind&z=1&x=0&y=1'))
    const methodFailure = await handler(request('layer=wind&z=1&x=0&y=1', 'POST'))

    expect(upstreamFailure.status).toBe(500)
    expect(await upstreamFailure.text()).not.toContain('private upstream body')
    expect(methodFailure.status).toBe(405)
    expect(methodFailure.headers.get('allow')).toBe('GET')
  })
})
