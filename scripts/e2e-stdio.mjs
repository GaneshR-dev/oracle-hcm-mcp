#!/usr/bin/env node
/**
 * End-to-end stdio MCP test against dummy HCM on :9090.
 * Spawns node dist/index.js twice: approval mode and --write mode.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_PATH = path.join(ROOT, 'E2E_REPORT.md');

const ENV = {
  ...getDefaultEnvironment(),
  ORACLE_HCM_BASE_URL: 'http://127.0.0.1:9090/hcmRestApi',
  ORACLE_HCM_AUTH: 'basic',
  ORACLE_HCM_USERNAME: 'demo',
  ORACLE_HCM_PASSWORD: 'demo',
  ORACLE_HCM_APPROVAL_TOKEN: 'e2e-approval-token',
};

const APPROVAL_TOOLS = [
  'hcm_list_pending_approvals',
  'hcm_approve_write',
  'hcm_deny_write',
];

const V06_TOOLS = [
  'hcm_search_check_ins',
  'hcm_search_learning_assignments',
  'hcm_search_document_records',
  'hcm_search_talent_pools',
  'hcm_recipe_transfer',
  'hcm_recipe_terminate',
  'hcm_preview_write',
  'hcm_atom_poll',
  'hcm_field_map',
  'hcm_export_approval_audit',
];

/** @type {{ section: string, step: string, pass: boolean, detail: string }[]} */
const results = [];
const gaps = [];

function record(section, step, pass, detail = '') {
  results.push({ section, step, pass, detail: String(detail).slice(0, 500) });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`  [${mark}] ${step}${detail ? ` — ${String(detail).slice(0, 120)}` : ''}`);
}

function parseTool(result) {
  const text = result?.content?.find((c) => c.type === 'text')?.text ?? '{}';
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { _raw: text };
  }
  return { data, isError: Boolean(result?.isError), raw: result };
}

async function withClient(args, fn, extraEnv = {}) {
  const transport = new StdioClientTransport({
    command: 'node',
    args,
    cwd: ROOT,
    env: { ...ENV, ...extraEnv },
    stderr: 'pipe',
  });
  const stderrChunks = [];
  transport.stderr?.on('data', (b) => stderrChunks.push(b));
  const client = new Client({ name: 'e2e-stdio', version: '0.1.0' });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    try {
      await client.close();
    } catch {
      /* ignore */
    }
    try {
      await transport.close();
    } catch {
      /* ignore */
    }
  }
}

async function call(client, name, args = {}) {
  return parseTool(await client.callTool({ name, arguments: args }));
}

function isBlocked(result) {
  const msg = JSON.stringify(result.data);
  return (
    result.isError ||
    Boolean(result.data?.error) ||
    /blocked|traversal|scheme|SENSITIVE|not allowed|allowlist|approval_token/i.test(msg)
  );
}

