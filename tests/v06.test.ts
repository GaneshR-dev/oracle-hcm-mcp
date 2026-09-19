import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDummyApp } from '../src/dummy-hcm/index.js';
import { seedStore } from '../src/dummy-hcm/data.js';
import type { Server } from 'node:http';
import type { Config } from '../src/config.js';
import { createMcpServer, createToolContext } from '../src/mcp/server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  WebhookReceiver,
  signWebhookBody,
} from '../src/platform/webhookStub.js';
import { applyProfileToConfig, DEFAULT_PROFILES } from '../src/platform/profiles.js';
import { getFieldMap, oracleToFriendly } from '../src/platform/fieldMaps.js';
import { extractRootsFromOpenApi, mergeAllowlistRoots } from '../src/platform/openapiAllowlist.js';
import { isAllowlistedPath } from '../src/policy/allowlist.js';
import { isSensitiveTool } from '../src/policy/sensitive.js';

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
  const client = new Client({ name: 'test-v06', version: '0.0.0' });
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

describe('v0.6 --write bypasses everything', () => {
  it('sensitive compensation update runs immediately under --write without SENSITIVE=1', async () => {
    await withClient(cfg({ writeMode: true, sensitiveEnabled: false }), async (c) => {
      const r = parse(
        await c.callTool({
          name: 'hcm_update_compensation',
          arguments: { compensationId: 'CH1', body: { Amount: 12000 } },
        }),
      );
      expect(r.pending_approval).toBeUndefined();
      expect(r.Amount ?? r.amount).toBeTruthy();
    });
  });

  it('sensitive salary bases search runs under --write without SENSITIVE', async () => {
    await withClient(cfg({ writeMode: true }), async (c) => {
      const r = parse(await c.callTool({ name: 'hcm_search_salary_bases', arguments: {} }));
      expect(r.pending_approval).toBeUndefined();
      expect(r.items?.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('sensitive still gated in default mode without SENSITIVE', async () => {
    await withClient(cfg({ writeMode: false, sensitiveEnabled: false }), async (c) => {
      const raw = await c.callTool({
        name: 'hcm_search_salary_bases',
        arguments: {},
      });
      expect(raw.isError).toBe(true);
    });
  });

  it('sensitive queues approval in default mode with SENSITIVE=1', async () => {
    await withClient(cfg({ writeMode: false, sensitiveEnabled: true }), async (c) => {
      const r = parse(await c.callTool({ name: 'hcm_search_salary_bases', arguments: {} }));
      expect(r.pending_approval).toBe(true);
      expect(r.sensitive).toBe(true);
    });
  });

  it('prod profile cannot turn off writeMode when --write set', () => {
    const prod = DEFAULT_PROFILES.find((p) => p.name === 'prod')!;
    const base = cfg({ writeMode: true });
    const next = applyProfileToConfig(base, prod);
    expect(next.writeMode).toBe(true);
  });
});

describe('v0.6 domains', () => {
  it('performance review cycles + feedback + check-ins', async () => {
    await withClient(cfg(), async (c) => {
      const cycles = parse(await c.callTool({ name: 'hcm_search_review_cycles', arguments: {} }));
      expect(cycles.items?.length).toBeGreaterThanOrEqual(1);
      const fb = parse(
        await c.callTool({
          name: 'hcm_create_feedback',
          arguments: { body: { PersonNumber: 'P1001', Comments: 'hi' } },
        }),
      );
      expect(fb.pending_approval).toBe(true);
    });
    await withClient(cfg({ writeMode: true }), async (c) => {
      const fb = parse(
        await c.callTool({
          name: 'hcm_create_feedback',
          arguments: { body: { PersonNumber: 'P1001', Comments: 'ok' } },
        }),
      );
      expect(fb.FeedbackId).toBeTruthy();
    });
  });

  it('learning assignments + completions', async () => {
    await withClient(cfg(), async (c) => {
      const a = parse(await c.callTool({ name: 'hcm_search_learning_assignments', arguments: {} }));
      expect(a.items?.length).toBeGreaterThanOrEqual(1);
      const comp = parse(await c.callTool({ name: 'hcm_list_learning_completions', arguments: {} }));
      expect(comp.items?.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('workforce structures + documents + journeys', async () => {
    await withClient(cfg(), async (c) => {
      const tree = parse(await c.callTool({ name: 'hcm_get_department_tree', arguments: {} }));
      expect(tree.tree).toBeTruthy();
      const jf = parse(await c.callTool({ name: 'hcm_search_job_families', arguments: {} }));
      expect(jf.items?.length).toBeGreaterThanOrEqual(1);
      const docs = parse(await c.callTool({ name: 'hcm_search_document_records', arguments: {} }));
      expect(docs.items?.length).toBeGreaterThanOrEqual(1);
      const j = parse(await c.callTool({ name: 'hcm_search_journeys', arguments: {} }));
      expect(j.items?.length).toBeGreaterThanOrEqual(1);
      const jt = parse(await c.callTool({ name: 'hcm_list_journey_tasks', arguments: { journeyId: 'JN1' } }));
      expect(jt.items?.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('absence entitlement preview + accrual by date + LOVs', async () => {
    await withClient(cfg(), async (c) => {
      const prev = parse(
        await c.callTool({
          name: 'hcm_preview_entitlement_calc',
          arguments: {
            body: {
              PersonNumber: 'P1001',
              absenceType: 'Vacation',
              startDate: '2026-10-01',
              endDate: '2026-10-03',
            },
          },
        }),
      );
      expect(prev.preview).toBe(true);
      expect(prev.requestedDays).toBe(3);
      const acc = parse(
        await c.callTool({
          name: 'hcm_accrual_balances_by_date',
          arguments: { asOf: '2026-09-19', personNumber: 'P1001' },
        }),
      );
      expect(acc.items?.length).toBeGreaterThanOrEqual(1);
      const lov = parse(await c.callTool({ name: 'hcm_list_absence_type_lov', arguments: {} }));
      expect(lov.items?.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('v0.6 recipes + agent UX', () => {
  it('recipes transfer/promote pending; write mode executes terminate', async () => {
    await withClient(cfg(), async (c) => {
      const t = parse(
        await c.callTool({
          name: 'hcm_recipe_transfer',
          arguments: { workerId: '1001', body: { OrganizationId: 'O2' } },
        }),
      );
      expect(t.pending_approval).toBe(true);
    });
    await withClient(cfg({ writeMode: true }), async (c) => {
      const t = parse(
        await c.callTool({
          name: 'hcm_recipe_promote',
          arguments: { workerId: '1001', body: { GradeId: 'G2' } },
        }),
      );
      expect(t.recipe).toBe('promote');
    });
  });

  it('dry-run preview + field maps + role probe', async () => {
    expect(oracleToFriendly('PersonNumber')).toBe('person_number');
    expect(getFieldMap('worker').length).toBeGreaterThan(0);
    await withClient(cfg(), async (c) => {
      const p = parse(
        await c.callTool({
          name: 'hcm_preview_write',
          arguments: { toolName: 'hcm_create_absence', args: { body: {} } },
        }),
      );
      expect(p.dry_run).toBe(true);
      const fm = parse(await c.callTool({ name: 'hcm_list_field_maps', arguments: {} }));
      expect(fm.domains.length).toBeGreaterThan(0);
      const role = parse(await c.callTool({ name: 'hcm_role_privilege_probe', arguments: {} }));
      expect(role.smokeSummary).toBeTruthy();
    });
  });
});

describe('v0.6 platform', () => {
  it('atom cdc status + allowlist refresh', async () => {
    await withClient(cfg(), async (c) => {
      const st = parse(await c.callTool({ name: 'hcm_atom_cdc_status', arguments: {} }));
      expect(st.checkpoints).toBeDefined();
      const roots = extractRootsFromOpenApi({
        paths: { '/customThingies': {}, '/workers': {}, '/ce/ai': {} },
      });
      expect(roots).toContain('customThingies');
      expect(roots).not.toContain('ce');
      const merged = mergeAllowlistRoots(['customThingies']);
      expect(merged.added).toContain('customThingies');
      expect(isAllowlistedPath('customThingies')).toBe(true);
    });
  });

  it('webhook replay protection rejects reused nonce', async () => {
    const wh = new WebhookReceiver({ secret: 'replay-secret-xyz' });
    // force replay on
    process.env.ORACLE_HCM_WEBHOOK_REPLAY_PROTECTION = '1';
    const url = await wh.start(0);
    const port = Number(new URL(url).port);
    const body = JSON.stringify({ event: 'x' });
    const sig = signWebhookBody('replay-secret-xyz', body);
    const headers = {
      'Content-Type': 'application/json',
      'X-HCM-Signature': sig,
      'X-HCM-Timestamp': new Date().toISOString(),
      'X-HCM-Nonce': 'nonce-unique-1',
    };
    let res = await fetch(`http://127.0.0.1:${port}/webhook`, { method: 'POST', headers, body });
    expect(res.status).toBe(202);
    res = await fetch(`http://127.0.0.1:${port}/webhook`, { method: 'POST', headers, body });
    expect(res.status).toBe(409);
    await wh.stop();
  });

  it('nice/later: otbi, dependents, talent pools', async () => {
    await withClient(cfg(), async (c) => {
      const otbi = parse(await c.callTool({ name: 'hcm_otbi_query', arguments: {} }));
      expect(otbi.items?.length).toBeGreaterThanOrEqual(1);
      const dep = parse(await c.callTool({ name: 'hcm_search_benefit_dependents', arguments: {} }));
      expect(dep.items?.length).toBeGreaterThanOrEqual(1);
      const pool = parse(await c.callTool({ name: 'hcm_search_talent_pools', arguments: {} }));
      expect(pool.items?.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('sensitive tools set includes v0.6 packs', () => {
    expect(isSensitiveTool('hcm_get_offer_letter_fields')).toBe(true);
    expect(isSensitiveTool('hcm_search_payroll_costing')).toBe(true);
  });
});

describe('v0.6 tool count', () => {
  it('registers 190+ tools', async () => {
    await withClient(cfg(), async (c) => {
      const tools = await c.listTools();
      expect(tools.tools.length).toBeGreaterThanOrEqual(190);
    });
  });
});
