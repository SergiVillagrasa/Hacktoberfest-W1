export class DeadlineExceeded extends Error {
  constructor(message = 'Deadline exceeded', options?: ErrorOptions) {
    super(message, options);
    this.name = 'DeadlineExceeded';
  }
}

export interface RetryOptions {
  deadlineMs: number;
  baseDelayMs?: number;
  signal?: AbortSignal;
  isRetryable?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export function isRetryableError(error: unknown): boolean {
  const e = error as { isRetryable?: boolean; statusCode?: number; status?: number } | null;
  if (typeof e?.isRetryable === 'boolean') return e.isRetryable;
  const status = e?.statusCode ?? e?.status;
  return status === undefined || status === 408 || status === 429 || status >= 500;
}

export async function withRetry<T>(fn: (signal: AbortSignal) => Promise<T>, opts: RetryOptions): Promise<T> {
  const { deadlineMs, baseDelayMs = 500, isRetryable = isRetryableError } = opts;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;
  if (opts.signal?.aborted) throw opts.signal.reason;
  const start = now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DeadlineExceeded()), deadlineMs);
  const onParentAbort = () => controller.abort(opts.signal?.reason);
  opts.signal?.addEventListener('abort', onParentAbort, { once: true });
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn(controller.signal);
      } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason instanceof DeadlineExceeded ? controller.signal.reason : error;
        if (!isRetryable(error)) throw error;
        const delay = baseDelayMs * 2 ** attempt;
        if (now() - start + delay >= deadlineMs) throw new DeadlineExceeded('Deadline exceeded while retrying', { cause: error });
        await sleep(delay);
      }
    }
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onParentAbort);
  }
}