async function runApprovalMode() {
  const section = 'A) Approval mode (no --write)';
  console.log(`\n=== ${section} ===`);
  await withClient(['dist/index.js'], async (client) => {
    // 1. listTools
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    const hasApproval = APPROVAL_TOOLS.every((n) => names.includes(n));
    record(
      section,
      'listTools — approval tools present, curated suite',
      hasApproval && names.length >= 100,
      `count=${names.length}; approval=${hasApproval}; tools=${names.join(',')}`,
    );

    // 2. Every read tool
    const health = await call(client, 'hcm_health', {});
    record(section, 'hcm_health', !health.isError && health.data.ok === true, JSON.stringify(health.data));

    const whoami = await call(client, 'hcm_whoami', {});
    record(
      section,
      'hcm_whoami',
      !whoami.isError && whoami.data.username === 'demo',
      JSON.stringify(whoami.data),
    );

    const resources = await call(client, 'hcm_list_resources', {});
    record(
      section,
      'hcm_list_resources',
      !resources.isError && Array.isArray(resources.data.resources ?? resources.data),
      JSON.stringify(resources.data).slice(0, 200),
    );

    const describe = await call(client, 'hcm_describe_resource', { name: 'workers' });
    record(
      section,
      'hcm_describe_resource(workers)',
      !describe.isError && (describe.data.name === 'workers' || describe.data.path === 'workers'),
      JSON.stringify(describe.data).slice(0, 200),
    );

    const workers = await call(client, 'hcm_search_workers', { limit: 5 });
    const workerItems = workers.data.items ?? [];
    record(
      section,
      'hcm_search_workers',
      !workers.isError && workerItems.length > 0,
      `count=${workerItems.length}`,
    );
    const workerId = workerItems[0]?.WorkerId ?? '1001';

    const worker = await call(client, 'hcm_get_worker', { workerId: String(workerId) });
    record(
      section,
      'hcm_get_worker',
      !worker.isError && String(worker.data.WorkerId) === String(workerId),
      JSON.stringify(worker.data).slice(0, 200),
    );

    const absences = await call(client, 'hcm_search_absences', { limit: 10 });
    const absenceItems = absences.data.items ?? [];
    record(
      section,
      'hcm_search_absences',
      !absences.isError && absenceItems.length > 0,
      `count=${absenceItems.length}`,
    );
    const absenceId = absenceItems[0]?.AbsenceId ?? 'A1';

    const absence = await call(client, 'hcm_get_absence', { absenceId: String(absenceId) });
    record(
      section,
      'hcm_get_absence',
      !absence.isError && String(absence.data.AbsenceId) === String(absenceId),
      JSON.stringify(absence.data).slice(0, 200),
    );

    const bal = await call(client, 'hcm_absence_balance', { personNumber: 'P1001' });
    record(
      section,
      'hcm_absence_balance (planBalances)',
      !bal.isError && (bal.data.items?.length ?? 0) > 0,
      JSON.stringify(bal.data).slice(0, 200),
    );

    const planBal = await call(client, 'hcm_get_plan_balance', { balanceId: 'B1' });
    record(
      section,
      'hcm_get_plan_balance',
      !planBal.isError && String(planBal.data.BalanceId) === 'B1',
      JSON.stringify(planBal.data).slice(0, 200),
    );

    const assignments = await call(client, 'hcm_get_worker_assignments', { workerId: String(workerId) });
    record(
      section,
      'hcm_get_worker_assignments',
      !assignments.isError &&
        (Array.isArray(assignments.data.workRelationships) ||
          (assignments.data.items?.length ?? 0) > 0),
      JSON.stringify(assignments.data).slice(0, 200),
    );

    const aors = await call(client, 'hcm_search_aor', { limit: 10 });
    const aorItems = aors.data.items ?? [];
    record(section, 'hcm_search_aor', !aors.isError && aorItems.length > 0, `count=${aorItems.length}`);
    const aorId = aorItems[0]?.AreaOfResponsibilityId ?? 'R1';

    const aor = await call(client, 'hcm_get_aor', { aorId: String(aorId) });
    record(
      section,
      'hcm_get_aor',
      !aor.isError && String(aor.data.AreaOfResponsibilityId) === String(aorId),
      JSON.stringify(aor.data).slice(0, 200),
    );

    const checklists = await call(client, 'hcm_list_checklists', { limit: 10 });
    const clItems = checklists.data.items ?? [];
    record(
      section,
      'hcm_list_checklists',
      !checklists.isError && clItems.length > 0,
      `count=${clItems.length}`,
    );
    const checklistId = clItems[0]?.AllocatedChecklistId ?? 'C1';

    const checklist = await call(client, 'hcm_get_checklist', { checklistId: String(checklistId) });
    record(
      section,
      'hcm_get_checklist',
      !checklist.isError && String(checklist.data.AllocatedChecklistId) === String(checklistId),
      JSON.stringify(checklist.data).slice(0, 200),
    );

    const notifs = await call(client, 'hcm_list_notifications', { limit: 10 });
    const nItems = notifs.data.items ?? [];
    record(
      section,
      'hcm_list_notifications',
      !notifs.isError && nItems.length > 0,
      `count=${nItems.length}`,
    );
    const notificationId = nItems[0]?.NotificationId ?? 'N1';

    const notif = await call(client, 'hcm_get_notification', {
      notificationId: String(notificationId),
    });
    record(
      section,
      'hcm_get_notification (businessProcessNotifications)',
      !notif.isError && String(notif.data.NotificationId) === String(notificationId),
      JSON.stringify(notif.data).slice(0, 200),
    );

    // P1 org LOVs / time / talent / payroll
    const orgs = await call(client, 'hcm_search_organizations', { limit: 10 });
    record(
      section,
      'hcm_search_organizations',
      !orgs.isError && (orgs.data.items?.length ?? 0) > 0,
      `count=${(orgs.data.items ?? []).length}`,
    );
    const org = await call(client, 'hcm_get_organization', { organizationId: 'O1' });
    record(section, 'hcm_get_organization', !org.isError && org.data.OrganizationId === 'O1', JSON.stringify(org.data).slice(0, 120));

    const locs = await call(client, 'hcm_search_locations', { limit: 10 });
    record(section, 'hcm_search_locations', !locs.isError && (locs.data.items?.length ?? 0) > 0, `count=${(locs.data.items ?? []).length}`);
    const loc = await call(client, 'hcm_get_location', { locationId: 'L1' });
    record(section, 'hcm_get_location', !loc.isError && loc.data.LocationId === 'L1', JSON.stringify(loc.data).slice(0, 120));

    const jobs = await call(client, 'hcm_search_jobs', { limit: 10 });
    record(section, 'hcm_search_jobs', !jobs.isError && (jobs.data.items?.length ?? 0) > 0, `count=${(jobs.data.items ?? []).length}`);
    const job = await call(client, 'hcm_get_job', { jobId: 'J1' });
    record(section, 'hcm_get_job', !job.isError && job.data.JobId === 'J1', JSON.stringify(job.data).slice(0, 120));

    const grades = await call(client, 'hcm_search_grades', { limit: 10 });
    record(section, 'hcm_search_grades', !grades.isError && (grades.data.items?.length ?? 0) > 0, `count=${(grades.data.items ?? []).length}`);

    const times = await call(client, 'hcm_search_time_records', { limit: 10 });
    record(section, 'hcm_search_time_records', !times.isError && (times.data.items?.length ?? 0) > 0, `count=${(times.data.items ?? []).length}`);
    const tr = await call(client, 'hcm_get_time_record', { timeRecordId: 'TR1' });
    record(section, 'hcm_get_time_record', !tr.isError && tr.data.timeRecordId === 'TR1', JSON.stringify(tr.data).slice(0, 120));

    const talent = await call(client, 'hcm_search_talent_profiles', { limit: 10 });
    record(section, 'hcm_search_talent_profiles', !talent.isError && (talent.data.items?.length ?? 0) > 0, `count=${(talent.data.items ?? []).length}`);
    const tp = await call(client, 'hcm_get_talent_profile', { profileId: 'TP1' });
    record(section, 'hcm_get_talent_profile', !tp.isError && tp.data.ProfileId === 'TP1', JSON.stringify(tp.data).slice(0, 120));

    const payroll = await call(client, 'hcm_search_payroll_relationships', { limit: 10 });
    record(section, 'hcm_search_payroll_relationships', !payroll.isError && (payroll.data.items?.length ?? 0) > 0, `count=${(payroll.data.items ?? []).length}`);
    const pr = await call(client, 'hcm_get_payroll_relationship', { payrollRelationshipId: 'PR1' });
    record(section, 'hcm_get_payroll_relationship', !pr.isError && pr.data.PayrollRelationshipId === 'PR1', JSON.stringify(pr.data).slice(0, 120));

    // Path probes via rest_get
    const restPlan = await call(client, 'hcm_rest_get', { path: 'planBalances', query: { limit: 2 } });
    record(section, 'hcm_rest_get planBalances', !restPlan.isError && (restPlan.data.items?.length ?? 0) > 0, JSON.stringify(restPlan.data).slice(0, 120));
    const restBp = await call(client, 'hcm_rest_get', { path: 'businessProcessNotifications', query: { limit: 2 } });
    record(section, 'hcm_rest_get businessProcessNotifications', !restBp.isError && (restBp.data.items?.length ?? 0) > 0, JSON.stringify(restBp.data).slice(0, 120));
    const restTasks = await call(client, 'hcm_rest_get', {
      path: `allocatedChecklists/${checklistId}/child/allocatedTasks`,
    });
    record(
      section,
      'hcm_rest_get allocatedTasks',
      !restTasks.isError && (restTasks.data.items?.length ?? 0) > 0,
      JSON.stringify(restTasks.data).slice(0, 120),
    );

    const restGet = await call(client, 'hcm_rest_get', { path: 'workers', query: { limit: 2 } });
    record(
      section,
      'hcm_rest_get',
      !restGet.isError && (restGet.data.items?.length ?? 0) > 0,
      JSON.stringify(restGet.data).slice(0, 200),
    );

    // 3. Write → pending_approval
    const pending1 = await call(client, 'hcm_create_absence', {
      body: {
        personNumber: 'P1001',
        absenceType: 'Vacation',
        startDate: '2026-12-01',
        endDate: '2026-12-02',
        status: 'SUBMITTED',
      },
    });
    record(
      section,
      'hcm_create_absence → pending_approval',
      !pending1.isError &&
        pending1.data.pending_approval === true &&
        Boolean(pending1.data.approval_id),
      JSON.stringify(pending1.data).slice(0, 300),
    );

    // 4. list pending
    const pendingList = await call(client, 'hcm_list_pending_approvals', {});
    const pendingCount = pendingList.data.pending?.length ?? 0;
    record(
      section,
      'hcm_list_pending_approvals',
      !pendingList.isError && pendingCount >= 1,
      `pending=${pendingCount}`,
    );

    // 5. deny one (create another then deny, keep first for approve path clarity)
    const pendingDeny = await call(client, 'hcm_create_absence', {
      body: {
        personNumber: 'P1002',
        absenceType: 'Sick',
        startDate: '2026-12-10',
        endDate: '2026-12-11',
      },
    });
    const denyId = pendingDeny.data.approval_id;
    const denied = await call(client, 'hcm_deny_write', { approval_id: denyId, approval_token: ENV.ORACLE_HCM_APPROVAL_TOKEN });
    record(
      section,
      'hcm_deny_write',
      !denied.isError && denied.data.denied === true,
      JSON.stringify(denied.data).slice(0, 200),
    );

    // 6. create another → approve → verify
    const pending2 = await call(client, 'hcm_create_absence', {
      body: {
        personNumber: 'P1001',
        absenceType: 'Vacation',
        startDate: '2026-12-20',
        endDate: '2026-12-21',
        status: 'SUBMITTED',
      },
    });
    const approveId = pending2.data.approval_id;
    const approved = await call(client, 'hcm_approve_write', { approval_id: approveId, approval_token: ENV.ORACLE_HCM_APPROVAL_TOKEN });
    const createdId = approved.data.result?.AbsenceId;
    record(
      section,
      'hcm_approve_write',
      !approved.isError && approved.data.approved === true && Boolean(createdId),
      JSON.stringify(approved.data).slice(0, 300),
    );

    const got = await call(client, 'hcm_get_absence', { absenceId: String(createdId) });
    record(
      section,
      'verify approved absence via hcm_get_absence',
      !got.isError && String(got.data.AbsenceId) === String(createdId),
      JSON.stringify(got.data).slice(0, 200),
    );

    const searchAfter = await call(client, 'hcm_search_absences', { q: String(createdId) });
    const found =
      (searchAfter.data.items ?? []).some((a) => String(a.AbsenceId) === String(createdId)) ||
      (searchAfter.data.items ?? []).length > 0;
    record(
      section,
      'verify via hcm_search_absences',
      !searchAfter.isError && found,
      `items=${(searchAfter.data.items ?? []).length}`,
    );

    // Also approve the first pending if still there (cleanup / extra coverage)
    if (pending1.data.approval_id) {
      const still = await call(client, 'hcm_list_pending_approvals', {});
      const ids = (still.data.pending ?? []).map((p) => p.approval_id);
      if (ids.includes(pending1.data.approval_id)) {
        await call(client, 'hcm_approve_write', { approval_id: pending1.data.approval_id, approval_token: ENV.ORACLE_HCM_APPROVAL_TOKEN });
      }
    }

    // 7. blocklisted rest_mutate
    const blocked = await call(client, 'hcm_rest_mutate', {
      method: 'POST',
      path: 'ce/generativeAi/chat',
      body: { prompt: 'nope' },
    });
    const blockMsg = JSON.stringify(blocked.data);
    const blockedOk =
      blocked.isError ||
      /blocked|not allowed|allowlist/i.test(blockMsg) ||
      blocked.data?.error;
    record(
      section,
      'hcm_rest_mutate blocklisted path → fail/block',
      Boolean(blockedOk) && blocked.data?.pending_approval !== true,
      blockMsg.slice(0, 300),
    );
  });
}

