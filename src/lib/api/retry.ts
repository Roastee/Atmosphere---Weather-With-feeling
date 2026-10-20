export interface RetryPolicyOptions {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  shouldRetry?: (status?: number, error?: unknown) => boolean
}

const nonNegativeNumber = (value: number | undefined, fallback: number) => {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.max(0, value)
}

const nonNegativeInteger = (value: number | undefined, fallback: number) => {
  const normalized = nonNegativeNumber(value, fallback)
  return Number.isFinite(normalized) ? Math.floor(normalized) : fallback
}

export class RetryPolicy {
  readonly maxRetries: number
  readonly baseDelayMs: number
  readonly maxDelayMs: number
  private readonly predicate?: RetryPolicyOptions['shouldRetry']

  constructor(options: RetryPolicyOptions = {}) {
    this.maxRetries = nonNegativeInteger(options.maxRetries, 2)
    this.baseDelayMs = nonNegativeNumber(options.baseDelayMs, 300)
    this.maxDelayMs = nonNegativeNumber(options.maxDelayMs, 5_000)
    this.predicate = options.shouldRetry
  }

  shouldRetry(status?: number, error?: unknown) {
    return this.predicate
      ? this.predicate(status, error)
      : status === 408 || status === 429 || (status !== undefined && status >= 500) || (status === undefined && !!error)
  }

  delay(attempt: number, retryAfter?: string | null) {
    const normalizedAttempt = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0
    let delay = this.baseDelayMs * 2 ** normalizedAttempt
    if (!Number.isFinite(delay)) delay = this.maxDelayMs

    const header = retryAfter?.trim()
    if (header) {
      const seconds = Number(header)
      const date = Date.parse(header)
      if (Number.isFinite(seconds)) delay = seconds * 1_000
      else if (!Number.isNaN(date)) delay = Math.max(0, date - Date.now())
    }

    return Math.min(this.maxDelayMs, Math.max(0, delay))
  }
}
