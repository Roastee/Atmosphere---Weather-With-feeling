/**
 * Small logging boundary for the browser app.
 *
 * Error objects can contain request URLs, response bodies, user input, or
 * component stacks. Keep those details out of logs by only emitting stable
 * error metadata and a small allow-list of operational fields.
 */
export type SafeLogContext = Partial<{
  feature: string
  operation: string
  route: string
  code: string
  status: number
  retryCount: number
  cached: boolean
  stale: boolean
}>

type SafeError = {
  name: string
  code?: string
  status?: number
}

const SAFE_CONTEXT_KEYS = new Set<keyof SafeLogContext>([
  'feature',
  'operation',
  'route',
  'code',
  'status',
  'retryCount',
  'cached',
  'stale',
])

const boundedString = (value: string) => value.slice(0, 80).replace(/[\r\n\t]/g, ' ')

function safeError(error: unknown): SafeError | undefined {
  if (error === undefined || error === null) return undefined
  if (error instanceof Error) {
    const candidate = error as Error & { code?: unknown; status?: unknown }
    return {
      name: boundedString(candidate.name || 'Error'),
      ...(typeof candidate.code === 'string' ? { code: boundedString(candidate.code) } : {}),
      ...(typeof candidate.status === 'number' && Number.isFinite(candidate.status) ? { status: candidate.status } : {}),
    }
  }
  return { name: 'UnknownError' }
}

function safeContext(context?: SafeLogContext): Record<string, string | number | boolean> | undefined {
  if (!context) return undefined
  const result: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(context) as [keyof SafeLogContext, SafeLogContext[keyof SafeLogContext]][]) {
    if (!SAFE_CONTEXT_KEYS.has(key) || value === undefined) continue
    if (typeof value === 'string') result[key] = boundedString(value)
    else if (typeof value === 'number' && Number.isFinite(value)) result[key] = value
    else if (typeof value === 'boolean') result[key] = value
  }
  return Object.keys(result).length ? result : undefined
}

function write(level: 'debug' | 'info' | 'warn' | 'error', event: string, error?: unknown, context?: SafeLogContext) {
  const record = {
    event: boundedString(event),
    ...(safeError(error) ? { error: safeError(error) } : {}),
    ...(safeContext(context) ? { context: safeContext(context) } : {}),
  }
  // Keep the logger usable in test/SSR-like environments where console may be
  // incomplete, while never logging the original error or arbitrary context.
  const target = typeof console !== 'undefined' && console[level] ? console[level].bind(console) : undefined
  target?.('[Atmosphere]', record)
}

export const logger = {
  debug: (event: string, context?: SafeLogContext) => write('debug', event, undefined, context),
  info: (event: string, context?: SafeLogContext) => write('info', event, undefined, context),
  warn: (event: string, error?: unknown, context?: SafeLogContext) => write('warn', event, error, context),
  error: (event: string, error?: unknown, context?: SafeLogContext) => write('error', event, error, context),
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && (('code' in error && (error as Error & { code?: unknown }).code === 'ABORTED') || error.name === 'AbortError')
}