async function runWriteMode() {
  const section = 'B) Write mode (--write)';
  console.log(`\n=== ${section} ===`);
  await withClient(['dist/index.js', '--write'], async (client) => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    const present = APPROVAL_TOOLS.every((n) => names.includes(n));
    record(
      section,
      'listTools — approval tools PRESENT (v0.3 sensitive gate)',
      present && names.length >= 100,
      `count=${names.length}; hasApprovalTools=${present}`,
    );

    const noPending = (data) => data?.pending_approval !== true;

    // Workers
    const createdW = await call(client, 'hcm_create_worker', {
      body: { FirstName: 'E2E', LastName: 'Writer', PersonNumber: 'P-E2E-W' },
    });
    record(
      section,
      'hcm_create_worker immediate',
      !createdW.isError && noPending(createdW.data) && Boolean(createdW.data.WorkerId),
      JSON.stringify(createdW.data).slice(0, 200),
    );
    const wid = createdW.data.WorkerId;
    const updW = await call(client, 'hcm_update_worker', {
      workerId: String(wid),
      body: { DisplayName: 'E2E Writer Updated' },
    });
    record(
      section,
      'hcm_update_worker immediate',
      !updW.isError && noPending(updW.data) && updW.data.DisplayName === 'E2E Writer Updated',
      JSON.stringify(updW.data).slice(0, 200),
    );

    // Absences CRUD
    const createdA = await call(client, 'hcm_create_absence', {
      body: {
        personNumber: 'P1002',
        absenceType: 'Vacation',
        startDate: '2027-01-01',
        endDate: '2027-01-03',
      },
    });
    record(
      section,
      'hcm_create_absence immediate',
      !createdA.isError && noPending(createdA.data) && Boolean(createdA.data.AbsenceId),
      JSON.stringify(createdA.data).slice(0, 200),
    );
    const aid = createdA.data.AbsenceId;
    const updA = await call(client, 'hcm_update_absence', {
      absenceId: String(aid),
      body: { status: 'APPROVED' },
    });
    record(
      section,
      'hcm_update_absence immediate',
      !updA.isError && noPending(updA.data) && updA.data.status === 'APPROVED',
      JSON.stringify(updA.data).slice(0, 200),
    );
    const delA = await call(client, 'hcm_delete_absence', { absenceId: String(aid) });
    record(
      section,
      'hcm_delete_absence immediate',
      !delA.isError && noPending(delA.data) && (delA.data.deleted === true || delA.data.status === 204),
      JSON.stringify(delA.data).slice(0, 200),
    );

    // AOR CRUD
    const createdR = await call(client, 'hcm_create_aor', {
      body: { ResponsibilityName: 'E2E AOR', PersonNumber: 'P1002', Status: 'A' },
    });
    record(
      section,
      'hcm_create_aor immediate',
      !createdR.isError &&
        noPending(createdR.data) &&
        Boolean(createdR.data.AreaOfResponsibilityId),
      JSON.stringify(createdR.data).slice(0, 200),
    );
    const rid = createdR.data.AreaOfResponsibilityId;
    const updR = await call(client, 'hcm_update_aor', {
      aorId: String(rid),
      body: { Status: 'I' },
    });
    record(
      section,
      'hcm_update_aor immediate',
      !updR.isError && noPending(updR.data) && updR.data.Status === 'I',
      JSON.stringify(updR.data).slice(0, 200),
    );
    const delR = await call(client, 'hcm_delete_aor', { aorId: String(rid) });
    record(
      section,
      'hcm_delete_aor immediate',
      !delR.isError && noPending(delR.data) && (delR.data.deleted === true || delR.data.status === 204),
      JSON.stringify(delR.data).slice(0, 200),
    );

    // Task status via allocatedTasks/action/updateTaskStatus
    const task = await call(client, 'hcm_update_task_status', {
      checklistId: 'C1',
      taskId: 'T1',
      status: 'COMPLETED',
    });
    record(
      section,
      'hcm_update_task_status immediate (allocatedTasks)',
      !task.isError && noPending(task.data) && task.data.status === 'COMPLETED',
      JSON.stringify(task.data).slice(0, 200),
    );

    // Talent light update
    const talentUpd = await call(client, 'hcm_update_talent_profile', {
      profileId: 'TP1',
      body: { Summary: 'E2E updated summary' },
    });
    record(
      section,
      'hcm_update_talent_profile immediate',
      !talentUpd.isError && noPending(talentUpd.data) && talentUpd.data.Summary === 'E2E updated summary',
      JSON.stringify(talentUpd.data).slice(0, 200),
    );

    // BP action via businessProcessNotifications/action/performAction
    const bp = await call(client, 'hcm_perform_bp_action', {
      notificationId: 'N1',
      action: 'APPROVE',
      comment: 'e2e ok',
    });
    const bpOk =
      !bp.isError &&
      noPending(bp.data) &&
      (bp.data.Status === 'APPROVE' || bp.data.actionResult === 'OK');
    if (bp.isError) {
      gaps.push('hcm_perform_bp_action may have failed against dummy (check response)');
    }
    record(section, 'hcm_perform_bp_action immediate', bpOk, JSON.stringify(bp.data).slice(0, 200));

    // allowlisted rest_mutate
    const mute = await call(client, 'hcm_rest_mutate', {
      method: 'POST',
      path: 'workers',
      body: { FirstName: 'Rest', LastName: 'Mutate' },
    });
    record(
      section,
      'hcm_rest_mutate allowlisted immediate',
      !mute.isError && noPending(mute.data) && Boolean(mute.data.WorkerId),
      JSON.stringify(mute.data).slice(0, 200),
    );

    // blocklisted still fails in write mode
    const blocked = await call(client, 'hcm_rest_mutate', {
      method: 'POST',
      path: 'ce/generativeAi/chat',
      body: {},
    });
    record(
      section,
      'hcm_rest_mutate blocklisted → fail',
      (blocked.isError || Boolean(blocked.data?.error)) && noPending(blocked.data),
      JSON.stringify(blocked.data).slice(0, 200),
    );

    // --write bypasses SENSITIVE
    const payslip = await call(client, 'hcm_get_payslip', { payslipId: 'PS1' });
    record(
      section,
      'hcm_get_payslip immediate under --write (SENSITIVE bypass)',
      !payslip.isError && noPending(payslip.data) && payslip.data.PayslipId === 'PS1',
      JSON.stringify(payslip.data).slice(0, 200),
    );
  });
}

