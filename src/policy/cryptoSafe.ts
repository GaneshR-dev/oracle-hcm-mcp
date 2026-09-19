/**
 * Timing-safe string compare. Different lengths still run a dummy compare.
 */
import { timingSafeEqual } from 'node:crypto';

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

export function pickBearerOrHeader(
  authorization: string | string[] | undefined,
  extra: string | string[] | undefined,
): string | undefined {
  const auth = Array.isArray(authorization) ? authorization[0] : authorization;
  if (auth?.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  const x = Array.isArray(extra) ? extra[0] : extra;
  return x?.trim() || undefined;
}
