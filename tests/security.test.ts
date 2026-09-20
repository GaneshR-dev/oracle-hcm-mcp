import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDummyApp } from '../src/dummy-hcm/index.js';
import { seedStore } from '../src/dummy-hcm/data.js';
import type { Server } from 'node:http';
import { createMcpServer, createToolContext } from '../src/mcp/server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { startHttp } from '../src/transports/http.js';
import { HcmClient } from '../src/client/hcmClient.js';
import {
  canonicalizeResourcePath,
  assertAllowlisted,
  isBlockedPath,
  isAllowlistedPath,
} from '../src/policy/allowlist.js';
import { adfEquals } from '../src/policy/adf.js';
import { isSensitivePath, isSensitiveRoot } from '../src/policy/sensitive.js';
import { applyProfileToConfig, DEFAULT_PROFILES } from '../src/platform/profiles.js';
import { summarizeMutation } from '../src/policy/approval.js';
import { WebhookReceiver, signWebhookBody } from '../src/platform/webhookStub.js';
import { TEST_APPROVAL_TOKEN, TEST_HTTP_TOKEN, baseCfg, parseTool } from './helpers.js';
import type { Config } from '../src/config.js';

let dummy: Server;
let baseUrl: string;

async function withClient(config: Config, fn: (c: Client) => Promise<void>) {
  const ctx = createToolContext(config);
  const mcp = createMcpServer(config, ctx);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'sec', version: '0.0.0' });
  await Promise.all([mcp.connect(st), client.connect(ct)]);
  try {
    await fn(client);
  } finally {
    await client.close();
    await mcp.close();
  }
}

beforeAll(async () => {
  const app = createDummyApp(seedStore());
  await new Promise<void>((resolve, reject) => {
    dummy = app.listen(0, '127.0.0.1', () => resolve());
    dummy.on('error', reject);
  });
  const addr = dummy.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  baseUrl = `http://127.0.0.1:${addr.port}/hcmRestApi`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => dummy.close((err) => (err ? reject(err) : resolve())));
});

describe('v0.7 path canonicalization', () => {
  it('rejects traversal, schemes, and encoded dots', () => {
    expect(() => canonicalizeResourcePath('workers/../ce/foo')).toThrow(/traversal/i);
    expect(() => canonicalizeResourcePath('workers/%2e%2e/ce')).toThrow(/traversal/i);
    expect(() => canonicalizeResourcePath('workers/%2E%2E/%2e%2e/ce')).toThrow(/traversal/i);
    expect(() => canonicalizeResourcePath('https://evil.example/workers')).toThrow(/scheme/i);
    expect(() => canonicalizeResourcePath('//evil.example/workers')).toThrow(/scheme/i);
    expect(() => canonicalizeResourcePath('')).toThrow(/required/i);
    expect(isBlockedPath('workers/../ce/foo')).toBe(true);
    expect(isAllowlistedPath('workers/../ce/foo')).toBe(false);
    expect(() => assertAllowlisted('workers/foo/../../ce/ai')).toThrow();
  });

  it('normalizes extra slashes and prefixes', () => {
    const c = canonicalizeResourcePath('/hcmRestApi/resources/11.13.18.05/workers/1001');
    expect(c.root).toBe('workers');
    expect(c.resourcePath).toBe('workers/1001');
  });
});

describe('v0.7 SENSITIVE roots on generic REST', () => {
  it('marks payslip/bank/national ID roots sensitive', () => {
    expect(isSensitiveRoot('payslips')).toBe(true);
    expect(isSensitivePath('payslips/PS1')).toBe(true);
    expect(isSensitivePath('salaries/CH1')).toBe(true);
    expect(isSensitivePath('workers/1001/child/nationalIdentifiers')).toBe(true);
    expect(isSensitivePath('workers/1001/child/addresses')).toBe(true);
    expect(isSensitivePath('workers/1001/child/visasPermits')).toBe(true);
    expect(isSensitivePath('workers/1001')).toBe(false);
  });

  it('hcm_rest_get payslips blocked without SENSITIVE', async () => {
    const client = new HcmClient(baseCfg(baseUrl));
    await expect(client.restGet('payslips/PS1')).rejects.toThrow(/SENSITIVE/);
  });

  it('hcm_rest_get payslips works with SENSITIVE=1', async () => {
    const client = new HcmClient(baseCfg(baseUrl, { sensitiveEnabled: true }));
    const ps = await client.restGet<{ PayslipId?: string }>('payslips/PS1');
    expect((ps as { PayslipId?: string }).PayslipId ?? (ps as { items?: unknown[] }).items).toBeTruthy();
  });

  it('MCP rest_get cannot bypass named-tool SENSITIVE gate', async () => {
    await withClient(baseCfg(baseUrl), async (c) => {
      const raw = await c.callTool({ name: 'hcm_rest_get', arguments: { path: 'payslips/PS1' } });
      expect(raw.isError).toBe(true);
      const body = parseTool(raw as { content: { type: string; text?: string }[] });
      expect(String(body.error)).toMatch(/SENSITIVE/);
    });
  });
});