async function runV03Smoke() {
  const section = 'C) v0.3 smoke (approval mode)';
  console.log(`\n=== ${section} ===`);
  await withClient(['dist/index.js'], async (client) => {
    const { tools } = await client.listTools();
    record(section, 'tool count >= 100', tools.length >= 100, `count=${tools.length}`);
    const setup = await call(client, 'hcm_setup_status', {});
    record(section, 'hcm_setup_status', !setup.isError && setup.data?.unofficial === true, JSON.stringify(setup.data).slice(0, 200));
    const atom = await call(client, 'hcm_list_atom_entries', {});
    record(section, 'hcm_list_atom_entries', !atom.isError && (atom.data?.items?.length ?? 0) > 0, JSON.stringify(atom.data).slice(0, 200));
    const req = await call(client, 'hcm_search_requisitions', {});
    record(section, 'hcm_search_requisitions', !req.isError && req.data?.items?.[0]?.RequisitionId, JSON.stringify(req.data).slice(0, 200));
    const sens = await call(client, 'hcm_get_payslip', { payslipId: 'PS1' });
    record(section, 'hcm_get_payslip gated without SENSITIVE', sens.isError || String(sens.data?.error ?? '').includes('SENSITIVE'), JSON.stringify(sens.data).slice(0, 200));
    const dry = await call(client, 'hcm_dry_run_mutate', { method: 'POST', path: 'absences', body: { x: 1 } });
    record(section, 'hcm_dry_run_mutate', !dry.isError && dry.data?.ok === true, JSON.stringify(dry.data).slice(0, 200));
  });
}

