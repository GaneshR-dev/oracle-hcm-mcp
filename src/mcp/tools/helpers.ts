import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { HcmClient } from '../../client/hcmClient.js';
import type { ApprovalStore } from '../../policy/approval.js';
import { summarizeMutation } from '../../policy/approval.js';
import { isWriteTool } from '../../policy/classify.js';
import { isSensitiveTool } from '../../policy/sensitive.js';
import type { Config } from '../../config.js';
import { redactDeep } from '../../platform/redact.js';
import type { WebhookReceiver } from '../../platform/webhookStub.js';
import type { CheckpointStore, ParsedAtomEntry } from '../../platform/atomCdc.js';
import { safeEqual } from '../../policy/cryptoSafe.js';
import { resolveAtomFeed } from '../../policy/atom.js';

/** Flatten workers/{id}?expand=workRelationships.assignments into assignment rows. */
export async function listWorkerAssignments(
  client: HcmClient,
  workerId: string,
): Promise<{
  worker: Record<string, unknown>;
  items: Record<string, unknown>[];
}> {
  const worker = (await client.getJson(`workers/${encodeURIComponent(workerId)}`, {
    expand: 'workRelationships.assignments',
  })) as Record<string, unknown>;
  const items: Record<string, unknown>[] = [];
  const wrs = (worker.workRelationships as
    | { PeriodOfServiceId?: string; assignments?: Record<string, unknown>[] }[]
    | undefined) ?? [];
  for (const wr of wrs) {
    for (const a of wr.assignments ?? []) {
      items.push({ ...a, PeriodOfServiceId: wr.PeriodOfServiceId, WorkerId: workerId });
    }
  }
  return { worker, items };
}

/** PATCH nested Fusion assignment: workers/{id}/child/workRelationships/{wr}/child/assignments/{asg}. */
export async function patchWorkerAssignment(
  client: HcmClient,
  workerId: string,
  assignmentId: string,
  body: unknown,
  periodOfServiceId?: string,
): Promise<unknown> {
  let wrId = periodOfServiceId;
  if (!wrId) {
    const { items } = await listWorkerAssignments(client, workerId);
    wrId = items.find((a) => String(a.AssignmentId) === assignmentId)?.PeriodOfServiceId as
      | string
      | undefined;
  }
  if (!wrId) {
    throw new Error(`Assignment ${assignmentId} not found under workers/${workerId} workRelationships`);
  }
  return client.patchJson(
    `workers/${encodeURIComponent(workerId)}/child/workRelationships/${encodeURIComponent(wrId)}/child/assignments/${encodeURIComponent(assignmentId)}`,
    body,
  );
}

/** Resolve assignmentId → worker + nested PATCH using official workers child path. */
export async function patchAssignmentById(
  client: HcmClient,
  assignmentId: string,
  body: unknown,
  workerId?: string,
  periodOfServiceId?: string,
): Promise<unknown> {
  let wid = workerId;
  if (!wid) {
    const workers = await client.list('workers', { limit: 100 });
    for (const w of workers.items as { WorkerId?: string }[]) {
      const id = String(w.WorkerId ?? '');
      if (!id) continue;
      const { items } = await listWorkerAssignments(client, id);
      if (items.some((a) => String(a.AssignmentId) === assignmentId)) {
        wid = id;
        break;
      }
    }
  }
  if (!wid) throw new Error(`Assignment ${assignmentId} not found under workers`);
  return patchWorkerAssignment(client, wid, assignmentId, body, periodOfServiceId);
}

export type WorkerChildName =
  | 'emails'
  | 'phones'
  | 'nationalIdentifiers'
  | 'legislativeInfo'
  | 'addresses'
  | 'names'
  | 'photos'
  | 'citizenships'
  | 'visasPermits'
  | 'passports'
  | 'disabilities'
  | 'driverLicenses'
  | 'ethnicities'
  | 'religions'
  | 'externalIdentifiers'
  | 'otherCommunicationAccounts'
  | 'messages';

/** GET workers/{id}/child/{child} across one or all workers (official nested collections). */
export async function listWorkerChild(
  client: HcmClient,
  child: WorkerChildName,
  opts: { workerId?: string; q?: string; limit?: number; offset?: number } = {},
): Promise<{ items: Record<string, unknown>[]; count: number; hasMore: boolean }> {
  const workerIds: { WorkerId: string; PersonNumber?: string }[] = [];
  if (opts.workerId) {
    workerIds.push({ WorkerId: opts.workerId });
  } else {
    const list = await client.list('workers', { limit: opts.limit ?? 100, offset: opts.offset ?? 0 });
    for (const w of list.items as { WorkerId?: string; PersonNumber?: string }[]) {
      if (w.WorkerId) workerIds.push({ WorkerId: String(w.WorkerId), PersonNumber: w.PersonNumber });
    }
  }
  const items: Record<string, unknown>[] = [];
  for (const w of workerIds) {
    try {
      const nested = await client.list(
        `workers/${encodeURIComponent(w.WorkerId)}/child/${child}`,
        { limit: 100 },
      );
      for (const row of nested.items as Record<string, unknown>[]) {
        items.push({ ...row, WorkerId: w.WorkerId, PersonNumber: w.PersonNumber ?? row.PersonNumber });
      }
    } catch {
      /* pod may 404 a child — skip */
    }
  }
  let filtered = items;
  if (opts.q) {
    const lower = opts.q.toLowerCase();
    filtered = items.filter((it) => JSON.stringify(it).toLowerCase().includes(lower));
  }
  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;
  const slice = filtered.slice(offset, offset + limit);
  return { items: slice, count: filtered.length, hasMore: offset + slice.length < filtered.length };
}

