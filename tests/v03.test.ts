import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDummyApp } from '../src/dummy-hcm/index.js';
import { seedStore } from '../src/dummy-hcm/data.js';
import type { Server } from 'node:http';
import type { Config } from '../src/config.js';
import { createMcpServer, createToolContext } from '../src/mcp/server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { redactDeep } from '../src/platform/redact.js';
import { isSensitiveTool } from '../src/policy/sensitive.js';
import { RateLimiter } from '../src/platform/rateLimit.js';

let server: Server;
let baseUrl: string;

function cfg(overrides: Partial<Config> = {}): Config {
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

async function withClient(config: Config, fn: (c: Client) => Promise<void>) {
  const ctx = createToolContext(config);
  const mcp = createMcpServer(config, ctx);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([mcp.connect(serverTransport), client.connect(clientTransport)]);
  try {
    await fn(client);
  } finally {
    await client.close();
    await mcp.close();
  }
}

function parse(result: { content: { type: string; text?: string }[] }) {
  const text = result.content.find((c) => c.type === 'text')?.text ?? '{}';
  return JSON.parse(text);
}

beforeAll(async () => {
  const app = createDummyApp(seedStore());
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  baseUrl = `http://127.0.0.1:${addr.port}/hcmRestApi`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe('v0.3 tools against dummy', () => {
  it('lists many tools including setup and recruiting', async () => {
    await withClient(cfg(), async (client) => {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain('hcm_setup_status');
      expect(names).toContain('hcm_search_requisitions');
      expect(names).toContain('hcm_list_atom_entries');
      expect(names).toContain('hcm_get_payslip');
      expect(names).toContain('hcm_explain_tool');
      expect(names.length).toBeGreaterThan(80);
    });
  });

  it('atom + recruiting + benefits reads', async () => {
    await withClient(cfg(), async (client) => {
      const atom = parse(await client.callTool({ name: 'hcm_list_atom_entries', arguments: {} }));
      expect(atom.items?.length).toBeGreaterThan(0);
      const req = parse(await client.callTool({ name: 'hcm_search_requisitions', arguments: {} }));
      expect(req.items[0].RequisitionId).toBe('REQ1');
      const ben = parse(await client.callTool({ name: 'hcm_search_benefit_enrollments', arguments: {} }));
      expect(ben.items[0].EnrollmentId).toBe('BE1');
    });
  });

  it('checklist allocate goes pending then approve', async () => {
    await withClient(cfg(), async (client) => {
      const pending = parse(
        await client.callTool({
          name: 'hcm_allocate_checklist',
          arguments: { body: { PersonNumber: 'P1001', ChecklistName: 'Security' } },
        }),
      );
      expect(pending.pending_approval).toBe(true);
      const approved = parse(
        await client.callTool({
          name: 'hcm_approve_write',
          arguments: { approval_id: pending.approval_id, approval_token: 'test-approval-token' },
        }),
      );
      expect(approved.approved).toBe(true);
      expect(approved.result.AllocatedChecklistId).toBeTruthy();
    });
  });

  it('sensitive payslip blocked without ORACLE_HCM_SENSITIVE', async () => {
    await withClient(cfg(), async (client) => {
      const r = await client.callTool({ name: 'hcm_get_payslip', arguments: { payslipId: 'PS1' } });
      expect(r.isError).toBe(true);
      const body = parse(r);
      expect(body.error).toMatch(/ORACLE_HCM_SENSITIVE/);
    });
  });

  it('sensitive payslip executes with sensitive flag (reads are not queued)', async () => {
    await withClient(cfg({ sensitiveEnabled: true }), async (client) => {
      const ps = parse(
        await client.callTool({ name: 'hcm_get_payslip', arguments: { payslipId: 'PS1' } }),
      );
      expect(ps.pending_approval).toBeUndefined();
      expect(ps.PayslipId).toBe('PS1');
      expect(ps.NetPay).toBe(8500);
    });
  });

  it('setup status + emit mcp config redacted', async () => {
    await withClient(cfg(), async (client) => {
      const status = parse(await client.callTool({ name: 'hcm_setup_status', arguments: {} }));
      expect(status.unofficial).toBe(true);
      expect(status.hasPassword).toBe(true);
      expect(status).not.toHaveProperty('password');
      const mcp = parse(await client.callTool({ name: 'hcm_emit_mcp_config', arguments: {} }));
      expect(mcp.mcpServers['oracle-hcm'].env.ORACLE_HCM_PASSWORD).toBe('${ORACLE_HCM_PASSWORD}');
    });
  });

  it('dry_run_mutate and explain_tool', async () => {
    await withClient(cfg(), async (client) => {
      const dry = parse(
        await client.callTool({
          name: 'hcm_dry_run_mutate',
          arguments: { method: 'POST', path: 'absences', body: { x: 1 } },
        }),
      );
      expect(dry.ok).toBe(true);
      const blocked = parse(
        await client.callTool({
          name: 'hcm_dry_run_mutate',
          arguments: { method: 'POST', path: 'ce/generativeAi/chat', body: {} },
        }),
      );
      expect(blocked.blocked).toBe(true);
      const expl = parse(
        await client.callTool({ name: 'hcm_explain_tool', arguments: { name: 'hcm_create_absence' } }),
      );
      expect(expl.class).toBe('write');
    });
  });

  it('direct reports + org hierarchy + lov finder', async () => {
    await withClient(cfg(), async (client) => {
      const reports = parse(
        await client.callTool({
          name: 'hcm_list_direct_reports',
          arguments: { managerPersonNumber: 'P1001' },
        }),
      );
      expect(reports.items.some((w: { PersonNumber: string }) => w.PersonNumber === 'P1002')).toBe(true);
      const hier = parse(
        await client.callTool({ name: 'hcm_get_org_hierarchy', arguments: { organizationId: 'O1' } }),
      );
      expect(hier.children.length).toBeGreaterThan(0);
      const lov = parse(
        await client.callTool({
          name: 'hcm_lov_finder',
          arguments: { resource: 'locations', finder: 'findByCountry', q: 'Country=US' },
        }),
      );
      expect(lov.items.length).toBeGreaterThan(0);
    });
  });

  it('submit time card pending via timeRecordEventRequests', async () => {
    await withClient(cfg({ writeMode: true }), async (client) => {
      const tc = parse(
        await client.callTool({
          name: 'hcm_submit_time_card',
          arguments: { body: { PersonNumber: 'P1001' } },
        }),
      );
      expect(tc.Status).toBe('SUBMITTED');
    });
  });
});

describe('platform helpers', () => {
  it('redacts secrets and masks national ids', () => {
    const out = redactDeep({
      password: 'secret',
      NationalIdentifierNumber: '123-45-6789',
      ok: true,
    }) as Record<string, unknown>;
    expect(out.password).toBe('[REDACTED]');
    expect(String(out.NationalIdentifierNumber).endsWith('6789')).toBe(true);
  });

  it('marks payslip sensitive', () => {
    expect(isSensitiveTool('hcm_get_payslip')).toBe(true);
  });

  it('rate limiter allows takes', async () => {
    const rl = new RateLimiter(5, 100);
    await rl.take();
    await rl.take();
  });
});
