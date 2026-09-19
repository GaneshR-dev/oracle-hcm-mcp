/**
 * Allowlist / blocklist for generic REST paths under HCM resources.
 * Blocks Oracle-internal and generative-AI style CE endpoints.
 */

const BLOCKED_PATTERNS: RegExp[] = [
  /\/ce\//i,
  /generative.?ai/i,
  /\/ai\//i,
  /oracle.?internal/i,
  /\/internal\//i,
  /\/fai\//i,
  /cohere/i,
  /llm/i,
  /chat.?completion/i,
  /embedding/i,
];

/** Curated resource roots allowed for generic get/mutate */
const ALLOWED_ROOTS = [
  'workers',
  'absences',
  'absencesBalances',
  'areasOfResponsibility',
  'allocatedChecklists',
  'workflowNotifications',
  'workerAssignments',
  'emps',
  'publicWorkers',
  'hcmContacts',
];

export function normalizeResourcePath(path: string): string {
  let p = path.trim();
  if (p.startsWith('/')) p = p.slice(1);
  // strip leading resources/version if present
  p = p.replace(/^resources\/[^/]+\//i, '');
  p = p.replace(/^hcmRestApi\//i, '');
  return p;
}

export function isBlockedPath(path: string): boolean {
  const p = normalizeResourcePath(path);
  return BLOCKED_PATTERNS.some((re) => re.test(p));
}

export function isAllowlistedPath(path: string): boolean {
  if (isBlockedPath(path)) return false;
  const p = normalizeResourcePath(path);
  const root = p.split(/[/?]/)[0] ?? '';
  return ALLOWED_ROOTS.includes(root);
}

export function assertAllowlisted(path: string): void {
  if (isBlockedPath(path)) {
    throw new Error(
      `Path blocked by policy (Oracle-internal / CE generative AI style paths are not allowed): ${path}`,
    );
  }
  if (!isAllowlistedPath(path)) {
    throw new Error(
      `Path not in allowlist. Allowed roots: ${ALLOWED_ROOTS.join(', ')}. Got: ${path}`,
    );
  }
}

export { ALLOWED_ROOTS, BLOCKED_PATTERNS };