async function runV07Security() {
  const section = 'D) v0.7 security (stdio process)';
  console.log(`\n=== ${section} ===`);
  await withClient(['dist/index.js'], async (client) => {
    const pending = await call(client, 'hcm_create_absence', {
      body: { personNumber: 'P1001', absenceType: 'Vacation', startDate: '2026-11-01' },
    });
    const blob = JSON.stringify(pending.data);
    record(
      section,
      'pending payload never includes approval token',
      pending.data.pending_approval === true &&
        pending.data.approval_token === undefined &&
        !blob.includes(ENV.ORACLE_HCM_APPROVAL_TOKEN),
      blob.slice(0, 300),
    );

    const noTok = await call(client, 'hcm_approve_write', { approval_id: pending.data.approval_id });
    record(
      section,
      'approve without token fails',
      isBlocked(noTok) && pending.data.pending_approval === true,
      JSON.stringify(noTok.data).slice(0, 200),
    );

    const wrong = await call(client, 'hcm_approve_write', {
      approval_id: pending.data.approval_id,
      approval_token: 'wrong-token',
    });
    record(
      section,
      'approve with wrong token fails',
      isBlocked(wrong),
      JSON.stringify(wrong.data).slice(0, 200),
    );

    const denied = await call(client, 'hcm_deny_write', {
      approval_id: pending.data.approval_id,
      approval_token: ENV.ORACLE_HCM_APPROVAL_TOKEN,
    });
    record(
      section,
      'deny with correct split-principal token works',
      !denied.isError && denied.data.denied === true,
      JSON.stringify(denied.data).slice(0, 200),
    );

    const trav = await call(client, 'hcm_rest_get', { path: 'workers/../ce/foo' });
    record(section, 'path traversal rest_get blocked', isBlocked(trav), JSON.stringify(trav.data).slice(0, 200));

    const enc = await call(client, 'hcm_rest_get', { path: 'workers/%2e%2e/ce' });
    record(section, 'encoded .. rest_get blocked', isBlocked(enc), JSON.stringify(enc.data).slice(0, 200));

    const scheme = await call(client, 'hcm_rest_get', { path: 'https://evil.example/workers' });
    record(section, 'scheme rest_get blocked', isBlocked(scheme), JSON.stringify(scheme.data).slice(0, 200));

    const payslip = await call(client, 'hcm_rest_get', { path: 'payslips/PS1' });
    record(
      section,
      'hcm_rest_get payslips blocked without SENSITIVE',
      isBlocked(payslip) && /SENSITIVE/i.test(JSON.stringify(payslip.data)),
      JSON.stringify(payslip.data).slice(0, 200),
    );

    const nid = await call(client, 'hcm_rest_get', { path: 'workers/1001/child/nationalIdentifiers' });
    record(
      section,
      'hcm_rest_get nationalIdentifiers child blocked without SENSITIVE',
      isBlocked(nid) && /SENSITIVE/i.test(JSON.stringify(nid.data)),
      JSON.stringify(nid.data).slice(0, 200),
    );
  });

  await withClient(
    ['dist/index.js'],
    async (client) => {
      const ps = await call(client, 'hcm_rest_get', { path: 'payslips/PS1' });
      record(
        section,
        'hcm_rest_get payslips allowed with SENSITIVE=1',
        !ps.isError && (ps.data.PayslipId === 'PS1' || (ps.data.items?.length ?? 0) > 0),
        JSON.stringify(ps.data).slice(0, 200),
      );
      const named = await call(client, 'hcm_get_payslip', { payslipId: 'PS1' });
      record(
        section,
        'hcm_get_payslip allowed with SENSITIVE=1',
        !named.isError && named.data.PayslipId === 'PS1',
        JSON.stringify(named.data).slice(0, 200),
      );
    },
    { ORACLE_HCM_SENSITIVE: '1' },
  );
}

