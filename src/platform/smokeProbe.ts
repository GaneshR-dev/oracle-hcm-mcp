/**
 * Live Fusion smoke profile — probe matrix of official 11.13.18.05 resources,
 * recording HTTP status classes (200 / 403 / 404) per env.
 * Results saved under ORACLE_HCM_SMOKE_DIR or ~/.oracle-hcm-mcp/smoke/.
 * Unofficial — not an Oracle health product.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { HcmClient } from '../client/hcmClient.js';

export type SmokeStatusClass = '200' | '403' | '404' | '401' | '5xx' | 'other' | 'error';

export type SmokeProbeRow = {
  resource: string;
  path: string;
  status: number | null;
  statusClass: SmokeStatusClass;
  ok: boolean;
  ms: number;
  error?: string;
};

export type SmokeReport = {
  profile: string;
  baseUrl: string;
  apiVersion: string;
  startedAt: string;
  finishedAt: string;
  summary: Record<SmokeStatusClass, number>;
  rows: SmokeProbeRow[];
  unofficial: true;
  note: string;
};

/** Official Fusion HCM REST collection roots only (no invented aliases). */
export const SMOKE_PROBE_PATHS: { resource: string; path: string }[] = [
  { resource: 'workers', path: 'workers?limit=1' },
  { resource: 'publicWorkers', path: 'publicWorkers?limit=1' },
  { resource: 'absences', path: 'absences?limit=1' },
  { resource: 'planBalances', path: 'planBalances?limit=1' },
  { resource: 'organizations', path: 'organizations?limit=1' },
  { resource: 'locations', path: 'locations?limit=1' },
  { resource: 'locationsV2', path: 'locationsV2?limit=1' },
  { resource: 'jobs', path: 'jobs?limit=1' },
  { resource: 'grades', path: 'grades?limit=1' },
  { resource: 'jobFamilies', path: 'jobFamilies?limit=1' },
  { resource: 'positions', path: 'positions?limit=1' },
  { resource: 'businessProcessNotifications', path: 'businessProcessNotifications?limit=1' },
  { resource: 'allocatedChecklists', path: 'allocatedChecklists?limit=1' },
  { resource: 'timeRecordGroups', path: 'timeRecordGroups?limit=1' },
  { resource: 'timeRecordEventRequests', path: 'timeRecordEventRequests?limit=1' },
  { resource: 'workforceScheduleDefinitions', path: 'workforceScheduleDefinitions?limit=1' },
  { resource: 'recruitingJobRequisitions', path: 'recruitingJobRequisitions?limit=1' },
  { resource: 'recruitingCandidates', path: 'recruitingCandidates?limit=1' },
  { resource: 'recruitingJobOffers', path: 'recruitingJobOffers?limit=1' },
  { resource: 'benefitEnrollments', path: 'benefitEnrollments?limit=1' },
  { resource: 'goalPlans', path: 'goalPlans?limit=1' },
  { resource: 'performanceEvaluations', path: 'performanceEvaluations?limit=1' },
  { resource: 'checkInDocuments', path: 'checkInDocuments?limit=1' },
  { resource: 'learnerLearningRecords', path: 'learnerLearningRecords?limit=1' },
  { resource: 'absenceTypesLOV', path: 'absenceTypesLOV?limit=1' },
  { resource: 'absencePlansLOV', path: 'absencePlansLOV?limit=1' },
  { resource: 'salaryBasisLov', path: 'salaryBasisLov?limit=1' },
  { resource: 'documentRecords', path: 'documentRecords?limit=1' },
  { resource: 'workerJourneys', path: 'workerJourneys?limit=1' },
  { resource: 'talentPoolsLOV', path: 'talentPoolsLOV?limit=1' },
  { resource: 'payslips', path: 'payslips?limit=1' },
  { resource: 'timeEventRequests', path: 'timeEventRequests?limit=1' },
  { resource: 'jobsLov', path: 'jobsLov?limit=1' },
  { resource: 'gradesLov', path: 'gradesLov?limit=1' },
  { resource: 'gradeLaddersLov', path: 'gradeLaddersLov?limit=1' },
  { resource: 'gradeRatesLOV', path: 'gradeRatesLOV?limit=1' },
  { resource: 'locationsLov', path: 'locationsLov?limit=1' },
];

function classify(status: number | null): SmokeStatusClass {
  if (status == null) return 'error';
  if (status === 200 || status === 201) return '200';
  if (status === 401) return '401';
  if (status === 403) return '403';
  if (status === 404) return '404';
  if (status >= 500) return '5xx';
  return 'other';
}

export function smokeDir(): string {
  return (
    process.env.ORACLE_HCM_SMOKE_DIR ??
    path.join(os.homedir(), '.oracle-hcm-mcp', 'smoke')
  );
}

export async function runSmokeProbe(
  client: HcmClient,
  opts: { profile?: string; paths?: typeof SMOKE_PROBE_PATHS } = {},
): Promise<SmokeReport> {
  const startedAt = new Date().toISOString();
  const paths = opts.paths ?? SMOKE_PROBE_PATHS;
  const rows: SmokeProbeRow[] = [];

  for (const p of paths) {
    try {
      const result = await client.probe(p.path);
      rows.push({
        resource: p.resource,
        path: p.path,
        status: result.status,
        statusClass: classify(result.status),
        ok: result.ok,
        ms: result.ms,
      });
    } catch (e) {
      rows.push({
        resource: p.resource,
        path: p.path,
        status: (e as { status?: number })?.status ?? null,
        statusClass: 'error',
        ok: false,
        ms: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const summary: Record<SmokeStatusClass, number> = {
    '200': 0,
    '403': 0,
    '404': 0,
    '401': 0,
    '5xx': 0,
    other: 0,
    error: 0,
  };
  for (const r of rows) summary[r.statusClass]++;

  return {
    profile: opts.profile ?? client.config.profile ?? 'default',
    baseUrl: client.config.baseUrl,
    apiVersion: client.config.apiVersion,
    startedAt,
    finishedAt: new Date().toISOString(),
    summary,
    rows,
    unofficial: true,
    note: 'Tenant probe matrix — 200=reachable, 403=RBAC deny, 404=missing on pod. Official 11.13.18.05 roots only. Not an Oracle product.',
  };
}

export function saveSmokeReport(report: SmokeReport, dir?: string): string {
  const d = dir ?? smokeDir();
  fs.mkdirSync(d, { recursive: true });
  const safe = report.profile.replace(/[^a-zA-Z0-9._-]/g, '_');
  const file = path.join(d, `smoke-${safe}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2), 'utf8');
  const latest = path.join(d, `smoke-${safe}-latest.json`);
  fs.writeFileSync(latest, JSON.stringify(report, null, 2), 'utf8');
  return file;
}

export function listSmokeReports(dir?: string, profile?: string): string[] {
  const d = dir ?? smokeDir();
  if (!fs.existsSync(d)) return [];
  return fs
    .readdirSync(d)
    .filter((f) => f.startsWith('smoke-') && f.endsWith('.json'))
    .filter((f) => (profile ? f.includes(`smoke-${profile}`) : true))
    .map((f) => path.join(d, f))
    .sort();
}
