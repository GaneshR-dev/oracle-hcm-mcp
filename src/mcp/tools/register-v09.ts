/**
 * v0.9 official Fusion 11.13.18.05 child/LOV/action coverage.
 * Worker children, timeEventRequests, work-structure LOVs, recruiting children,
 * benefits costs/providers, documentRecords actions, assignment gradeSteps.
 * Unofficial — not affiliated with Oracle.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext, WorkerChildName } from './helpers.js';
import {
  gateWrite,
  runRead,
  bindExecutor,
  listWorkerChild,
  getWorkerChildById,
  postWorkerChild,
  patchWorkerChild,
  listNestedChild,
  listWorkerAssignments,
} from './helpers.js';

const listArgs = {
  q: z.string().optional(),
  finder: z.string().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
  workerId: z.string().optional(),
};

function childSearch(
  server: McpServer,
  ctx: ToolContext,
  tool: string,
  child: WorkerChildName,
  desc: string,
  sensitive: boolean,
): void {
  if (sensitive) {
    bindExecutor(ctx, tool, async (args) =>
      listWorkerChild(ctx.client, child, {
        q: args.q as string | undefined,
        workerId: args.workerId as string | undefined,
        limit: (args.limit as number) ?? 25,
        offset: (args.offset as number) ?? 0,
      }),
    );
    server.registerTool(
      tool,
      {
        description: `${desc} Official workers/{id}/child/${child}. SENSITIVE.`,
        inputSchema: listArgs,
        annotations: { readOnlyHint: true },
      },
      async (args) => gateWrite(ctx, tool, args as Record<string, unknown>),
    );
    return;
  }
  server.registerTool(
    tool,
    {
      description: `${desc} Official workers/{id}/child/${child}.`,
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(
        () =>
          listWorkerChild(ctx.client, child, {
            q: args.q,
            workerId: args.workerId,
            limit: args.limit ?? 25,
            offset: args.offset ?? 0,
          }),
        ctx,
        tool,
      ),
  );
}

function childGet(
  server: McpServer,
  ctx: ToolContext,
  tool: string,
  child: WorkerChildName,
  idParam: string,
  idFields: string[],
  desc: string,
  sensitive: boolean,
): void {
  if (sensitive) {
    bindExecutor(ctx, tool, async (args) =>
      getWorkerChildById(ctx.client, child, String(args[idParam]), idFields),
    );
    server.registerTool(
      tool,
      {
        description: `${desc} SENSITIVE.`,
        inputSchema: { [idParam]: z.string() },
        annotations: { readOnlyHint: true },
      },
      async (args) => gateWrite(ctx, tool, args as Record<string, unknown>),
    );
    return;
  }
  server.registerTool(
    tool,
    {
      description: desc,
      inputSchema: { [idParam]: z.string() },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(
        () => getWorkerChildById(ctx.client, child, String(args[idParam]), idFields),
        ctx,
        tool,
      ),
  );
}

export function registerV09Tools(server: McpServer, ctx: ToolContext): void {
  childSearch(server, ctx, 'hcm_search_addresses', 'addresses', 'Search worker addresses.', true);
  childGet(server, ctx, 'hcm_get_address', 'addresses', 'addressId', ['AddressId'], 'Get worker address.', true);
  childSearch(server, ctx, 'hcm_search_names', 'names', 'Search worker names.', false);
  childGet(server, ctx, 'hcm_get_name', 'names', 'nameId', ['NameId'], 'Get worker name.', false);
  childSearch(server, ctx, 'hcm_search_photos', 'photos', 'Search worker photos.', false);
  childGet(server, ctx, 'hcm_get_photo', 'photos', 'photoId', ['PhotoId'], 'Get worker photo.', false);
  childSearch(server, ctx, 'hcm_search_citizenships', 'citizenships', 'Search worker citizenships.', false);
  childGet(server, ctx, 'hcm_get_citizenship', 'citizenships', 'citizenshipId', ['CitizenshipId'], 'Get citizenship.', false);
  childSearch(server, ctx, 'hcm_search_visas', 'visasPermits', 'Search worker visas/permits.', true);
  childGet(server, ctx, 'hcm_get_visa', 'visasPermits', 'visaPermitId', ['VisaPermitId'], 'Get visa/permit.', true);
  childSearch(server, ctx, 'hcm_search_passports', 'passports', 'Search worker passports.', true);
  childGet(server, ctx, 'hcm_get_passport', 'passports', 'passportId', ['PassportId'], 'Get passport.', true);
  childSearch(server, ctx, 'hcm_search_disabilities', 'disabilities', 'Search worker disabilities.', true);
  childSearch(server, ctx, 'hcm_search_driver_licenses', 'driverLicenses', 'Search driver licenses.', true);
  childSearch(server, ctx, 'hcm_search_ethnicities', 'ethnicities', 'Search ethnicities.', true);
  childSearch(server, ctx, 'hcm_search_religions', 'religions', 'Search religions.', true);
  childSearch(server, ctx, 'hcm_search_external_identifiers', 'externalIdentifiers', 'Search external identifiers.', true);
  childSearch(server, ctx, 'hcm_search_other_communication', 'otherCommunicationAccounts', 'Search other communication accounts.', false);
  childSearch(server, ctx, 'hcm_search_worker_messages', 'messages', 'Search worker messages.', false);

  bindExecutor(ctx, 'hcm_create_address', async (args) =>
    postWorkerChild(ctx.client, String(args.workerId), 'addresses', args.body ?? args),
  );
  server.registerTool(
    'hcm_create_address',
    {
      description: 'POST workers/{id}/child/addresses. Approval-gated unless --write. SENSITIVE.',
      inputSchema: { workerId: z.string(), body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_create_address', args as Record<string, unknown>),
  );
  bindExecutor(ctx, 'hcm_update_address', async (args) =>
    patchWorkerChild(
      ctx.client,
      String(args.workerId),
      'addresses',
      String(args.addressId),
      args.body ?? {},
    ),
  );
  server.registerTool(
    'hcm_update_address',
    {
      description: 'PATCH workers/{id}/child/addresses/{id}. Approval-gated unless --write. SENSITIVE.',
      inputSchema: { workerId: z.string(), addressId: z.string(), body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_update_address', args as Record<string, unknown>),
  );
  bindExecutor(ctx, 'hcm_create_photo', async (args) =>
    postWorkerChild(ctx.client, String(args.workerId), 'photos', args.body ?? args),
  );
  server.registerTool(
    'hcm_create_photo',
    {
      description: 'POST workers/{id}/child/photos (Photo + PhotoName). Approval-gated unless --write.',
      inputSchema: { workerId: z.string(), body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_create_photo', args as Record<string, unknown>),
  );

  server.registerTool(
    'hcm_search_time_event_requests',
    {
      description: 'Search official timeEventRequests (clock in/out events).',
      inputSchema: listArgs,
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(
        () =>
          ctx.client.list('timeEventRequests', {
            q: args.q,
            limit: args.limit ?? 25,
            offset: args.offset ?? 0,
          }),
        ctx,
        'hcm_search_time_event_requests',
      ),
  );
  bindExecutor(ctx, 'hcm_submit_time_event', async (args) =>
    ctx.client.postJson('timeEventRequests', args.body ?? args),
  );
  server.registerTool(
    'hcm_submit_time_event',
    {
      description: 'POST timeEventRequests (clock in/out). Distinct from timeRecordEventRequests submit.',
      inputSchema: { body: z.record(z.unknown()) },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_submit_time_event', args as Record<string, unknown>),
  );

  const lov = (tool: string, path: string, desc: string) => {
    server.registerTool(
      tool,
      { description: desc, inputSchema: listArgs, annotations: { readOnlyHint: true } },
      async (args) =>
        runRead(
          () => ctx.client.list(path, { q: args.q, finder: args.finder, limit: args.limit ?? 25 }),
          ctx,
          tool,
        ),
    );
  };
  lov('hcm_list_jobs_lov', 'jobsLov', 'Official jobsLov collection.');
  lov('hcm_list_grades_lov', 'gradesLov', 'Official gradesLov collection.');
  lov('hcm_list_grade_ladders_lov', 'gradeLaddersLov', 'Official gradeLaddersLov collection.');
  lov('hcm_list_grade_rates_lov', 'gradeRatesLOV', 'Official gradeRatesLOV collection.');
  lov('hcm_list_locations_lov', 'locationsLov', 'Official locationsLov collection.');

  const nested = (
    tool: string,
    parent: string,
    child: string,
    idField: string,
    parentArg: string,
    desc: string,
  ) => {
    server.registerTool(
      tool,
      {
        description: desc,
        inputSchema: { ...listArgs, [parentArg]: z.string().optional() },
        annotations: { readOnlyHint: true },
      },
      async (args) =>
        runRead(
          () => {
            const rec = args as Record<string, unknown>;
            return listNestedChild(ctx.client, parent, child, idField, {
              parentId: rec[parentArg] as string | undefined,
              q: rec.q as string | undefined,
              limit: rec.limit as number | undefined,
              offset: rec.offset as number | undefined,
            });
          },
          ctx,
          tool,
        ),
    );
  };
  nested(
    'hcm_list_requisition_skills',
    'recruitingJobRequisitions',
    'skills',
    'RequisitionId',
    'requisitionId',
    'Official recruitingJobRequisitions/{id}/child/skills.',
  );
  nested(
    'hcm_list_requisition_attachments',
    'recruitingJobRequisitions',
    'attachments',
    'RequisitionId',
    'requisitionId',
    'Official recruitingJobRequisitions/{id}/child/attachments.',
  );
  nested(
    'hcm_list_published_jobs',
    'recruitingJobRequisitions',
    'publishedJobs',
    'RequisitionId',
    'requisitionId',
    'Official recruitingJobRequisitions/{id}/child/publishedJobs.',
  );
  nested(
    'hcm_list_candidate_citizenships',
    'recruitingCandidates',
    'citizenships',
    'CandidateId',
    'candidateId',
    'Official recruitingCandidates/{id}/child/citizenships.',
  );
  nested(
    'hcm_search_benefit_costs',
    'benefitEnrollments',
    'costs',
    'EnrollmentId',
    'enrollmentId',
    'Official benefitEnrollments/{id}/child/costs.',
  );
  nested(
    'hcm_search_benefit_providers',
    'benefitEnrollments',
    'providers',
    'EnrollmentId',
    'enrollmentId',
    'Official benefitEnrollments/{id}/child/providers.',
  );

  server.registerTool(
    'hcm_list_assignment_grade_steps',
    {
      description:
        'Official workers/{id}/child/workRelationships/{wr}/child/assignments/{asg}/child/gradeSteps.',
      inputSchema: {
        workerId: z.string(),
        assignmentId: z.string().optional(),
        periodOfServiceId: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        const { items } = await listWorkerAssignments(ctx.client, args.workerId);
        const asg = args.assignmentId
          ? items.find((a) => String(a.AssignmentId) === args.assignmentId)
          : items[0];
        if (!asg) throw new Error('Assignment not found');
        const wr = String(args.periodOfServiceId ?? asg.PeriodOfServiceId ?? '');
        return ctx.client.list(
          `workers/${encodeURIComponent(args.workerId)}/child/workRelationships/${encodeURIComponent(wr)}/child/assignments/${encodeURIComponent(String(asg.AssignmentId))}/child/gradeSteps`,
        );
      }, ctx, 'hcm_list_assignment_grade_steps'),
  );

  server.registerTool(
    'hcm_download_document_attachments',
    {
      description: 'POST documentRecords/action/downloadAttachments.',
      inputSchema: { documentRecordId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(
        () =>
          ctx.client.postJson('documentRecords/action/downloadAttachments', {
            DocumentsOfRecordId: args.documentRecordId,
          }),
        ctx,
        'hcm_download_document_attachments',
      ),
  );
  bindExecutor(ctx, 'hcm_generate_document_letter', async (args) =>
    ctx.client.postJson('documentRecords/action/generateDraftLetter', {
      DocumentsOfRecordId: args.documentRecordId,
    }),
  );
  server.registerTool(
    'hcm_generate_document_letter',
    {
      description: 'POST documentRecords/action/generateDraftLetter. Approval-gated unless --write.',
      inputSchema: { documentRecordId: z.string() },
      annotations: { readOnlyHint: false },
    },
    async (args) => gateWrite(ctx, 'hcm_generate_document_letter', args as Record<string, unknown>),
  );
  server.registerTool(
    'hcm_find_document_records_advanced',
    {
      description: 'POST documentRecords/action/findByAdvancedSearchQuery.',
      inputSchema: { searchTerms: z.string().optional(), q: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(
        () =>
          ctx.client.postJson('documentRecords/action/findByAdvancedSearchQuery', {
            searchTerms: args.searchTerms ?? args.q,
          }),
        ctx,
        'hcm_find_document_records_advanced',
      ),
  );
}
