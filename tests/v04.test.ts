import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDummyApp } from '../src/dummy-hcm/index.js';
import { seedStore } from '../src/dummy-hcm/data.js';
import type { Server } from 'node:http';
import type { Config } from '../src/config.js';
import { createMcpServer, createToolContext } from '../src/mcp/server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createApprovalStore } from '../src/policy/approval.js';
import {
  WebhookReceiver,
  signWebhookBody,
  verifyWebhookSignature,
} from '../src/platform/webhookStub.js';
import {
  parseAtomEntry,
  entriesAfterCursor,
  entryCursor,
  createFileCheckpointStore,
  entriesToAtomXml,
  parseAtomXml,
} from '../src/platform/atomCdc.js';
import { listFinders, buildFinderExpression, applyFinderFilter } from '../src/policy/finders.js';
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
  const client = new Client({ name: 'test-v04', version: '0.0.0' });
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

describe('v0.4 Atom CDC', () => {
  it('lists feeds, gets entry, polls and consumes with checkpoint', async () => {
    const cpPath = path.join(os.tmpdir(), `hcm-atom-cp-${process.pid}.json`);
    try {
      fs.rmSync(cpPath, { force: true });
    } catch {
      /* ok */
    }
    await withClient(cfg({ atomCheckpointPath: cpPath }), async (client) => {
      const feeds = parse(await client.callTool({ name: 'hcm_list_atom_feeds', arguments: {} }));
      expect(feeds.feeds.length).toBeGreaterThan(0);

      const entry = parse(
        await client.callTool({ name: 'hcm_get_atom_entry', arguments: { entryId: 'AE1' } }),
      );
      expect(entry.entryId).toBe('AE1');

      const resetPending = parse(
        await client.callTool({ name: 'hcm_atom_reset_checkpoint', arguments: {} }),
      );
      expect(resetPending.pending_approval).toBe(true);
      parse(
        await client.callTool({
          name: 'hcm_approve_write',
          arguments: { approval_id: resetPending.approval_id, approval_token: 'test-approval-token' },
        }),
      );

      const poll1 = parse(
        await client.callTool({
          name: 'hcm_atom_poll',
          arguments: { collection: 'empupdate', limit: 10 },
        }),
      );
      expect(poll1.count).toBeGreaterThan(0);

      const consume = parse(
        await client.callTool({
          name: 'hcm_atom_consume',
          arguments: { collection: 'empupdate', limit: 10 },
        }),
      );
      expect(consume.consumed).toBeGreaterThan(0);
      expect(consume.checkpoint.cursor).toBeTruthy();

      const poll2 = parse(
        await client.callTool({
          name: 'hcm_atom_poll',
          arguments: { collection: 'empupdate', limit: 10 },
        }),
      );
      expect(poll2.count).toBe(0);

      const xmlFeed = parse(
        await client.callTool({
          name: 'hcm_get_atom_feed',
          arguments: { collection: 'empupdate', format: 'atom' },
        }),
      );
      expect(xmlFeed.format).toBe('atom');
      expect(xmlFeed.xml).toContain('<feed');
      expect(parseAtomXml(xmlFeed.xml).length).toBeGreaterThan(0);
    });
  });

  it('parses entries and cursor ordering', () => {
    const a = parseAtomEntry({
      EntryId: 'AE1',
      Updated: '2026-09-18T10:00:00Z',
      Title: 't',
      Collection: 'workers',
    });
    const b = parseAtomEntry({
      EntryId: 'AE3',
      Updated: '2026-09-19T12:00:00Z',
      Title: 't2',
      Collection: 'workers',
    });
    const after = entriesAfterCursor([a, b], entryCursor(a));
    expect(after.map((e) => e.entryId)).toEqual(['AE3']);
    const xml = entriesToAtomXml('t', 'atom:workers', [a]);
    expect(xml).toContain('AE1');
  });
});

describe('v0.4 webhook HMAC', () => {
  it('rejects unsigned and bad signatures; accepts valid', async () => {
    const secret = 'test-webhook-secret';
    const receiver = new WebhookReceiver({ secret, requireSignature: true });
    const endpoint = await receiver.start(0);

    const body = JSON.stringify({ event: 'atom', id: '1' });
    const unsigned = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    expect(unsigned.status).toBe(401);

    const bad = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-HCM-Signature': 'sha256=deadbeef',
      },
      body,
    });
    expect(bad.status).toBe(401);

    const sig = signWebhookBody(secret, body);
    expect(verifyWebhookSignature(secret, body, sig)).toBe(true);
    const ok = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-HCM-Signature': sig,
        'X-HCM-Timestamp': new Date().toISOString(),
        'X-HCM-Nonce': 'v04-hmac-nonce-1',
      },
      body,
    });
    expect(ok.status).toBe(202);
    expect(receiver.list().length).toBe(1);
    await receiver.stop();
  });
});

