/**
 * In-memory pending write intents. Skipped entirely when --write is set.
 */

import { randomUUID } from 'node:crypto';

export interface PendingIntent {
  approvalId: string;
  toolName: string;
  args: Record<string, unknown>;
  summary: string;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'approved' | 'denied' | 'executed' | 'expired';
}

export type ExecuteFn = (toolName: string, args: Record<string, unknown>) => Promise<unknown>;

export class ApprovalStore {
  private intents = new Map<string, PendingIntent>();
  private ttlMs: number;

  constructor(ttlMs = 15 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  create(toolName: string, args: Record<string, unknown>, summary: string): PendingIntent {
    this.purgeExpired();
    const now = Date.now();
    const intent: PendingIntent = {
      approvalId: randomUUID(),
      toolName,
      args,
      summary,
      createdAt: now,
      expiresAt: now + this.ttlMs,
      status: 'pending',
    };
    this.intents.set(intent.approvalId, intent);
    return intent;
  }

  get(approvalId: string): PendingIntent | undefined {
    this.purgeExpired();
    return this.intents.get(approvalId);
  }

  listPending(): PendingIntent[] {
    this.purgeExpired();
    return [...this.intents.values()].filter((i) => i.status === 'pending');
  }

  deny(approvalId: string): PendingIntent {
    const intent = this.requirePending(approvalId);
    intent.status = 'denied';
    return intent;
  }

  async approve(approvalId: string, execute: ExecuteFn): Promise<{ intent: PendingIntent; result: unknown }> {
    const intent = this.requirePending(approvalId);
    intent.status = 'approved';
    const result = await execute(intent.toolName, intent.args);
    intent.status = 'executed';
    return { intent, result };
  }

  private requirePending(approvalId: string): PendingIntent {
    this.purgeExpired();
    const intent = this.intents.get(approvalId);
    if (!intent) throw new Error(`Unknown approval_id: ${approvalId}`);
    if (intent.status === 'expired' || intent.expiresAt < Date.now()) {
      intent.status = 'expired';
      throw new Error(`Approval expired: ${approvalId}`);
    }
    if (intent.status !== 'pending') {
      throw new Error(`Approval not pending (status=${intent.status}): ${approvalId}`);
    }
    return intent;
  }

  purgeExpired(): void {
    const now = Date.now();
    for (const [id, intent] of this.intents) {
      if (intent.status === 'pending' && intent.expiresAt < now) {
        intent.status = 'expired';
      }
      // drop old terminal intents after 1h
      if (intent.status !== 'pending' && now - intent.createdAt > 60 * 60 * 1000) {
        this.intents.delete(id);
      }
    }
  }

  clear(): void {
    this.intents.clear();
  }
}

export function summarizeMutation(toolName: string, args: Record<string, unknown>): string {
  const keys = Object.keys(args).slice(0, 8);
  const brief = keys
    .map((k) => {
      const v = args[k];
      const s = typeof v === 'string' ? v : JSON.stringify(v);
      return `${k}=${(s ?? '').slice(0, 80)}`;
    })
    .join(', ');
  return `${toolName}(${brief})`;
}
