/**
 * v0.5 curated tools — smoke, profiles, person deep-read, recruiting depth,
 * time validate/submit, benefits write, recipes, Atom real-pod hooks,
 * redaction audit, batch GET, learning/goals writes, compensation light update.
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
import {
  loadProfileStore,
  saveProfileStore,
  setActiveProfile,
  getActiveProfile,
  applyProfileToConfig,
  emitMcpFragmentForProfile,
  DEFAULT_PROFILES,
  type EnvProfile,
} from '../../platform/profiles.js';
import {
  runSmokeProbe,
  saveSmokeReport,
  listSmokeReports,
  SMOKE_PROBE_PATHS,
} from '../../platform/smokeProbe.js';
import {
  listRedactionEvents,
  redactionStats,
  clearRedactionEvents,
} from '../../platform/redactionAudit.js';
import { entriesToAtomXml, feedIdForCollection } from '../../platform/atomCdc.js';
import { adfEquals } from '../../policy/adf.js';

const listArgs = {
  q: z.string().optional().describe('ADF q= filter, e.g. PersonNumber=P1001'),
  finder: z.string().optional().describe('ADF finder expression'),
  limit: z.number().int().positive().optional().describe('Page size (default 25)'),
  offset: z.number().int().nonnegative().optional().describe('Offset (default 0)'),
};

function listHandler(ctx: ToolContext, path: string, tool: string) {
  return async (args: { q?: string; finder?: string; limit?: number; offset?: number }) =>
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

export function registerV05Tools(server: McpServer, ctx: ToolContext): void {
  registerSmokeAndProfiles(server, ctx);
  registerOAuthAndConfig(server, ctx);
  registerPersonDeepRead(server, ctx);
  registerRecruitingDepth(server, ctx);
  registerTimeE2E(server, ctx);
  registerBenefitsWrite(server, ctx);
  registerRecipes(server, ctx);
  registerRedactionAudit(server, ctx);
  registerAtomRealPod(server, ctx);
  registerBatchAndWebhookExtras(server, ctx);
  registerLearningGoalsWrites(server, ctx);
  registerCompensationExtras(server, ctx);
  registerAbsenceLovExtras(server, ctx);
  registerBulkBpPreview(server, ctx);
}

function registerSmokeAndProfiles(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_smoke_probe',
    {
      description:
        'Run live Fusion smoke probe matrix (200/403/404 per curated resource). Saves report per env/profile. Example: { "profile": "sandbox" }',
      inputSchema: {
        profile: z.string().optional().describe('Label for saved report (defaults to active profile)'),
        save: z.boolean().optional().describe('Persist JSON under smoke dir (default true)'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        const report = await runSmokeProbe(ctx.client, {
          profile: args.profile ?? ctx.config.profile ?? 'default',
        });
        let savedPath: string | null = null;
        if (args.save !== false) {
          savedPath = saveSmokeReport(report);
        }
        return { ...report, savedPath, probeCount: SMOKE_PROBE_PATHS.length };
      }, ctx, 'hcm_smoke_probe'),
  );

  server.registerTool(
    'hcm_list_smoke_reports',
    {
      description: 'List saved smoke probe JSON reports for an optional profile.',
      inputSchema: { profile: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(
        async () => ({ reports: listSmokeReports(undefined, args.profile) }),
        ctx,
        'hcm_list_smoke_reports',
      ),
  );

  server.registerTool(
    'hcm_list_profiles',
    {
      description:
        'List multi-env profiles (dummy / sandbox / prod). Secrets referenced by env var names only.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () =>
      runRead(async () => {
        const store = loadProfileStore(ctx.config.profilesPath);
        return {
          path: store.path,
          active: store.active,
          profiles: store.profiles.map((p) => ({
            name: p.name,
            kind: p.kind,
            baseUrl: p.baseUrl,
            authMode: p.authMode,
            note: p.note,
          })),
          defaultsAvailable: DEFAULT_PROFILES.map((p) => p.name),
        };
      }, ctx, 'hcm_list_profiles'),
  );

  bindExecutor(ctx, 'hcm_switch_profile', async (args) => {
    const persist = args.persist !== false;
    const store = persist
      ? setActiveProfile(String(args.name), ctx.config.profilesPath)
      : (() => {
          const s = loadProfileStore(ctx.config.profilesPath);
          s.active = String(args.name);
          return s;
        })();
    const profile = getActiveProfile(store);
    if (!profile) throw new Error(`Profile not found: ${args.name}`);
    const next = applyProfileToConfig(ctx.config, profile);
    Object.assign(ctx.config, next);
    ctx.writeMode = next.writeMode;
    ctx.client.applyConfig(next);
    return {
      active: store.active,
      applied: {
        baseUrl: next.baseUrl,
        authMode: next.authMode,
        writeMode: next.writeMode,
        profile: next.profile,
      },
      note: 'Profile applied in-process. writeMode is never enabled by a profile. Cursor mcp.json still needs matching env for new sessions.',
    };
  });
  server.registerTool(
    'hcm_switch_profile',
    {
      description:
        'Switch active multi-env profile and hot-apply base URL / auth hints (secrets from env). Approval-gated. Profiles cannot enable --write. Example: { "name": "dummy" }',
      inputSchema: {
        name: z.string().describe('Profile name: dummy | sandbox | prod | custom'),
        persist: z.boolean().optional().describe('Write profiles.json (default true)'),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_switch_profile', args as Record<string, unknown>),
  );

  server.registerTool(
    'hcm_emit_profile_mcp_config',
    {
      description:
        'Emit Cursor mcp.json fragment for a named profile (one-click reinstall / full tool set). Secrets as placeholders.',
      inputSchema: {
        name: z.string().optional(),
        includeWriteServer: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        const store = loadProfileStore(ctx.config.profilesPath);
        const name = args.name ?? store.active ?? 'dummy';
        const profile = store.profiles.find((p) => p.name === name);
        if (!profile) throw new Error(`Unknown profile: ${name}`);
        return {
          ...emitMcpFragmentForProfile(profile, {
            includeWriteServer: args.includeWriteServer,
            command: 'node',
            args: ['dist/index.js'],
          }),
          reinstall:
            '1) npm run build  2) Paste mcpServers into Cursor MCP settings  3) Reload window  4) Tools list should show full curated set',
        };
      }, ctx, 'hcm_emit_profile_mcp_config'),
  );

  bindExecutor(ctx, 'hcm_upsert_profile', async (args) => {
    const store = loadProfileStore(ctx.config.profilesPath);
    const existing = store.profiles.findIndex((p) => p.name === String(args.name));
    const row = {
      name: String(args.name),
      kind: String(args.kind ?? args.name),
      baseUrl: String(args.baseUrl),
      apiVersion: args.apiVersion as string | undefined,
      authMode: args.authMode as EnvProfile['authMode'],
      username: args.username as string | undefined,
      passwordEnv: args.passwordEnv as string | undefined,
      bearerTokenEnv: args.bearerTokenEnv as string | undefined,
      tokenUrl: args.tokenUrl as string | undefined,
      clientId: args.clientId as string | undefined,
      clientSecretEnv: args.clientSecretEnv as string | undefined,
      // stored but ignored by applyProfileToConfig — profiles cannot enable writes
      writeMode: false,
      note: args.note as string | undefined,
    };
    if (existing >= 0) store.profiles[existing] = { ...store.profiles[existing], ...row };
    else store.profiles.push(row);
    saveProfileStore(store);
    return { ok: true, profile: row.name, count: store.profiles.length, writeModeIgnored: true };
  });
  server.registerTool(
    'hcm_upsert_profile',
    {
      description:
        'Create or update a multi-env profile (no secrets inline — use *Env field names). Approval-gated. writeMode on the profile is ignored.',
      inputSchema: {
        name: z.string(),
        kind: z.string().optional(),
        baseUrl: z.string(),
        apiVersion: z.string().optional(),
        authMode: z.enum(['basic', 'bearer', 'oauth', 'none']).optional(),
        username: z.string().optional(),
        passwordEnv: z.string().optional(),
        bearerTokenEnv: z.string().optional(),
        tokenUrl: z.string().optional(),
        clientId: z.string().optional(),
        clientSecretEnv: z.string().optional(),
        writeMode: z.boolean().optional(),
        note: z.string().optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_upsert_profile', args as Record<string, unknown>),
  );
}

function registerOAuthAndConfig(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_oauth_token_status',
    {
      description: 'OAuth token cache status: expiry, seconds remaining, refresh availability (no token value).',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () =>
      runRead(async () => ctx.client.oauthTokenInfo(), ctx, 'hcm_oauth_token_status'),
  );

  bindExecutor(ctx, 'hcm_oauth_refresh', async () => ctx.client.refreshOAuthToken());
  server.registerTool(
    'hcm_oauth_refresh',
    {
      description: 'Force OAuth client-credentials token refresh. Returns new expiry (not the token). Approval-gated.',
      inputSchema: {},
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_oauth_refresh', args as Record<string, unknown>),
  );

  server.registerTool(
    'hcm_test_as_user',
    {
      description:
        'Probe connectivity “as user X” by temporarily using basic-auth username (password from current config / env). Does not persist. Example: { "username": "hcm_user" }',
      inputSchema: {
        username: z.string(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        const prev = { ...ctx.config };
        try {
          ctx.client.applyConfig({
            ...ctx.config,
            authMode: 'basic',
            username: args.username,
            password: ctx.config.password ?? process.env.ORACLE_HCM_PASSWORD,
          });
          const h = await ctx.client.health();
          return {
            testedAs: args.username,
            ok: h.ok,
            baseUrl: h.baseUrl,
            note: 'Temporary probe — config restored. Password never returned.',
          };
        } finally {
          ctx.client.applyConfig(prev);
        }
      }, ctx, 'hcm_test_as_user'),
  );
}

function registerPersonDeepRead(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_get_legislative_data',
    {
      description:
        'Person deep-read: legislative data for a person/worker. Example: { "personNumber": "P1001" }',
      inputSchema: {
        personNumber: z.string().optional(),
        workerId: z.string().optional(),
        legislativeDataId: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        if (args.legislativeDataId) {
          return ctx.client.getJson(
            `workerLegislativeData/${encodeURIComponent(args.legislativeDataId)}`,
          );
        }
        const q = args.personNumber
          ? `PersonNumber=${args.personNumber}`
          : args.workerId
            ? `WorkerId=${args.workerId}`
            : undefined;
        return ctx.client.list('workerLegislativeData', { q, limit: 25 });
      }, ctx, 'hcm_get_legislative_data'),
  );

  server.registerTool(
    'hcm_list_work_relationships',
    {
      description: 'List work relationships for a worker (deep-read pack). Example: { "workerId": "1001" }',
      inputSchema: { workerId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ workerId }) =>
      runRead(async () => {
        const w = (await ctx.client.getJson(`workers/${encodeURIComponent(workerId)}`, {
          expand: 'workRelationships',
        })) as { workRelationships?: unknown[]; WorkerId?: string };
        return {
          workerId,
          workRelationships: w.workRelationships ?? [],
          count: (w.workRelationships ?? []).length,
        };
      }, ctx, 'hcm_list_work_relationships'),
  );

  server.registerTool(
    'hcm_get_assignment_history',
    {
      description:
        'Assignment history for a worker (current + historical rows from workerAssignments / nested). Example: { "workerId": "1001" }',
      inputSchema: {
        workerId: z.string(),
        includeInactive: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        const list = await ctx.client.list('workerAssignments', {
          q: adfEquals('WorkerId', String(args.workerId)),
          limit: 100,
        });
        let items = list.items as Record<string, unknown>[];
        if (!args.includeInactive) {
          items = items.filter(
            (a) =>
              !a.AssignmentStatusType ||
              String(a.AssignmentStatusType).toUpperCase() === 'ACTIVE' ||
              String(a.AssignmentStatusType) === 'A',
          );
        }
        // Also try history collection if present on pod
        let historyExtra: unknown = null;
        try {
          historyExtra = await ctx.client.list('assignmentHistories', {
            q: adfEquals('WorkerId', String(args.workerId)),
            limit: 50,
          });
        } catch {
          historyExtra = { note: 'assignmentHistories not available on this pod (404/403 OK)' };
        }
        return {
          workerId: args.workerId,
          assignments: items,
          count: items.length,
          historyCollection: historyExtra,
        };
      }, ctx, 'hcm_get_assignment_history'),
  );

  server.registerTool(
    'hcm_person_deep_read',
    {
      description:
        'Bundle person deep-read: worker + workRelationships + assignments + legislative data. Example: { "workerId": "1001" }',
      inputSchema: {
        workerId: z.string().optional(),
        personNumber: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        let workerId = args.workerId;
        if (!workerId && args.personNumber) {
          const found = await ctx.client.list('workers', {
            q: adfEquals('PersonNumber', args.personNumber),
            limit: 1,
          });
          const first = found.items[0] as { WorkerId?: string } | undefined;
          workerId = first?.WorkerId;
        }
        if (!workerId) throw new Error('workerId or personNumber required');
        const worker = await ctx.client.getJson(`workers/${encodeURIComponent(workerId)}`, {
          expand: 'workRelationships',
        });
        const assignments = await ctx.client.list('workerAssignments', {
          q: adfEquals('WorkerId', workerId),
          limit: 50,
        });
        let legislative = null;
        try {
          const pn = (worker as { PersonNumber?: string }).PersonNumber ?? args.personNumber;
          legislative = await ctx.client.list('workerLegislativeData', {
            q: pn ? `PersonNumber=${pn}` : `WorkerId=${workerId}`,
            limit: 10,
          });
        } catch (e) {
          legislative = { error: e instanceof Error ? e.message : String(e) };
        }
        return {
          workerId,
          worker,
          assignments: assignments.items,
          legislative,
          note: 'Unofficial person deep-read pack.',
        };
      }, ctx, 'hcm_person_deep_read'),
  );
}

function registerRecruitingDepth(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_search_offers',
    {
      description: 'Search recruiting job offers (curated). Example: { "limit": 10 }',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'recruitingJobOffers', 'hcm_search_offers'),
  );
  server.registerTool(
    'hcm_get_offer',
    {
      description: 'Get recruiting job offer by id. Example: { "offerId": "OFF1" }',
      inputSchema: { offerId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ offerId }) =>
      runRead(
        () => ctx.client.getJson(`recruitingJobOffers/${encodeURIComponent(offerId)}`),
        ctx,
        'hcm_get_offer',
      ),
  );
  server.registerTool(
    'hcm_search_interviews',
    {
      description: 'Search recruiting interviews (curated).',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'recruitingInterviews', 'hcm_search_interviews'),
  );
  server.registerTool(
    'hcm_get_interview',
    {
      description: 'Get recruiting interview by id.',
      inputSchema: { interviewId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ interviewId }) =>
      runRead(
        () => ctx.client.getJson(`recruitingInterviews/${encodeURIComponent(interviewId)}`),
        ctx,
        'hcm_get_interview',
      ),
  );
  server.registerTool(
    'hcm_list_candidate_attachments',
    {
      description:
        'List curated candidate attachments metadata (not binary download). Example: { "candidateId": "CAN1" }',
      inputSchema: { candidateId: z.string(), limit: z.number().int().positive().optional() },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(
        () =>
          ctx.client.list('recruitingCandidateAttachments', {
            q: adfEquals('CandidateId', String(args.candidateId)),
            limit: args.limit ?? 25,
          }),
        ctx,
        'hcm_list_candidate_attachments',
      ),
  );
}

function registerTimeE2E(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_validate_time_card',
    {
      description:
        'Validate a time card payload before submit (client + dummy/action/validate). Does not submit. Example: { "body": { "PersonNumber": "P1001", "PeriodStart": "2026-09-14", "PeriodEnd": "2026-09-20" } }',
      inputSchema: { body: z.record(z.unknown()) },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        const body = args.body ?? {};
        const issues: string[] = [];
        if (!body.PersonNumber && !body.personNumber) issues.push('PersonNumber required');
        if (!body.PeriodStart && !body.periodStart) issues.push('PeriodStart required');
        if (!body.PeriodEnd && !body.periodEnd) issues.push('PeriodEnd required');
        let serverValidation: unknown = null;
        try {
          serverValidation = await ctx.client.postJson('timeCards/action/validate', body);
        } catch (e) {
          serverValidation = {
            unreachable: true,
            error: e instanceof Error ? e.message : String(e),
            note: 'Local schema checks still apply; pod may lack validate action.',
          };
        }
        return {
          valid: issues.length === 0,
          issues,
          serverValidation,
          next: 'Call hcm_submit_time_card (approval-gated) when valid.',
        };
      }, ctx, 'hcm_validate_time_card'),
  );

  // Enhanced submit already exists; add time card get + E2E recipe helper below
  server.registerTool(
    'hcm_get_time_card',
    {
      description: 'Get time card by id.',
      inputSchema: { timeCardId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ timeCardId }) =>
      runRead(
        () => ctx.client.getJson(`timeCards/${encodeURIComponent(timeCardId)}`),
        ctx,
        'hcm_get_time_card',
      ),
  );
}

function registerBenefitsWrite(server: McpServer, ctx: ToolContext): void {
  bindExecutor(ctx, 'hcm_enroll_benefit', async (args) =>
    ctx.client.postJson('benefitEnrollments/action/enroll', args.body ?? args),
  );
  server.registerTool(
    'hcm_enroll_benefit',
    {
      description:
        'Enroll person in a benefit plan (approval-gated unless --write). Example: { "body": { "PersonNumber": "P1001", "PlanName": "Dental" } }',
      inputSchema: { body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_enroll_benefit', args),
  );

  bindExecutor(ctx, 'hcm_opt_out_benefit', async (args) => {
    const id = String(args.enrollmentId);
    return ctx.client.postJson(
      `benefitEnrollments/${encodeURIComponent(id)}/action/optOut`,
      args.body ?? {},
    );
  });
  server.registerTool(
    'hcm_opt_out_benefit',
    {
      description: 'Opt out of a benefit enrollment (approval-gated). Example: { "enrollmentId": "BE1" }',
      inputSchema: {
        enrollmentId: z.string(),
        body: z.record(z.unknown()).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async (args) => gateWrite(ctx, 'hcm_opt_out_benefit', args),
  );
}

function registerRecipes(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_recipe_new_hire_checklist',
    {
      description:
        'Canned flow: look up worker → list/allocate onboarding checklist steps (read + optional allocate pending approval). Example: { "personNumber": "P1001", "allocate": false }',
      inputSchema: {
        personNumber: z.string(),
        checklistName: z.string().optional(),
        allocate: z.boolean().optional().describe('If true, queue allocateChecklist via approval gate'),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) => {
      try {
        const workers = await ctx.client.list('workers', {
          q: adfEquals('PersonNumber', args.personNumber),
          limit: 1,
        });
        const worker = workers.items[0] ?? null;
        const checklists = await ctx.client.list('allocatedChecklists', {
          q: adfEquals('PersonNumber', args.personNumber),
          limit: 10,
        });
        if (args.allocate) {
          const allocateResult = await gateWrite(ctx, 'hcm_allocate_checklist', {
            body: {
              PersonNumber: args.personNumber,
              ChecklistName: args.checklistName ?? 'New Hire Onboarding',
            },
          });
          const first = allocateResult.content?.[0];
          const text =
            first && typeof first === 'object' && 'text' in first
              ? String((first as { text: string }).text)
              : '{}';
          return jsonResult({
            recipe: 'new_hire_checklist',
            personNumber: args.personNumber,
            worker,
            existingChecklists: checklists.items,
            allocate: JSON.parse(text),
            steps: [
              'Verify worker',
              'Review existing checklists',
              'Approve allocate if pending',
              'Update tasks via hcm_update_task_status',
            ],
          });
        }
        return jsonResult({
          recipe: 'new_hire_checklist',
          personNumber: args.personNumber,
          worker,
          existingChecklists: checklists.items,
          next: 'Re-run with allocate:true to queue checklist allocation (approval-gated).',
        });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  // Ensure allocate executor exists (registered in extra); bind no-op if missing
  if (!ctx.executors.has('hcm_allocate_checklist')) {
    bindExecutor(ctx, 'hcm_allocate_checklist', async (args) =>
      ctx.client.postJson('allocatedChecklists/action/allocateChecklist', args.body ?? args),
    );
  }

  server.registerTool(
    'hcm_recipe_absence_balance_approve',
    {
      description:
        'Canned flow: absence balance → optional create absence → list BP notifications for approve preview. Example: { "personNumber": "P1001", "createAbsence": false }',
      inputSchema: {
        personNumber: z.string(),
        absenceType: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        createAbsence: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) => {
      try {
        const balance = await ctx.client.list('planBalances', {
          q: adfEquals('personNumber', args.personNumber),
          limit: 25,
        });
        let createResult: unknown = null;
        if (args.createAbsence) {
          const r = await gateWrite(ctx, 'hcm_create_absence', {
            body: {
              personNumber: args.personNumber,
              absenceType: args.absenceType ?? 'Vacation',
              startDate: args.startDate ?? '2026-10-01',
              endDate: args.endDate ?? '2026-10-02',
              status: 'SUBMITTED',
            },
          });
          const first = r.content?.[0];
          const text =
            first && typeof first === 'object' && 'text' in first
              ? String((first as { text: string }).text)
              : '{}';
          createResult = JSON.parse(text);
        }
        const notifications = await ctx.client.list('businessProcessNotifications', { limit: 10 });
        return jsonResult({
          recipe: 'absence_balance_approve',
          personNumber: args.personNumber,
          balance: balance.items,
          createAbsence: createResult,
          notificationsPreview: notifications.items,
          next: 'Use hcm_bulk_bp_dry_run then hcm_bulk_approve_notifications / hcm_approve_write.',
        });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  if (!ctx.executors.has('hcm_create_absence')) {
    bindExecutor(ctx, 'hcm_create_absence', async (args) =>
      ctx.client.postJson('absences', args.body ?? args),
    );
  }

  server.registerTool(
    'hcm_recipe_time_submit',
    {
      description:
        'Canned E2E: validate time card → submit (approval-gated). Example: { "body": { "PersonNumber": "P1001", "PeriodStart": "2026-09-14", "PeriodEnd": "2026-09-20" } }',
      inputSchema: { body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => {
      try {
        const body = args.body ?? {};
        const issues: string[] = [];
        if (!body.PersonNumber && !body.personNumber) issues.push('PersonNumber required');
        if (!body.PeriodStart) issues.push('PeriodStart required');
        if (!body.PeriodEnd) issues.push('PeriodEnd required');
        if (issues.length) {
          return jsonResult({ recipe: 'time_submit', valid: false, issues });
        }
        let serverValidation: unknown = null;
        try {
          serverValidation = await ctx.client.postJson('timeCards/action/validate', body);
        } catch (e) {
          serverValidation = { localOnly: true, error: e instanceof Error ? e.message : String(e) };
        }
        const submit = await gateWrite(ctx, 'hcm_submit_time_card', { body });
        const first = submit.content?.[0];
        const text =
          first && typeof first === 'object' && 'text' in first
            ? String((first as { text: string }).text)
            : '{}';
        return jsonResult({
          recipe: 'time_submit',
          valid: true,
          serverValidation,
          submit: JSON.parse(text),
        });
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}

function registerRedactionAudit(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_list_redaction_audit',
    {
      description:
        'List redaction audit log: which sensitive fields were stripped/masked and when.',
      inputSchema: {
        limit: z.number().int().positive().optional(),
        tool: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        return {
          stats: redactionStats(),
          entries: listRedactionEvents(args.limit ?? 50, args.tool),
          note: 'Local MCP redaction audit — not Oracle audit.',
        };
      }, ctx, 'hcm_list_redaction_audit'),
  );

  bindExecutor(ctx, 'hcm_clear_redaction_audit', async () => {
    clearRedactionEvents();
    return { cleared: true };
  });
  server.registerTool(
    'hcm_clear_redaction_audit',
    {
      description: 'Clear in-process redaction audit buffer. Approval-gated.',
      inputSchema: {},
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_clear_redaction_audit', args as Record<string, unknown>),
  );
}

function registerAtomRealPod(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_atom_replay',
    {
      description:
        'Replay Atom entries from a checkpoint cursor (or since) without advancing — useful for dummy + real-pod dry runs. Example: { "collection": "workers", "limit": 20 }',
      inputSchema: {
        collection: z.string().optional(),
        since: z.string().optional(),
        limit: z.number().int().positive().optional(),
        format: z.enum(['json', 'atom']).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        const collection =
          args.collection && args.collection !== 'all' ? args.collection : undefined;
        const feedId = feedIdForCollection(collection ?? 'all');
        const cp = ctx.atomCheckpoints.get(feedId);
        const feed = await ctx.client.list('atomfeeds', {
          q: collection ? `Collection=${collection}` : undefined,
          limit: args.limit ?? 100,
        });
        const { parseAtomEntry, entriesAfterCursor } = await import('../../platform/atomCdc.js');
        const parsed = (feed.items as Record<string, unknown>[]).map(parseAtomEntry);
        let cursor = cp?.cursor;
        if (args.since) cursor = `${args.since}::`;
        const entries = entriesAfterCursor(parsed, cursor);
        if (args.format === 'atom') {
          return {
            mode: 'replay',
            feedId,
            format: 'atom',
            xml: entriesToAtomXml(`Replay ${feedId}`, feedId, entries),
            count: entries.length,
            realPodHooks: REAL_POD_ATOM_HOOKS,
          };
        }
        return {
          mode: 'replay',
          feedId,
          checkpoint: cp ?? null,
          count: entries.length,
          entries,
          realPodHooks: REAL_POD_ATOM_HOOKS,
          note: 'Replay does not advance checkpoint — use hcm_atom_consume after validation.',
        };
      }, ctx, 'hcm_atom_replay'),
  );

  server.registerTool(
    'hcm_atom_real_pod_guide',
    {
      description:
        'Document real Fusion Atom CDC hooks: feed URLs, auth, checkpoint strategy, replay vs consume. Dummy-first with clear real-pod steps.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () =>
      runRead(async () => REAL_POD_ATOM_HOOKS, ctx, 'hcm_atom_real_pod_guide'),
  );
}

const REAL_POD_ATOM_HOOKS = {
  unofficial: true,
  dummy: {
    base: 'http://127.0.0.1:9090/hcmRestApi/resources/{version}/atomfeeds',
    formats: ['application/json', 'application/atom+xml'],
    tools: ['hcm_atom_poll', 'hcm_atom_consume', 'hcm_atom_replay', 'hcm_atom_get_checkpoint'],
  },
  realPod: {
    typicalPath: '{ORACLE_HCM_BASE_URL}/resources/{ORACLE_HCM_API_VERSION}/atomfeeds',
    auth: 'Same as MCP (basic / bearer / oauth). HCM RBAC must allow Atom feed privileges.',
    checkpoint: 'ORACLE_HCM_ATOM_CHECKPOINT_PATH — local file; not Oracle CDC product.',
    steps: [
      '1. Point ORACLE_HCM_BASE_URL at non-prod pod',
      '2. hcm_smoke_probe — expect atomfeeds 200 (or 403 if duty missing)',
      '3. hcm_list_atom_feeds / hcm_atom_poll',
      '4. hcm_atom_replay to validate parsers',
      '5. hcm_atom_consume to advance checkpoint',
    ],
    gaps: 'Not every collection is Atom-enabled on every pod; 404 is informative, not a bug in MCP.',
  },
};

function registerBatchAndWebhookExtras(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_batch_get',
    {
      description:
        'Batch GET multiple allowlisted resource paths (connection-pooled, concurrency-limited). Example: { "paths": ["workers/1001", "absences/A1"] }',
      inputSchema: {
        paths: z.array(z.string()).min(1).max(50),
        concurrency: z.number().int().positive().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(
        () => ctx.client.batchGet(args.paths, { concurrency: args.concurrency }),
        ctx,
        'hcm_batch_get',
      ),
  );

  bindExecutor(ctx, 'hcm_webhook_rotate_secret', async (args) => {
    if (!ctx.webhook) throw new Error('Start webhook first via hcm_start_webhook_receiver');
    const result = ctx.webhook.rotateSecret(String(args.newSecret), args.keepPrevious !== false);
    return {
      ...result,
      note: 'New secret accepted; previous still valid if keepPrevious. Update ORACLE_HCM_WEBHOOK_SECRET / _SECRETS for restarts.',
    };
  });
  server.registerTool(
    'hcm_webhook_rotate_secret',
    {
      description:
        'Rotate webhook HMAC secret on the running receiver (keeps previous during rotation). Approval-gated. Example: { "newSecret": "…" }',
      inputSchema: {
        newSecret: z.string().min(8),
        keepPrevious: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_webhook_rotate_secret', args as Record<string, unknown>),
  );
}

function registerLearningGoalsWrites(server: McpServer, ctx: ToolContext): void {
  bindExecutor(ctx, 'hcm_create_goal', async (args) =>
    ctx.client.postJson('goals', args.body ?? args),
  );
  server.registerTool(
    'hcm_create_goal',
    {
      description:
        'Create a talent goal (approval-gated). Example: { "body": { "PersonNumber": "P1001", "GoalName": "Ship v0.5", "Status": "IN_PROGRESS" } }',
      inputSchema: { body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_create_goal', args),
  );

  bindExecutor(ctx, 'hcm_update_goal', async (args) =>
    ctx.client.patchJson(`goals/${encodeURIComponent(String(args.goalId))}`, args.body),
  );
  server.registerTool(
    'hcm_update_goal',
    {
      description: 'Update a talent goal (approval-gated). Example: { "goalId": "G1", "body": { "Status": "COMPLETE" } }',
      inputSchema: { goalId: z.string(), body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_update_goal', args),
  );

  bindExecutor(ctx, 'hcm_enroll_learning', async (args) =>
    ctx.client.postJson('learningEnrollments', args.body ?? args),
  );
  server.registerTool(
    'hcm_enroll_learning',
    {
      description:
        'Enroll in a learning course (approval-gated). Example: { "body": { "PersonNumber": "P1002", "CourseName": "HCM Security", "Status": "ENROLLED" } }',
      inputSchema: { body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_enroll_learning', args),
  );

  bindExecutor(ctx, 'hcm_update_learning_enrollment', async (args) =>
    ctx.client.patchJson(
      `learningEnrollments/${encodeURIComponent(String(args.enrollmentId))}`,
      args.body,
    ),
  );
  server.registerTool(
    'hcm_update_learning_enrollment',
    {
      description: 'Update learning enrollment status (approval-gated).',
      inputSchema: { enrollmentId: z.string(), body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_update_learning_enrollment', args),
  );
}

function registerCompensationExtras(server: McpServer, ctx: ToolContext): void {
  // compensation search/get already sensitive-gated in extra; add light update
  bindExecutor(ctx, 'hcm_update_compensation', async (args) =>
    ctx.client.patchJson(
      `compensationHistories/${encodeURIComponent(String(args.compensationId))}`,
      args.body,
    ),
  );
  server.registerTool(
    'hcm_update_compensation',
    {
      description:
        'Light PATCH compensation history row. SENSITIVE: requires ORACLE_HCM_SENSITIVE=1 + approval unless SENSITIVE_WRITE. Example: { "compensationId": "CH1", "body": { "Amount": 11000 } }',
      inputSchema: { compensationId: z.string(), body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_update_compensation', args),
  );
}

function registerAbsenceLovExtras(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_get_absence_type',
    {
      description: 'Get absence type LOV by id. Example: { "absenceTypeId": "AT1" }',
      inputSchema: { absenceTypeId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ absenceTypeId }) =>
      runRead(
        () => ctx.client.getJson(`absenceTypes/${encodeURIComponent(absenceTypeId)}`),
        ctx,
        'hcm_get_absence_type',
      ),
  );
  server.registerTool(
    'hcm_get_absence_plan',
    {
      description: 'Get absence plan LOV by id.',
      inputSchema: { absencePlanId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ absencePlanId }) =>
      runRead(
        () => ctx.client.getJson(`absencePlans/${encodeURIComponent(absencePlanId)}`),
        ctx,
        'hcm_get_absence_plan',
      ),
  );
  server.registerTool(
    'hcm_balance_by_plan',
    {
      description:
        'Plan-balance helper filtered by person + plan name. Example: { "personNumber": "P1001", "planName": "Annual Leave" }',
      inputSchema: {
        personNumber: z.string(),
        planName: z.string().optional(),
        absenceType: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        const parts = [`personNumber=${args.personNumber}`];
        if (args.planName) parts.push(`planName=${args.planName}`);
        if (args.absenceType) parts.push(`absenceType=${args.absenceType}`);
        return ctx.client.list('planBalances', {
          finder: 'getAbsenceTypeBalance',
          q: parts.join(';'),
          limit: 25,
        });
      }, ctx, 'hcm_balance_by_plan'),
  );
}

function registerBulkBpPreview(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_bulk_bp_preview',
    {
      description:
        'Rich multi-notification approve/reject preview: fetches each notification then dry-runs actions. Example: { "notificationIds": ["N1"], "action": "APPROVE" }',
      inputSchema: {
        notificationIds: z.array(z.string()).min(1),
        action: z.enum(['APPROVE', 'REJECT', 'DENY']),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        const action = args.action === 'DENY' ? 'REJECT' : args.action;
        const preview = [];
        for (const id of args.notificationIds) {
          let notification: unknown = null;
          let fetchError: string | null = null;
          try {
            notification = await ctx.client.getJson(
              `businessProcessNotifications/${encodeURIComponent(id)}`,
            );
          } catch (e) {
            fetchError = e instanceof Error ? e.message : String(e);
          }
          preview.push({
            notificationId: id,
            notification,
            fetchError,
            plannedAction: action,
            wouldCall: 'businessProcessNotifications/action/performAction',
          });
        }
        recordAudit(
          ctx,
          'hcm_bulk_bp_preview',
          'dry_run',
          `${action} x${args.notificationIds.length}`,
        );
        return {
          dry_run: true,
          action,
          count: preview.length,
          preview,
          next: 'hcm_bulk_approve_notifications / hcm_bulk_deny_notifications (approval-gated)',
        };
      }, ctx, 'hcm_bulk_bp_preview'),
  );
}
