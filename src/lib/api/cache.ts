import { ApiError } from './errors'

type Entry<T> = { value: T; savedAt: number }
type Pending<T> = { promise: Promise<T>; controller: AbortController; subscribers: Set<symbol>; cancelled: boolean }

export interface RequestCacheOptions<T = unknown> {
  ttlMs?: number
  staleMs?: number
  storageKey?: string
  /** Validate values restored from storage and values returned by fetchers. */
  validate?: (value: unknown) => value is T
  maxEntries?: number
}

const CACHE_VERSION = 1
const MAX_STORAGE_BYTES = 2_000_000
const MAX_KEY_LENGTH = 4_096
const MAX_FUTURE_MS = 5 * 60_000

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isCancellation = (error: unknown) => {
  if (error instanceof ApiError && error.code === 'ABORTED') return true
  if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') return true
  return isRecord(error) && error.name === 'AbortError'
}

const duration = (value: number | undefined, fallback: number) => {
  if (value === undefined || Number.isNaN(value)) return fallback
  return Math.max(0, value)
}

export class RequestCache<T = unknown> {
  private entries = new Map<string, Entry<T>>()
  private pending = new Map<string, Pending<T>>()
  readonly ttlMs: number
  readonly staleMs: number
  private readonly storageKey?: string
  private readonly validate?: (value: unknown) => value is T
  private readonly maxEntries: number

  constructor(options: RequestCacheOptions<T> = {}) {
    this.ttlMs = duration(options.ttlMs, 5 * 60_000)
    this.staleMs = Math.max(this.ttlMs, duration(options.staleMs, 24 * 60 * 60_000))
    this.storageKey = options.storageKey
    this.validate = options.validate
    const requestedMaxEntries = options.maxEntries ?? 50
    this.maxEntries = Number.isFinite(requestedMaxEntries)
      ? Math.max(1, Math.min(200, Math.floor(requestedMaxEntries)))
      : 50
    this.load()
  }

  private load() {
    if (!this.storageKey || typeof localStorage === 'undefined') return
    try {
      const raw = localStorage.getItem(this.storageKey)
      if (!raw || raw.length > MAX_STORAGE_BYTES) return
      const parsed: unknown = JSON.parse(raw)
      if (!isRecord(parsed)) return
      const source = parsed.version === CACHE_VERSION && isRecord(parsed.entries) ? parsed.entries : parsed
      const now = Date.now()
      const candidates: Array<[string, Entry<T>]> = []
      for (const [key, candidate] of Object.entries(source)) {
        if (!this.validKey(key) || !isRecord(candidate)) continue
        const savedAt = candidate.savedAt
        if (typeof savedAt !== 'number' || !Number.isFinite(savedAt) || savedAt < 0 || savedAt > now + MAX_FUTURE_MS) continue
        if (now - savedAt > this.staleMs) continue
        if (!this.accepts(candidate.value)) continue
        candidates.push([key, { value: candidate.value as T, savedAt }])
      }
      candidates.sort(([, a], [, b]) => b.savedAt - a.savedAt)
      for (const [key, entry] of candidates.slice(0, this.maxEntries)) this.entries.set(key, entry)
    } catch {
      // Persistent cache is disposable. A corrupt or hostile value must not
      // affect the live provider path.
      this.entries.clear()
    }
  }

  private persist() {
    if (!this.storageKey || typeof localStorage === 'undefined') return
    try {
      const entries = Object.fromEntries(Array.from(this.entries.entries()).slice(0, this.maxEntries))
      const payload = JSON.stringify({ version: CACHE_VERSION, entries })
      if (payload.length > MAX_STORAGE_BYTES) return
      localStorage.setItem(this.storageKey, payload)
    } catch {
      // Storage is optional and can be disabled, full, or non-serializable.
    }
  }

  private validKey(key: string) {
    return typeof key === 'string' && key.length > 0 && key.length <= MAX_KEY_LENGTH && !/[\u0000-\u001f\u007f]/.test(key)
  }

  private accepts(value: unknown) {
    if (!this.validate) return true
    try {
      return this.validate(value)
    } catch {
      return false
    }
  }

