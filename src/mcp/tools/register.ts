import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './helpers.js';
import { gateWrite, runRead, jsonResult, errorResult } from './helpers.js';
import { ALLOWED_ROOTS } from '../../policy/allowlist.js';

const RESOURCE_CATALOG = [
  { name: 'workers', path: 'workers', description: 'HCM workers (person + work relationships)' },
  { name: 'absences', path: 'absences', description: 'Absence entries' },
  { name: 'absencesBalances', path: 'absencesBalances', description: 'Absence balances' },
  {
    name: 'areasOfResponsibility',
    path: 'areasOfResponsibility',
    description: 'Areas of responsibility (AOR)',
  },
  {
    name: 'allocatedChecklists',
    path: 'allocatedChecklists',
    description: 'Allocated checklists and tasks',
  },
  {
    name: 'workflowNotifications',
    path: 'workflowNotifications',
    description: 'Business process / workflow notifications inbox',
  },
];

export function registerAllTools(server: McpServer, ctx: ToolContext): void {
  registerMeta(server, ctx);
  registerWorkers(server, ctx);
  registerAbsences(server, ctx);
  registerAor(server, ctx);
  registerChecklists(server, ctx);
  registerNotifications(server, ctx);
  registerGeneric(server, ctx);
  if (!ctx.writeMode) {
    registerApproval(server, ctx);
  }
}

