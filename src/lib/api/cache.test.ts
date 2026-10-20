import { afterEach, describe, expect, it, vi } from 'vitest'
import { RequestCache } from './cache'

const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0))

afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
})

describe('RequestCache', () => {
  it('deduplicates concurrent fetches and shares the result', async () => {
    let resolveRequest!: (value: string) => void
    const request = new Promise<string>(resolve => { resolveRequest = resolve })
    const fetcher = vi.fn((signal: AbortSignal) => {
      void signal
      return request
    })
    const cache = new RequestCache<string>({ storageKey: undefined })

    const first = cache.getOrFetch('same-request', fetcher)
    const second = cache.getOrFetch('same-request', fetcher)
    await flush()

    expect(fetcher).toHaveBeenCalledTimes(1)
    resolveRequest('shared result')

    await expect(first).resolves.toMatchObject({ value: 'shared result', cached: false, stale: false })
    await expect(second).resolves.toMatchObject({ value: 'shared result', cached: false, stale: false })
  })

  it('does not abort a deduplicated request while another subscriber remains', async () => {
    let resolveRequest!: (value: string) => void
    const request = new Promise<string>(resolve => { resolveRequest = resolve })
    const signals: AbortSignal[] = []
    const fetcher = vi.fn((signal: AbortSignal) => {
      signals.push(signal)
      return request
    })
    const cache = new RequestCache<string>({ storageKey: undefined })
    const firstController = new AbortController()
    const secondController = new AbortController()

    const first = cache.getOrFetch('shared-request', fetcher, { signal: firstController.signal })
    const second = cache.getOrFetch('shared-request', fetcher, { signal: secondController.signal })
    await flush()
    firstController.abort()

    await expect(first).rejects.toMatchObject({ code: 'ABORTED' })
    expect(signals).toHaveLength(1)
    expect(signals[0].aborted).toBe(false)

    resolveRequest('still usable')
    await expect(second).resolves.toMatchObject({ value: 'still usable' })
  })

  it('starts a new request after every subscriber cancels', async () => {
    const requests: Array<{ resolve: (value: string) => void; signal: AbortSignal }> = []
    const fetcher = vi.fn((signal: AbortSignal) => new Promise<string>(resolve => {
      requests.push({ resolve, signal })
    }))
    const cache = new RequestCache<string>({ storageKey: undefined })
    const controller = new AbortController()

    const cancelled = cache.getOrFetch('replace-aborted', fetcher, { signal: controller.signal })
    await flush()
    controller.abort()
    await expect(cancelled).rejects.toMatchObject({ code: 'ABORTED' })
    expect(requests[0].signal.aborted).toBe(true)

    const next = cache.getOrFetch('replace-aborted', fetcher)
    await flush()
    expect(fetcher).toHaveBeenCalledTimes(2)
    requests[1].resolve('new request')
    await expect(next).resolves.toMatchObject({ value: 'new request', cached: false })
  })

  it('expires entries at the TTL boundary and serves a stale value on refresh failure', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn()
      .mockResolvedValueOnce('first response')
      .mockRejectedValueOnce(new Error('provider unavailable'))
    const cache = new RequestCache<string>({ storageKey: undefined, ttlMs: 100, staleMs: 500 })

    await expect(cache.getOrFetch('expiring', fetcher)).resolves.toMatchObject({ cached: false, stale: false })
    vi.advanceTimersByTime(99)
    await expect(cache.getOrFetch('expiring', fetcher)).resolves.toMatchObject({ value: 'first response', cached: true, stale: false })
    vi.advanceTimersByTime(1)
    await expect(cache.getOrFetch('expiring', fetcher, { forceRefresh: true })).resolves.toMatchObject({
      value: 'first response',
      cached: true,
      stale: true,
      warning: 'provider unavailable',
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('treats a zero TTL as disabled caching even within one clock tick', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second')
    const cache = new RequestCache<string>({ storageKey: undefined, ttlMs: 0, staleMs: 0 })

    await expect(cache.getOrFetch('no-ttl', fetcher)).resolves.toMatchObject({ value: 'first', cached: false })
    await expect(cache.getOrFetch('no-ttl', fetcher)).resolves.toMatchObject({ value: 'second', cached: false })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('validates restored values before returning them', async () => {
    const storageKey = 'request-cache-validation'
    localStorage.setItem(storageKey, JSON.stringify({
      version: 1,
      entries: { city: { value: { unexpected: true }, savedAt: Date.now() } },
    }))
    const fetcher = vi.fn().mockResolvedValue('validated value')
    const cache = new RequestCache<string>({
      storageKey,
      validate: (value: unknown): value is string => typeof value === 'string',
    })

    await expect(cache.getOrFetch('city', fetcher)).resolves.toMatchObject({ value: 'validated value', cached: false })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
