/**
 * Role / privilege probe — correlate smoke 403 patterns with likely missing
 * HCM duties. Unofficial heuristics, not Oracle RBAC product.
 */

import type { SmokeReport } from './smokeProbe.js';

export type PrivilegeHint = {
  path: string;
  status: number;
  likelyDuty: string;
  remediation: string;
};

const PATH_DUTY_HINTS: { re: RegExp; duty: string; remediation: string }[] = [
  { re: /workers/i, duty: 'Worker Management / Person View', remediation: 'Grant Human Resource Specialist or line-manager worker view duties.' },
  { re: /absences|planBalances|absenceTypes|absencePlans/i, duty: 'Absence Management', remediation: 'Grant Absence Management duty role / absence administrator.' },
  { re: /payslip|bankAccount|nationalIdentifier|paymentMethod|compensation|salaryBasis|elementEntr|payrollCost/i, duty: 'Payroll / Compensation confidential', remediation: 'Grant payroll inquiry or compensation manager; enable ORACLE_HCM_SENSITIVE only in default mode.' },
  { re: /recruiting|candidate|offer|interview/i, duty: 'Recruiting', remediation: 'Grant Recruiter / Recruiting Administrator duties.' },
  { re: /learning|goal|performance|talent|reviewCycle|feedback|checkIn/i, duty: 'Talent / Learning', remediation: 'Grant Learning Specialist or Talent Management duties.' },
  { re: /benefit|dependent|lifeEvent/i, duty: 'Benefits', remediation: 'Grant Benefits Administrator / enrollment duties.' },
  { re: /documentRecord/i, duty: 'Document Records', remediation: 'Grant Document Records Management duty.' },
  { re: /journey|allocatedChecklist/i, duty: 'Journeys / Checklists', remediation: 'Grant Journey / Onboarding administrator duties.' },
  { re: /atomfeed/i, duty: 'Atom feeds / Integration', remediation: 'Grant HCM Atom feed / integration user privileges.' },
  { re: /businessProcess|workflowNotification/i, duty: 'Workflow notifications', remediation: 'Ensure user is a task assignee or has BPM worklist admin.' },
  { re: /organization|location|job|grade|position|jobFamil/i, duty: 'Workforce Structures', remediation: 'Grant Workforce Structures / HR analyst LOV access.' },
];

export function hintsFromSmoke(report: SmokeReport): PrivilegeHint[] {
  const hints: PrivilegeHint[] = [];
  for (const row of report.rows) {
    if (row.status !== 403 && row.status !== 401) continue;
    const match = PATH_DUTY_HINTS.find((h) => h.re.test(row.path));
    hints.push({
      path: row.path,
      status: row.status,
      likelyDuty: match?.duty ?? 'Unknown / custom duty',
      remediation: match?.remediation ?? 'Inspect Fusion Security Console for the resource privilege.',
    });
  }
  return hints;
}

export function summarizePrivilegeGaps(hints: PrivilegeHint[]): Record<string, unknown> {
  const byDuty: Record<string, string[]> = {};
  for (const h of hints) {
    (byDuty[h.likelyDuty] ??= []).push(h.path);
  }
  return {
    gapCount: hints.length,
    byDuty,
    hints,
    note: 'Heuristic only — not Oracle Security Console. Unofficial.',
  };
}
