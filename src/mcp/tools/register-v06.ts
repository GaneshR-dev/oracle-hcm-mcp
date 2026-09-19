/**
 * v0.6 curated tools — performance, learning depth, compensation LOVs,
 * workforce structures, document records, journeys, absence enhancements,
 * recipes, dry-run preview, field maps, role probe, OpenAPI allowlist refresh,
 * Atom/webhook polish, OTBI thin read, benefits dependents, payroll costing,
 * talent pools. Unofficial — not affiliated with Oracle.
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
  getFieldMap,
  listFieldMapDomains,
  oracleToFriendly,
  friendlyToOracle,
  remapKeys,
} from '../../platform/fieldMaps.js';
import { hintsFromSmoke, summarizePrivilegeGaps } from '../../platform/rolePrivilegeProbe.js';
import { runSmokeProbe } from '../../platform/smokeProbe.js';
import {
  extractRootsFromOpenApi,
  mergeAllowlistRoots,
  suggestAllowlistDiff,
} from '../../platform/openapiAllowlist.js';
import { listAllowlistRoots } from '../../policy/allowlist.js';
import { redactDeep } from '../../platform/redact.js';

const listArgs = {
  q: z.string().optional().describe('ADF q= filter'),
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

function getHandler(ctx: ToolContext, pathPrefix: string, idKey: string, tool: string) {
  return async (args: Record<string, unknown>) =>
    runRead(
      () => ctx.client.getJson(`${pathPrefix}/${encodeURIComponent(String(args[idKey]))}`),
      ctx,
      tool,
    );
}

export function registerV06Tools(server: McpServer, ctx: ToolContext): void {
  registerPerformance(server, ctx);
  registerLearningDepth(server, ctx);
  registerCompensationPacks(server, ctx);
  registerWorkforceStructures(server, ctx);
  registerDocumentRecords(server, ctx);
  registerJourneys(server, ctx);
  registerAbsenceEnhancements(server, ctx);
  registerRecipesV06(server, ctx);
  registerDryRunPreview(server, ctx);
  registerFieldMaps(server, ctx);
  registerRoleProbe(server, ctx);
  registerPlatformV06(server, ctx);
  registerNiceLater(server, ctx);
}

function registerPerformance(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_search_review_cycles',
    {
      description: 'Search performance review cycles. Example: { "q": "Status=OPEN" }',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'reviewCycles', 'hcm_search_review_cycles'),
  );
  server.registerTool(
    'hcm_get_review_cycle',
    {
      description: 'Get a review cycle by id.',
      inputSchema: { reviewCycleId: z.string() },
      annotations: { readOnlyHint: true },
    },
    getHandler(ctx, 'reviewCycles', 'reviewCycleId', 'hcm_get_review_cycle'),
  );
  server.registerTool(
    'hcm_search_feedback',
    {
      description: 'Search performance feedback records.',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'performanceFeedback', 'hcm_search_feedback'),
  );
  server.registerTool(
    'hcm_get_feedback',
    {
      description: 'Get feedback by id.',
      inputSchema: { feedbackId: z.string() },
      annotations: { readOnlyHint: true },
    },
    getHandler(ctx, 'performanceFeedback', 'feedbackId', 'hcm_get_feedback'),
  );
  bindExecutor(ctx, 'hcm_create_feedback', async (args) =>
    ctx.client.postJson('performanceFeedback', args.body ?? args),
  );
  server.registerTool(
    'hcm_create_feedback',
    {
      description:
        'Create performance feedback (approval-gated unless --write). Example: { "body": { "PersonNumber": "P1001", "Comments": "Nice work" } }',
      inputSchema: { body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_create_feedback', args),
  );
  server.registerTool(
    'hcm_search_check_ins',
    {
      description: 'Search manager/employee check-ins.',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'checkIns', 'hcm_search_check_ins'),
  );
  server.registerTool(
    'hcm_get_check_in',
    {
      description: 'Get a check-in by id.',
      inputSchema: { checkInId: z.string() },
      annotations: { readOnlyHint: true },
    },
    getHandler(ctx, 'checkIns', 'checkInId', 'hcm_get_check_in'),
  );
  bindExecutor(ctx, 'hcm_create_check_in', async (args) =>
    ctx.client.postJson('checkIns', args.body ?? args),
  );
  server.registerTool(
    'hcm_create_check_in',
    {
      description: 'Schedule a check-in (approval-gated unless --write).',
      inputSchema: { body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_create_check_in', args),
  );
}

function registerLearningDepth(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_search_learning_assignments',
    {
      description: 'Search learning assignments (beyond enrollments).',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'learningAssignments', 'hcm_search_learning_assignments'),
  );
  server.registerTool(
    'hcm_get_learning_assignment',
    {
      description: 'Get a learning assignment by id.',
      inputSchema: { assignmentId: z.string() },
      annotations: { readOnlyHint: true },
    },
    getHandler(ctx, 'learningAssignments', 'assignmentId', 'hcm_get_learning_assignment'),
  );
  server.registerTool(
    'hcm_list_learning_completions',
    {
      description: 'List learning completions.',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'learningCompletions', 'hcm_list_learning_completions'),
  );
  bindExecutor(ctx, 'hcm_record_learning_completion', async (args) =>
    ctx.client.postJson('learningCompletions', args.body ?? args),
  );
  server.registerTool(
    'hcm_record_learning_completion',
    {
      description: 'Record a learning completion (approval-gated unless --write).',
      inputSchema: { body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_record_learning_completion', args),
  );
}

function registerCompensationPacks(server: McpServer, ctx: ToolContext): void {
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
        description: `${desc} SENSITIVE in default mode only; --write bypasses.`,
        inputSchema: listArgs,
        annotations: { readOnlyHint: true },
      },
      async (args) => gateWrite(ctx, tool, args as Record<string, unknown>),
    );
  };
  const sensGet = (tool: string, path: string, idParam: string, desc: string) => {
    bindExecutor(ctx, tool, async (args) =>
      ctx.client.getJson(`${path}/${encodeURIComponent(String(args[idParam]))}`),
    );
    server.registerTool(
      tool,
      {
        description: `${desc} SENSITIVE in default mode only; --write bypasses.`,
        inputSchema: { [idParam]: z.string() },
        annotations: { readOnlyHint: true },
      },
      async (args) => gateWrite(ctx, tool, args as Record<string, unknown>),
    );
  };

  sensList('hcm_search_salary_bases', 'salaryBases', 'Search salary bases.');
  sensGet('hcm_get_salary_basis', 'salaryBases', 'salaryBasisId', 'Get salary basis.');
  sensList('hcm_search_grade_steps', 'gradeSteps', 'Search grade steps LOV.');
  sensGet('hcm_get_grade_step', 'gradeSteps', 'gradeStepId', 'Get grade step.');

  bindExecutor(ctx, 'hcm_get_offer_letter_fields', async (args) => {
    const offer = (await ctx.client.getJson(
      `recruitingJobOffers/${encodeURIComponent(String(args.offerId))}`,
    )) as Record<string, unknown>;
    return {
      offerId: args.offerId,
      ProposedSalary: offer.ProposedSalary,
      Currency: offer.Currency,
      Status: offer.Status,
      CandidateId: offer.CandidateId,
      RequisitionId: offer.RequisitionId,
      fieldMap: getFieldMap('recruiting').filter((f) =>
        ['ProposedSalary', 'Currency'].includes(f.oracle),
      ),
      note: 'Curated offer letter fields — not full letter template. Unofficial.',
    };
  });
  server.registerTool(
    'hcm_get_offer_letter_fields',
    {
      description:
        'Get offer letter / proposed compensation fields (SENSITIVE in default; --write bypasses).',
      inputSchema: { offerId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async (args) => gateWrite(ctx, 'hcm_get_offer_letter_fields', args as Record<string, unknown>),
  );
}

function registerWorkforceStructures(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_search_departments',
    {
      description: 'Search departments (workforce structures).',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'departments', 'hcm_search_departments'),
  );
  server.registerTool(
    'hcm_get_department_tree',
    {
      description: 'Build a department/org tree from organizations (parent links).',
      inputSchema: {
        rootOrganizationId: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        const list = await ctx.client.list('organizations', { limit: 200 });
        const items = (list.items ?? []) as {
          OrganizationId: string;
          Name: string;
          ParentOrganizationId?: string;
        }[];
        type Node = {
          OrganizationId: string;
          Name: string;
          children: Node[];
        };
        const map = new Map<string, Node>();
        for (const o of items) {
          map.set(o.OrganizationId, {
            OrganizationId: o.OrganizationId,
            Name: o.Name,
            children: [],
          });
        }
        const roots: Node[] = [];
        for (const o of items) {
          const node = map.get(o.OrganizationId)!;
          if (o.ParentOrganizationId && map.has(o.ParentOrganizationId)) {
            map.get(o.ParentOrganizationId)!.children.push(node);
          } else {
            roots.push(node);
          }
        }
        if (args.rootOrganizationId && map.has(args.rootOrganizationId)) {
          return { tree: map.get(args.rootOrganizationId), unofficial: true };
        }
        return { tree: roots, count: items.length, unofficial: true };
      }, ctx, 'hcm_get_department_tree'),
  );
  server.registerTool(
    'hcm_search_job_families',
    {
      description: 'Search job families.',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'jobFamilies', 'hcm_search_job_families'),
  );
  server.registerTool(
    'hcm_get_job_family',
    {
      description: 'Get job family by id.',
      inputSchema: { jobFamilyId: z.string() },
      annotations: { readOnlyHint: true },
    },
    getHandler(ctx, 'jobFamilies', 'jobFamilyId', 'hcm_get_job_family'),
  );
  server.registerTool(
    'hcm_list_position_hierarchy',
    {
      description: 'List positions with optional org filter (workforce structures).',
      inputSchema: {
        organizationId: z.string().optional(),
        limit: z.number().int().positive().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        const list = await ctx.client.list('positions', {
          q: args.organizationId ? `OrganizationId=${args.organizationId}` : undefined,
          limit: args.limit ?? 50,
        });
        return { ...list, note: 'Flat position list — hierarchy via OrganizationId. Unofficial.' };
      }, ctx, 'hcm_list_position_hierarchy'),
  );
}

function registerDocumentRecords(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_search_document_records',
    {
      description: 'List person document records.',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'documentRecords', 'hcm_search_document_records'),
  );
  server.registerTool(
    'hcm_get_document_record',
    {
      description: 'Get a document record by id (PII may be redacted in results).',
      inputSchema: { documentRecordId: z.string() },
      annotations: { readOnlyHint: true },
    },
    getHandler(ctx, 'documentRecords', 'documentRecordId', 'hcm_get_document_record'),
  );
  bindExecutor(ctx, 'hcm_upload_document_record', async (args) =>
    ctx.client.postJson('documentRecords', args.body ?? args),
  );
  server.registerTool(
    'hcm_upload_document_record',
    {
      description:
        'Upload / create a document record metadata row (approval-gated in default mode; --write bypasses).',
      inputSchema: { body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_upload_document_record', args),
  );
  server.registerTool(
    'hcm_redact_document_pii',
    {
      description:
        'Locally redact PII fields from a document-like payload (does not call Fusion). Helper for agent UX.',
      inputSchema: {
        payload: z.record(z.unknown()),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        const redacted = redactDeep(args.payload, 0, { tool: 'hcm_redact_document_pii', audit: true });
        return { redacted, note: 'Local redaction only — not Fusion DFF scrubbing. Unofficial.' };
      }, ctx, 'hcm_redact_document_pii'),
  );
}

function registerJourneys(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_search_journeys',
    {
      description: 'Search worker journeys (onboarding etc.) beyond allocated checklists.',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'workerJourneys', 'hcm_search_journeys'),
  );
  server.registerTool(
    'hcm_get_journey',
    {
      description: 'Get a worker journey by id.',
      inputSchema: { journeyId: z.string() },
      annotations: { readOnlyHint: true },
    },
    getHandler(ctx, 'workerJourneys', 'journeyId', 'hcm_get_journey'),
  );
  server.registerTool(
    'hcm_list_journey_tasks',
    {
      description: 'List journey tasks (optional journeyId filter via q).',
      inputSchema: {
        ...listArgs,
        journeyId: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(
        () =>
          ctx.client.list('journeyTasks', {
            q: args.journeyId ? `JourneyId=${args.journeyId}` : args.q,
            finder: args.finder,
            limit: args.limit ?? 25,
            offset: args.offset ?? 0,
          }),
        ctx,
        'hcm_list_journey_tasks',
      ),
  );
  bindExecutor(ctx, 'hcm_update_journey_task', async (args) =>
    ctx.client.patchJson(
      `journeyTasks/${encodeURIComponent(String(args.journeyTaskId))}`,
      args.body,
    ),
  );
  server.registerTool(
    'hcm_update_journey_task',
    {
      description: 'Update a journey task status (approval-gated unless --write).',
      inputSchema: { journeyTaskId: z.string(), body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_update_journey_task', args),
  );
}

function registerAbsenceEnhancements(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_preview_entitlement_calc',
    {
      description:
        'Preview absence entitlement / balance sufficiency before create. Example: { "body": { "PersonNumber": "P1001", "absenceType": "Vacation", "startDate": "2026-10-01", "endDate": "2026-10-03" } }',
      inputSchema: { body: z.record(z.unknown()) },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(
        () => ctx.client.postJson('absences/action/previewEntitlement', args.body ?? args),
        ctx,
        'hcm_preview_entitlement_calc',
      ),
  );
  server.registerTool(
    'hcm_accrual_balances_by_date',
    {
      description: 'Accrual / plan balances as-of a date.',
      inputSchema: {
        personNumber: z.string().optional(),
        asOf: z.string().describe('ISO date YYYY-MM-DD'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        const q = new URLSearchParams();
        q.set('asOf', args.asOf);
        if (args.personNumber) q.set('personNumber', args.personNumber);
        return ctx.client.getJson(`planBalances/action/byDate?${q.toString()}`);
      }, ctx, 'hcm_accrual_balances_by_date'),
  );
  server.registerTool(
    'hcm_list_absence_type_lov',
    {
      description: 'Absence type LOV (finish type LOV coverage).',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'absenceTypes', 'hcm_list_absence_type_lov'),
  );
  server.registerTool(
    'hcm_list_absence_plan_lov',
    {
      description: 'Absence plan LOV (finish plan LOV coverage).',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'absencePlans', 'hcm_list_absence_plan_lov'),
  );
}

function registerRecipesV06(server: McpServer, ctx: ToolContext): void {
  bindExecutor(ctx, 'hcm_recipe_transfer', async (args) => {
    const workerId = String(args.workerId);
    const body = (args.body ?? {}) as Record<string, unknown>;
    const worker = await ctx.client.getJson(`workers/${encodeURIComponent(workerId)}`);
    const asgList = await ctx.client.list('workerAssignments', {
      q: `WorkerId=${workerId}`,
      limit: 5,
    });
    const asg = (asgList.items?.[0] ?? {}) as Record<string, unknown>;
    const assignmentId = String(asg.AssignmentId ?? args.assignmentId ?? '');
    let updated = null;
    if (assignmentId) {
      updated = await ctx.client.patchJson(
        `workerAssignments/${encodeURIComponent(assignmentId)}`,
        {
          OrganizationId: body.OrganizationId ?? body.organizationId,
          LocationId: body.LocationId ?? body.locationId,
          JobId: body.JobId ?? body.jobId,
          ActionCode: 'TRANSFER',
          ...body,
        },
      );
    }
    return {
      recipe: 'transfer',
      workerId,
      worker,
      assignmentId,
      updated,
      unofficial: true,
    };
  });
  server.registerTool(
    'hcm_recipe_transfer',
    {
      description:
        'Recipe: transfer worker (patch assignment org/location/job). Approval-gated unless --write.',
      inputSchema: {
        workerId: z.string(),
        assignmentId: z.string().optional(),
        body: z.record(z.unknown()),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_recipe_transfer', args),
  );

  bindExecutor(ctx, 'hcm_recipe_terminate', async (args) => {
    const workerId = String(args.workerId);
    const asgList = await ctx.client.list('workerAssignments', {
      q: `WorkerId=${workerId}`,
      limit: 5,
    });
    const asg = (asgList.items?.[0] ?? {}) as Record<string, unknown>;
    const assignmentId = String(asg.AssignmentId ?? args.assignmentId ?? '');
    let updated = null;
    if (assignmentId) {
      updated = await ctx.client.patchJson(
        `workerAssignments/${encodeURIComponent(assignmentId)}`,
        {
          AssignmentStatusType: 'INACTIVE',
          ActionCode: 'TERMINATION',
          TerminationDate: args.terminationDate ?? new Date().toISOString().slice(0, 10),
        },
      );
    }
    return { recipe: 'terminate', workerId, assignmentId, updated, unofficial: true };
  });
  server.registerTool(
    'hcm_recipe_terminate',
    {
      description: 'Recipe: terminate (set assignment inactive). Approval-gated unless --write.',
      inputSchema: {
        workerId: z.string(),
        assignmentId: z.string().optional(),
        terminationDate: z.string().optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_recipe_terminate', args),
  );

  bindExecutor(ctx, 'hcm_recipe_promote', async (args) => {
    const workerId = String(args.workerId);
    const asgList = await ctx.client.list('workerAssignments', {
      q: `WorkerId=${workerId}`,
      limit: 5,
    });
    const asg = (asgList.items?.[0] ?? {}) as Record<string, unknown>;
    const assignmentId = String(asg.AssignmentId ?? args.assignmentId ?? '');
    const body = (args.body ?? {}) as Record<string, unknown>;
    let updated = null;
    if (assignmentId) {
      updated = await ctx.client.patchJson(
        `workerAssignments/${encodeURIComponent(assignmentId)}`,
        {
          GradeId: body.GradeId ?? body.gradeId,
          JobId: body.JobId ?? body.jobId,
          ActionCode: 'PROMOTION',
          ...body,
        },
      );
    }
    return { recipe: 'promote', workerId, assignmentId, updated, unofficial: true };
  });
  server.registerTool(
    'hcm_recipe_promote',
    {
      description: 'Recipe: promote (grade/job change). Approval-gated unless --write.',
      inputSchema: {
        workerId: z.string(),
        assignmentId: z.string().optional(),
        body: z.record(z.unknown()),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_recipe_promote', args),
  );

  bindExecutor(ctx, 'hcm_recipe_new_contingent_worker', async (args) => {
    const body = (args.body ?? {
      FirstName: 'Contingent',
      LastName: 'Worker',
      PersonNumber: `C${Date.now() % 100000}`,
      DisplayName: 'Contingent Worker',
    }) as Record<string, unknown>;
    const worker = (await ctx.client.postJson('workers', {
      ...body,
      WorkerType: body.WorkerType ?? 'CONTINGENT',
    })) as Record<string, unknown>;
    return {
      recipe: 'new_contingent_worker',
      worker,
      next: ['Allocate onboarding journey', 'Create assignment'],
      unofficial: true,
    };
  });
  server.registerTool(
    'hcm_recipe_new_contingent_worker',
    {
      description: 'Recipe: create contingent worker skeleton. Approval-gated unless --write.',
      inputSchema: { body: z.record(z.unknown()).optional() },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_recipe_new_contingent_worker', args),
  );

  bindExecutor(ctx, 'hcm_recipe_mass_absence_approve', async (args) => {
    const ids = (args.notificationIds ?? args.absenceIds ?? []) as string[];
    const results: unknown[] = [];
    for (const id of ids) {
      try {
        const r = await ctx.client.postJson(
          `businessProcessNotifications/${encodeURIComponent(id)}/action/performAction`,
          { ActionCode: 'APPROVE', ...(args.body as object ?? {}) },
        );
        results.push({ id, ok: true, result: r });
      } catch (e) {
        results.push({ id, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return {
      recipe: 'mass_absence_approve',
      count: ids.length,
      results,
      unofficial: true,
    };
  });
  server.registerTool(
    'hcm_recipe_mass_absence_approve',
    {
      description:
        'Recipe: mass-approve absence BP notifications. Approval-gated unless --write. Example: { "notificationIds": ["N1"] }',
      inputSchema: {
        notificationIds: z.array(z.string()).optional(),
        absenceIds: z.array(z.string()).optional(),
        body: z.record(z.unknown()).optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_recipe_mass_absence_approve', args),
  );
}

function registerDryRunPreview(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_preview_write',
    {
      description:
        'Dry-run write preview — shows intended method/path/body without mutating. Optional helper; not required under --write.',
      inputSchema: {
        toolName: z.string().describe('Target write tool name'),
        args: z.record(z.unknown()).describe('Args that would be passed'),
        method: z.enum(['POST', 'PATCH', 'PUT', 'DELETE']).optional(),
        path: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        recordAudit(ctx, 'hcm_preview_write', 'dry_run', args.toolName);
        return {
          dry_run: true,
          toolName: args.toolName,
          args: args.args,
          inferredMethod: args.method ?? 'POST',
          inferredPath: args.path ?? null,
          writeMode: ctx.writeMode,
          wouldQueueApproval: !ctx.writeMode,
          note: 'Preview only — no Fusion mutation. Under --write real tools execute immediately.',
          unofficial: true,
        };
      }, ctx, 'hcm_preview_write'),
  );
}

function registerFieldMaps(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_list_field_maps',
    {
      description: 'List Oracle ↔ friendly field map domains.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () =>
      runRead(
        async () => ({ domains: listFieldMapDomains(), count: getFieldMap().length }),
        ctx,
        'hcm_list_field_maps',
      ),
  );
  server.registerTool(
    'hcm_field_map',
    {
      description:
        'Lookup Oracle field ↔ friendly name. Example: { "domain": "worker", "oracle": "PersonNumber" }',
      inputSchema: {
        domain: z.string().optional(),
        oracle: z.string().optional(),
        friendly: z.string().optional(),
        remap: z.record(z.unknown()).optional().describe('Optional object to remap keys'),
        direction: z.enum(['toFriendly', 'toOracle']).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        const entries = getFieldMap(args.domain);
        let resolved: unknown = null;
        if (args.oracle) resolved = { friendly: oracleToFriendly(args.oracle, args.domain) };
        if (args.friendly) resolved = { oracle: friendlyToOracle(args.friendly, args.domain) };
        const remapped = args.remap
          ? remapKeys(args.remap, args.direction ?? 'toFriendly', args.domain)
          : null;
        return { entries, resolved, remapped, unofficial: true };
      }, ctx, 'hcm_field_map'),
  );
}

function registerRoleProbe(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_role_privilege_probe',
    {
      description:
        'Run smoke probe and map 403/401 rows to likely missing HCM duties. Example: { "profile": "sandbox" }',
      inputSchema: {
        profile: z.string().optional(),
        reuseReport: z.boolean().optional().describe('If true, only analyze without re-probing (needs prior smoke in-process — still re-runs for accuracy)'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        const report = await runSmokeProbe(ctx.client, {
          profile: args.profile ?? ctx.config.profile ?? 'default',
        });
        const hints = hintsFromSmoke(report);
        return {
          ...summarizePrivilegeGaps(hints),
          smokeSummary: report.summary,
          profile: report.profile,
        };
      }, ctx, 'hcm_role_privilege_probe'),
  );
}

function registerPlatformV06(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_atom_cdc_status',
    {
      description:
        'Live Atom CDC status — durable cursor/checkpoint store path + all feed cursors.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () =>
      runRead(async () => {
        const checkpoints = ctx.atomCheckpoints.list();
        return {
          storePath: ctx.atomCheckpoints.path ?? null,
          durable: Boolean(ctx.atomCheckpoints.path),
          checkpoints,
          count: checkpoints.length,
          note: 'Local unofficial CDC cursors — not Oracle CDC product.',
        };
      }, ctx, 'hcm_atom_cdc_status'),
  );

  server.registerTool(
    'hcm_refresh_allowlist_from_openapi',
    {
      description:
        'Pull tenant describe/OpenAPI JSON (or pass document) and merge safe roots into runtime allowlist. CE/AI stay blocked.',
      inputSchema: {
        document: z.record(z.unknown()).optional().describe('Inline OpenAPI/ADF describe JSON'),
        fetchFromTenant: z.boolean().optional().describe('GET resources/ root from baseUrl'),
        apply: z.boolean().optional().describe('Merge into runtime allowlist (default true)'),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) => {
      try {
        let doc: unknown = args.document;
        if (!doc && args.fetchFromTenant !== false) {
          // Prefer explicit document; fetch attempt via rest get of version root may 404 on some pods
          try {
            doc = await ctx.client.getJson('');
          } catch {
            doc = {
              items: listAllowlistRoots().map((name) => ({ name })),
              note: 'Fallback stub — pass document for real refresh',
            };
          }
        }
        if (!doc) doc = { items: [] };
        const roots = extractRootsFromOpenApi(doc);
        const diff = suggestAllowlistDiff(roots);
        let merge: unknown = null;
        if (args.apply !== false) {
          merge = mergeAllowlistRoots(roots);
        }
        recordAudit(ctx, 'hcm_refresh_allowlist_from_openapi', 'write', `roots=${roots.length}`);
        return jsonResult({
          diff,
          merge,
          allowlistSize: listAllowlistRoots().length,
          unofficial: true,
        });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  server.registerTool(
    'hcm_export_approval_audit',
    {
      description: 'Export in-process audit trail + pending approvals (for Approval UI export).',
      inputSchema: {
        limit: z.number().int().positive().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        const pending = ctx.approvals.listPending();
        const audit = ctx.auditTrail.slice(-(args.limit ?? 100));
        return {
          pending: pending.map((p) => ({
            approval_id: p.approvalId,
            tool: p.toolName,
            summary: p.summary,
            created_at: new Date(p.createdAt).toISOString(),
            expires_at: new Date(p.expiresAt).toISOString(),
            domain: inferDomain(p.toolName),
          })),
          audit,
          exportedAt: new Date().toISOString(),
          unofficial: true,
        };
      }, ctx, 'hcm_export_approval_audit'),
  );

  bindExecutor(ctx, 'hcm_bulk_approve_writes', async (args) => {
    const ids = (args.approvalIds as string[]) ?? [];
    const results: unknown[] = [];
    for (const id of ids) {
      try {
        const { intent, result } = await ctx.approvals.approve(id, async (tool, a) => {
          const fn = ctx.executors.get(tool);
          if (!fn) throw new Error(`No executor for ${tool}`);
          return fn(a);
        });
        results.push({ approval_id: id, ok: true, tool: intent.toolName, result });
      } catch (e) {
        results.push({ approval_id: id, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return { bulk: true, results };
  });
  server.registerTool(
    'hcm_bulk_approve_writes',
    {
      description:
        'Bulk-approve pending write intents by approval_id list (Approval UI). Still gated as a write unless --write.',
      inputSchema: { approvalIds: z.array(z.string()).min(1) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_bulk_approve_writes', args),
  );

  server.registerTool(
    'hcm_list_pending_approvals_by_domain',
    {
      description: 'List pending approvals filtered by domain (absence, worker, learning, …).',
      inputSchema: { domain: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        let pending = ctx.approvals.listPending().map((p) => ({
          approval_id: p.approvalId,
          tool: p.toolName,
          summary: p.summary,
          domain: inferDomain(p.toolName),
          expires_at: new Date(p.expiresAt).toISOString(),
        }));
        if (args.domain) {
          const d = args.domain.toLowerCase();
          pending = pending.filter((p) => p.domain === d);
        }
        return { pending, domains: [...new Set(pending.map((p) => p.domain))] };
      }, ctx, 'hcm_list_pending_approvals_by_domain'),
  );
}

function inferDomain(toolName: string): string {
  const n = toolName.toLowerCase();
  if (n.includes('absence') || n.includes('entitlement') || n.includes('accrual')) return 'absence';
  if (n.includes('worker') || n.includes('assignment') || n.includes('transfer') || n.includes('terminate') || n.includes('promote') || n.includes('contingent'))
    return 'worker';
  if (n.includes('learning') || n.includes('goal')) return 'learning';
  if (n.includes('compensat') || n.includes('salary') || n.includes('grade_step') || n.includes('offer_letter') || n.includes('payroll') || n.includes('element'))
    return 'compensation';
  if (n.includes('document')) return 'documents';
  if (n.includes('journey') || n.includes('checklist')) return 'journeys';
  if (n.includes('feedback') || n.includes('check_in') || n.includes('review') || n.includes('performance'))
    return 'performance';
  if (n.includes('benefit') || n.includes('dependent') || n.includes('life_event')) return 'benefits';
  if (n.includes('recruit') || n.includes('candidate') || n.includes('offer') || n.includes('interview'))
    return 'recruiting';
  if (n.includes('webhook') || n.includes('atom') || n.includes('allowlist') || n.includes('profile'))
    return 'platform';
  return 'other';
}

function registerNiceLater(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_otbi_query',
    {
      description:
        'Thin OTBI/analytics read stub — lists known report catalog entries (dummy) or allowlisted otbiReports. Not full BI Publisher.',
      inputSchema: {
        reportPath: z.string().optional(),
        limit: z.number().int().positive().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        try {
          const list = await ctx.client.list('otbiReports', { limit: args.limit ?? 25 });
          return {
            ...list,
            reportPath: args.reportPath ?? null,
            note: 'Thin catalog read only — not OTBI execute. Unofficial.',
          };
        } catch (e) {
          return {
            items: [],
            error: e instanceof Error ? e.message : String(e),
            note: 'otbiReports may be unavailable on this pod.',
          };
        }
      }, ctx, 'hcm_otbi_query'),
  );

  server.registerTool(
    'hcm_search_benefit_dependents',
    {
      description: 'Search benefits dependents.',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'benefitDependents', 'hcm_search_benefit_dependents'),
  );
  server.registerTool(
    'hcm_search_life_events',
    {
      description: 'Search benefits life events.',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'lifeEvents', 'hcm_search_life_events'),
  );

  bindExecutor(ctx, 'hcm_search_payroll_costing', async (args) =>
    ctx.client.list('payrollCosting', {
      q: args.q as string | undefined,
      limit: (args.limit as number) ?? 25,
      offset: (args.offset as number) ?? 0,
    }),
  );
  server.registerTool(
    'hcm_search_payroll_costing',
    {
      description: 'Search payroll costing rows (SENSITIVE in default; --write bypasses).',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    async (args) => gateWrite(ctx, 'hcm_search_payroll_costing', args as Record<string, unknown>),
  );
  bindExecutor(ctx, 'hcm_get_element_entry', async (args) =>
    ctx.client.getJson(`elementEntries/${encodeURIComponent(String(args.elementEntryId))}`),
  );
  server.registerTool(
    'hcm_get_element_entry',
    {
      description: 'Get element entry by id (SENSITIVE in default; --write bypasses).',
      inputSchema: { elementEntryId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async (args) => gateWrite(ctx, 'hcm_get_element_entry', args as Record<string, unknown>),
  );
  bindExecutor(ctx, 'hcm_create_element_entry', async (args) =>
    ctx.client.postJson('elementEntries', args.body ?? args),
  );
  server.registerTool(
    'hcm_create_element_entry',
    {
      description: 'Create element entry (SENSITIVE + approval in default; --write bypasses all).',
      inputSchema: { body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_create_element_entry', args),
  );
  bindExecutor(ctx, 'hcm_update_element_entry', async (args) =>
    ctx.client.patchJson(
      `elementEntries/${encodeURIComponent(String(args.elementEntryId))}`,
      args.body,
    ),
  );
  server.registerTool(
    'hcm_update_element_entry',
    {
      description: 'Update element entry (SENSITIVE + approval in default; --write bypasses all).',
      inputSchema: { elementEntryId: z.string(), body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_update_element_entry', args),
  );

  server.registerTool(
    'hcm_search_talent_pools',
    {
      description: 'Search curated talent pools (dummy-backed).',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    listHandler(ctx, 'talentPools', 'hcm_search_talent_pools'),
  );
  server.registerTool(
    'hcm_get_talent_pool',
    {
      description: 'Get talent pool by id.',
      inputSchema: { talentPoolId: z.string() },
      annotations: { readOnlyHint: true },
    },
    getHandler(ctx, 'talentPools', 'talentPoolId', 'hcm_get_talent_pool'),
  );
}
