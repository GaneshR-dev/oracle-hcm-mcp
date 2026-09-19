/**
 * Token-bucket rate limit + exponential backoff with Retry-After awareness.
 * Tunable via ORACLE_HCM_RATE_* env. Unofficial — local process only.
 */

export class RateLimiter {
  private tokens: number;
  private last = Date.now();

  constructor(
    private capacity = Number(process.env.ORACLE_HCM_RATE_CAPACITY ?? 40),
    private refillPerSec = Number(process.env.ORACLE_HCM_RATE_REFILL ?? 12),
  ) {
    this.tokens = capacity;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.last) / 1000;
    this.last = now;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
  }

  async take(cost = 1): Promise<void> {
    for (;;) {
      this.refill();
      if (this.tokens >= cost) {
        this.tokens -= cost;
        return;
      }
      const waitMs = Math.ceil(((cost - this.tokens) / this.refillPerSec) * 1000);
      await sleep(Math.min(Math.max(waitMs, 25), 2000));
    }
  }
}

export type BackoffOpts = {
  retries?: number;
  baseMs?: number;
  maxMs?: number;
  /** Optional Retry-After seconds from last 429 response */
  getRetryAfterSec?: (err: unknown) => number | undefined;
};

export async function withBackoff<T>(
  fn: () => Promise<T>,
  opts: BackoffOpts = {},
): Promise<T> {
  const retries = opts.retries ?? Number(process.env.ORACLE_HCM_HTTP_RETRIES ?? 4);
  const baseMs = opts.baseMs ?? Number(process.env.ORACLE_HCM_BACKOFF_BASE_MS ?? 250);
  const maxMs = opts.maxMs ?? Number(process.env.ORACLE_HCM_BACKOFF_MAX_MS ?? 8000);
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const status = (e as { status?: number })?.status;
      if (status && status < 500 && status !== 429) throw e;
      if (i === retries) break;
      const retryAfter = opts.getRetryAfterSec?.(e);
      const jitter = Math.floor(Math.random() * 80);
      const expo = Math.min(maxMs, baseMs * 2 ** i + jitter);
      const wait = retryAfter != null ? Math.min(maxMs, retryAfter * 1000 + jitter) : expo;
      await sleep(wait);
    }
  }
  throw lastErr;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
