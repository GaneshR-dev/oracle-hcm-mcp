import { describe, it, expect } from 'vitest';
import { classifyTool, isReadTool, isWriteTool } from '../src/policy/classify.js';
import {
  isAllowlistedPath,
  isBlockedPath,
  assertAllowlisted,
} from '../src/policy/allowlist.js';
import { ApprovalStore, summarizeMutation } from '../src/policy/approval.js';

describe('classify', () => {
  it('classifies known reads', () => {
    expect(classifyTool('hcm_health')).toBe('read');
    expect(classifyTool('hcm_search_workers')).toBe('read');
    expect(classifyTool('hcm_rest_get')).toBe('read');
    expect(isReadTool('hcm_get_absence')).toBe(true);
  });

  it('classifies known writes', () => {
    expect(classifyTool('hcm_create_worker')).toBe('write');
    expect(classifyTool('hcm_delete_absence')).toBe('write');
    expect(classifyTool('hcm_rest_mutate')).toBe('write');
    expect(isWriteTool('hcm_perform_bp_action')).toBe(true);
  });

  it('defaults unknown hcm_* to write', () => {
    expect(classifyTool('hcm_frobnicate')).toBe('write');
    expect(classifyTool('hcm_mystery_action')).toBe('write');
  });
});

describe('allowlist', () => {
  it('allows curated roots', () => {
    expect(isAllowlistedPath('workers')).toBe(true);
    expect(isAllowlistedPath('workers/1001')).toBe(true);
    expect(isAllowlistedPath('/absences?limit=1')).toBe(true);
    expect(isAllowlistedPath('areasOfResponsibility/R1')).toBe(true);
  });

  it('blocks CE / generative AI style paths', () => {
    expect(isBlockedPath('ce/generativeAi/chat')).toBe(true);
    expect(isBlockedPath('workers/../ce/foo')).toBe(true);
    expect(isBlockedPath('internal/oracleInternal')).toBe(true);
    expect(isAllowlistedPath('ce/generativeAi')).toBe(false);
  });

  it('assertAllowlisted throws on bad paths', () => {
    expect(() => assertAllowlisted('ce/ai/embed')).toThrow(/blocked/i);
    expect(() => assertAllowlisted('payrollSomething')).toThrow(/allowlist/i);
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