export async function getWorkerChildById(
  client: HcmClient,
  child: WorkerChildName,
  id: string,
  idFields: string[],
): Promise<Record<string, unknown>> {
  const { items } = await listWorkerChild(client, child, { limit: 200 });
  const found = items.find((it) => idFields.some((f) => String(it[f] ?? '') === id));
  if (!found) throw new Error(`${child} id ${id} not found under workers/*/child/${child}`);
  return found;
}

export async function postWorkerChild(
  client: HcmClient,
  workerId: string,
  child: WorkerChildName,
  body: unknown,
): Promise<unknown> {
  return client.postJson(`workers/${encodeURIComponent(workerId)}/child/${child}`, body);
}

export async function patchWorkerChild(
  client: HcmClient,
  workerId: string,
  child: WorkerChildName,
  childId: string,
  body: unknown,
): Promise<unknown> {
  return client.patchJson(
    `workers/${encodeURIComponent(workerId)}/child/${child}/${encodeURIComponent(childId)}`,
    body,
  );
}

export async function listNestedChild(
  client: HcmClient,
  parentRoot: string,
  child: string,
  idField: string,
  opts: { parentId?: string; q?: string; limit?: number; offset?: number } = {},
): Promise<{ items: Record<string, unknown>[]; count: number; hasMore: boolean }> {
  const ids: string[] = [];
  if (opts.parentId) {
    ids.push(opts.parentId);
  } else {
    const list = await client.list(parentRoot, { limit: opts.limit ?? 50, offset: opts.offset ?? 0 });
    for (const row of list.items as Record<string, unknown>[]) {
      const id = row[idField];
      if (id != null) ids.push(String(id));
    }
  }
  const items: Record<string, unknown>[] = [];
  for (const id of ids) {
    try {
      const nested = await client.list(`${parentRoot}/${encodeURIComponent(id)}/child/${child}`);
      for (const row of nested.items as Record<string, unknown>[]) {
        items.push({ ...row, [idField]: id });
      }
    } catch {
      /* skip */
    }
  }
  let filtered = items;
  if (opts.q) {
    const lower = opts.q.toLowerCase();
    filtered = items.filter((it) => JSON.stringify(it).toLowerCase().includes(lower));
  }
  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;
  const slice = filtered.slice(offset, offset + limit);
  return { items: slice, count: filtered.length, hasMore: offset + slice.length < filtered.length };
}

/** Official Atom servlet list. `collection` is workspace/collection, collection name, or "all". */
export async function listOfficialAtom(
  client: HcmClient,
  collection?: string,
  query?: Record<string, string | number | undefined>,
): Promise<{ feedId: string; workspace: string; collection: string; items: ParsedAtomEntry[]; count: number }> {
  const feed = resolveAtomFeed(collection);
  const list = await client.listAtom(feed.workspace, feed.collection, query);
  return {
    feedId: `atom:${feed.workspace}/${feed.collection}`,
    workspace: feed.workspace,
    collection: feed.collection,
    items: list.items,
    count: list.count ?? list.items.length,
  };
}

export type WriteExecutor = (args: Record<string, unknown>) => Promise<unknown>;

export type AuditEntry = {
  ts: string;
  tool: string;
  kind: 'read' | 'write' | 'sensitive' | 'approval' | 'deny' | 'dry_run';
  summary: string;
};

export type ToolContext = {
  client: HcmClient;
  approvals: ApprovalStore;
  writeMode: boolean;
  config: Config;
  executors: Map<string, WriteExecutor>;
  auditTrail: AuditEntry[];
  webhook?: WebhookReceiver;
  atomCheckpoints: CheckpointStore;
};

export function bindExecutor(
  ctx: ToolContext,
  toolName: string,
  execute: WriteExecutor,
): void {
  ctx.executors.set(toolName, execute);
}

export function jsonResult(data: unknown, redact = true, tool?: string): CallToolResult {
  const payload = redact ? redactDeep(data, 0, { tool, audit: true }) : data;
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  };
}

export function errorResult(err: unknown): CallToolResult {
  const message = err instanceof Error ? err.message : String(err);
  const extra =
    err && typeof err === 'object' && 'status' in err
      ? { status: (err as { status: number }).status, body: (err as { body?: unknown }).body }
      : undefined;
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: JSON.stringify(redactDeep({ error: message, ...extra }), null, 2),
      },
    ],
  };
}

