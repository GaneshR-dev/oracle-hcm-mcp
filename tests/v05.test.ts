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
  verifyAgainstSecrets,
} from '../src/platform/webhookStub.js';
import { redactDeep } from '../src/platform/redact.js';
import { listRedactionEvents, clearRedactionEvents, redactionStats } from '../src/platform/redactionAudit.js';
import { loadProfileStore, saveProfileStore, DEFAULT_PROFILES } from '../src/platform/profiles.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
  const client = new Client({ name: 'test-v05', version: '0.0.0' });
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

describe('v0.5 smoke + profiles', () => {
  it('hcm_smoke_probe returns 200 matrix on dummy', async () => {
    await withClient(cfg({ profile: 'dummy' }), async (c) => {
      const r = parse(await c.callTool({ name: 'hcm_smoke_probe', arguments: { save: false } }));
      expect(r.summary['200']).toBeGreaterThan(5);
      expect(r.rows.length).toBeGreaterThan(10);
    });
  });

  it('lists and switches profiles', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hcm-prof-'));
    const profilesPath = path.join(dir, 'profiles.json');
    saveProfileStore({ path: profilesPath, active: 'dummy', profiles: structuredClone(DEFAULT_PROFILES) });
    await withClient(cfg({ profilesPath }), async (c) => {
      const listed = parse(await c.callTool({ name: 'hcm_list_profiles', arguments: {} }));
      expect(listed.profiles.length).toBeGreaterThanOrEqual(3);
      const sw = parse(await c.callTool({ name: 'hcm_switch_profile', arguments: { name: 'sandbox', persist: true } }));
      expect(sw.active).toBe('sandbox');
      const store = loadProfileStore(profilesPath);
      expect(store.active).toBe('sandbox');
    });
  });
});

