import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { HcmClient } from '../../client/hcmClient.js';
import type { ApprovalStore } from '../../policy/approval.js';
import { summarizeMutation } from '../../policy/approval.js';
import { isWriteTool } from '../../policy/classify.js';

export type ToolContext = {
  client: HcmClient;
  approvals: ApprovalStore;
  writeMode: boolean;
};

export function jsonResult(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
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
        text: JSON.stringify({ error: message, ...extra }, null, 2),
      },
    ],
  };
}

/**
 * Gate write tools: in approval mode return pending_approval; in --write execute immediately.
 */
export async function gateWrite(
  ctx: ToolContext,
  toolName: string,
  args: Record<string, unknown>,
  execute: () => Promise<unknown>,
): Promise<CallToolResult> {
  try {
    if (!isWriteTool(toolName) || ctx.writeMode) {
      return jsonResult(await execute());
    }
    const summary = summarizeMutation(toolName, args);
    const intent = ctx.approvals.create(toolName, args, summary);
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

export async function runRead(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return jsonResult(await fn());
  } catch (err) {
    return errorResult(err);
  }
}
