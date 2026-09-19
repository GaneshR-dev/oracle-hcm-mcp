/**
 * Tenant OpenAPI / ADF describe → allowlist refresh helpers.
 * Merges discovered roots into runtime allowlist (does not weaken CE blocklist).
 * Unofficial — not Oracle OpenAPI product.
 */

import {
  ALLOWED_ROOTS,
  isBlockedPath,
  addAllowlistRoots,
  listAllowlistRoots,
} from '../policy/allowlist.js';

const BLOCKED = [/ce\//i, /generative.?ai/i, /\/ai\//i, /oracle.?internal/i, /\/fai\//i, /llm/i];

export function extractRootsFromOpenApi(doc: unknown): string[] {
  const roots = new Set<string>();
  const visit = (obj: unknown): void => {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (const x of obj) visit(x);
      return;
    }
    const rec = obj as Record<string, unknown>;
    if (rec.paths && typeof rec.paths === 'object') {
      for (const p of Object.keys(rec.paths as object)) {
        if (BLOCKED.some((re) => re.test(p))) continue;
        const seg = p.replace(/^\//, '').split('/')[0];
        if (seg && !seg.includes('{') && /^[A-Za-z][A-Za-z0-9_]*$/.test(seg)) roots.add(seg);
      }
    }
    const items = (rec.items ?? rec.Resources ?? rec.resources) as unknown;
    if (Array.isArray(items)) {
      for (const it of items) {
        if (it && typeof it === 'object') {
          const n = (it as Record<string, unknown>).name ?? (it as Record<string, unknown>).Name;
          if (typeof n === 'string' && /^[A-Za-z][A-Za-z0-9_]*$/.test(n)) roots.add(n);
        }
      }
    }
    for (const v of Object.values(rec)) visit(v);
  };
  visit(doc);
  return [...roots].filter((r) => !isBlockedPath(r)).sort();
}

export function mergeAllowlistRoots(roots: string[]): {
  added: string[];
  skippedBlocked: string[];
  total: number;
} {
  const skippedBlocked = roots.filter((r) => isBlockedPath(r) || BLOCKED.some((re) => re.test(r)));
  const safe = roots.filter((r) => !skippedBlocked.includes(r));
  const added = addAllowlistRoots(safe);
  return { added, skippedBlocked, total: listAllowlistRoots().length };
}

export function suggestAllowlistDiff(discovered: string[]): Record<string, unknown> {
  const known = new Set(ALLOWED_ROOTS);
  const newRoots = discovered.filter((r) => !known.has(r) && !isBlockedPath(r));
  const already = discovered.filter((r) => known.has(r));
  return {
    discovered: discovered.length,
    alreadyAllowlisted: already.length,
    candidates: newRoots,
    note: 'Review candidates before production use. CE/AI paths remain blocked. Unofficial.',
  };
}