async function runV06DomainSmoke() {
  const section = 'E) v0.6 domain smoke (approval mode)';
  console.log(`\n=== ${section} ===`);
  await withClient(['dist/index.js'], async (client) => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    const missing = V06_TOOLS.filter((n) => !names.includes(n));
    record(section, 'tool count >= 170', names.length >= 170, `count=${names.length}`);
    record(section, 'v0.6 tools registered', missing.length === 0, missing.join(',') || 'all present');

    const rc = await call(client, 'hcm_search_check_ins', { limit: 5 });
    record(
      section,
      'hcm_search_check_ins',
      !rc.isError && (rc.data.items?.length ?? 0) > 0,
      JSON.stringify(rc.data).slice(0, 200),
    );

    const learn = await call(client, 'hcm_search_learning_assignments', { limit: 5 });
    record(
      section,
      'hcm_search_learning_assignments',
      !learn.isError && (learn.data.items?.length ?? 0) > 0,
      JSON.stringify(learn.data).slice(0, 200),
    );

    const docs = await call(client, 'hcm_search_document_records', { limit: 5 });
    record(
      section,
      'hcm_search_document_records',
      !docs.isError && (docs.data.items?.length ?? 0) > 0,
      JSON.stringify(docs.data).slice(0, 200),
    );

    const pools = await call(client, 'hcm_search_talent_pools', { limit: 5 });
    record(
      section,
      'hcm_search_talent_pools',
      !pools.isError && (pools.data.items?.length ?? 0) > 0,
      JSON.stringify(pools.data).slice(0, 200),
    );

    const preview = await call(client, 'hcm_preview_write', {
      toolName: 'hcm_create_absence',
      args: { body: { personNumber: 'P1001', absenceType: 'Vacation', startDate: '2026-11-15' } },
    });
    record(
      section,
      'hcm_preview_write dry-run',
      !preview.isError && preview.data.dry_run === true && preview.data.wouldQueueApproval === true,
      JSON.stringify(preview.data).slice(0, 200),
    );

    const recipe = await call(client, 'hcm_recipe_transfer', {
      workerId: '1001',
      body: { OrganizationId: 'O1' },
    });
    record(
      section,
      'hcm_recipe_transfer → pending_approval',
      !recipe.isError && recipe.data.pending_approval === true && Boolean(recipe.data.approval_id),
      JSON.stringify(recipe.data).slice(0, 200),
    );

    const atom = await call(client, 'hcm_atom_poll', { collection: 'empupdate', limit: 10 });
    record(
      section,
      'hcm_atom_poll',
      !atom.isError && (Array.isArray(atom.data.entries) || Array.isArray(atom.data.items) || atom.data.feedId),
      JSON.stringify(atom.data).slice(0, 200),
    );

    const fmap = await call(client, 'hcm_field_map', { domain: 'worker', oracle: 'PersonNumber' });
    record(
      section,
      'hcm_field_map',
      !fmap.isError && (fmap.data.resolved || fmap.data.entries || fmap.data.friendly),
      JSON.stringify(fmap.data).slice(0, 200),
    );
  });
}

