import { describe, expect, it, vi } from 'vitest'
import { RetryPolicy } from './retry'

describe('RetryPolicy', () => {
  it('uses exponential backoff and caps the delay', () => {
    const policy = new RetryPolicy({ baseDelayMs: 100, maxDelayMs: 450 })

    expect(policy.delay(0)).toBe(100)
    expect(policy.delay(1)).toBe(200)
    expect(policy.delay(2)).toBe(400)
    expect(policy.delay(3)).toBe(450)
  })

  it('honors Retry-After seconds and HTTP dates within the configured cap', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-19T12:00:00.000Z'))
    const policy = new RetryPolicy({ baseDelayMs: 100, maxDelayMs: 5_000 })

    expect(policy.delay(0, '2')).toBe(2_000)
    expect(policy.delay(0, '2026-10-19T12:00:03.000Z')).toBe(3_000)
    expect(policy.delay(0, '')).toBe(100)
    expect(policy.delay(0, 'not-a-date')).toBe(100)
    vi.useRealTimers()
  })

  it('normalizes invalid retry settings and keeps the default retry statuses', () => {
    const policy = new RetryPolicy({ maxRetries: 2.8, baseDelayMs: -1, maxDelayMs: Number.NaN })

    expect(policy.maxRetries).toBe(2)
    expect(policy.baseDelayMs).toBe(0)
    expect(policy.maxDelayMs).toBe(5_000)
    expect(policy.shouldRetry(408)).toBe(true)
    expect(policy.shouldRetry(429)).toBe(true)
    expect(policy.shouldRetry(503)).toBe(true)
    expect(policy.shouldRetry(400)).toBe(false)
    expect(policy.shouldRetry(undefined, new Error('offline'))).toBe(true)
  })

  it('uses a custom retry predicate when supplied', () => {
    const predicate = vi.fn((status?: number) => status === 418)
    const policy = new RetryPolicy({ shouldRetry: predicate })

    expect(policy.shouldRetry(418)).toBe(true)
    expect(policy.shouldRetry(500)).toBe(false)
    expect(predicate).toHaveBeenCalledWith(500, undefined)
  })
})