function registerMeta(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_health',
    {
      description: 'Check connectivity to the configured HCM REST base (unofficial MCP).',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => runRead(() => ctx.client.health()),
  );

  server.registerTool(
    'hcm_whoami',
    {
      description: 'Return local auth/config identity hints (no secrets). HCM RBAC still applies.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => runRead(() => ctx.client.whoami()),
  );

  server.registerTool(
    'hcm_list_resources',
    {
      description: 'List curated HCM resource roots supported by this unofficial MCP.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () =>
      runRead(async () => ({
        resources: RESOURCE_CATALOG,
        allowlisted_roots: ALLOWED_ROOTS,
        note: 'Not an official Oracle catalog; curated for v1.',
      })),
  );

  server.registerTool(
    'hcm_describe_resource',
    {
      description: 'Describe a curated resource by name (workers, absences, …).',
      inputSchema: {
        name: z.string().describe('Resource name, e.g. workers'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ name }) =>
      runRead(async () => {
        const found = RESOURCE_CATALOG.find((r) => r.name === name || r.path === name);
        if (!found) throw new Error(`Unknown curated resource: ${name}`);
        return found;
      }),
  );
}

function registerWorkers(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_search_workers',
    {
      description: 'Search workers (q / finder / limit / offset).',
      inputSchema: {
        q: z.string().optional().describe('ADF q filter, e.g. PersonNumber=123'),
        finder: z.string().optional(),
        limit: z.number().int().positive().optional(),
        offset: z.number().int().nonnegative().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(() =>
        ctx.client.list('workers', {
          q: args.q,
          finder: args.finder,
          limit: args.limit ?? 25,
          offset: args.offset ?? 0,
        }),
      ),
  );

  server.registerTool(
    'hcm_get_worker',
    {
      description: 'Get a worker by WorkerId (or PersonId as used by your env).',
      inputSchema: {
        workerId: z.string().describe('Worker primary key'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ workerId }) => runRead(() => ctx.client.getJson(`workers/${encodeURIComponent(workerId)}`)),
  );

  server.registerTool(
    'hcm_create_worker',
    {
      description: 'Create a worker (requires approval unless --write).',
      inputSchema: {
        body: z.record(z.unknown()).describe('Worker JSON payload'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ body }) =>
      gateWrite(ctx, 'hcm_create_worker', { body }, () => ctx.client.postJson('workers', body)),
  );

  server.registerTool(
    'hcm_update_worker',
    {
      description: 'PATCH a worker (requires approval unless --write).',
      inputSchema: {
        workerId: z.string(),
        body: z.record(z.unknown()),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ workerId, body }) =>
      gateWrite(ctx, 'hcm_update_worker', { workerId, body }, () =>
        ctx.client.patchJson(`workers/${encodeURIComponent(workerId)}`, body),
      ),
  );
}

function registerAbsences(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_search_absences',
    {
      description: 'Search absences.',
      inputSchema: {
        q: z.string().optional(),
        limit: z.number().int().positive().optional(),
        offset: z.number().int().nonnegative().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(() =>
        ctx.client.list('absences', {
          q: args.q,
          limit: args.limit ?? 25,
          offset: args.offset ?? 0,
        }),
      ),
  );

  server.registerTool(
    'hcm_get_absence',
    {
      description: 'Get absence by id.',
      inputSchema: { absenceId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ absenceId }) =>
      runRead(() => ctx.client.getJson(`absences/${encodeURIComponent(absenceId)}`)),
  );

  server.registerTool(
    'hcm_create_absence',
    {
      description: 'Create an absence entry (approval unless --write).',
      inputSchema: { body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async ({ body }) =>
      gateWrite(ctx, 'hcm_create_absence', { body }, () => ctx.client.postJson('absences', body)),
  );

  server.registerTool(
    'hcm_update_absence',
    {
      description: 'Update an absence (approval unless --write).',
      inputSchema: {
        absenceId: z.string(),
        body: z.record(z.unknown()),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ absenceId, body }) =>
      gateWrite(ctx, 'hcm_update_absence', { absenceId, body }, () =>
        ctx.client.patchJson(`absences/${encodeURIComponent(absenceId)}`, body),
      ),
  );

  server.registerTool(
    'hcm_delete_absence',
    {
      description: 'Delete an absence (approval unless --write).',
      inputSchema: { absenceId: z.string() },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ absenceId }) =>
      gateWrite(ctx, 'hcm_delete_absence', { absenceId }, () =>
        ctx.client.delete(`absences/${encodeURIComponent(absenceId)}`),
      ),
  );

  server.registerTool(
    'hcm_absence_balance',
    {
      description: 'Read absence balances (optionally filter by personNumber).',
      inputSchema: {
        personNumber: z.string().optional(),
        q: z.string().optional(),
        limit: z.number().int().positive().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(() => {
        const q =
          args.q ??
          (args.personNumber ? `personNumber=${args.personNumber}` : undefined);
        return ctx.client.list('absencesBalances', { q, limit: args.limit ?? 25 });
      }),
  );
}

function registerAor(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_search_aor',
    {
      description: 'Search areas of responsibility.',
      inputSchema: {
        q: z.string().optional(),
        limit: z.number().int().positive().optional(),
        offset: z.number().int().nonnegative().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(() =>
        ctx.client.list('areasOfResponsibility', {
          q: args.q,
          limit: args.limit ?? 25,
          offset: args.offset ?? 0,
        }),
      ),
  );

  server.registerTool(
    'hcm_get_aor',
    {
      description: 'Get AOR by id.',
      inputSchema: { aorId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ aorId }) =>
      runRead(() =>
        ctx.client.getJson(`areasOfResponsibility/${encodeURIComponent(aorId)}`),
      ),
  );

  server.registerTool(
    'hcm_create_aor',
    {
      description: 'Create AOR (approval unless --write).',
      inputSchema: { body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async ({ body }) =>
      gateWrite(ctx, 'hcm_create_aor', { body }, () =>
        ctx.client.postJson('areasOfResponsibility', body),
      ),
  );

  server.registerTool(
    'hcm_update_aor',
    {
      description: 'Update AOR (approval unless --write).',
      inputSchema: { aorId: z.string(), body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async ({ aorId, body }) =>
      gateWrite(ctx, 'hcm_update_aor', { aorId, body }, () =>
        ctx.client.patchJson(`areasOfResponsibility/${encodeURIComponent(aorId)}`, body),
      ),
  );

  server.registerTool(
    'hcm_delete_aor',
    {
      description: 'Delete AOR (approval unless --write).',
      inputSchema: { aorId: z.string() },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ aorId }) =>
      gateWrite(ctx, 'hcm_delete_aor', { aorId }, () =>
        ctx.client.delete(`areasOfResponsibility/${encodeURIComponent(aorId)}`),
      ),
  );
}

function registerChecklists(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_list_checklists',
    {
      description: 'List allocated checklists.',
      inputSchema: {
        q: z.string().optional(),
        limit: z.number().int().positive().optional(),
        offset: z.number().int().nonnegative().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(() =>
        ctx.client.list('allocatedChecklists', {
          q: args.q,
          limit: args.limit ?? 25,
          offset: args.offset ?? 0,
        }),
      ),
  );

  server.registerTool(
    'hcm_get_checklist',
    {
      description: 'Get allocated checklist by id.',
      inputSchema: { checklistId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ checklistId }) =>
      runRead(() =>
        ctx.client.getJson(`allocatedChecklists/${encodeURIComponent(checklistId)}`),
      ),
  );

  server.registerTool(
    'hcm_update_task_status',
    {
      description: 'Update a checklist task status (approval unless --write).',
      inputSchema: {
        checklistId: z.string(),
        taskId: z.string(),
        status: z.string().describe('e.g. COMPLETED, IN_PROGRESS'),
        body: z.record(z.unknown()).optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ checklistId, taskId, status, body }) =>
      gateWrite(
        ctx,
        'hcm_update_task_status',
        { checklistId, taskId, status, body },
        () =>
          ctx.client.patchJson(
            `allocatedChecklists/${encodeURIComponent(checklistId)}/child/tasks/${encodeURIComponent(taskId)}`,
            { ...(body ?? {}), status },
          ),
      ),
  );
}

function registerNotifications(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_list_notifications',
    {
      description: 'List business process / workflow notifications.',
      inputSchema: {
        q: z.string().optional(),
        limit: z.number().int().positive().optional(),
        offset: z.number().int().nonnegative().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(() =>
        ctx.client.list('workflowNotifications', {
          q: args.q,
          limit: args.limit ?? 25,
          offset: args.offset ?? 0,
        }),
      ),
  );

  server.registerTool(
    'hcm_get_notification',
    {
      description: 'Get a workflow notification by id.',
      inputSchema: { notificationId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ notificationId }) =>
      runRead(() =>
        ctx.client.getJson(`workflowNotifications/${encodeURIComponent(notificationId)}`),
      ),
  );

  server.registerTool(
    'hcm_perform_bp_action',
    {
      description:
        'Perform a business process action on a notification (Approve/Reject/…). Requires approval unless --write.',
      inputSchema: {
        notificationId: z.string(),
        action: z.string().describe('e.g. APPROVE, REJECT'),
        comment: z.string().optional(),
        body: z.record(z.unknown()).optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ notificationId, action, comment, body }) =>
      gateWrite(
        ctx,
        'hcm_perform_bp_action',
        { notificationId, action, comment, body },
        () =>
          ctx.client.postJson(
            `workflowNotifications/${encodeURIComponent(notificationId)}/action/${encodeURIComponent(action)}`,
            { ...(body ?? {}), comment },
          ),
      ),
  );
}

function registerGeneric(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_rest_get',
    {
      description:
        'Allowlisted generic GET under HCM resources. Blocked for CE/generative-AI/internal paths.',
      inputSchema: {
        path: z.string().describe('Relative path, e.g. workers?limit=5 or workers/123'),
        query: z.record(z.union([z.string(), z.number()])).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ path, query }) => runRead(() => ctx.client.restGet(path, query)),
  );

  server.registerTool(
    'hcm_rest_mutate',
    {
      description:
        'Allowlisted generic mutate (POST/PATCH/PUT/DELETE). Requires approval unless --write. Blocked paths rejected.',
      inputSchema: {
        method: z.enum(['POST', 'PATCH', 'PUT', 'DELETE']),
        path: z.string(),
        body: z.unknown().optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ method, path, body }) =>
      gateWrite(ctx, 'hcm_rest_mutate', { method, path, body }, () =>
        ctx.client.restMutate(method, path, body),
      ),
  );
}

function registerApproval(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_list_pending_approvals',
    {
      description: 'List pending write intents awaiting human approval.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () =>
      runRead(async () => ({
        pending: ctx.approvals.listPending().map((i) => ({
          approval_id: i.approvalId,
          tool: i.toolName,
          summary: i.summary,
          created_at: new Date(i.createdAt).toISOString(),
          expires_at: new Date(i.expiresAt).toISOString(),
        })),
      })),
  );

  server.registerTool(
    'hcm_approve_write',
    {
      description: 'Approve and execute a pending write by approval_id.',
      inputSchema: {
        approval_id: z.string(),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ approval_id }) => {
      try {
        const { intent, result } = await ctx.approvals.approve(approval_id, async (toolName, args) =>
          executePending(ctx, toolName, args),
        );
        return jsonResult({
          approved: true,
          approval_id: intent.approvalId,
          tool: intent.toolName,
          result,
        });
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'hcm_deny_write',
    {
      description: 'Deny a pending write by approval_id.',
      inputSchema: {
        approval_id: z.string(),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ approval_id }) => {
      try {
        const intent = ctx.approvals.deny(approval_id);
        return jsonResult({
          denied: true,
          approval_id: intent.approvalId,
          tool: intent.toolName,
        });
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}

async function executePending(
  ctx: ToolContext,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const c = ctx.client;
  switch (toolName) {
    case 'hcm_create_worker':
      return c.postJson('workers', args.body);
    case 'hcm_update_worker':
      return c.patchJson(`workers/${encodeURIComponent(String(args.workerId))}`, args.body);
    case 'hcm_create_absence':
      return c.postJson('absences', args.body);
    case 'hcm_update_absence':
      return c.patchJson(`absences/${encodeURIComponent(String(args.absenceId))}`, args.body);
    case 'hcm_delete_absence':
      return c.delete(`absences/${encodeURIComponent(String(args.absenceId))}`);
    case 'hcm_create_aor':
      return c.postJson('areasOfResponsibility', args.body);
    case 'hcm_update_aor':
      return c.patchJson(
        `areasOfResponsibility/${encodeURIComponent(String(args.aorId))}`,
        args.body,
      );
    case 'hcm_delete_aor':
      return c.delete(`areasOfResponsibility/${encodeURIComponent(String(args.aorId))}`);
    case 'hcm_update_task_status':
      return c.patchJson(
        `allocatedChecklists/${encodeURIComponent(String(args.checklistId))}/child/tasks/${encodeURIComponent(String(args.taskId))}`,
        { ...((args.body as object) ?? {}), status: args.status },
      );
    case 'hcm_perform_bp_action':
      return c.postJson(
        `workflowNotifications/${encodeURIComponent(String(args.notificationId))}/action/${encodeURIComponent(String(args.action))}`,
        { ...((args.body as object) ?? {}), comment: args.comment },
      );
    case 'hcm_rest_mutate':
      return c.restMutate(
        args.method as 'POST' | 'PATCH' | 'PUT' | 'DELETE',
        String(args.path),
        args.body,
      );
    default:
      throw new Error(`No executor for pending tool: ${toolName}`);
  }
}
