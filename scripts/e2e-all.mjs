#!/usr/bin/env node
/**
 * Full live e2e: dummy HCM + stdio MCP + HTTP/gRPC + setup/approval UIs.
 * Requires a prior `npm run build`. Writes/appends E2E_REPORT.md.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_PATH = path.join(ROOT, 'E2E_REPORT.md');
const DUMMY_PORT = Number(process.env.DUMMY_HCM_PORT ?? 9090);
const HTTP_PORT = Number(process.env.E2E_HTTP_PORT ?? 18788);
const GRPC_PORT = Number(process.env.E2E_GRPC_PORT ?? 18789);
const SETUP_PORT = Number(process.env.SETUP_UI_PORT ?? 18790);
const APPROVAL_UI_PORT = Number(process.env.APPROVAL_UI_PORT ?? 18796);

const children = [];

function spawnNode(args, extraEnv = {}, name = 'proc') {
  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (b) => process.stdout.write(`[${name}] ${b}`));
  child.stderr.on('data', (b) => process.stderr.write(`[${name}] ${b}`));
  children.push(child);
  return child;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitUrl(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return r;
    } catch {
      /* retry */
    }
    await sleep(120);
  }
  throw new Error(`timeout waiting for ${url}`);
}

async function runNodeScript(rel, extraEnv = {}, name = 'script') {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, rel)], {
      cwd: ROOT,
      env: { ...process.env, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (b) => {
      out += b;
      process.stdout.write(b);
    });
    child.stderr.on('data', (b) => {
      out += b;
      process.stderr.write(b);
    });
    child.on('exit', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`${name} exited ${code}`));
    });
    child.on('error', reject);
  });
}

const extraResults = [];
function record(step, pass, detail = '') {
  extraResults.push({ step, pass, detail: String(detail).slice(0, 400) });
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${step}${detail ? ` — ${String(detail).slice(0, 140)}` : ''}`);
}

async function startDummy() {
  try {
    const r = await fetch(`http://127.0.0.1:${DUMMY_PORT}/health`);
    if (r.ok) {
      console.log(`[e2e-all] dummy already up on :${DUMMY_PORT}`);
      return { owned: false };
    }
  } catch {
    /* start */
  }
  spawnNode([path.join(ROOT, 'dist/dummy-hcm/index.js')], { DUMMY_HCM_PORT: String(DUMMY_PORT) }, 'dummy');
  await waitUrl(`http://127.0.0.1:${DUMMY_PORT}/health`);
  return { owned: true };
}

