/**
 * v0.3 curated tools — recruiting, benefits, atom, sensitive payroll, agent UX, etc.
 * Unofficial — not affiliated with Oracle.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './helpers.js';
import {
  gateWrite,
  runRead,
  jsonResult,
  errorResult,
  bindExecutor,
  recordAudit,
} from './helpers.js';
import { publicConfigView } from '../../config.js';
import { ALLOWED_ROOTS, assertAllowlisted, isBlockedPath } from '../../policy/allowlist.js';
import { classifyTool, READ_TOOLS, WRITE_TOOLS } from '../../policy/classify.js';
import { SENSITIVE_TOOLS } from '../../policy/sensitive.js';
import { RESOURCE_CATALOG } from './register-core.js';
import { WebhookReceiver } from '../../platform/webhookStub.js';
import { redactDeep } from '../../platform/redact.js';

const listArgs = {
  q: z.string().optional(),
  finder: z.string().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
};

function listHandler(ctx: ToolContext, path: string, tool: string) {
  return async (args: {
    q?: string;
    finder?: string;
    limit?: number;
    offset?: number;
  }) =>
    runRead(
      () =>
        ctx.client.list(path, {
          q: args.q,
          finder: args.finder,
          limit: args.limit ?? 25,
          offset: args.offset ?? 0,
        }),
      ctx,
      tool,
    );
}

export function registerExtraTools(server: McpServer, ctx: ToolContext): void {
  registerAtom(server, ctx);
  registerRecruiting(server, ctx);
  registerBenefits(server, ctx);
  registerChecklistExtra(server, ctx);
  registerAssignmentWrites(server, ctx);
  registerLovHelpers(server, ctx);
  registerSetupTools(server, ctx);
  registerCoreHrExtra(server, ctx);
  registerManagerOrg(server, ctx);
  registerTimeAbsenceExtra(server, ctx);
  registerTalentLearning(server, ctx);
  registerSensitivePayroll(server, ctx);
  registerApprovalsExtra(server, ctx);
  registerAgentUx(server, ctx);
  registerPlatformTools(server, ctx);
}

function registerAtom(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_list_atom_entries',
    {
      description:
        'List Atom feed / change-detection entries (Fusion atomfeeds). Dummy returns mock change events.',
      inputSchema: { ...listArgs, collection: z.string().optional().describe('e.g. workers') },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(
        () =>
          ctx.client.list('atomfeeds', {
            q: args.q ?? (args.collection ? `Collection=${args.collection}` : undefined),
            finder: args.finder,
            limit: args.limit ?? 25,
            offset: args.offset ?? 0,
          }),
        ctx,
        'hcm_list_atom_entries',
      ),
  );

  server.registerTool(
    'hcm_detect_changes',
    {
      description:
        'Summarize recent Atom/change entries since an optional ISO timestamp (client-side filter on feed).',
      inputSchema: {
        since: z.string().optional().describe('ISO timestamp'),
        collection: z.string().optional(),
        limit: z.number().int().positive().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        const feed = await ctx.client.list('atomfeeds', {
          q: args.collection ? `Collection=${args.collection}` : undefined,
          limit: args.limit ?? 50,
        });
        const sinceMs = args.since ? Date.parse(args.since) : 0;
        const items = (feed.items as Record<string, unknown>[]).filter((it) => {
          const u = String(it.Updated ?? it.published ?? it.updated ?? '');
          const t = Date.parse(u);
          return !sinceMs || (Number.isFinite(t) && t >= sinceMs);
        });
        return {
          since: args.since ?? null,
          count: items.length,
          items,
          note: 'Unofficial change detection over atomfeeds; not Oracle CDC.',
        };
      }, ctx, 'hcm_detect_changes'),
  );
}

function registerRecruiting(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_search_requisitions',
    {
      description: 'Search recruiting job requisitions.',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'recruitingJobRequisitions', 'hcm_search_requisitions'),
  );
  server.registerTool(
    'hcm_get_requisition',
    {
      description: 'Get recruiting job requisition by id.',
      inputSchema: { requisitionId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ requisitionId }) =>
      runRead(
        () =>
          ctx.client.getJson(
            `recruitingJobRequisitions/${encodeURIComponent(requisitionId)}`,
          ),
        ctx,
        'hcm_get_requisition',
      ),
  );
  server.registerTool(
    'hcm_search_candidates',
    {
      description: 'Search recruiting candidates.',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'recruitingCandidates', 'hcm_search_candidates'),
  );
  server.registerTool(
    'hcm_get_candidate',
    {
      description: 'Get recruiting candidate by id.',
      inputSchema: { candidateId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ candidateId }) =>
      runRead(
        () =>
          ctx.client.getJson(`recruitingCandidates/${encodeURIComponent(candidateId)}`),
        ctx,
        'hcm_get_candidate',
      ),
  );
}

function registerBenefits(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_search_benefit_enrollments',
    {
      description: 'Search benefits enrollments.',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'benefitEnrollments', 'hcm_search_benefit_enrollments'),
  );
  server.registerTool(
    'hcm_get_benefit_enrollment',
    {
      description: 'Get benefits enrollment by id.',
      inputSchema: { enrollmentId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ enrollmentId }) =>
      runRead(
        () =>
          ctx.client.getJson(`benefitEnrollments/${encodeURIComponent(enrollmentId)}`),
        ctx,
        'hcm_get_benefit_enrollment',
      ),
  );
}

function registerChecklistExtra(server: McpServer, ctx: ToolContext): void {
  bindExecutor(ctx, 'hcm_allocate_checklist', async (args) =>
    ctx.client.postJson('allocatedChecklists/action/allocateChecklist', args.body ?? args),
  );
  server.registerTool(
    'hcm_allocate_checklist',
    {
      description: 'Allocate a checklist to a person (approval unless --write).',
      inputSchema: {
        body: z.record(z.unknown()).describe('Allocate payload (PersonNumber, ChecklistName, …)'),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_allocate_checklist', args),
  );

  bindExecutor(ctx, 'hcm_force_close_checklist', async (args) =>
    ctx.client.postJson(
      `allocatedChecklists/${encodeURIComponent(String(args.checklistId))}/action/forceClose`,
      args.body ?? {},
    ),
  );
  server.registerTool(
    'hcm_force_close_checklist',
    {
      description: 'Force-close an allocated checklist (approval unless --write).',
      inputSchema: {
        checklistId: z.string(),
        body: z.record(z.unknown()).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async (args) => gateWrite(ctx, 'hcm_force_close_checklist', args),
  );
}

function registerAssignmentWrites(server: McpServer, ctx: ToolContext): void {
  bindExecutor(ctx, 'hcm_create_worker_assignment', async (args) => {
    const workerId = String(args.workerId);
    const body = args.body as Record<string, unknown>;
    return ctx.client.postJson(
      `workers/${encodeURIComponent(workerId)}/child/workRelationships/${encodeURIComponent(String(args.periodOfServiceId ?? 'WR1'))}/child/assignments`,
      body,
    );
  });
  server.registerTool(
    'hcm_create_worker_assignment',
    {
      description:
        'Create nested worker assignment under workRelationships/.../assignments (approval unless --write).',
      inputSchema: {
        workerId: z.string(),
        periodOfServiceId: z.string().optional(),
        body: z.record(z.unknown()),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_create_worker_assignment', args),
  );

  bindExecutor(ctx, 'hcm_update_worker_assignment', async (args) =>
    ctx.client.patchJson(
      `workerAssignments/${encodeURIComponent(String(args.assignmentId))}`,
      args.body,
    ),
  );
  server.registerTool(
    'hcm_update_worker_assignment',
    {
      description: 'PATCH a worker assignment (approval unless --write).',
      inputSchema: { assignmentId: z.string(), body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_update_worker_assignment', args),
  );
}

function registerLovHelpers(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_lov_finder',
    {
      description:
        'Better LOV finder helper — runs finder= on an allowlisted LOV root (organizations, locations, jobs, grades, positions, absenceTypes).',
      inputSchema: {
        resource: z.string().describe('e.g. locations'),
        finder: z.string().describe('Fusion finder name / expression'),
        q: z.string().optional(),
        limit: z.number().int().positive().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        assertAllowlisted(args.resource);
        return ctx.client.list(args.resource, {
          finder: args.finder,
          q: args.q,
          limit: args.limit ?? 25,
        });
      }, ctx, 'hcm_lov_finder'),
  );

  server.registerTool(
    'hcm_resolve_uniq_key',
    {
      description:
        'Resolve a Fusion-style uniq key / business key to a primary id via q= on an allowlisted resource.',
      inputSchema: {
        resource: z.string(),
        key: z.string().describe('Field name, e.g. PersonNumber'),
        value: z.string(),
        idField: z.string().optional().describe('Primary key field hint'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        assertAllowlisted(args.resource);
        const list = await ctx.client.list(args.resource, {
          q: `${args.key}=${args.value}`,
          limit: 5,
        });
        const items = list.items as Record<string, unknown>[];
        const idField = args.idField;
        return {
          resource: args.resource,
          key: args.key,
          value: args.value,
          matches: items.length,
          items,
          resolvedId: items[0]
            ? idField
              ? items[0][idField]
              : items[0][Object.keys(items[0]).find((k) => /Id$/i.test(k)) ?? '']
            : null,
        };
      }, ctx, 'hcm_resolve_uniq_key'),
  );
}

function registerSetupTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_setup_status',
    {
      description: 'Setup status: public config view, write/sensitive flags, tool counts (no secrets).',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () =>
      runRead(
        async () => ({
          ...publicConfigView(ctx.config),
          pendingApprovals: ctx.approvals.listPending().length,
          toolCounts: {
            read: READ_TOOLS.size,
            write: WRITE_TOOLS.size,
            sensitive: SENSITIVE_TOOLS.size,
          },
          webhookListening: Boolean(ctx.webhook),
        }),
        ctx,
        'hcm_setup_status',
      ),
  );

  server.registerTool(
    'hcm_test_connection',
    {
      description: 'Probe HCM connectivity via workers?limit=1 (same as hcm_health, explicit setup name).',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => runRead(() => ctx.client.health(), ctx, 'hcm_test_connection'),
  );

  server.registerTool(
    'hcm_emit_mcp_config',
    {
      description:
        'Emit a redacted Cursor mcp.json fragment for oracle-hcm / oracle-hcm-write (secrets as placeholders).',
      inputSchema: {
        includeWriteServer: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        const env: Record<string, string> = {
          ORACLE_HCM_BASE_URL: ctx.config.baseUrl,
          ORACLE_HCM_API_VERSION: ctx.config.apiVersion,
          ORACLE_HCM_AUTH: ctx.config.authMode,
        };
        if (ctx.config.authMode === 'basic') {
          env.ORACLE_HCM_USERNAME = ctx.config.username ?? '${ORACLE_HCM_USERNAME}';
          env.ORACLE_HCM_PASSWORD = '${ORACLE_HCM_PASSWORD}';
        } else if (ctx.config.authMode === 'bearer') {
          env.ORACLE_HCM_BEARER_TOKEN = '${ORACLE_HCM_BEARER_TOKEN}';
        } else if (ctx.config.authMode === 'oauth') {
          env.ORACLE_HCM_TOKEN_URL = ctx.config.tokenUrl ?? '${ORACLE_HCM_TOKEN_URL}';
          env.ORACLE_HCM_CLIENT_ID = ctx.config.clientId ?? '${ORACLE_HCM_CLIENT_ID}';
          env.ORACLE_HCM_CLIENT_SECRET = '${ORACLE_HCM_CLIENT_SECRET}';
        }
        if (ctx.config.sensitiveEnabled) env.ORACLE_HCM_SENSITIVE = '1';
        const servers: Record<string, unknown> = {
          'oracle-hcm': {
            command: 'npx',
            args: ['-y', 'oracle-hcm-mcp'],
            env,
          },
        };
        if (args.includeWriteServer !== false) {
          servers['oracle-hcm-write'] = {
            command: 'npx',
            args: ['-y', 'oracle-hcm-mcp', '--write'],
            env: { ...env, ORACLE_HCM_WRITE: '1' },
          };
        }
        return {
          mcpServers: servers,
          note: 'Redacted placeholders for secrets. Unofficial MCP — not Oracle.',
        };
      }, ctx, 'hcm_emit_mcp_config'),
  );

  server.registerTool(
    'hcm_export_config',
    {
      description: 'Export public (non-secret) config JSON for multi-env profiles / backup.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => runRead(async () => publicConfigView(ctx.config), ctx, 'hcm_export_config'),
  );
}

function registerCoreHrExtra(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_search_public_workers',
    { description: 'Search publicWorkers.', inputSchema: listArgs, annotations: { readOnlyHint: true } },
    listHandler(ctx, 'publicWorkers', 'hcm_search_public_workers'),
  );
  server.registerTool(
    'hcm_get_public_worker',
    {
      description: 'Get publicWorker by id.',
      inputSchema: { publicWorkerId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ publicWorkerId }) =>
      runRead(
        () => ctx.client.getJson(`publicWorkers/${encodeURIComponent(publicWorkerId)}`),
        ctx,
        'hcm_get_public_worker',
      ),
  );
  server.registerTool(
    'hcm_search_contacts',
    { description: 'Search hcmContacts.', inputSchema: listArgs, annotations: { readOnlyHint: true } },
    listHandler(ctx, 'hcmContacts', 'hcm_search_contacts'),
  );
  server.registerTool(
    'hcm_get_contact',
    {
      description: 'Get contact by id.',
      inputSchema: { contactId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ contactId }) =>
      runRead(
        () => ctx.client.getJson(`hcmContacts/${encodeURIComponent(contactId)}`),
        ctx,
        'hcm_get_contact',
      ),
  );
  server.registerTool(
    'hcm_search_phones',
    { description: 'Search worker phones.', inputSchema: listArgs, annotations: { readOnlyHint: true } },
    listHandler(ctx, 'workerPhones', 'hcm_search_phones'),
  );
  server.registerTool(
    'hcm_search_emails',
    { description: 'Search worker emails.', inputSchema: listArgs, annotations: { readOnlyHint: true } },
    listHandler(ctx, 'workerEmails', 'hcm_search_emails'),
  );
  server.registerTool(
    'hcm_get_work_relationship',
    {
      description: 'Get nested work relationship for a worker.',
      inputSchema: { workerId: z.string(), periodOfServiceId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ workerId, periodOfServiceId }) =>
      runRead(async () => {
        const w = (await ctx.client.getJson(
          `workers/${encodeURIComponent(workerId)}`,
          { expand: 'workRelationships' },
        )) as { workRelationships?: Record<string, unknown>[] };
        const wr = (w.workRelationships ?? []).find(
          (r) => String(r.PeriodOfServiceId) === periodOfServiceId,
        );
        if (!wr) throw new Error('Work relationship not found');
        return wr;
      }, ctx, 'hcm_get_work_relationship'),
  );
  server.registerTool(
    'hcm_search_positions',
    { description: 'Search positions LOV.', inputSchema: listArgs, annotations: { readOnlyHint: true } },
    listHandler(ctx, 'positions', 'hcm_search_positions'),
  );
  server.registerTool(
    'hcm_get_position',
    {
      description: 'Get position by id.',
      inputSchema: { positionId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ positionId }) =>
      runRead(
        () => ctx.client.getJson(`positions/${encodeURIComponent(positionId)}`),
        ctx,
        'hcm_get_position',
      ),
  );
}

function registerManagerOrg(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_list_direct_reports',
    {
      description: 'List direct reports for a manager person number (dummy: filters workers by ManagerPersonNumber).',
      inputSchema: {
        managerPersonNumber: z.string(),
        limit: z.number().int().positive().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(
        () =>
          ctx.client.list('workers', {
            q: `ManagerPersonNumber=${args.managerPersonNumber}`,
            limit: args.limit ?? 25,
          }),
        ctx,
        'hcm_list_direct_reports',
      ),
  );

  server.registerTool(
    'hcm_get_org_hierarchy',
    {
      description: 'Return a simple org hierarchy tree rooted at organizationId (dummy parent/child).',
      inputSchema: { organizationId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ organizationId }) =>
      runRead(async () => {
        const org = await ctx.client.getJson(
          `organizations/${encodeURIComponent(organizationId)}`,
        );
        const children = await ctx.client.list('organizations', {
          q: `ParentOrganizationId=${organizationId}`,
          limit: 50,
        });
        return { root: org, children: children.items, note: 'Simplified hierarchy — not full Fusion tree API.' };
      }, ctx, 'hcm_get_org_hierarchy'),
  );

  server.registerTool(
    'hcm_find_locations',
    {
      description: 'Location finder helper (finder + country filter).',
      inputSchema: {
        finder: z.string().optional(),
        country: z.string().optional(),
        q: z.string().optional(),
        limit: z.number().int().positive().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(
        () =>
          ctx.client.list('locations', {
            finder: args.finder ?? 'findByCountry',
            q: args.q ?? (args.country ? `Country=${args.country}` : undefined),
            limit: args.limit ?? 25,
          }),
        ctx,
        'hcm_find_locations',
      ),
  );
}

function registerTimeAbsenceExtra(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_search_absence_types',
    { description: 'Search absence types LOV.', inputSchema: listArgs, annotations: { readOnlyHint: true } },
    listHandler(ctx, 'absenceTypes', 'hcm_search_absence_types'),
  );
  server.registerTool(
    'hcm_search_absence_plans',
    { description: 'Search absence plans LOV.', inputSchema: listArgs, annotations: { readOnlyHint: true } },
    listHandler(ctx, 'absencePlans', 'hcm_search_absence_plans'),
  );
  server.registerTool(
    'hcm_get_absence_type_balance',
    {
      description: 'getAbsenceTypeBalance-style helper via planBalances finder.',
      inputSchema: {
        personNumber: z.string(),
        absenceType: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(
        () =>
          ctx.client.list('planBalances', {
            finder: 'getAbsenceTypeBalance',
            q: args.absenceType
              ? `personNumber=${args.personNumber};absenceType=${args.absenceType}`
              : `personNumber=${args.personNumber}`,
            limit: 25,
          }),
        ctx,
        'hcm_get_absence_type_balance',
      ),
  );

  bindExecutor(ctx, 'hcm_submit_time_card', async (args) =>
    ctx.client.postJson('timeCards/action/submit', args.body ?? args),
  );
  server.registerTool(
    'hcm_submit_time_card',
    {
      description: 'Submit a time card (approval unless --write).',
      inputSchema: { body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_submit_time_card', args),
  );

  server.registerTool(
    'hcm_search_schedules',
    { description: 'Search work schedules.', inputSchema: listArgs, annotations: { readOnlyHint: true } },
    listHandler(ctx, 'workSchedules', 'hcm_search_schedules'),
  );
  server.registerTool(
    'hcm_get_schedule',
    {
      description: 'Get work schedule by id.',
      inputSchema: { scheduleId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ scheduleId }) =>
      runRead(
        () => ctx.client.getJson(`workSchedules/${encodeURIComponent(scheduleId)}`),
        ctx,
        'hcm_get_schedule',
      ),
  );
}

function registerTalentLearning(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_search_goals',
    { description: 'Search talent goals.', inputSchema: listArgs, annotations: { readOnlyHint: true } },
    listHandler(ctx, 'goals', 'hcm_search_goals'),
  );
  server.registerTool(
    'hcm_get_goal',
    {
      description: 'Get goal by id.',
      inputSchema: { goalId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ goalId }) =>
      runRead(() => ctx.client.getJson(`goals/${encodeURIComponent(goalId)}`), ctx, 'hcm_get_goal'),
  );
  server.registerTool(
    'hcm_search_performance_documents',
    {
      description: 'Search performance documents.',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'performanceDocuments', 'hcm_search_performance_documents'),
  );
  server.registerTool(
    'hcm_get_performance_document',
    {
      description: 'Get performance document by id.',
      inputSchema: { documentId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ documentId }) =>
      runRead(
        () =>
          ctx.client.getJson(`performanceDocuments/${encodeURIComponent(documentId)}`),
        ctx,
        'hcm_get_performance_document',
      ),
  );
  server.registerTool(
    'hcm_search_learning_enrollments',
    {
      description: 'Search learning enrollments.',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'learningEnrollments', 'hcm_search_learning_enrollments'),
  );
  server.registerTool(
    'hcm_get_learning_enrollment',
    {
      description: 'Get learning enrollment by id.',
      inputSchema: { enrollmentId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ enrollmentId }) =>
      runRead(
        () =>
          ctx.client.getJson(`learningEnrollments/${encodeURIComponent(enrollmentId)}`),
        ctx,
        'hcm_get_learning_enrollment',
      ),
  );
}

function registerSensitivePayroll(server: McpServer, ctx: ToolContext): void {
  const sensList = (tool: string, path: string, desc: string) => {
    bindExecutor(ctx, tool, async (args) =>
      ctx.client.list(path, {
        q: args.q as string | undefined,
        finder: args.finder as string | undefined,
        limit: (args.limit as number) ?? 25,
        offset: (args.offset as number) ?? 0,
      }),
    );
    server.registerTool(
      tool,
      {
        description: `${desc} SENSITIVE: requires ORACLE_HCM_SENSITIVE=1 + approval (unless SENSITIVE_WRITE).`,
        inputSchema: listArgs,
        annotations: { readOnlyHint: true },
      },
      async (args) => gateWrite(ctx, tool, args),
    );
  };
  const sensGet = (tool: string, path: string, idParam: string, desc: string) => {
    bindExecutor(ctx, tool, async (args) =>
      ctx.client.getJson(`${path}/${encodeURIComponent(String(args[idParam]))}`),
    );
    server.registerTool(
      tool,
      {
        description: `${desc} SENSITIVE gate.`,
        inputSchema: { [idParam]: z.string() },
        annotations: { readOnlyHint: true },
      },
      async (args) => gateWrite(ctx, tool, args as Record<string, unknown>),
    );
  };

  sensList('hcm_search_payslips', 'payslips', 'Search payslips.');
  sensGet('hcm_get_payslip', 'payslips', 'payslipId', 'Get payslip by id.');
  sensList('hcm_search_national_identifiers', 'nationalIdentifiers', 'Search national identifiers.');
  sensGet(
    'hcm_get_national_identifier',
    'nationalIdentifiers',
    'nationalIdentifierId',
    'Get national identifier.',
  );
  sensList('hcm_search_bank_accounts', 'bankAccounts', 'Search bank accounts.');
  sensGet('hcm_get_bank_account', 'bankAccounts', 'bankAccountId', 'Get bank account.');
  sensList('hcm_search_payment_methods', 'personalPaymentMethods', 'Search payment methods.');
  sensList('hcm_search_compensation', 'compensationHistories', 'Search compensation history.');
  sensGet('hcm_get_compensation', 'compensationHistories', 'compensationId', 'Get compensation row.');

  server.registerTool(
    'hcm_search_element_entries',
    {
      description: 'Search payroll element entries (read-only specialist; not sensitive-gated).',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'elementEntries', 'hcm_search_element_entries'),
  );
  server.registerTool(
    'hcm_search_calculation_cards',
    {
      description: 'Search calculation cards (read-only specialist).',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'calculationCards', 'hcm_search_calculation_cards'),
  );
}

function registerApprovalsExtra(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_bulk_bp_dry_run',
    {
      description:
        'Dry-run bulk approve/deny for notification ids — returns planned actions without executing.',
      inputSchema: {
        notificationIds: z.array(z.string()),
        action: z.enum(['APPROVE', 'REJECT', 'DENY']),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        recordAudit(ctx, 'hcm_bulk_bp_dry_run', 'dry_run', `${args.action} x${args.notificationIds.length}`);
        return {
          dry_run: true,
          action: args.action,
          planned: args.notificationIds.map((id) => ({
            notificationId: id,
            wouldCall: 'hcm_perform_bp_action',
            action: args.action === 'DENY' ? 'REJECT' : args.action,
          })),
          note: 'No mutations performed. Use hcm_perform_bp_action / bulk tools to execute.',
        };
      }, ctx, 'hcm_bulk_bp_dry_run'),
  );

  bindExecutor(ctx, 'hcm_bulk_approve_notifications', async (args) => {
    const ids = args.notificationIds as string[];
    const results = [];
    for (const id of ids) {
      results.push(
        await ctx.client.postJson('businessProcessNotifications/action/performAction', {
          notificationId: id,
          taskId: id,
          action: 'APPROVE',
          actionName: 'APPROVE',
        }),
      );
    }
    return { approved: ids.length, results };
  });
  server.registerTool(
    'hcm_bulk_approve_notifications',
    {
      description: 'Bulk approve BP notifications (approval unless --write). Prefer dry-run first.',
      inputSchema: { notificationIds: z.array(z.string()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_bulk_approve_notifications', args),
  );

  bindExecutor(ctx, 'hcm_bulk_deny_notifications', async (args) => {
    const ids = args.notificationIds as string[];
    const results = [];
    for (const id of ids) {
      results.push(
        await ctx.client.postJson('businessProcessNotifications/action/performAction', {
          notificationId: id,
          taskId: id,
          action: 'REJECT',
          actionName: 'REJECT',
        }),
      );
    }
    return { denied: ids.length, results };
  });
  server.registerTool(
    'hcm_bulk_deny_notifications',
    {
      description: 'Bulk reject/deny BP notifications (approval unless --write).',
      inputSchema: { notificationIds: z.array(z.string()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_bulk_deny_notifications', args),
  );

  server.registerTool(
    'hcm_list_audit_trail',
    {
      description: 'List in-process MCP audit trail (tool invocations; not Fusion transaction history).',
      inputSchema: { limit: z.number().int().positive().optional() },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        const lim = args.limit ?? 50;
        return { entries: ctx.auditTrail.slice(-lim), note: 'Local MCP audit — not Oracle audit.' };
      }, ctx, 'hcm_list_audit_trail'),
  );
}

function registerAgentUx(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_explain_tool',
    {
      description: 'Explain a curated MCP tool: class (read/write/sensitive), related resource, usage hints.',
      inputSchema: { name: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ name }) =>
      runRead(async () => {
        const cls = classifyTool(name);
        const sensitive = SENSITIVE_TOOLS.has(name);
        const resHint = RESOURCE_CATALOG.find((r) =>
          name.toLowerCase().includes(r.name.replace(/s$/, '').toLowerCase()),
        );
        return {
          name,
          class: cls,
          sensitive,
          resourceHint: resHint ?? null,
          approval:
            cls === 'write' || sensitive
              ? 'May require hcm_approve_write unless --write / SENSITIVE_WRITE'
              : 'none',
          note: 'Unofficial tool catalog.',
        };
      }, ctx, 'hcm_explain_tool'),
  );

  server.registerTool(
    'hcm_dry_run_mutate',
    {
      description:
        'Dry-run an allowlisted mutate: validates path/method/body shape; does not call Fusion.',
      inputSchema: {
        method: z.enum(['POST', 'PATCH', 'PUT', 'DELETE']),
        path: z.string(),
        body: z.unknown().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        if (isBlockedPath(args.path)) {
          return { ok: false, blocked: true, path: args.path };
        }
        try {
          assertAllowlisted(args.path);
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
        recordAudit(ctx, 'hcm_dry_run_mutate', 'dry_run', `${args.method} ${args.path}`);
        return {
          ok: true,
          dry_run: true,
          method: args.method,
          path: args.path,
          bodyPreview: redactDeep(args.body),
          wouldRequireApproval: !ctx.writeMode,
        };
      }, ctx, 'hcm_dry_run_mutate'),
  );

  server.registerTool(
    'hcm_probe_capabilities',
    {
      description: 'Tenant capability probe — lists curated resources and whether dummy/seed responds.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () =>
      runRead(async () => {
        const results = [];
        for (const r of RESOURCE_CATALOG.slice(0, 12)) {
          try {
            const list = await ctx.client.list(r.path, { limit: 1 });
            results.push({
              resource: r.name,
              ok: true,
              sampleCount: list.items?.length ?? 0,
            });
          } catch (e) {
            results.push({
              resource: r.name,
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
        return {
          probed: results,
          allowlisted_roots: ALLOWED_ROOTS.length,
          note: 'Partial probe of curated catalog against configured base URL.',
        };
      }, ctx, 'hcm_probe_capabilities'),
  );

  server.registerTool(
    'hcm_rbac_hint',
    {
      description:
        'RBAC hint: reminds that HTTP auth ≠ HCM privileges; returns whoami + sensitive/write flags.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () =>
      runRead(async () => {
        const who = await ctx.client.whoami();
        return {
          ...who,
          sensitiveEnabled: ctx.config.sensitiveEnabled,
          writeMode: ctx.writeMode,
          hint: 'Credentials open the door; Fusion duty roles still decide access. Prefer least privilege.',
        };
      }, ctx, 'hcm_rbac_hint'),
  );
}

function registerPlatformTools(server: McpServer, ctx: ToolContext): void {
  bindExecutor(ctx, 'hcm_start_webhook_receiver', async (args) => {
    const port = Number(args.port ?? ctx.config.webhookPort ?? 8795);
    if (!ctx.webhook) ctx.webhook = new WebhookReceiver();
    const url = await ctx.webhook.start(port);
    return { url, eventsPath: `${url}/events`, note: 'Minimal Atom/BP webhook stub.' };
  });
  server.registerTool(
    'hcm_start_webhook_receiver',
    {
      description: 'Start localhost webhook receiver stub for Atom/BP callbacks (approval unless --write).',
      inputSchema: { port: z.number().int().positive().optional() },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_start_webhook_receiver', args),
  );

  server.registerTool(
    'hcm_list_webhook_events',
    {
      description: 'List events received by the local webhook stub.',
      inputSchema: { limit: z.number().int().positive().optional() },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        if (!ctx.webhook) return { events: [], note: 'Webhook not started.' };
        return { events: ctx.webhook.list(args.limit ?? 50) };
      }, ctx, 'hcm_list_webhook_events'),
  );
}