describe('v0.7 approval split principal', () => {
  it('pending payload never includes the approval token', async () => {
    await withClient(baseCfg(baseUrl), async (c) => {
      const pending = parseTool(
        await c.callTool({
          name: 'hcm_create_absence',
          arguments: { body: { personNumber: 'P1001', absenceType: 'Vacation', startDate: '2026-11-01' } },
        }),
      );
      expect(pending.pending_approval).toBe(true);
      expect(JSON.stringify(pending)).not.toMatch(/test-approval-token/);
      expect(pending.approval_token).toBeUndefined();
    });
  });

  it('self-approve without token fails', async () => {
    await withClient(baseCfg(baseUrl), async (c) => {
      const pending = parseTool(
        await c.callTool({
          name: 'hcm_create_absence',
          arguments: { body: { personNumber: 'P1001', absenceType: 'Vacation', startDate: '2026-11-02' } },
        }),
      );
      const raw = await c.callTool({
        name: 'hcm_approve_write',
        arguments: { approval_id: pending.approval_id, approval_token: 'wrong-token' },
      });
      expect(raw.isError).toBe(true);
      const body = parseTool(raw as { content: { type: string; text?: string }[] });
      expect(String(body.error)).toMatch(/approval_token/i);
    });
  });

  it('approve with token executes', async () => {
    await withClient(baseCfg(baseUrl), async (c) => {
      const pending = parseTool(
        await c.callTool({
          name: 'hcm_create_absence',
          arguments: { body: { personNumber: 'P1001', absenceType: 'Vacation', startDate: '2026-11-03' } },
        }),
      );
      const approved = parseTool(
        await c.callTool({
          name: 'hcm_approve_write',
          arguments: { approval_id: pending.approval_id, approval_token: TEST_APPROVAL_TOKEN },
        }),
      );
      expect(approved.approved).toBe(true);
      expect(approved.result.AbsenceId).toBeTruthy();
    });
  });

  it('summarizeMutation strips token/password keys', () => {
    const s = summarizeMutation('hcm_create_worker', {
      body: { FirstName: 'A' },
      approval_token: 'super-secret',
      password: 'pw',
    });
    expect(s).not.toContain('super-secret');
    expect(s).not.toContain('pw');
    expect(s).toContain('hcm_create_worker');
  });
});

describe('v0.7 profiles cannot enable writeMode', () => {
  it('writeMode:true on a profile is ignored', () => {
    const prod = { ...DEFAULT_PROFILES.find((p) => p.name === 'prod')!, writeMode: true };
    const next = applyProfileToConfig(baseCfg(baseUrl, { writeMode: false }), prod);
    expect(next.writeMode).toBe(false);
  });
});

describe('v0.7 HTTP bearer', () => {
  it('rejects unauthenticated /mcp and /approvals; health stays public', async () => {
    const http = await startHttp(baseCfg(baseUrl, { transport: 'http' }), 0);
    try {
      const health = await fetch(`http://127.0.0.1:${http.port}/health`);
      expect(health.status).toBe(200);
      const mcp = await fetch(`http://127.0.0.1:${http.port}/mcp`, { method: 'POST', body: '{}' });
      expect(mcp.status).toBe(401);
      const appr = await fetch(`http://127.0.0.1:${http.port}/approvals`);
      expect(appr.status).toBe(401);
      const ok = await fetch(`http://127.0.0.1:${http.port}/approvals`, {
        headers: { Authorization: `Bearer ${TEST_HTTP_TOKEN}` },
      });
      expect(ok.status).toBe(200);
      const badOrigin = await fetch(`http://127.0.0.1:${http.port}/health`, {
        headers: { Origin: 'https://evil.example' },
      });
      expect(badOrigin.status).toBe(403);
    } finally {
      await http.close();
    }
  });
});

describe('v0.7 ADF quoting + webhook replay headers', () => {
  it('quotes and escapes ADF q= values', () => {
    expect(adfEquals('PersonNumber', "O'Brien")).toBe("PersonNumber='O''Brien'");
    expect(() => adfEquals('Person Number', 'x')).toThrow(/field name/i);
  });

  it('signed webhook without timestamp/nonce is 409', async () => {
    const wh = new WebhookReceiver({ secret: 'sec-replay' });
    const url = await wh.start(0);
    const body = JSON.stringify({ e: 1 });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-HCM-Signature': signWebhookBody('sec-replay', body),
      },
      body,
    });
    expect(res.status).toBe(409);
    const ok = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-HCM-Signature': signWebhookBody('sec-replay', body),
        'X-HCM-Timestamp': new Date().toISOString(),
        'X-HCM-Nonce': 'sec-nonce-1',
      },
      body,
    });
    expect(ok.status).toBe(202);
    await wh.stop();
  });
});
