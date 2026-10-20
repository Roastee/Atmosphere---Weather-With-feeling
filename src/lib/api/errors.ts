export class ApiError extends Error {
  readonly status?: number; readonly code: string; readonly details?: unknown;
  constructor(message: string, options: { status?: number; code?: string; details?: unknown; cause?: unknown } = {}) {
    super(message); this.name = 'ApiError'; this.status = options.status; this.code = options.code ?? 'API_ERROR'; this.details = options.details;
    if (options.cause !== undefined) (this as Error & { cause?: unknown }).cause = options.cause;
  }
}
