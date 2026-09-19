/**
 * Heavier HTTP + gRPC e2e — health, curated tools, approval path.
 * Unofficial oracle-hcm-mcp v0.4
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDummyApp } from '../src/dummy-hcm/index.js';
import { seedStore } from '../src/dummy-hcm/data.js';
import type { Server } from 'node:http';
import type { Config } from '../src/config.js';
import { startHttp } from '../src/transports/http.js';
import { startGrpc, createGrpcClient } from '../src/transports/grpc.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let dummy: Server;
let baseUrl: string;
let httpHandle: Awaited<ReturnType<typeof startHttp>>;
let grpcHandle: Awaited<ReturnType<typeof startGrpc>>;
const approvalPath = path.join(os.tmpdir(), `hcm-transport-approvals-${process.pid}.json`);

function mcpConfig(overrides: Partial<Config> = {}): Config {
  return {
    baseUrl,
    apiVersion: '11.13.18.05',
    writeMode: false,
    sensitiveEnabled: false,
    sensitiveWriteEnabled: false,
    authMode: 'basic',
    username: 'demo',
    password: 'demo',
    approvalTtlMs: 120_000,
    approvalStore: 'file',
    approvalStorePath: approvalPath,
    transport: 'http',
    ...overrides,
  };
}

function parseTool(result: { content: Array<{ type: string; text?: string }> }) {
  const text = result.content.find((c) => c.type === 'text')?.text ?? '{}';
  return JSON.parse(text);
}

beforeAll(async () => {
  try {
    fs.rmSync(approvalPath, { force: true });
  } catch {
    /* ok */
  }
  const app = createDummyApp(seedStore());
  await new Promise<void>((resolve, reject) => {
    dummy = app.listen(0, '127.0.0.1', () => resolve());
    dummy.on('error', reject);
  });
  const addr = dummy.address();
  if (!addr || typeof addr === 'string') throw new Error('no dummy port');
  baseUrl = `http://127.0.0.1:${addr.port}/hcmRestApi`;

  httpHandle = await startHttp(mcpConfig({ transport: 'http' }), 0);
  grpcHandle = await startGrpc(mcpConfig({ transport: 'grpc' }), 0);
}, 60_000);

afterAll(async () => {
  await httpHandle?.close();
  await grpcHandle?.close();
  await new Promise<void>((resolve, reject) => {
    dummy.close((err) => (err ? reject(err) : resolve()));
  });
});

describe('Streamable HTTP /mcp e2e', () => {
  it('GET /health', async () => {
    const res = await fetch(`http://127.0.0.1:${httpHandle.port}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.unofficial).toBe(true);
    expect(body.version).toBe('0.6.0');
  });

  it('lists tools, health, search workers, approval path', async () => {
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${httpHandle.port}/mcp`),
    );
    const client = new Client({ name: 'http-e2e', version: '0.5.0' });
    await client.connect(transport);
    try {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain('hcm_health');
      expect(names).toContain('hcm_approve_write');
      expect(names).toContain('hcm_atom_poll');
      expect(names.length).toBeGreaterThanOrEqual(110);

      const health = parseTool(await client.callTool({ name: 'hcm_health', arguments: {} }));
      expect(health.ok).toBe(true);

      const workers = parseTool(await client.callTool({ name: 'hcm_search_workers', arguments: { limit: 5 } }));
      expect(workers.items.length).toBeGreaterThan(0);

      const atom = parseTool(await client.callTool({ name: 'hcm_list_atom_feeds', arguments: {} }));
      expect(atom.feeds.length).toBeGreaterThan(0);

      const pending = parseTool(
        await client.callTool({
          name: 'hcm_create_absence',
          arguments: { body: { personNumber: 'P1001', absenceType: 'Vacation', startDate: '2026-12-01' } },
        }),
      );
      expect(pending.pending_approval).toBe(true);

      // HTTP /approvals mirrors shared store
      const appr = await fetch(`http://127.0.0.1:${httpHandle.port}/approvals`);
      const apprBody = await appr.json();
      expect(apprBody.pending.some((p: { approval_id: string }) => p.approval_id === pending.approval_id)).toBe(
        true,
      );

      const approved = parseTool(
        await client.callTool({
          name: 'hcm_approve_write',
          arguments: { approval_id: pending.approval_id },
        }),
      );
      expect(approved.approved).toBe(true);
      expect(approved.result.AbsenceId).toBeTruthy();
    } finally {
      await client.close();
    }
  });
});

describe('gRPC McpBridge e2e', () => {
  it('initialize + tools/list + curated calls + approval', async () => {
    const grpc = await createGrpcClient(grpcHandle.port);
    try {
      let id = 1;
      const init = (await grpc.call({
        jsonrpc: '2.0',
        id: id++,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'grpc-e2e', version: '0.5.0' },
        },
      })) as { result?: { serverInfo?: { name: string; version: string } } };
      expect(init.result?.serverInfo?.name).toBe('oracle-hcm-mcp');
      expect(init.result?.serverInfo?.version).toBe('0.6.0');

      // notifications/initialized (no id)
      await grpc.call({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      });

      const listed = (await grpc.call({
        jsonrpc: '2.0',
        id: id++,
        method: 'tools/list',
        params: {},
      })) as { result?: { tools: { name: string }[] } };
      const names = (listed.result?.tools ?? []).map((t) => t.name);
      expect(names).toContain('hcm_health');
      expect(names).toContain('hcm_lov_find');
      expect(names.length).toBeGreaterThanOrEqual(110);

      const health = (await grpc.call({
        jsonrpc: '2.0',
        id: id++,
        method: 'tools/call',
        params: { name: 'hcm_health', arguments: {} },
      })) as { result?: { content: { type: string; text?: string }[] } };
      const healthBody = JSON.parse(health.result?.content?.find((c) => c.type === 'text')?.text ?? '{}');
      expect(healthBody.ok).toBe(true);

      const finders = (await grpc.call({
        jsonrpc: '2.0',
        id: id++,
        method: 'tools/call',
        params: {
          name: 'hcm_describe_finder',
          arguments: { resource: 'locations' },
        },
      })) as { result?: { content: { type: string; text?: string }[] } };
      const finderBody = JSON.parse(finders.result?.content?.find((c) => c.type === 'text')?.text ?? '{}');
      expect(finderBody.count).toBeGreaterThan(0);

      const pending = (await grpc.call({
        jsonrpc: '2.0',
        id: id++,
        method: 'tools/call',
        params: {
          name: 'hcm_create_absence',
          arguments: { body: { personNumber: 'P1002', absenceType: 'Sick', startDate: '2026-12-15' } },
        },
      })) as { result?: { content: { type: string; text?: string }[] } };
      const pendingBody = JSON.parse(pending.result?.content?.find((c) => c.type === 'text')?.text ?? '{}');
      expect(pendingBody.pending_approval).toBe(true);

      const denied = (await grpc.call({
        jsonrpc: '2.0',
        id: id++,
        method: 'tools/call',
        params: {
          name: 'hcm_deny_write',
          arguments: { approval_id: pendingBody.approval_id },
        },
      })) as { result?: { content: { type: string; text?: string }[] } };
      const deniedBody = JSON.parse(denied.result?.content?.find((c) => c.type === 'text')?.text ?? '{}');
      expect(deniedBody.denied).toBe(true);
    } finally {
      grpc.close();
    }
  });
});
