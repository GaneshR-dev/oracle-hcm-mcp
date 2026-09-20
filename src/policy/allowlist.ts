/**
 * Allowlist / blocklist for generic REST paths under HCM resources.
 * Canonicalizes (decode, reject .. / schemes) BEFORE root matching.
 * Blocks Oracle-internal and generative-AI style CE endpoints.
 *
 * Roots are Fusion HCM REST collection names from
 * https://docs.oracle.com/en/cloud/saas/human-resources/farws/rest-endpoints.html
 * (version 11.13.18.05). Invented aliases are not listed.
 */

export type CanonicalResourcePath = {
  /** Percent-encoded path under resources/{version}/ */
  resourcePath: string;
  root: string;
  query?: string;
};

const BLOCKED_PATTERNS: RegExp[] = [
  /(?:^|\/)ce(?:\/|$)/i,
  /generative.?ai/i,
  /(?:^|\/)ai(?:\/|$)/i,
  /oracle.?internal/i,
  /(?:^|\/)internal(?:\/|$)/i,
  /(?:^|\/)fai(?:\/|$)/i,
  /(?:^|\/)cohere(?:\/|$)/i,
  /(?:^|\/)llm(?:\/|$)/i,
  /chat.?completion/i,
  /(?:^|\/)embedding(?:\/|$)/i,
];

/**
 * Official Fusion HCM REST collection roots only.
 * Child resources (emails, phones, assignments, tasks, …) are allowlisted
 * because canonicalize uses the first segment as root (e.g. workers/{id}/child/emails).
 * Atom feeds are NOT resources/ collections — see src/policy/atom.ts.
 */
const ALLOWED_ROOTS = [
  'workers',
  'publicWorkers',
  'emps',
  'absences',
  'planBalances',
  'areasOfResponsibility',
  'allocatedChecklists',
  'businessProcessNotifications',
  'hcmContacts',
  'positions',
  'organizations',
  'locations',
  'locationsV2',
  'jobs',
  'grades',
  'jobFamilies',
  'talentPersonProfiles',
  'documentRecords',
  'payrollRelationships',
  'personalPaymentMethods',
  'payslips',
  'elementEntries',
  'benefitEnrollments',
  'recruitingJobRequisitions',
  'recruitingCandidates',
  'recruitingJobOffers',
  'workerJourneys',
  'workerJourneyTasks',
  'timeRecordGroups',
  'timeRecordEventRequests',
  'workforceScheduleDefinitions',
  'goalPlans',
  'performanceEvaluations',
  'checkInDocuments',
  'learnerLearningRecords',
  'salaryBasisLov',
  'calculationEntries',
  'salaries',
  'absenceTypesLOV',
  'absencePlansLOV',
  'gradeStepsLOV',
  'lifeEventsLOV',
  'talentPoolsLOV',
  'assignmentCosting',
  'payrollRelationshipCosting',
  'timeEventRequests',
  'jobsLov',
  'gradesLov',
  'gradeLaddersLov',
  'gradeRatesLOV',
  'locationsLov',
];

