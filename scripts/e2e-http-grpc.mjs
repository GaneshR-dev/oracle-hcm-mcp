#!/usr/bin/env node
/**
 * Standalone HTTP + gRPC e2e script (also covered by vitest transport-e2e).
 * Expects dummy HCM on :9090 and built dist/.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTTP_PORT = Number(process.env.E2E_HTTP_PORT ?? 8788);
const GRPC_PORT = Number(process.env.E2E_GRPC_PORT ?? 8789);

const ENV = {
  ...process.env,
  ORACLE_HCM_BASE_URL: process.env.ORACLE_HCM_BASE_URL ?? 'http://127.0.0.1:9090/hcmRestApi',
  ORACLE_HCM_AUTH: 'basic',
  ORACLE_HCM_USERNAME: 'demo',
  ORACLE_HCM_PASSWORD: 'demo',
};

function spawnMcp(args) {
  const child = spawn('node', [path.join(ROOT, 'dist/index.js'), ...args], {
    cwd: ROOT,
    env: ENV,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  child.stderr.on('data', (b) => process.stderr.write(b));
  return child;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitHealth(port, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/health`);
      if (r.ok) return true;
    } catch {
      /* retry */
    }
    await sleep(150);
  }
  return false;
}

function parseTool(result) {
  const text = result?.content?.find((c) => c.type === 'text')?.text ?? '{}';
  return JSON.parse(text);
}

async function runHttp() {
  console.log('\n=== HTTP Streamable /mcp ===');
  const child = spawnMcp(['--http', String(HTTP_PORT)]);
  try {
    if (!(await waitHealth(HTTP_PORT))) throw new Error('HTTP health timeout');
    const health = await (await fetch(`http://127.0.0.1:${HTTP_PORT}/health`)).json();
    console.log('  [PASS] health', health.version ?? health.ok);

    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${HTTP_PORT}/mcp`),
    );
    const client = new Client({ name: 'e2e-http', version: '0.4.0' });
    await client.connect(transport);
    const { tools } = await client.listTools();
    console.log(`  [PASS] tools/list count=${tools.length}`);
    const h = parseTool(await client.callTool({ name: 'hcm_health', arguments: {} }));
    if (!h.ok) throw new Error('hcm_health failed');
    console.log('  [PASS] hcm_health');
    const pending = parseTool(
      await client.callTool({
        name: 'hcm_create_absence',
        arguments: { body: { personNumber: 'P1001', absenceType: 'Vacation', startDate: '2027-01-05' } },
      }),
    );
    if (!pending.pending_approval) throw new Error('expected pending');
    const denied = parseTool(
      await client.callTool({
        name: 'hcm_deny_write',
        arguments: { approval_id: pending.approval_id },
      }),
    );
    if (!denied.denied) throw new Error('deny failed');
    console.log('  [PASS] approval path (create → deny)');
    await client.close();
  } finally {
    child.kill('SIGTERM');
  }
}

async function runGrpc() {
  console.log('\n=== gRPC McpBridge ===');
  const child = spawnMcp(['--grpc', String(GRPC_PORT)]);
  await sleep(800);
  const protoPath = path.join(ROOT, 'proto/mcp_bridge.proto');
  const def = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const loaded = grpc.loadPackageDefinition(def);
  const client = new loaded.mcpbridge.McpBridge(
    `127.0.0.1:${GRPC_PORT}`,
    grpc.credentials.createInsecure(),
  );
  const call = (msg) =>
    new Promise((resolve, reject) => {
      client.Call({ json_rpc: JSON.stringify(msg) }, (err, res) => {
        if (err) reject(err);
        else resolve(JSON.parse(res.json_rpc));
      });
    });
  try {
    const init = await call({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'e2e-grpc', version: '0.4.0' },
      },
    });
    console.log('  [PASS] initialize', init.result?.serverInfo?.version);
    await call({ jsonrpc: '2.0', method: 'notifications/initialized' });
    const listed = await call({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    console.log(`  [PASS] tools/list count=${listed.result?.tools?.length}`);
    const health = await call({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'hcm_health', arguments: {} },
    });
    const body = JSON.parse(health.result.content.find((c) => c.type === 'text').text);
    if (!body.ok) throw new Error('grpc health failed');
    console.log('  [PASS] hcm_health via gRPC');
  } finally {
    client.close();
    child.kill('SIGTERM');
  }
}

const okHttp = await runHttp().then(() => true).catch((e) => {
  console.error('HTTP e2e FAIL', e);
  return false;
});
const okGrpc = await runGrpc().then(() => true).catch((e) => {
  console.error('gRPC e2e FAIL', e);
  return false;
});
if (!okHttp || !okGrpc) process.exit(1);
console.log('\nAll HTTP/gRPC e2e checks passed.');
