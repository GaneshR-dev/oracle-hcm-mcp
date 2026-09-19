/**
 * Simple token-bucket rate limit + exponential backoff helper for HCM HTTP.
 * Unofficial — local process only.
 */

export class RateLimiter {
  private tokens: number;
  private last = Date.now();

  constructor(
    private capacity = 30,
    private refillPerSec = 10,
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

export async function withBackoff<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseMs?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseMs = opts.baseMs ?? 200;
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const status = (e as { status?: number })?.status;
      if (status && status < 500 && status !== 429) throw e;
      if (i === retries) break;
      await sleep(baseMs * 2 ** i + Math.floor(Math.random() * 50));
    }
  }
  throw lastErr;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