describe('v0.5 person deep-read + recruiting', () => {
  it('person deep-read pack', async () => {
    await withClient(cfg(), async (c) => {
      const r = parse(await c.callTool({ name: 'hcm_person_deep_read', arguments: { workerId: '1001' } }));
      expect(r.workerId).toBe('1001');
      expect(r.worker).toBeTruthy();
      expect(r.legislative).toBeTruthy();
    });
  });

  it('offers interviews attachments', async () => {
    await withClient(cfg(), async (c) => {
      const offers = parse(await c.callTool({ name: 'hcm_search_offers', arguments: { limit: 5 } }));
      expect(offers.items?.length).toBeGreaterThanOrEqual(1);
      const ints = parse(await c.callTool({ name: 'hcm_search_interviews', arguments: {} }));
      expect(ints.items?.length).toBeGreaterThanOrEqual(1);
      const att = parse(
        await c.callTool({ name: 'hcm_list_candidate_attachments', arguments: { candidateId: 'CAN1' } }),
      );
      expect(att.items?.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('v0.5 time + benefits + recipes', () => {
  it('validate then submit time card (approval)', async () => {
    await withClient(cfg(), async (c) => {
      const body = { PersonNumber: 'P1001', PeriodStart: '2026-09-14', PeriodEnd: '2026-09-20' };
      const v = parse(await c.callTool({ name: 'hcm_validate_time_card', arguments: { body } }));
      expect(v.valid).toBe(true);
      const s = parse(await c.callTool({ name: 'hcm_submit_time_card', arguments: { body } }));
      expect(s.pending_approval).toBe(true);
    });
  });

  it('benefits enroll is approval-gated', async () => {
    await withClient(cfg(), async (c) => {
      const r = parse(
        await c.callTool({
          name: 'hcm_enroll_benefit',
          arguments: { body: { PersonNumber: 'P1001', PlanName: 'Dental' } },
        }),
      );
      expect(r.pending_approval).toBe(true);
    });
  });

  it('recipe absence balance', async () => {
    await withClient(cfg(), async (c) => {
      const r = parse(
        await c.callTool({
          name: 'hcm_recipe_absence_balance_approve',
          arguments: { personNumber: 'P1001', createAbsence: false },
        }),
      );
      expect(r.recipe).toBe('absence_balance_approve');
      expect(Array.isArray(r.balance)).toBe(true);
    });
  });
});

describe('v0.5 learning/goals writes + compensation + absence LOVs', () => {
  it('create goal pending approval; write mode executes', async () => {
    await withClient(cfg(), async (c) => {
      const r = parse(
        await c.callTool({
          name: 'hcm_create_goal',
          arguments: { body: { PersonNumber: 'P1001', GoalName: 'v05', Status: 'IN_PROGRESS' } },
        }),
      );
      expect(r.pending_approval).toBe(true);
    });
    await withClient(cfg({ writeMode: true }), async (c) => {
      const r = parse(
        await c.callTool({
          name: 'hcm_create_goal',
          arguments: { body: { PersonNumber: 'P1001', GoalName: 'v05w', Status: 'IN_PROGRESS' } },
        }),
      );
      expect(r.GoalId || r.goalId).toBeTruthy();
    });
  });

  it('enroll learning approval-gated', async () => {
    await withClient(cfg(), async (c) => {
      const r = parse(
        await c.callTool({
          name: 'hcm_enroll_learning',
          arguments: { body: { PersonNumber: 'P1002', CourseName: 'Security', Status: 'ENROLLED' } },
        }),
      );
      expect(r.pending_approval).toBe(true);
    });
  });

  it('compensation update is sensitive-gated', async () => {
    await withClient(cfg({ writeMode: true }), async (c) => {
      const raw = await c.callTool({
        name: 'hcm_update_compensation',
        arguments: { compensationId: 'CH1', body: { Amount: 11000 } },
      });
      expect(raw.isError).toBe(true);
      const body = parse(raw as { content: { type: string; text?: string }[] });
      expect(String(body.error)).toMatch(/ORACLE_HCM_SENSITIVE/);
    });
    await withClient(cfg({ writeMode: true, sensitiveEnabled: true }), async (c) => {
      const r = parse(
        await c.callTool({
          name: 'hcm_update_compensation',
          arguments: { compensationId: 'CH1', body: { Amount: 11000 } },
        }),
      );
      expect(r.pending_approval || r.sensitive).toBeTruthy();
    });
  });

  it('absence type/plan get + balance_by_plan', async () => {
    await withClient(cfg(), async (c) => {
      const t = parse(await c.callTool({ name: 'hcm_get_absence_type', arguments: { absenceTypeId: 'AT1' } }));
      expect(t.AbsenceTypeId).toBe('AT1');
      const b = parse(
        await c.callTool({
          name: 'hcm_balance_by_plan',
          arguments: { personNumber: 'P1001', planName: 'Annual Leave' },
        }),
      );
      expect(b.items).toBeDefined();
    });
  });
});

describe('v0.5 redaction audit + bulk preview + webhook rotate', () => {
  it('redaction audit records masked fields', () => {
    clearRedactionEvents();
    redactDeep({ BankAccountNumber: '000123456789', password: 'secret' }, 0, { tool: 'test' });
    const stats = redactionStats();
    expect(stats.total).toBeGreaterThanOrEqual(2);
    const ev = listRedactionEvents(10);
    expect(ev.some((e) => e.action === 'masked' || e.action === 'redacted')).toBe(true);
  });

  it('bulk bp preview', async () => {
    await withClient(cfg(), async (c) => {
      const r = parse(
        await c.callTool({
          name: 'hcm_bulk_bp_preview',
          arguments: { notificationIds: ['N1'], action: 'APPROVE' },
        }),
      );
      expect(r.dry_run).toBe(true);
      expect(r.preview.length).toBe(1);
    });
  });

  it('rotating webhook secrets', async () => {
    const wh = new WebhookReceiver({ secret: 'old-secret-value' });
    const url = await wh.start(0);
    const port = Number(new URL(url).port);
    wh.rotateSecret('new-secret-value', true);
    const body = JSON.stringify({ hello: 'world' });
    // old still works
    let res = await fetch(`http://127.0.0.1:${port}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-HCM-Signature': signWebhookBody('old-secret-value', body) },
      body,
    });
    expect(res.status).toBe(202);
    res = await fetch(`http://127.0.0.1:${port}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-HCM-Signature': signWebhookBody('new-secret-value', body) },
      body,
    });
    expect(res.status).toBe(202);
    expect(verifyAgainstSecrets(['a', 'b'], body, signWebhookBody('b', body))).toBe(true);
    await wh.stop();
  });

  it('atom replay', async () => {
    await withClient(cfg(), async (c) => {
      const r = parse(await c.callTool({ name: 'hcm_atom_replay', arguments: { collection: 'workers', limit: 10 } }));
      expect(r.mode).toBe('replay');
      expect(r.realPodHooks).toBeTruthy();
    });
  });

  it('batch get', async () => {
    await withClient(cfg(), async (c) => {
      const r = parse(
        await c.callTool({
          name: 'hcm_batch_get',
          arguments: { paths: ['workers/1001', 'absences/A1'] },
        }),
      );
      expect(Array.isArray(r)).toBe(true);
      expect(r[0].ok).toBe(true);
    });
  });
});

describe('v0.5 tool count', () => {
  it('registers substantially more than 119 tools', async () => {
    await withClient(cfg(), async (c) => {
      const tools = await c.listTools();
      expect(tools.tools.length).toBeGreaterThanOrEqual(140);
    });
  });
});
