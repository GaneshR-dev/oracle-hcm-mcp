import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { HcmClient } from '../../client/hcmClient.js';
import type { ApprovalStore } from '../../policy/approval.js';
import { summarizeMutation } from '../../policy/approval.js';
import { isWriteTool } from '../../policy/classify.js';
import { isSensitiveTool } from '../../policy/sensitive.js';
import type { Config } from '../../config.js';
import { redactDeep } from '../../platform/redact.js';
import type { WebhookReceiver } from '../../platform/webhookStub.js';

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
};

export function bindExecutor(
  ctx: ToolContext,
  toolName: string,
  execute: WriteExecutor,
): void {
  ctx.executors.set(toolName, execute);
}

export function jsonResult(data: unknown, redact = true): CallToolResult {
  const payload = redact ? redactDeep(data) : data;
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
 * Gate write tools. Sensitive tools always need approval unless
 * ORACLE_HCM_SENSITIVE=1 and ORACLE_HCM_SENSITIVE_WRITE=1 with --write.
 */
export async function gateWrite(
  ctx: ToolContext,
  toolName: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  try {
    const exec = ctx.executors.get(toolName);
    if (!exec) throw new Error(`No executor for ${toolName}`);

    if (isSensitiveTool(toolName)) {
      if (!ctx.config.sensitiveEnabled) {
        return errorResult(
          new Error(
            `${toolName} is gated. Set ORACLE_HCM_SENSITIVE=1 to enable payslip/bank/national-ID style tools.`,
          ),
        );
      }
      const allowImmediate = ctx.writeMode && ctx.config.sensitiveWriteEnabled;
      if (!allowImmediate) {
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
            'Sensitive tool requires approval even in --write unless ORACLE_HCM_SENSITIVE_WRITE=1. Use hcm_approve_write.',
        });
      }
      const result = await exec(args);
      audit(ctx, toolName, 'sensitive', summarizeMutation(toolName, args));
      return jsonResult(result);
    }

    if (!isWriteTool(toolName) || ctx.writeMode) {
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
        'Write requires human approval. Call hcm_approve_write with approval_id, or hcm_deny_write to cancel.',
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
