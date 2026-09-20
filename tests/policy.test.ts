import { describe, it, expect } from 'vitest';
import { classifyTool, isReadTool, isWriteTool } from '../src/policy/classify.js';
import {
  isAllowlistedPath,
  isBlockedPath,
  assertAllowlisted,
  canonicalizeResourcePath,
} from '../src/policy/allowlist.js';
import { ApprovalStore, summarizeMutation } from '../src/policy/approval.js';
import { adfEquals } from '../src/policy/adf.js';
import { isSensitiveRoot } from '../src/policy/sensitive.js';

describe('classify', () => {
  it('classifies known reads', () => {
    expect(classifyTool('hcm_health')).toBe('read');
    expect(classifyTool('hcm_search_workers')).toBe('read');
    expect(classifyTool('hcm_rest_get')).toBe('read');
    expect(isReadTool('hcm_get_absence')).toBe(true);
    expect(classifyTool('hcm_absence_balance')).toBe('read');
    expect(classifyTool('hcm_get_plan_balance')).toBe('read');
    expect(classifyTool('hcm_search_organizations')).toBe('read');
    expect(classifyTool('hcm_search_time_records')).toBe('read');
    expect(classifyTool('hcm_search_payroll_relationships')).toBe('read');
    expect(classifyTool('hcm_get_worker_assignments')).toBe('read');
  });

  it('classifies known writes', () => {
    expect(classifyTool('hcm_create_worker')).toBe('write');
    expect(classifyTool('hcm_delete_absence')).toBe('write');
    expect(classifyTool('hcm_rest_mutate')).toBe('write');
    expect(isWriteTool('hcm_perform_bp_action')).toBe(true);
    expect(classifyTool('hcm_update_talent_profile')).toBe('write');
  });

  it('defaults unknown hcm_* to write', () => {
    expect(classifyTool('hcm_frobnicate')).toBe('write');
    expect(classifyTool('hcm_mystery_action')).toBe('write');
  });
});

describe('allowlist', () => {
  it('allows curated Fusion roots', () => {
    expect(isAllowlistedPath('workers')).toBe(true);
    expect(isAllowlistedPath('workers/1001')).toBe(true);
    expect(isAllowlistedPath('/absences?limit=1')).toBe(true);
    expect(isAllowlistedPath('areasOfResponsibility/R1')).toBe(true);
    expect(isAllowlistedPath('planBalances')).toBe(true);
    expect(isAllowlistedPath('planBalances/B1')).toBe(true);
    expect(isAllowlistedPath('businessProcessNotifications')).toBe(true);
    expect(isAllowlistedPath('businessProcessNotifications/action/performAction')).toBe(true);
    expect(isAllowlistedPath('allocatedChecklists/C1/child/allocatedTasks/T1')).toBe(true);
    expect(isAllowlistedPath('organizations')).toBe(true);
    expect(isAllowlistedPath('locations')).toBe(true);
    expect(isAllowlistedPath('recruitingJobRequisitions')).toBe(true);
    expect(isAllowlistedPath('payslips')).toBe(true);
    expect(isAllowlistedPath('timeRecordGroups')).toBe(true);
    expect(isAllowlistedPath('jobs')).toBe(true);
    expect(isAllowlistedPath('grades')).toBe(true);
    expect(isAllowlistedPath('talentPersonProfiles')).toBe(true);
    expect(isAllowlistedPath('payrollRelationships')).toBe(true);
    expect(isAllowlistedPath('workers/1001/child/emails')).toBe(true);
    expect(isAllowlistedPath('benefitEnrollments')).toBe(true);
    expect(isAllowlistedPath('learnerLearningRecords')).toBe(true);
    expect(isAllowlistedPath('goalPlans')).toBe(true);
    expect(isAllowlistedPath('checkInDocuments')).toBe(true);
    expect(isAllowlistedPath('absenceTypesLOV')).toBe(true);
    expect(isAllowlistedPath('absencePlansLOV')).toBe(true);
    expect(isAllowlistedPath('salaryBasisLov')).toBe(true);
    expect(isAllowlistedPath('timeEventRequests')).toBe(true);
    expect(isAllowlistedPath('jobsLov')).toBe(true);
    expect(isAllowlistedPath('workers/1001/child/addresses')).toBe(true);
  });

  it('rejects invented aliases that are not official Fusion collections', () => {
    expect(isAllowlistedPath('atomfeeds')).toBe(false);
    expect(isAllowlistedPath('timeRecords')).toBe(false);
    expect(isAllowlistedPath('workerAssignments')).toBe(false);
    expect(isAllowlistedPath('learningEnrollments')).toBe(false);
    expect(isAllowlistedPath('absencesBalances')).toBe(false);
    expect(isAllowlistedPath('workflowNotifications')).toBe(false);
    expect(isAllowlistedPath('bankAccounts')).toBe(false);
    expect(isAllowlistedPath('reviewCycles')).toBe(false);
    expect(isAllowlistedPath('otbiReports')).toBe(false);
  });

  it('blocks CE / generative AI style paths', () => {
    expect(isBlockedPath('ce/generativeAi/chat')).toBe(true);
    expect(isBlockedPath('workers/../ce/foo')).toBe(true);
    expect(isBlockedPath('internal/oracleInternal')).toBe(true);
    expect(isAllowlistedPath('ce/generativeAi')).toBe(false);
    expect(isBlockedPath('llm')).toBe(true);
    expect(isBlockedPath('workers/llm/x')).toBe(true);
    expect(isBlockedPath('benefitEnrollments')).toBe(false);
  });

  it('assertAllowlisted throws on bad paths', () => {
    expect(() => assertAllowlisted('ce/ai/embed')).toThrow(/blocked/i);
    expect(() => assertAllowlisted('payrollSomething')).toThrow(/allowlist/i);
  });

  it('canonicalize rejects traversal and schemes', () => {
    expect(() => canonicalizeResourcePath('workers/../ce')).toThrow(/traversal/i);
    expect(() => canonicalizeResourcePath('%2e%2e/ce')).toThrow(/traversal/i);
    expect(() => canonicalizeResourcePath('https://x/workers')).toThrow(/scheme/i);
    expect(isSensitiveRoot('payslips')).toBe(true);
    expect(isSensitiveRoot('workers')).toBe(false);
  });

  it('adfEquals quotes values', () => {
    expect(adfEquals('PersonNumber', "O'Brien")).toBe("PersonNumber='O''Brien'");
  });
});

describe('approval store', () => {
  it('creates and lists pending intents', () => {
    const store = new ApprovalStore(60_000);
    const intent = store.create('hcm_create_absence', { body: { x: 1 } }, 'summary');
    expect(intent.approvalId).toBeTruthy();
    expect(store.listPending()).toHaveLength(1);
  });

  it('deny marks denied', () => {
    const store = new ApprovalStore(60_000);
    const intent = store.create('hcm_create_worker', { body: {} }, 'c');
    store.deny(intent.approvalId);
    expect(store.listPending()).toHaveLength(0);
  });

  it('approve executes callback', async () => {
    const store = new ApprovalStore(60_000);
    const intent = store.create('hcm_create_worker', { body: { FirstName: 'X' } }, 'c');
    const { result } = await store.approve(intent.approvalId, async (tool, args) => {
      expect(tool).toBe('hcm_create_worker');
      return { ok: true, args };
    });
    expect(result).toEqual({ ok: true, args: { body: { FirstName: 'X' } } });
  });

  it('summarizeMutation includes tool name', () => {
    expect(summarizeMutation('hcm_delete_absence', { absenceId: 'A1' })).toContain(
      'hcm_delete_absence',
    );
  });
});