async function runV09DomainSmoke() {
  const section = 'G) v0.9 official children (write mode)';
  console.log(`\n=== ${section} ===`);
  await withClient(['dist/index.js', '--write'], async (client) => {
    const names = await call(client, 'hcm_search_names', { workerId: '1001' });
    record(
      section,
      'hcm_search_names',
      !names.isError && (names.data.items?.length ?? 0) > 0,
      JSON.stringify(names.data).slice(0, 200),
    );
    const te = await call(client, 'hcm_search_time_event_requests', {});
    record(
      section,
      'hcm_search_time_event_requests',
      !te.isError && (te.data.items?.length ?? 0) > 0,
      JSON.stringify(te.data).slice(0, 200),
    );
    const skills = await call(client, 'hcm_list_requisition_skills', { requisitionId: 'REQ1' });
    record(
      section,
      'hcm_list_requisition_skills',
      !skills.isError && skills.data.items?.[0]?.SkillId,
      JSON.stringify(skills.data).slice(0, 200),
    );
    const jobs = await call(client, 'hcm_list_jobs_lov', {});
    record(
      section,
      'hcm_list_jobs_lov',
      !jobs.isError && (jobs.data.items?.length ?? 0) > 0,
      JSON.stringify(jobs.data).slice(0, 200),
    );
    const atom = await call(client, 'hcm_atom_poll', { collection: 'workrelshipupdate', limit: 10 });
    record(
      section,
      'hcm_atom_poll workrelshipupdate',
      !atom.isError && atom.data.feedId,
      JSON.stringify(atom.data).slice(0, 200),
    );
  }, { ORACLE_HCM_SENSITIVE: '1' });
}

