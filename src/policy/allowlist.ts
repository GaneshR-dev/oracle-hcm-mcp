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

/**
 * Curated resource roots allowed for generic get/mutate.
 * Primary Fusion names first; legacy aliases kept for compatibility.
 */
const ALLOWED_ROOTS = [
  // Core people / absences
  'workers',
  'absences',
  'planBalances',
  'absencesBalances',
  'areasOfResponsibility',
  'allocatedChecklists',
  'businessProcessNotifications',
  'workflowNotifications',
  'workerAssignments',
  'emps',
  'publicWorkers',
  'hcmContacts',
  'workerEmails',
  'workerPhones',
  'nationalIdentifiers',
  'positions',
  // Org LOVs
  'organizations',
  'locations',
  'jobs',
  'grades',
  // Time / talent / payroll
  'timeRecords',
  'timeCards',
  'workSchedules',
  'talentPersonProfiles',
  'goals',
  'performanceDocuments',
  'learningEnrollments',
  'payrollRelationships',
  'payslips',
  'bankAccounts',
  'personalPaymentMethods',
  'salaryBases',
  'elementEntries',
  'calculationCards',
  'compensationHistories',
  // Recruiting / benefits
  'recruitingJobRequisitions',
  'recruitingCandidates',
  'benefitEnrollments',
  // Absence LOVs
  'absenceTypes',
  'absencePlans',
  // Recruiting depth / person deep-read (v0.5)
  'recruitingJobOffers',
  'recruitingInterviews',
  'recruitingCandidateAttachments',
  'workerLegislativeData',
  'assignmentHistories',
  // Atom / change
  'atomfeeds',
  'atomFeeds',
  // v0.6 domains
  'reviewCycles',
  'performanceFeedback',
  'checkIns',
  'learningAssignments',
  'learningCompletions',
  'salaryBases',
  'gradeSteps',
  'jobFamilies',
  'departments',
  'documentRecords',
  'workerJourneys',
  'journeyTasks',
  'benefitDependents',
  'lifeEvents',
  'talentPools',
  'payrollCosting',
  'otbiReports',
];

export function normalizeResourcePath(path: string): string {
  let p = path.trim();
  if (p.startsWith('/')) p = p.slice(1);
  p = p.replace(/^resources\/[^/]+\//i, '');
  p = p.replace(/^hcmRestApi\//i, '');
  return p;
}

export function isBlockedPath(path: string): boolean {
  const p = normalizeResourcePath(path);
  return BLOCKED_PATTERNS.some((re) => re.test(p));
}

const runtimeAllowlistExtras = new Set<string>();

export function addAllowlistRoots(roots: string[]): string[] {
  const added: string[] = [];
  for (const r of roots) {
    if (/^[A-Za-z][A-Za-z0-9_]*$/.test(r) && !isBlockedPath(r) && !ALLOWED_ROOTS.includes(r) && !runtimeAllowlistExtras.has(r)) {
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
  const p = normalizeResourcePath(path);
  const root = p.split(/[/?]/)[0] ?? '';
  return ALLOWED_ROOTS.includes(root) || runtimeAllowlistExtras.has(root);
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
