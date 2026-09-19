import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './helpers.js';
import { gateWrite, runRead, jsonResult, errorResult, bindExecutor, recordAudit, executeApproved, requireApprovalToken } from './helpers.js';
import { ALLOWED_ROOTS, assertAllowlisted } from '../../policy/allowlist.js';

export const RESOURCE_CATALOG = [
  { name: 'workers', path: 'workers', description: 'HCM workers (person + work relationships)' },
  { name: 'absences', path: 'absences', description: 'Absence entries' },
  { name: 'planBalances', path: 'planBalances', description: 'Absence plan balances' },
  { name: 'areasOfResponsibility', path: 'areasOfResponsibility', description: 'Areas of responsibility (AOR)' },
  { name: 'allocatedChecklists', path: 'allocatedChecklists', description: 'Allocated checklists; tasks via child/allocatedTasks' },
  { name: 'businessProcessNotifications', path: 'businessProcessNotifications', description: 'Business process notifications inbox' },
  { name: 'workerAssignments', path: 'workerAssignments', description: 'Worker assignments' },
  { name: 'organizations', path: 'organizations', description: 'Organizations / departments LOV' },
  { name: 'locations', path: 'locations', description: 'Locations LOV' },
  { name: 'jobs', path: 'jobs', description: 'Jobs LOV' },
  { name: 'grades', path: 'grades', description: 'Grades LOV' },
  { name: 'timeRecords', path: 'timeRecords', description: 'Time records' },
  { name: 'talentPersonProfiles', path: 'talentPersonProfiles', description: 'Talent person profiles' },
  { name: 'payrollRelationships', path: 'payrollRelationships', description: 'Payroll relationships (read-only)' },
  { name: 'publicWorkers', path: 'publicWorkers', description: 'Public workers view' },
  { name: 'hcmContacts', path: 'hcmContacts', description: 'Worker contacts' },
  { name: 'positions', path: 'positions', description: 'Positions LOV' },
  { name: 'recruitingJobRequisitions', path: 'recruitingJobRequisitions', description: 'Job requisitions' },
  { name: 'recruitingCandidates', path: 'recruitingCandidates', description: 'Recruiting candidates' },
  { name: 'benefitEnrollments', path: 'benefitEnrollments', description: 'Benefits enrollments' },
  { name: 'absenceTypes', path: 'absenceTypes', description: 'Absence types LOV' },
  { name: 'absencePlans', path: 'absencePlans', description: 'Absence plans LOV' },
  { name: 'timeCards', path: 'timeCards', description: 'Time cards' },
  { name: 'workSchedules', path: 'workSchedules', description: 'Work schedules' },
  { name: 'goals', path: 'goals', description: 'Talent goals' },
  { name: 'performanceDocuments', path: 'performanceDocuments', description: 'Performance documents' },
  { name: 'learningEnrollments', path: 'learningEnrollments', description: 'Learning enrollments' },
  { name: 'payslips', path: 'payslips', description: 'Payslips (SENSITIVE)' },
  { name: 'bankAccounts', path: 'bankAccounts', description: 'Bank accounts (SENSITIVE)' },
  { name: 'nationalIdentifiers', path: 'nationalIdentifiers', description: 'National IDs (SENSITIVE)' },
  { name: 'atomfeeds', path: 'atomfeeds', description: 'Atom change feeds' },
];

export function registerCoreTools(server: McpServer, ctx: ToolContext): void {
  registerMeta(server, ctx);
  registerWorkers(server, ctx);
  registerAbsences(server, ctx);
  registerAor(server, ctx);
  registerChecklists(server, ctx);
  registerNotifications(server, ctx);
  registerOrgLovs(server, ctx);
  registerTime(server, ctx);
  registerTalent(server, ctx);
  registerPayroll(server, ctx);
  registerGeneric(server, ctx);
  if (!ctx.writeMode) {
    registerApproval(server, ctx);
  } else {
    // Still register approve/deny when sensitive tools may need approval under --write
    registerApproval(server, ctx);
  }
}