export function canonicalizeResourcePath(path: string): CanonicalResourcePath {
  if (typeof path !== 'string' || !path.trim()) {
    throw new Error('Resource path required');
  }
  let raw = path.trim();
  if (raw.includes('\0')) throw new Error('Invalid resource path');
  const hash = raw.indexOf('#');
  if (hash >= 0) raw = raw.slice(0, hash);

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) || raw.startsWith('//')) {
    throw new Error(`Absolute / scheme-relative paths are not allowed: ${path}`);
  }

  let query: string | undefined;
  const q = raw.indexOf('?');
  if (q >= 0) {
    query = raw.slice(q + 1);
    raw = raw.slice(0, q);
    if (query.includes('?') || query.includes('#')) {
      throw new Error('Invalid query string');
    }
  }

  raw = raw.replace(/\\/g, '/');
  raw = raw.replace(/^\/+/, '');
  raw = raw.replace(/^hcmRestApi\/+/i, '');
  raw = raw.replace(/^resources\/[^/]+\/+/i, '');

  const parts = raw.split('/').filter((s) => s.length > 0);
  const decodedSegs: string[] = [];
  for (const seg of parts) {
    let d = seg;
    for (let i = 0; i < 4; i++) {
      try {
        const next = decodeURIComponent(d.replace(/\+/g, '%20'));
        if (next === d) break;
        d = next;
      } catch {
        break;
      }
    }
    if (d === '.' || d === '..' || d === '') {
      throw new Error(`Path traversal rejected: ${path}`);
    }
    if (d.includes('/') || d.includes('\\') || d.includes('\0') || d.includes('://')) {
      throw new Error(`Invalid path segment: ${path}`);
    }
    decodedSegs.push(d);
  }
  if (decodedSegs.length === 0) {
    throw new Error('Resource path required');
  }
  const root = decodedSegs[0]!;
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(root)) {
    throw new Error(`Invalid resource root: ${root}`);
  }
  return {
    resourcePath: decodedSegs.map((s) => encodeURIComponent(s)).join('/'),
    root,
    query,
  };
}

/** Strip prefixes only — prefer canonicalizeResourcePath for security checks. */
export function normalizeResourcePath(path: string): string {
  try {
    const c = canonicalizeResourcePath(path);
    return c.query ? `${c.resourcePath}?${c.query}` : c.resourcePath;
  } catch {
    let p = path.trim();
    if (p.startsWith('/')) p = p.slice(1);
    p = p.replace(/^resources\/[^/]+\//i, '');
    p = p.replace(/^hcmRestApi\//i, '');
    return p;
  }
}

export function isBlockedPath(path: string): boolean {
  try {
    const c = canonicalizeResourcePath(path);
    const hay = `${c.resourcePath}${c.query ? `?${c.query}` : ''}`;
    return BLOCKED_PATTERNS.some((re) => re.test(hay) || re.test(c.root));
  } catch {
    // Invalid / traversal paths are treated as blocked
    return true;
  }
}

const runtimeAllowlistExtras = new Set<string>();

export function addAllowlistRoots(roots: string[]): string[] {
  const added: string[] = [];
  for (const r of roots) {
    if (
      /^[A-Za-z][A-Za-z0-9_]*$/.test(r) &&
      !isBlockedPath(r) &&
      !ALLOWED_ROOTS.includes(r) &&
      !runtimeAllowlistExtras.has(r)
    ) {
      runtimeAllowlistExtras.add(r);
      added.push(r);
    }
  }
  return added;
}

export function listAllowlistRoots(): string[] {
  return [...new Set([...ALLOWED_ROOTS, ...runtimeAllowlistExtras])].sort();
}

export function isAllowlistedPath(path: string): boolean {
  if (isBlockedPath(path)) return false;
  try {
    const c = canonicalizeResourcePath(path);
    return ALLOWED_ROOTS.includes(c.root) || runtimeAllowlistExtras.has(c.root);
  } catch {
    return false;
  }
}

export function assertAllowlisted(path: string): CanonicalResourcePath {
  let canon: CanonicalResourcePath;
  try {
    canon = canonicalizeResourcePath(path);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : `Invalid resource path: ${path}`);
  }
  const hay = `${canon.resourcePath}${canon.query ? `?${canon.query}` : ''}`;
  if (BLOCKED_PATTERNS.some((re) => re.test(hay) || re.test(canon.root))) {
    throw new Error(
      `Path blocked by policy (Oracle-internal / CE generative AI style paths are not allowed): ${path}`,
    );
  }
  if (!ALLOWED_ROOTS.includes(canon.root) && !runtimeAllowlistExtras.has(canon.root)) {
    throw new Error(
      `Path not in allowlist. Allowed roots: ${ALLOWED_ROOTS.join(', ')}. Got: ${path}`,
    );
  }
  return canon;
}

export { ALLOWED_ROOTS, BLOCKED_PATTERNS };
