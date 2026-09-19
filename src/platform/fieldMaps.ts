/**
 * Oracle Fusion field ↔ friendly name maps for agent UX.
 * Unofficial curated subset — not exhaustive ADF describe.
 */

export type FieldMapEntry = {
  oracle: string;
  friendly: string;
  domain: string;
  notes?: string;
};

export const FIELD_MAPS: FieldMapEntry[] = [
  { oracle: 'PersonNumber', friendly: 'person_number', domain: 'worker' },
  { oracle: 'WorkerId', friendly: 'worker_id', domain: 'worker' },
  { oracle: 'DisplayName', friendly: 'display_name', domain: 'worker' },
  { oracle: 'AssignmentId', friendly: 'assignment_id', domain: 'assignment' },
  { oracle: 'AssignmentNumber', friendly: 'assignment_number', domain: 'assignment' },
  { oracle: 'AssignmentStatusType', friendly: 'assignment_status', domain: 'assignment' },
  { oracle: 'AbsenceId', friendly: 'absence_id', domain: 'absence' },
  { oracle: 'absenceType', friendly: 'absence_type', domain: 'absence' },
  { oracle: 'startDate', friendly: 'start_date', domain: 'absence' },
  { oracle: 'endDate', friendly: 'end_date', domain: 'absence' },
  { oracle: 'planName', friendly: 'plan_name', domain: 'absence' },
  { oracle: 'balance', friendly: 'balance_days', domain: 'absence' },
  { oracle: 'OrganizationId', friendly: 'organization_id', domain: 'org' },
  { oracle: 'OrganizationCode', friendly: 'org_code', domain: 'org' },
  { oracle: 'ParentOrganizationId', friendly: 'parent_org_id', domain: 'org' },
  { oracle: 'JobId', friendly: 'job_id', domain: 'job' },
  { oracle: 'JobCode', friendly: 'job_code', domain: 'job' },
  { oracle: 'JobFamilyId', friendly: 'job_family_id', domain: 'workforce' },
  { oracle: 'JobFamilyName', friendly: 'job_family', domain: 'workforce' },
  { oracle: 'PositionId', friendly: 'position_id', domain: 'workforce' },
  { oracle: 'PositionCode', friendly: 'position_code', domain: 'workforce' },
  { oracle: 'GradeId', friendly: 'grade_id', domain: 'compensation' },
  { oracle: 'GradeStepId', friendly: 'grade_step_id', domain: 'compensation' },
  { oracle: 'SalaryBasisId', friendly: 'salary_basis_id', domain: 'compensation' },
  { oracle: 'Amount', friendly: 'amount', domain: 'compensation' },
  { oracle: 'AnnualAmount', friendly: 'annual_amount', domain: 'compensation' },
  { oracle: 'ProposedSalary', friendly: 'proposed_salary', domain: 'recruiting' },
  { oracle: 'DocumentRecordId', friendly: 'document_id', domain: 'documents' },
  { oracle: 'DocumentType', friendly: 'document_type', domain: 'documents' },
  { oracle: 'JourneyId', friendly: 'journey_id', domain: 'journeys' },
  { oracle: 'JourneyTaskId', friendly: 'journey_task_id', domain: 'journeys' },
  { oracle: 'ReviewCycleId', friendly: 'review_cycle_id', domain: 'performance' },
  { oracle: 'FeedbackId', friendly: 'feedback_id', domain: 'performance' },
  { oracle: 'CheckInId', friendly: 'check_in_id', domain: 'performance' },
  { oracle: 'EnrollmentId', friendly: 'enrollment_id', domain: 'learning' },
  { oracle: 'CourseName', friendly: 'course_name', domain: 'learning' },
  { oracle: 'CompletionDate', friendly: 'completion_date', domain: 'learning' },
  { oracle: 'DependentId', friendly: 'dependent_id', domain: 'benefits' },
  { oracle: 'LifeEventId', friendly: 'life_event_id', domain: 'benefits' },
  { oracle: 'TalentPoolId', friendly: 'talent_pool_id', domain: 'talent' },
  { oracle: 'CostingId', friendly: 'costing_id', domain: 'payroll' },
  { oracle: 'ElementEntryId', friendly: 'element_entry_id', domain: 'payroll' },
];

export function listFieldMapDomains(): string[] {
  return [...new Set(FIELD_MAPS.map((e) => e.domain))].sort();
}

export function getFieldMap(domain?: string): FieldMapEntry[] {
  if (!domain) return FIELD_MAPS;
  return FIELD_MAPS.filter((e) => e.domain === domain);
}

export function oracleToFriendly(oracle: string, domain?: string): string | undefined {
  const rows = getFieldMap(domain);
  return rows.find((e) => e.oracle.toLowerCase() === oracle.toLowerCase())?.friendly;
}

export function friendlyToOracle(friendly: string, domain?: string): string | undefined {
  const rows = getFieldMap(domain);
  return rows.find((e) => e.friendly.toLowerCase() === friendly.toLowerCase())?.oracle;
}

/** Map an object’s keys using friendly↔oracle (oracle→friendly by default). */
export function remapKeys(
  obj: Record<string, unknown>,
  direction: 'toFriendly' | 'toOracle' = 'toFriendly',
  domain?: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const mapped =
      direction === 'toFriendly' ? oracleToFriendly(k, domain) ?? k : friendlyToOracle(k, domain) ?? k;
    out[mapped] = v;
  }
  return out;
}
