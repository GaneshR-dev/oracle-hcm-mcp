import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDummyApp } from '../src/dummy-hcm/index.js';
import { seedStore } from '../src/dummy-hcm/data.js';
import type { Server } from 'node:http';
import type { Config } from '../src/config.js';
import { createMcpServer, createToolContext } from '../src/mcp/server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { HcmClient } from '../src/client/hcmClient.js';
import { isAllowlistedPath } from '../src/policy/allowlist.js';
import { isSensitivePath } from '../src/policy/sensitive.js';
import { resolveAtomFeed } from '../src/policy/atom.js';

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
  const client = new Client({ name: 'test-v09', version: '0.0.0' });
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

describe('v0.9 official children / LOVs', () => {
  it('allowlists official new roots and Atom workrelshipupdate', () => {
    expect(isAllowlistedPath('timeEventRequests')).toBe(true);
    expect(isAllowlistedPath('jobsLov')).toBe(true);
    expect(isAllowlistedPath('gradeLaddersLov')).toBe(true);
    expect(isAllowlistedPath('workers/1001/child/addresses')).toBe(true);
    expect(isAllowlistedPath('workers/1001/child/visasPermits')).toBe(true);
    expect(isSensitivePath('workers/1001/child/addresses')).toBe(true);
    expect(isSensitivePath('workers/1001/child/names')).toBe(false);
    expect(resolveAtomFeed('workrelshipupdate').collection).toBe('workrelshipupdate');
  });

  it('lists worker addresses/names/photos and assignment gradeSteps', async () => {
    await withClient(cfg({ writeMode: true, sensitiveEnabled: true }), async (c) => {
      const addr = parse(await c.callTool({ name: 'hcm_search_addresses', arguments: { workerId: '1001' } }));
      expect(addr.items?.[0]?.AddressId).toBe('AD1');
      const names = parse(await c.callTool({ name: 'hcm_search_names', arguments: { workerId: '1001' } }));
      expect(names.items?.[0]?.NameId).toBe('NM1');
      const photos = parse(await c.callTool({ name: 'hcm_search_photos', arguments: { workerId: '1001' } }));
      expect(photos.items?.[0]?.PhotoId).toBe('PHTO1');
      const steps = parse(
        await c.callTool({
          name: 'hcm_list_assignment_grade_steps',
          arguments: { workerId: '1001', assignmentId: 'AS1' },
        }),
      );
      expect(steps.items?.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('gates addresses without SENSITIVE', async () => {
    await withClient(cfg(), async (c) => {
      const r = parse(await c.callTool({ name: 'hcm_search_addresses', arguments: { workerId: '1001' } }));
      expect(r.error ?? '').toMatch(/gated|SENSITIVE/i);
    });
  });

  it('timeEventRequests + work-structure LOVs + recruiting/benefit children', async () => {
    await withClient(cfg({ writeMode: true }), async (c) => {
      const te = parse(await c.callTool({ name: 'hcm_search_time_event_requests', arguments: {} }));
      expect(te.items?.length).toBeGreaterThanOrEqual(1);
      const jobs = parse(await c.callTool({ name: 'hcm_list_jobs_lov', arguments: {} }));
      expect(jobs.items?.length).toBeGreaterThanOrEqual(1);
      const skills = parse(
        await c.callTool({ name: 'hcm_list_requisition_skills', arguments: { requisitionId: 'REQ1' } }),
      );
      expect(skills.items?.[0]?.SkillId).toBe('SK1');
      const costs = parse(
        await c.callTool({ name: 'hcm_search_benefit_costs', arguments: { enrollmentId: 'BE1' } }),
      );
      expect(costs.items?.[0]?.CostId).toBe('BC1');
      const citz = parse(
        await c.callTool({ name: 'hcm_list_candidate_citizenships', arguments: { candidateId: 'CAN1' } }),
      );
      expect(citz.items?.[0]?.CitizenshipId).toBe('CCZ1');
    });
  });

  it('documentRecords official actions', async () => {
    await withClient(cfg({ writeMode: true }), async (c) => {
      const dl = parse(
        await c.callTool({ name: 'hcm_download_document_attachments', arguments: { documentRecordId: 'DR1' } }),
      );
      expect(dl.FileName).toBe('i9.pdf');
      const letter = parse(
        await c.callTool({ name: 'hcm_generate_document_letter', arguments: { documentRecordId: 'DR1' } }),
      );
      expect(letter.letterStatus).toBe('DRAFT');
    });
  });

  it('If-Match mismatch on PATCH returns 412', async () => {
    const client = new HcmClient(cfg({ writeMode: true, ifMatch: '"wrong-etag"' }));
    await expect(client.patchJson('workers/1001', { DisplayName: 'Nope' })).rejects.toThrow(/412|Precondition/i);
  });

  it('create address under --write', async () => {
    await withClient(cfg({ writeMode: true, sensitiveEnabled: true }), async (c) => {
      const created = parse(
        await c.callTool({
          name: 'hcm_create_address',
          arguments: {
            workerId: '1002',
            body: { AddressLine1: 'Bletchley Park', Country: 'GB', AddressType: 'HOME' },
          },
        }),
      );
      expect(created.AddressId).toBeTruthy();
    });
  });
});