  private save(key: string, value: T) {
    if (!this.accepts(value)) throw new ApiError('Invalid provider response', { code: 'SCHEMA_ERROR' })
    this.entries.set(key, { value, savedAt: Date.now() })
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value
      if (typeof oldest !== 'string') break
      this.entries.delete(oldest)
    }
    this.persist()
  }

  clear() {
    this.entries.clear()
    for (const pending of this.pending.values()) {
      pending.cancelled = true
      pending.controller.abort()
    }
    this.pending.clear()
    this.persist()
  }

  async getOrFetch(key: string, fetcher: (signal: AbortSignal) => Promise<T>, options: { forceRefresh?: boolean; signal?: AbortSignal; onWarning?: (warning: string) => void } = {}): Promise<{ value: T; cached: boolean; stale: boolean; warning?: string }> {
    if (!this.validKey(key)) throw new ApiError('Invalid cache key', { code: 'INVALID_QUERY' })
    if (options.signal?.aborted) throw new ApiError('Request aborted', { code: 'ABORTED' })

    const entry = this.entries.get(key)
    const age = entry ? Math.max(0, Date.now() - entry.savedAt) : Infinity
    if (!options.forceRefresh && entry && this.ttlMs > 0 && age < this.ttlMs) return { value: entry.value, cached: true, stale: false }
    const old = entry && age < this.staleMs ? entry : undefined

    let pending = this.pending.get(key)
    if (pending?.controller.signal.aborted) {
      if (this.pending.get(key) === pending) this.pending.delete(key)
      pending = undefined
    }
    if (!pending) {
      const controller = new AbortController()
      const activePending: Pending<T> = {
        promise: Promise.resolve(undefined as T),
        controller,
        subscribers: new Set<symbol>(),
        cancelled: false,
      }
      activePending.promise = Promise.resolve()
        .then(() => fetcher(controller.signal))
        .then(value => {
          if (activePending.cancelled) throw new ApiError('Request aborted', { code: 'ABORTED' })
          this.save(key, value)
          return value
        })
        .finally(() => {
          if (this.pending.get(key)?.promise === activePending.promise) this.pending.delete(key)
        })
      pending = activePending
      this.pending.set(key, pending)
    }

    const active = pending
    const subscriber = Symbol('request-cache-subscriber')
    active.subscribers.add(subscriber)
    try {
      const value = await this.abortable(active.promise, options.signal)
      return { value, cached: false, stale: false }
    } catch (error) {
      // A caller that explicitly cancelled must never receive stale data as a
      // surprising success. Other provider errors may still use the last good
      // response, which is the app's offline behavior.
      if (isCancellation(error)) throw error
      if (old) {
        const warning = error instanceof Error ? error.message : 'Unable to refresh data'
        try {
          options.onWarning?.(warning)
        } catch {
          // A warning callback must not replace the provider error or cached result.
        }
        return { value: old.value, cached: true, stale: true, warning }
      }
      throw error
    } finally {
      active.subscribers.delete(subscriber)
      if (active.subscribers.size === 0 && this.pending.get(key) === active) {
        // Remove an abandoned request before aborting it. A new caller should
        // start a fresh request instead of joining a request that cannot finish.
        active.cancelled = true
        this.pending.delete(key)
        active.controller.abort()
      }
    }
  }

  private abortable<R>(promise: Promise<R>, signal?: AbortSignal): Promise<R> {
    if (!signal) return promise
    if (signal.aborted) return Promise.reject(new ApiError('Request aborted', { code: 'ABORTED' }))
    return new Promise((resolve, reject) => {
      let settled = false
      const cleanup = () => signal.removeEventListener('abort', abort)
      const abort = () => {
        if (settled) return
        settled = true
        cleanup()
        reject(new ApiError('Request aborted', { code: 'ABORTED' }))
      }
      signal.addEventListener('abort', abort, { once: true })
      promise.then(
        value => {
          if (settled) return
          settled = true
          cleanup()
          resolve(value)
        },
        error => {
          if (settled) return
          settled = true
          cleanup()
          reject(error)
        },
      )
      if (signal.aborted) abort()
    })
  }
}
