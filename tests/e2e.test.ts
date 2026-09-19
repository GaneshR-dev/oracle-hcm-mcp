import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDummyApp } from '../src/dummy-hcm/index.js';
import { seedStore } from '../src/dummy-hcm/data.js';
import type { Server } from 'node:http';
import { HcmClient } from '../src/client/hcmClient.js';
import type { Config } from '../src/config.js';
import { ApprovalStore } from '../src/policy/approval.js';
import { createMcpServer, createToolContext } from '../src/mcp/server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

let server: Server;
let baseUrl: string;
let port: number;

function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    baseUrl,
    apiVersion: '11.13.18.05',
    writeMode: false,
    sensitiveEnabled: false,
    sensitiveWriteEnabled: false,
    authMode: 'basic',
    username: 'demo',
    password: 'demo',
    approvalToken: 'test-approval-token',
    httpToken: 'test-http-token',
    approvalTtlMs: 60_000,
    approvalStore: 'memory',
    transport: 'stdio',
    ...overrides,
  };
}

beforeAll(async () => {
  const app = createDummyApp(seedStore());
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  port = addr.port;
  baseUrl = `http://127.0.0.1:${port}/hcmRestApi`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe('HcmClient against dummy', () => {
  it('reads workers', async () => {
    const client = new HcmClient(testConfig());
    const list = await client.list('workers', { limit: 10 });
    expect(list.items.length).toBeGreaterThan(0);
    const w = await client.getJson<{ WorkerId: string }>(`workers/${(list.items[0] as { WorkerId: string }).WorkerId}`);
    expect(w.WorkerId).toBeTruthy();
  });

  it('health ok', async () => {
    const client = new HcmClient(testConfig());
    const h = await client.health();
    expect(h.ok).toBe(true);
  });

  it('blocks allowlist violations', async () => {
    const client = new HcmClient(testConfig());
    await expect(client.restGet('ce/generativeAi/chat')).rejects.toThrow(/blocked/i);
  });
});

async function withMcpClient(cfg: Config, fn: (c: Client) => Promise<void>) {
  const ctx = createToolContext(cfg);
  const mcp = createMcpServer(cfg, ctx);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.1' });
  await Promise.all([mcp.connect(serverTransport), client.connect(clientTransport)]);
  try {
    await fn(client);
  } finally {
    await client.close();
    await mcp.close();
  }
}

function parseTool(result: { content: Array<{ type: string; text?: string }> }) {
  const text = result.content.find((c) => c.type === 'text')?.text ?? '{}';
  return JSON.parse(text);
}

describe('MCP E2E approval mode', () => {
  it('read tools work', async () => {
    await withMcpClient(testConfig({ writeMode: false }), async (client) => {
      const tools = await client.listTools();
      const names = tools.tools.map((t) => t.name);
      expect(names).toContain('hcm_search_workers');
      expect(names).toContain('hcm_approve_write');
      expect(names).toContain('hcm_deny_write');

      const health = parseTool(await client.callTool({ name: 'hcm_health', arguments: {} }));
      expect(health.ok).toBe(true);

      const workers = parseTool(
        await client.callTool({ name: 'hcm_search_workers', arguments: { limit: 5 } }),
      );
      expect(workers.items.length).toBeGreaterThan(0);
    });
  });

  it('write returns pending then approve executes', async () => {
    await withMcpClient(testConfig({ writeMode: false }), async (client) => {
      const pending = parseTool(
        await client.callTool({
          name: 'hcm_create_absence',
          arguments: {
            body: {
              personNumber: 'P1001',
              absenceType: 'Vacation',
              startDate: '2026-11-01',
              endDate: '2026-11-02',
            },
          },
        }),
      );
      expect(pending.pending_approval).toBe(true);
      expect(pending.approval_id).toBeTruthy();

      const approved = parseTool(
        await client.callTool({
          name: 'hcm_approve_write',
          arguments: { approval_id: pending.approval_id, approval_token: 'test-approval-token' },
        }),
      );
      expect(approved.approved).toBe(true);
      expect(approved.result.AbsenceId).toBeTruthy();
    });
  });

  it('deny cancels write', async () => {
    await withMcpClient(testConfig({ writeMode: false }), async (client) => {
      const pending = parseTool(
        await client.callTool({
          name: 'hcm_create_worker',
          arguments: { body: { FirstName: 'No', LastName: 'Write' } },
        }),
      );
      const denied = parseTool(
        await client.callTool({
          name: 'hcm_deny_write',
          arguments: { approval_id: pending.approval_id, approval_token: 'test-approval-token' },
        }),
      );
      expect(denied.denied).toBe(true);
    });
  });
});

describe('MCP E2E --write mode', () => {
  it('mutates immediately and has no approval tools', async () => {
    await withMcpClient(testConfig({ writeMode: true }), async (client) => {
      const tools = await client.listTools();
      const names = tools.tools.map((t) => t.name);
      // v0.3: approval tools remain registered so sensitive tools can still gate under --write
      expect(names).toContain('hcm_approve_write');
      expect(names).toContain('hcm_deny_write');

      const created = parseTool(
        await client.callTool({
          name: 'hcm_create_worker',
          arguments: { body: { FirstName: 'Grace', LastName: 'Hopper' } },
        }),
      );
      expect(created.pending_approval).toBeUndefined();
      expect(created.WorkerId).toBeTruthy();
      expect(created.FirstName).toBe('Grace');
    });
  });
});

describe('ApprovalStore unit with TTL', () => {
  it('expires intents', async () => {
    const store = new ApprovalStore(10);
    const intent = store.create('hcm_create_absence', { body: {} }, 's');
    await new Promise((r) => setTimeout(r, 20));
    expect(() => store.deny(intent.approvalId)).toThrow(/expired|Unknown/i);
  });
});

describe('Fusion path alignment against dummy', () => {
  it('reads planBalances and legacy absencesBalances alias', async () => {
    const client = new HcmClient(testConfig());
    const primary = await client.list('planBalances', { q: 'personNumber=P1001' });
    expect(primary.items.length).toBeGreaterThan(0);
    const legacy = await client.list('absencesBalances', { limit: 5 });
    expect(legacy.items.length).toBeGreaterThan(0);
    const one = await client.getJson<{ BalanceId: string }>('planBalances/B1');
    expect(one.BalanceId).toBe('B1');
  });

  it('lists businessProcessNotifications and performAction', async () => {
    const client = new HcmClient(testConfig());
    const list = await client.list('businessProcessNotifications', { limit: 5 });
    expect(list.items.length).toBeGreaterThan(0);
    const result = await client.postJson<{ actionResult: string; Status: string }>(
      'businessProcessNotifications/action/performAction',
      { taskId: 'N1', actionName: 'APPROVE', comment: 'unit' },
    );
    expect(result.actionResult).toBe('OK');
    expect(result.Status).toBe('APPROVE');
  });

  it('updates allocatedTasks via updateTaskStatus action', async () => {
    const client = new HcmClient(testConfig());
    const tasks = await client.list('allocatedChecklists/C1/child/allocatedTasks');
    expect(tasks.items.length).toBeGreaterThan(0);
    const updated = await client.postJson<{ status: string }>(
      'allocatedChecklists/C1/child/allocatedTasks/T2/action/updateTaskStatus',
      { status: 'COMPLETED' },
    );
    expect(updated.status).toBe('COMPLETED');
  });

  it('reads org LOVs, time, talent, payroll', async () => {
    const client = new HcmClient(testConfig());
    expect((await client.list('organizations')).items.length).toBeGreaterThan(0);
    expect((await client.list('locations')).items.length).toBeGreaterThan(0);
    expect((await client.list('jobs')).items.length).toBeGreaterThan(0);
    expect((await client.list('grades')).items.length).toBeGreaterThan(0);
    expect((await client.list('timeRecords')).items.length).toBeGreaterThan(0);
    expect((await client.list('talentPersonProfiles')).items.length).toBeGreaterThan(0);
    expect((await client.list('payrollRelationships')).items.length).toBeGreaterThan(0);
    expect((await client.list('workerAssignments', { q: 'WorkerId=1001' })).items.length).toBeGreaterThan(0);
  });
});