function audit(
  ctx: ToolContext,
  tool: string,
  kind: AuditEntry['kind'],
  summary: string,
): void {
  ctx.auditTrail.push({
    ts: new Date().toISOString(),
    tool,
    kind,
    summary: summary.slice(0, 240),
  });
  if (ctx.auditTrail.length > 500) {
    ctx.auditTrail.splice(0, ctx.auditTrail.length - 400);
  }
}

export function recordAudit(
  ctx: ToolContext,
  tool: string,
  kind: AuditEntry['kind'],
  summary: string,
): void {
  audit(ctx, tool, kind, summary);
}

/**
 * Approvals are a separate principal. The agent that queued the write does not
 * receive this token in any tool result; a human/ops client must pass it.
 */
export function requireApprovalToken(ctx: ToolContext, args: Record<string, unknown>): void {
  const expected = ctx.config.approvalToken;
  if (!expected) {
    throw new Error(
      'Approvals are locked: set ORACLE_HCM_APPROVAL_TOKEN (printed on stderr at startup if generated). This token is never returned by tools.',
    );
  }
  const provided = String(args.approval_token ?? args.approvalToken ?? '');
  if (!provided || !safeEqual(provided, expected)) {
    throw new Error(
      'Invalid or missing approval_token. Pass the human/ops token from ORACLE_HCM_APPROVAL_TOKEN — it is never included in pending_approval payloads.',
    );
  }
}

/**
 * Gate write tools.
 *
 * **`--write` / ORACLE_HCM_WRITE=1 bypasses everything**: no approval queue,
 * no SENSITIVE gate, mutations run immediately (including payslip/bank/comp).
 *
 * Default (approval) mode:
 * - Sensitive reads need ORACLE_HCM_SENSITIVE=1, then execute (resource-root gated too).
 * - Sensitive writes need the flag, then queue for a *different principal* (approval token).
 * - Other writes queue for approval.
 */
export async function gateWrite(
  ctx: ToolContext,
  toolName: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  try {
    const exec = ctx.executors.get(toolName);
    if (!exec) throw new Error(`No executor for ${toolName}`);

    if (ctx.writeMode) {
      const result = await exec(args);
      audit(
        ctx,
        toolName,
        isSensitiveTool(toolName) ? 'sensitive' : 'write',
        summarizeMutation(toolName, args),
      );
      return jsonResult(result);
    }

    if (isSensitiveTool(toolName)) {
      if (!ctx.config.sensitiveEnabled) {
        return errorResult(
          new Error(
            `${toolName} is gated. Set ORACLE_HCM_SENSITIVE=1 to enable payslip/bank/national-ID style tools in default (approval) mode. Or use --write / ORACLE_HCM_WRITE=1 to bypass.`,
          ),
        );
      }
      if (!isWriteTool(toolName)) {
        const result = await exec(args);
        audit(ctx, toolName, 'sensitive', summarizeMutation(toolName, args));
        return jsonResult(result);
      }
      const summary = summarizeMutation(toolName, args);
      const intent = ctx.approvals.create(toolName, args, summary);
      audit(ctx, toolName, 'sensitive', `pending:${intent.approvalId}`);
      return jsonResult({
        pending_approval: true,
        sensitive: true,
        approval_id: intent.approvalId,
        tool: toolName,
        summary: intent.summary,
        expires_at: new Date(intent.expiresAt).toISOString(),
        message:
          'Sensitive write queued. Approve out-of-band with ORACLE_HCM_APPROVAL_TOKEN (Approval UI or hcm_approve_write). The token is never returned here. Or use --write to bypass.',
      });
    }

    if (!isWriteTool(toolName)) {
      const result = await exec(args);
      audit(ctx, toolName, 'write', summarizeMutation(toolName, args));
      return jsonResult(result);
    }

    const summary = summarizeMutation(toolName, args);
    const intent = ctx.approvals.create(toolName, args, summary);
    audit(ctx, toolName, 'write', `pending:${intent.approvalId}`);
    return jsonResult({
      pending_approval: true,
      approval_id: intent.approvalId,
      tool: toolName,
      summary: intent.summary,
      expires_at: new Date(intent.expiresAt).toISOString(),
      message:
        'Write queued for a human/ops principal. Approve via Approval UI (HTTP + bearer token) or hcm_approve_write with approval_token=ORACLE_HCM_APPROVAL_TOKEN. The same agent session does not receive this token.',
    });
  } catch (err) {
    return errorResult(err);
  }
}

export async function runRead(
  fn: () => Promise<unknown>,
  ctx?: ToolContext,
  tool?: string,
): Promise<CallToolResult> {
  try {
    const data = await fn();
    if (ctx && tool) audit(ctx, tool, 'read', tool);
    return jsonResult(data);
  } catch (err) {
    return errorResult(err);
  }
}

export async function executeApproved(
  ctx: ToolContext,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const fn = ctx.executors.get(toolName);
  if (!fn) throw new Error(`No executor registered for pending tool: ${toolName}`);
  return fn(args);
}