describe('v0.4 multi-node approvals (file store)', () => {
  it('shares pending intents across ApprovalStore instances', async () => {
    const storePath = path.join(os.tmpdir(), `hcm-approvals-${process.pid}.json`);
    try {
      fs.rmSync(storePath, { force: true });
    } catch {
      /* ok */
    }
    const a = createApprovalStore(60_000, { store: 'file', storePath });
    const intent = a.create('hcm_create_absence', { personNumber: 'P1001' }, 'test');
    expect(a.backendKind).toBe('file');

    const b = createApprovalStore(60_000, { store: 'file', storePath });
    const pending = b.listPending();
    expect(pending.some((p) => p.approvalId === intent.approvalId)).toBe(true);

    const denied = b.deny(intent.approvalId);
    expect(denied.status).toBe('denied');
    expect(a.get(intent.approvalId)?.status).toBe('denied');
  });

  it('MCP create pending visible via second context with same file store', async () => {
    const storePath = path.join(os.tmpdir(), `hcm-approvals-mcp-${process.pid}.json`);
    try {
      fs.rmSync(storePath, { force: true });
    } catch {
      /* ok */
    }
    const c1 = cfg({ approvalStore: 'file', approvalStorePath: storePath });
    const ctx1 = createToolContext(c1);
    const mcp1 = createMcpServer(c1, ctx1);
    const [ct1, st1] = InMemoryTransport.createLinkedPair();
    const client1 = new Client({ name: 'c1', version: '0' });
    await Promise.all([mcp1.connect(st1), client1.connect(ct1)]);

    const pending = parse(
      await client1.callTool({
        name: 'hcm_create_absence',
        arguments: { body: { personNumber: 'P1001', absenceType: 'Vacation', startDate: '2026-11-01' } },
      }),
    );
    expect(pending.pending_approval).toBe(true);
    await client1.close();
    await mcp1.close();

    const c2 = cfg({ approvalStore: 'file', approvalStorePath: storePath });
    await withClient(c2, async (client2) => {
      const list = parse(await client2.callTool({ name: 'hcm_list_pending_approvals', arguments: {} }));
      expect(list.pending.some((p: { approval_id: string }) => p.approval_id === pending.approval_id)).toBe(
        true,
      );
      const approved = parse(
        await client2.callTool({
          name: 'hcm_approve_write',
          arguments: { approval_id: pending.approval_id, approval_token: 'test-approval-token' },
        }),
      );
      expect(approved.approved).toBe(true);
    });
  });
});

describe('v0.4 ADF finders', () => {
  it('describe + lov_find against dummy', async () => {
    expect(listFinders('locations').length).toBeGreaterThan(0);
    await withClient(cfg(), async (client) => {
      const desc = parse(
        await client.callTool({
          name: 'hcm_describe_finder',
          arguments: { resource: 'locations', finder: 'findByCountry' },
        }),
      );
      expect(desc.found).toBe(true);
      expect(desc.finder.params[0].name).toBe('Country');

      const found = parse(
        await client.callTool({
          name: 'hcm_lov_find',
          arguments: {
            resource: 'locations',
            finder: 'findByCountry',
            params: { Country: 'US' },
          },
        }),
      );
      expect(found.items.length).toBeGreaterThan(0);
      expect(found.items.every((i: { Country: string }) => i.Country === 'US')).toBe(true);

      const workers = parse(
        await client.callTool({
          name: 'hcm_lov_find',
          arguments: {
            resource: 'workers',
            finder: 'findByPersonNumber',
            params: { PersonNumber: 'P1001' },
          },
        }),
      );
      expect(workers.items.length).toBe(1);
    });
  });

  it('buildFinderExpression + applyFinderFilter unit', () => {
    expect(buildFinderExpression('findByCountry', { Country: 'US' })).toBe(
      'findByCountry;Country=US',
    );
    const items = applyFinderFilter(
      [
        { LocationId: 'L1', Country: 'US' },
        { LocationId: 'L2', Country: 'GB' },
      ],
      'locations',
      'findByCountry;Country=US',
    );
    expect(items).toHaveLength(1);
  });
});

describe('v0.4 payslip field parity', () => {
  it('returns richer Fusion-shaped payslip under sensitive gate', async () => {
    await withClient(cfg({ sensitiveEnabled: true }), async (client) => {
      const ps = parse(
        await client.callTool({ name: 'hcm_get_payslip', arguments: { payslipId: 'PS1' } }),
      );
      expect(ps.pending_approval).toBeUndefined();
      expect(ps.PayslipId).toBe('PS1');
      expect(ps.GrossEarnings).toBe(10500);
      expect(ps.TotalDeductions).toBe(2000);
      expect(ps.NetPay).toBe(8500);
      expect(ps.CurrencyCode).toBe('USD');
      expect(ps.earnings?.length).toBeGreaterThan(0);
      expect(ps.deductions?.length).toBeGreaterThan(0);
      expect(ps.PeriodStartDate).toBe('2026-08-01');
    });
  });
});

describe('v0.4 tool count', () => {
  it('registers 110+ tools including new atom/finder tools', async () => {
    await withClient(cfg(), async (client) => {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain('hcm_atom_poll');
      expect(names).toContain('hcm_atom_consume');
      expect(names).toContain('hcm_lov_find');
      expect(names).toContain('hcm_describe_finder');
      expect(names).toContain('hcm_list_atom_feeds');
      expect(names.length).toBeGreaterThanOrEqual(110);
    });
  });
});