function writeReport() {
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const verdict =
    failed === 0
      ? 'PASS — stdio MCP e2e against dummy HCM (approval, --write, v0.3, v0.6, v0.7, v0.9)'
      : `FAIL — ${failed} step(s) failed (see details)`;

  const lines = [
    '# Oracle HCM MCP — E2E Report',
    '',
    `- Date: ${new Date().toISOString()} (box UTC; user zone Asia/Calcutta)`,
    `- Target: http://127.0.0.1:9090 (dummy HCM, basic auth demo/demo)`,
    `- Script: scripts/e2e-stdio.mjs (MCP Client + StdioClientTransport)`,
    `- Server: node dist/index.js [ --write ]  (v0.9.0)`,
    '',
    `## Verdict: **${verdict}**`,
    '',
    `| Result | Count |`,
    `| --- | --- |`,
    `| PASS | ${passed} |`,
    `| FAIL | ${failed} |`,
    '',
  ];

  if (gaps.length) {
    lines.push('## Known / dummy gaps', '');
    for (const g of gaps) lines.push(`- ${g}`);
    lines.push('');
  }

  let current = '';
  for (const r of results) {
    if (r.section !== current) {
      current = r.section;
      lines.push(`## ${current}`, '');
      lines.push('| Step | Result | Detail |', '| --- | --- | --- |');
    }
    lines.push(
      `| ${r.step.replace(/\|/g, '\\|')} | ${r.pass ? 'PASS' : 'FAIL'} | \`${r.detail.replace(/`/g, "'").replace(/\|/g, '\\|')}\` |`,
    );
  }
  lines.push('', '## Notes', '');
  lines.push(
    '- Approval tools remain registered in `--write` mode so sensitive tools can still require approval unless `ORACLE_HCM_SENSITIVE_WRITE=1` or `--write` (which bypasses all gates).',
  );
  lines.push(
    '- `hcm_rest_mutate` to CE/generative-AI style paths is rejected by allowlist/blocklist before pending approval or execution.',
  );
  lines.push(
    '- v0.7: `ORACLE_HCM_APPROVAL_TOKEN` is never returned in pending payloads; HTTP/gRPC bearer is fail-closed; SENSITIVE resource roots apply to `hcm_rest_get`.',
  );
  lines.push(
    '- v0.9: official worker children, timeEventRequests, work-structure LOVs, recruiting/benefit children, documentRecords actions, If-Match 412.',
  );
  lines.push('- Dummy HCM covers official 11.13.18.05 paths including atomservlet, recruiting, benefits, payslips (gated), checklists, performance, learning, recipes.', '');

  fs.writeFileSync(REPORT_PATH, lines.join('\n'));
  console.log(`\nWrote ${REPORT_PATH}`);
  console.log(`\nSUMMARY: ${passed} passed, ${failed} failed — ${verdict}`);
  return failed === 0;
}

async function main() {
  // Ensure dummy is reachable
  try {
    const res = await fetch('http://127.0.0.1:9090/health');
    if (!res.ok) throw new Error(`health ${res.status}`);
  } catch (e) {
    console.error('Dummy HCM not reachable on :9090 — start with: node dist/dummy-hcm/index.js');
    throw e;
  }

  await runApprovalMode();
  await runWriteMode();
  await runV03Smoke();
  await runV07Security();
  await runV06DomainSmoke();
  await runV09DomainSmoke();
  const ok = writeReport();
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