function registerMeta(server: McpServer, ctx: ToolContext): void {
  server.registerTool('hcm_health', {
    description: 'Check connectivity to the configured HCM REST base (unofficial MCP).',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, async () => runRead(() => ctx.client.health(), ctx, 'hcm_health'));

  server.registerTool('hcm_whoami', {
    description: 'Return local auth/config identity hints (no secrets). HCM RBAC still applies.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, async () => runRead(() => ctx.client.whoami(), ctx, 'hcm_whoami'));

  server.registerTool('hcm_list_resources', {
    description: 'List curated HCM resource roots supported by this unofficial MCP.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, async () => runRead(async () => ({
    resources: RESOURCE_CATALOG,
    allowlisted_roots: ALLOWED_ROOTS,
    note: 'Not an official Oracle catalog; curated for v0.3. Fusion path names used.',
  }), ctx, 'hcm_list_resources'));

  server.registerTool('hcm_describe_resource', {
    description: 'Describe a curated resource by name (workers, planBalances, …).',
    inputSchema: { name: z.string().describe('Resource name, e.g. workers') },
    annotations: { readOnlyHint: true },
  }, async ({ name }) => runRead(async () => {
    const found = RESOURCE_CATALOG.find((r) => r.name === name || r.path === name);
    if (!found) throw new Error(`Unknown curated resource: ${name}`);
    return found;
  }, ctx, 'hcm_describe_resource'));
}

function registerWorkers(server: McpServer, ctx: ToolContext): void {
  server.registerTool('hcm_search_workers', {
    description: 'Search workers (q / finder / limit / offset). Example: { "q": "PersonNumber=P1001", "limit": 5 }',
    inputSchema: {
      q: z.string().optional().describe('ADF q filter, e.g. PersonNumber=123'),
      finder: z.string().optional(),
      limit: z.number().int().positive().optional(),
      offset: z.number().int().nonnegative().optional(),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => runRead(() => ctx.client.list('workers', {
    q: args.q, finder: args.finder, limit: args.limit ?? 25, offset: args.offset ?? 0,
  }), ctx, 'hcm_search_workers'));

  server.registerTool('hcm_get_worker', {
    description: 'Get a worker by WorkerId. Example: { "workerId": "1001" }',
    inputSchema: { workerId: z.string().describe('Worker primary key') },
    annotations: { readOnlyHint: true },
  }, async ({ workerId }) => runRead(() => ctx.client.getJson(`workers/${encodeURIComponent(workerId)}`), ctx, 'hcm_get_worker'));

  server.registerTool('hcm_get_worker_assignments', {
    description: 'Deep-read worker assignments. Prefers workers/{id} expand; falls back to workerAssignments.',
    inputSchema: {
      workerId: z.string(),
      expand: z.string().optional().describe('ADF expand, default workRelationships.assignments'),
    },
    annotations: { readOnlyHint: true },
  }, async ({ workerId, expand }) => runRead(async () => {
    try {
      return await ctx.client.getJson(`workers/${encodeURIComponent(workerId)}`, {
        expand: expand ?? 'workRelationships.assignments',
      });
    } catch {
      return ctx.client.list('workerAssignments', { q: `WorkerId=${workerId}`, limit: 100 });
    }
  }, ctx, 'hcm_get_worker_assignments'));

  bindExecutor(ctx, 'hcm_create_worker', async (args) => ctx.client.postJson('workers', args.body));
  server.registerTool('hcm_create_worker', {
    description: 'Create a worker (requires approval unless --write). Example body: { "DisplayName": "New Hire", "PersonNumber": "P9" }',
    inputSchema: { body: z.record(z.unknown()).describe('Worker JSON payload') },
    annotations: { readOnlyHint: false },
  }, async (args) => gateWrite(ctx, 'hcm_create_worker', args));

  bindExecutor(ctx, 'hcm_update_worker', async (args) =>
    ctx.client.patchJson(`workers/${encodeURIComponent(String(args.workerId))}`, args.body));
  server.registerTool('hcm_update_worker', {
    description: 'PATCH a worker (requires approval unless --write).',
    inputSchema: { workerId: z.string(), body: z.record(z.unknown()) },
    annotations: { readOnlyHint: false },
  }, async (args) => gateWrite(ctx, 'hcm_update_worker', args));
}

function registerAbsences(server: McpServer, ctx: ToolContext): void {
  server.registerTool('hcm_search_absences', {
    description: 'Search absences.',
    inputSchema: {
      q: z.string().optional(),
      limit: z.number().int().positive().optional(),
      offset: z.number().int().nonnegative().optional(),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => runRead(() => ctx.client.list('absences', {
    q: args.q, limit: args.limit ?? 25, offset: args.offset ?? 0,
  }), ctx, 'hcm_search_absences'));

  server.registerTool('hcm_get_absence', {
    description: 'Get absence by id.',
    inputSchema: { absenceId: z.string() },
    annotations: { readOnlyHint: true },
  }, async ({ absenceId }) => runRead(() => ctx.client.getJson(`absences/${encodeURIComponent(absenceId)}`), ctx, 'hcm_get_absence'));

  bindExecutor(ctx, 'hcm_create_absence', async (args) => ctx.client.postJson('absences', args.body));
  server.registerTool('hcm_create_absence', {
    description: 'Create an absence entry (approval unless --write).',
    inputSchema: { body: z.record(z.unknown()) },
    annotations: { readOnlyHint: false },
  }, async (args) => gateWrite(ctx, 'hcm_create_absence', args));

  bindExecutor(ctx, 'hcm_update_absence', async (args) =>
    ctx.client.patchJson(`absences/${encodeURIComponent(String(args.absenceId))}`, args.body));
  server.registerTool('hcm_update_absence', {
    description: 'Update an absence (approval unless --write).',
    inputSchema: { absenceId: z.string(), body: z.record(z.unknown()) },
    annotations: { readOnlyHint: false },
  }, async (args) => gateWrite(ctx, 'hcm_update_absence', args));

  bindExecutor(ctx, 'hcm_delete_absence', async (args) =>
    ctx.client.delete(`absences/${encodeURIComponent(String(args.absenceId))}`));
  server.registerTool('hcm_delete_absence', {
    description: 'Delete an absence (approval unless --write).',
    inputSchema: { absenceId: z.string() },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async (args) => gateWrite(ctx, 'hcm_delete_absence', args));

  server.registerTool('hcm_absence_balance', {
    description: 'Search absence plan balances via Fusion planBalances.',
    inputSchema: {
      personNumber: z.string().optional(),
      q: z.string().optional(),
      finder: z.string().optional(),
      limit: z.number().int().positive().optional(),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => runRead(() => {
    const q = args.q ?? (args.personNumber ? `personNumber=${args.personNumber}` : undefined);
    return ctx.client.list('planBalances', { q, finder: args.finder, limit: args.limit ?? 25 });
  }, ctx, 'hcm_absence_balance'));

  server.registerTool('hcm_get_plan_balance', {
    description: 'Get a single plan balance by id (Fusion planBalances/{id}).',
    inputSchema: { balanceId: z.string() },
    annotations: { readOnlyHint: true },
  }, async ({ balanceId }) => runRead(() => ctx.client.getJson(`planBalances/${encodeURIComponent(balanceId)}`), ctx, 'hcm_get_plan_balance'));
}

function registerAor(server: McpServer, ctx: ToolContext): void {
  server.registerTool('hcm_search_aor', {
    description: 'Search areas of responsibility.',
    inputSchema: {
      q: z.string().optional(),
      limit: z.number().int().positive().optional(),
      offset: z.number().int().nonnegative().optional(),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => runRead(() => ctx.client.list('areasOfResponsibility', {
    q: args.q, limit: args.limit ?? 25, offset: args.offset ?? 0,
  }), ctx, 'hcm_search_aor'));

  server.registerTool('hcm_get_aor', {
    description: 'Get AOR by id.',
    inputSchema: { aorId: z.string() },
    annotations: { readOnlyHint: true },
  }, async ({ aorId }) => runRead(() => ctx.client.getJson(`areasOfResponsibility/${encodeURIComponent(aorId)}`), ctx, 'hcm_get_aor'));

  bindExecutor(ctx, 'hcm_create_aor', async (args) => ctx.client.postJson('areasOfResponsibility', args.body));
  server.registerTool('hcm_create_aor', {
    description: 'Create AOR (approval unless --write).',
    inputSchema: { body: z.record(z.unknown()) },
    annotations: { readOnlyHint: false },
  }, async (args) => gateWrite(ctx, 'hcm_create_aor', args));

  bindExecutor(ctx, 'hcm_update_aor', async (args) =>
    ctx.client.patchJson(`areasOfResponsibility/${encodeURIComponent(String(args.aorId))}`, args.body));
  server.registerTool('hcm_update_aor', {
    description: 'Update AOR (approval unless --write).',
    inputSchema: { aorId: z.string(), body: z.record(z.unknown()) },
    annotations: { readOnlyHint: false },
  }, async (args) => gateWrite(ctx, 'hcm_update_aor', args));

  bindExecutor(ctx, 'hcm_delete_aor', async (args) =>
    ctx.client.delete(`areasOfResponsibility/${encodeURIComponent(String(args.aorId))}`));
  server.registerTool('hcm_delete_aor', {
    description: 'Delete AOR (approval unless --write).',
    inputSchema: { aorId: z.string() },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async (args) => gateWrite(ctx, 'hcm_delete_aor', args));
}

function registerChecklists(server: McpServer, ctx: ToolContext): void {
  server.registerTool('hcm_list_checklists', {
    description: 'List allocated checklists.',
    inputSchema: {
      q: z.string().optional(),
      limit: z.number().int().positive().optional(),
      offset: z.number().int().nonnegative().optional(),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => runRead(() => ctx.client.list('allocatedChecklists', {
    q: args.q, limit: args.limit ?? 25, offset: args.offset ?? 0,
  }), ctx, 'hcm_list_checklists'));

  server.registerTool('hcm_get_checklist', {
    description: 'Get allocated checklist by id (expand allocatedTasks when supported).',
    inputSchema: {
      checklistId: z.string(),
      expand: z.string().optional().describe('e.g. allocatedTasks'),
    },
    annotations: { readOnlyHint: true },
  }, async ({ checklistId, expand }) => runRead(() =>
    ctx.client.getJson(`allocatedChecklists/${encodeURIComponent(checklistId)}`, {
      expand: expand ?? 'allocatedTasks',
    }), ctx, 'hcm_get_checklist'));

  bindExecutor(ctx, 'hcm_update_task_status', async (args) =>
    ctx.client.postJson(
      `allocatedChecklists/${encodeURIComponent(String(args.checklistId))}/child/allocatedTasks/${encodeURIComponent(String(args.taskId))}/action/updateTaskStatus`,
      { ...((args.body as object) ?? {}), status: args.status, TaskStatus: args.status },
    ));
  server.registerTool('hcm_update_task_status', {
    description: 'Update checklist task status via child/allocatedTasks/.../action/updateTaskStatus.',
    inputSchema: {
      checklistId: z.string(),
      taskId: z.string(),
      status: z.string().describe('e.g. COMPLETED, IN_PROGRESS'),
      body: z.record(z.unknown()).optional(),
    },
    annotations: { readOnlyHint: false },
  }, async (args) => gateWrite(ctx, 'hcm_update_task_status', args));
}

function registerNotifications(server: McpServer, ctx: ToolContext): void {
  server.registerTool('hcm_list_notifications', {
    description: 'List business process notifications. Optional status/assignee filters (richer BP filters).',
    inputSchema: {
      q: z.string().optional(),
      status: z.string().optional().describe('e.g. OPEN'),
      assignee: z.string().optional(),
      limit: z.number().int().positive().optional(),
      offset: z.number().int().nonnegative().optional(),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => runRead(() => {
    const parts = [args.q, args.status ? `Status=${args.status}` : null, args.assignee ? `Assignee=${args.assignee}` : null]
      .filter(Boolean);
    const q = parts.length ? parts.join(';') : undefined;
    return ctx.client.list('businessProcessNotifications', {
      q, limit: args.limit ?? 25, offset: args.offset ?? 0,
    });
  }, ctx, 'hcm_list_notifications'));

  server.registerTool('hcm_get_notification', {
    description: 'Get a business process notification by task/notification id.',
    inputSchema: { notificationId: z.string() },
    annotations: { readOnlyHint: true },
  }, async ({ notificationId }) => runRead(() =>
    ctx.client.getJson(`businessProcessNotifications/${encodeURIComponent(notificationId)}`),
    ctx, 'hcm_get_notification'));

  bindExecutor(ctx, 'hcm_perform_bp_action', async (args) =>
    ctx.client.postJson('businessProcessNotifications/action/performAction', {
      ...((args.body as object) ?? {}),
      taskId: args.notificationId,
      notificationId: args.notificationId,
      actionName: args.action,
      action: args.action,
      comment: args.comment,
    }));
  server.registerTool('hcm_perform_bp_action', {
    description: 'Perform BP action via businessProcessNotifications/action/performAction.',
    inputSchema: {
      notificationId: z.string(),
      action: z.string().describe('e.g. APPROVE, REJECT'),
      comment: z.string().optional(),
      body: z.record(z.unknown()).optional(),
    },
    annotations: { readOnlyHint: false },
  }, async (args) => gateWrite(ctx, 'hcm_perform_bp_action', args));
}

function registerOrgLovs(server: McpServer, ctx: ToolContext): void {
  const listTool = (name: string, path: string, description: string) => {
    server.registerTool(name, {
      description,
      inputSchema: {
        q: z.string().optional(),
        finder: z.string().optional(),
        limit: z.number().int().positive().optional(),
        offset: z.number().int().nonnegative().optional(),
      },
      annotations: { readOnlyHint: true },
    }, async (args) => runRead(() => ctx.client.list(path, {
      q: args.q, finder: args.finder, limit: args.limit ?? 25, offset: args.offset ?? 0,
    }), ctx, name));
  };
  const getTool = (name: string, path: string, idParam: string, description: string) => {
    server.registerTool(name, {
      description,
      inputSchema: { [idParam]: z.string() },
      annotations: { readOnlyHint: true },
    }, async (args) => {
      const id = String((args as Record<string, string>)[idParam]);
      return runRead(() => ctx.client.getJson(`${path}/${encodeURIComponent(id)}`), ctx, name);
    });
  };
  listTool('hcm_search_organizations', 'organizations', 'Search organizations / departments.');
  getTool('hcm_get_organization', 'organizations', 'organizationId', 'Get organization by id.');
  listTool('hcm_search_locations', 'locations', 'Search locations LOV.');
  getTool('hcm_get_location', 'locations', 'locationId', 'Get location by id.');
  listTool('hcm_search_jobs', 'jobs', 'Search jobs LOV.');
  getTool('hcm_get_job', 'jobs', 'jobId', 'Get job by id.');
  listTool('hcm_search_grades', 'grades', 'Search grades LOV (optional).');
  getTool('hcm_get_grade', 'grades', 'gradeId', 'Get grade by id.');
}

function registerTime(server: McpServer, ctx: ToolContext): void {
  server.registerTool('hcm_search_time_records', {
    description: 'Search time records (Fusion timeRecords).',
    inputSchema: {
      q: z.string().optional(),
      finder: z.string().optional(),
      limit: z.number().int().positive().optional(),
      offset: z.number().int().nonnegative().optional(),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => runRead(() => ctx.client.list('timeRecords', {
    q: args.q, finder: args.finder, limit: args.limit ?? 25, offset: args.offset ?? 0,
  }), ctx, 'hcm_search_time_records'));

  server.registerTool('hcm_get_time_record', {
    description: 'Get a time record by id.',
    inputSchema: { timeRecordId: z.string() },
    annotations: { readOnlyHint: true },
  }, async ({ timeRecordId }) => runRead(() =>
    ctx.client.getJson(`timeRecords/${encodeURIComponent(timeRecordId)}`), ctx, 'hcm_get_time_record'));
}

function registerTalent(server: McpServer, ctx: ToolContext): void {
  server.registerTool('hcm_search_talent_profiles', {
    description: 'Search talent person profiles.',
    inputSchema: {
      q: z.string().optional(),
      limit: z.number().int().positive().optional(),
      offset: z.number().int().nonnegative().optional(),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => runRead(() => ctx.client.list('talentPersonProfiles', {
    q: args.q, limit: args.limit ?? 25, offset: args.offset ?? 0,
  }), ctx, 'hcm_search_talent_profiles'));

  server.registerTool('hcm_get_talent_profile', {
    description: 'Get talent person profile by id.',
    inputSchema: { profileId: z.string() },
    annotations: { readOnlyHint: true },
  }, async ({ profileId }) => runRead(() =>
    ctx.client.getJson(`talentPersonProfiles/${encodeURIComponent(profileId)}`), ctx, 'hcm_get_talent_profile'));

  bindExecutor(ctx, 'hcm_update_talent_profile', async (args) =>
    ctx.client.patchJson(`talentPersonProfiles/${encodeURIComponent(String(args.profileId))}`, args.body));
  server.registerTool('hcm_update_talent_profile', {
    description: 'Light PATCH of a talent person profile (approval unless --write).',
    inputSchema: { profileId: z.string(), body: z.record(z.unknown()) },
    annotations: { readOnlyHint: false },
  }, async (args) => gateWrite(ctx, 'hcm_update_talent_profile', args));
}

function registerPayroll(server: McpServer, ctx: ToolContext): void {
  server.registerTool('hcm_search_payroll_relationships', {
    description: 'Search payroll relationships (read-only).',
    inputSchema: {
      q: z.string().optional(),
      limit: z.number().int().positive().optional(),
      offset: z.number().int().nonnegative().optional(),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => runRead(() => ctx.client.list('payrollRelationships', {
    q: args.q, limit: args.limit ?? 25, offset: args.offset ?? 0,
  }), ctx, 'hcm_search_payroll_relationships'));

  server.registerTool('hcm_get_payroll_relationship', {
    description: 'Get payroll relationship by id (read-only).',
    inputSchema: { payrollRelationshipId: z.string() },
    annotations: { readOnlyHint: true },
  }, async ({ payrollRelationshipId }) => runRead(() =>
    ctx.client.getJson(`payrollRelationships/${encodeURIComponent(payrollRelationshipId)}`),
    ctx, 'hcm_get_payroll_relationship'));
}

function registerGeneric(server: McpServer, ctx: ToolContext): void {
  server.registerTool('hcm_rest_get', {
    description: 'Allowlisted generic GET under HCM resources. Blocked for CE/generative-AI/internal paths.',
    inputSchema: {
      path: z.string().describe('Relative path, e.g. workers?limit=5 or workers/123'),
      query: z.record(z.union([z.string(), z.number()])).optional(),
    },
    annotations: { readOnlyHint: true },
  }, async ({ path, query }) => runRead(() => ctx.client.restGet(path, query), ctx, 'hcm_rest_get'));

  bindExecutor(ctx, 'hcm_rest_mutate', async (args) =>
    ctx.client.restMutate(args.method as 'POST' | 'PATCH' | 'PUT' | 'DELETE', String(args.path), args.body));
  server.registerTool('hcm_rest_mutate', {
    description: 'Allowlisted generic mutate (POST/PATCH/PUT/DELETE). Requires approval unless --write.',
    inputSchema: {
      method: z.enum(['POST', 'PATCH', 'PUT', 'DELETE']),
      path: z.string(),
      body: z.unknown().optional(),
    },
    annotations: { readOnlyHint: false },
  }, async (args) => {
    try { assertAllowlisted(String(args.path)); } catch (err) { return errorResult(err); }
    return gateWrite(ctx, 'hcm_rest_mutate', args);
  });
}

function registerApproval(server: McpServer, ctx: ToolContext): void {
  server.registerTool('hcm_list_pending_approvals', {
    description: 'List pending write intents awaiting human approval.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, async () => runRead(async () => ({
    pending: ctx.approvals.listPending().map((i) => ({
      approval_id: i.approvalId,
      tool: i.toolName,
      summary: i.summary,
      created_at: new Date(i.createdAt).toISOString(),
      expires_at: new Date(i.expiresAt).toISOString(),
    })),
  }), ctx, 'hcm_list_pending_approvals'));

  server.registerTool('hcm_approve_write', {
    description:
      'HUMAN/OPS ONLY. Approve and execute a pending write. Requires approval_token matching ORACLE_HCM_APPROVAL_TOKEN (never returned by tools; printed on stderr at startup if generated).',
    inputSchema: { approval_id: z.string(), approval_token: z.string() },
    annotations: { readOnlyHint: false },
  }, async ({ approval_id, approval_token }) => {
    try {
      requireApprovalToken(ctx, { approval_token });
      const { intent, result } = await ctx.approvals.approve(approval_id, (toolName, args) =>
        executeApproved(ctx, toolName, args),
      );
      recordAudit(ctx, intent.toolName, 'approval', intent.approvalId);
      return jsonResult({ approved: true, approval_id: intent.approvalId, tool: intent.toolName, result });
    } catch (err) {
      return errorResult(err);
    }
  });

  server.registerTool('hcm_deny_write', {
    description:
      'HUMAN/OPS ONLY. Deny a pending write. Requires approval_token matching ORACLE_HCM_APPROVAL_TOKEN.',
    inputSchema: { approval_id: z.string(), approval_token: z.string() },
    annotations: { readOnlyHint: false },
  }, async ({ approval_id, approval_token }) => {
    try {
      requireApprovalToken(ctx, { approval_token });
      const intent = ctx.approvals.deny(approval_id);
      recordAudit(ctx, intent.toolName, 'deny', intent.approvalId);
      return jsonResult({ denied: true, approval_id: intent.approvalId, tool: intent.toolName });
    } catch (err) {
      return errorResult(err);
    }
  });
}