async function runUiChecks() {
  console.log('\n=== F) Setup UI + Approval UI ===');
  spawnNode(
    [path.join(ROOT, 'scripts/setup-ui-server.mjs')],
    { SETUP_UI_PORT: String(SETUP_PORT) },
    'setup-ui',
  );
  spawnNode(
    [path.join(ROOT, 'scripts/approval-ui-server.mjs')],
    { APPROVAL_UI_PORT: String(APPROVAL_UI_PORT) },
    'approval-ui',
  );
  await waitUrl(`http://127.0.0.1:${SETUP_PORT}/`);
  await waitUrl(`http://127.0.0.1:${APPROVAL_UI_PORT}/`);

  const setupHtml = await (await fetch(`http://127.0.0.1:${SETUP_PORT}/`)).text();
  record(
    'setup-ui GET /',
    /unofficial|Oracle HCM|setup/i.test(setupHtml) && !/<script src="https?:\/\/(?!127\.0\.0\.1)/i.test(setupHtml),
    `bytes=${setupHtml.length}`,
  );

  const meta = await (await fetch(`http://127.0.0.1:${SETUP_PORT}/api/meta`)).json();
  record('setup-ui /api/meta unofficial', meta.unofficial === true, JSON.stringify(meta).slice(0, 200));

  const probe = await fetch(`http://127.0.0.1:${SETUP_PORT}/api/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1' },
    body: JSON.stringify({
      baseUrl: `http://127.0.0.1:${DUMMY_PORT}/hcmRestApi`,
      apiVersion: '11.13.18.05',
      authMode: 'basic',
      username: 'demo',
      password: 'demo',
    }),
  });
  const probeBody = await probe.json();
  const probeSecretLeak =
    JSON.stringify(probeBody).includes('demo') === false || !JSON.stringify(probeBody).toLowerCase().includes('password');
  record(
    'setup-ui test-connection against dummy',
    probe.ok && probeBody.ok === true && probeBody.status === 200,
    JSON.stringify(probeBody).slice(0, 220),
  );
  record(
    'setup-ui test-connection does not echo password',
    !JSON.stringify(probeBody).toLowerCase().includes('password') && !JSON.stringify(probeBody).includes('"demo"'),
    `secretLeakCheck=${probeSecretLeak}`,
  );

  const csrf = await fetch(`http://127.0.0.1:${SETUP_PORT}/api/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
    body: JSON.stringify({ baseUrl: 'http://127.0.0.1:9090/hcmRestApi' }),
  });
  record('setup-ui CSRF Origin 403', csrf.status === 403, `status=${csrf.status}`);

  const ssrf = await fetch(`http://127.0.0.1:${SETUP_PORT}/api/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1' },
    body: JSON.stringify({ baseUrl: 'file:///etc/passwd', authMode: 'none' }),
  });
  const ssrfBody = await ssrf.json().catch(() => ({}));
  record(
    'setup-ui SSRF file:// rejected',
    ssrf.status >= 400 && /http/i.test(JSON.stringify(ssrfBody)),
    JSON.stringify(ssrfBody).slice(0, 200),
  );

  const apprHtml = await (await fetch(`http://127.0.0.1:${APPROVAL_UI_PORT}/`)).text();
  record(
    'approval-ui GET /',
    /unofficial/i.test(apprHtml) && /Pending HCM write approvals/i.test(apprHtml),
    `bytes=${apprHtml.length}`,
  );
  const apprJs = await (await fetch(`http://127.0.0.1:${APPROVAL_UI_PORT}/app.js`)).text();
  record(
    'approval-ui XSS-safe (textContent, no innerHTML assignment of tool text)',
    /textContent/.test(apprJs) && !/innerHTML\s*=\s*[^;]*summary/.test(apprJs),
    `jsBytes=${apprJs.length}`,
  );
}

function appendReport() {
  const passed = extraResults.filter((r) => r.pass).length;
  const failed = extraResults.filter((r) => !r.pass).length;
  const lines = [
    '',
    '## F) Setup UI + Approval UI (live)',
    '',
    '| Step | Result | Detail |',
    '| --- | --- | --- |',
  ];
  for (const r of extraResults) {
    lines.push(
      `| ${r.step.replace(/\|/g, '\\|')} | ${r.pass ? 'PASS' : 'FAIL'} | \`${r.detail.replace(/`/g, "'").replace(/\|/g, '\\|')}\` |`,
    );
  }
  lines.push('');
  lines.push(
    `UI extra: ${passed} passed, ${failed} failed. HTTP/gRPC live script ran separately (see console).`,
  );
  lines.push('');
  fs.appendFileSync(REPORT_PATH, lines.join('\n'));
  return failed === 0;
}

function shutdown() {
  for (const c of children) {
    try {
      c.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
}

process.on('exit', shutdown);
process.on('SIGINT', () => {
  shutdown();
  process.exit(130);
});

async function main() {
  if (!fs.existsSync(path.join(ROOT, 'dist/index.js'))) {
    throw new Error('dist/ missing — run npm run build first');
  }
  await startDummy();

  console.log('\n=== stdio MCP e2e ===');
  await runNodeScript('scripts/e2e-stdio.mjs', {}, 'e2e-stdio');

  console.log('\n=== HTTP + gRPC e2e ===');
  await runNodeScript(
    'scripts/e2e-http-grpc.mjs',
    { E2E_HTTP_PORT: String(HTTP_PORT), E2E_GRPC_PORT: String(GRPC_PORT) },
    'e2e-http-grpc',
  );

  await runUiChecks();
  const uiOk = appendReport();
  shutdown();
  if (!uiOk) process.exit(1);
  console.log('\n[e2e-all] ALL LIVE CHECKS PASSED');
  process.exit(0);
}

main().catch((err) => {
  console.error('[e2e-all] FAIL', err);
  shutdown();
  process.exit(1);
});
