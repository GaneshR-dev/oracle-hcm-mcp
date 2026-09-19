#!/usr/bin/env node
/**
 * Local setup wizard for unofficial oracle-hcm-mcp.
 * Serves http://127.0.0.1:8790 — NOT affiliated with Oracle Corporation.
 * Secrets are accepted only for test-connection / .env.local write; never logged or echoed back.
 */

import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STATIC_DIR = path.join(ROOT, 'setup-ui');
const PORT = Number(process.env.SETUP_UI_PORT ?? 8790);
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function log(...args) {
  // Never pass secrets into this helper from handlers.
  console.error('[setup-ui]', ...args);
}

function sendJson(res, status, body) {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(raw);
}

function readJsonBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('Body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function isLocalRequest(req) {
  const origin = req.headers.origin;
  if (origin) {
    try {
      const u = new URL(origin);
      return u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.hostname === '::1';
    } catch {
      return false;
    }
  }
  const referer = req.headers.referer;
  if (referer) {
    try {
      const u = new URL(referer);
      return u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.hostname === '::1';
    } catch {
      return false;
    }
  }
  return true; // non-browser (curl)
}

function assertSafeHttpUrl(raw, label) {
  const s = String(raw ?? '').trim();
  if (!s) throw Object.assign(new Error(`${label} required`), { status: 400 });
  let u;
  try {
    u = new URL(s);
  } catch {
    throw Object.assign(new Error(`${label} is not a valid URL`), { status: 400 });
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw Object.assign(new Error(`${label} must be http(s)`), { status: 400 });
  }
  if (u.username || u.password) {
    throw Object.assign(new Error(`${label} must not embed credentials`), { status: 400 });
  }
  return s.replace(/\/+$/, '');
}

function sanitizeAuthMode(v) {
  const m = String(v ?? 'basic').toLowerCase();
  if (m === 'oauth' || m === 'client_credentials') return 'oauth';
  if (m === 'bearer' || m === 'token') return 'bearer';
  if (m === 'none' || m === 'off') return 'none';
  return 'basic';
}

function buildAuthHeader(body) {
  const authMode = sanitizeAuthMode(body.authMode);
  if (authMode === 'none') return { authMode, header: undefined };
  if (authMode === 'basic') {
    const u = String(body.username ?? '');
    const p = String(body.password ?? '');
    return {
      authMode,
      header: `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`,
    };
  }
  if (authMode === 'bearer') {
    const token = String(body.bearerToken ?? '');
    if (!token) throw Object.assign(new Error('Bearer token required'), { status: 400 });
    return { authMode, header: `Bearer ${token}` };
  }
  // oauth — fetch token first
  return { authMode, header: null, oauth: true };
}

async function fetchOAuthToken(body) {
  const tokenUrl = assertSafeHttpUrl(body.tokenUrl, 'tokenUrl');
  const clientId = String(body.clientId ?? '');
  const clientSecret = String(body.clientSecret ?? '');
  if (!tokenUrl || !clientId || !clientSecret) {
    throw Object.assign(
      new Error('OAuth requires tokenUrl, clientId, and clientSecret'),
      { status: 400 },
    );
  }
  const form = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    redirect: 'error',
  });
  if (!res.ok) {
    throw Object.assign(new Error(`OAuth token request failed (${res.status})`), {
      status: 502,
      upstreamStatus: res.status,
    });
  }
  const data = await res.json();
  if (!data?.access_token) {
    throw Object.assign(new Error('OAuth response missing access_token'), { status: 502 });
  }
  return data.access_token;
}

async function testConnection(body) {
  const baseUrl = assertSafeHttpUrl(body.baseUrl, 'baseUrl');
  const apiVersion = String(body.apiVersion ?? '11.13.18.05');

  let auth;
  try {
    auth = buildAuthHeader(body);
  } catch (e) {
    throw e;
  }

  let authorization = auth.header;
  if (auth.oauth) {
    const token = await fetchOAuthToken(body);
    authorization = `Bearer ${token}`;
  }

  const probeUrl = `${baseUrl}/resources/${apiVersion}/workers?limit=1`;
  const headers = { Accept: 'application/json' };
  if (authorization) headers.Authorization = authorization;

  const started = Date.now();
  let res;
  try {
    res = await fetch(probeUrl, { method: 'GET', headers, redirect: 'error' });
  } catch (e) {
    return {
      ok: false,
      baseUrl,
      apiVersion,
      authMode: auth.authMode,
      error: e instanceof Error ? e.message : 'Network error',
      latencyMs: Date.now() - started,
      // Never include credentials
    };
  }

  const ok = res.status < 500;
  return {
    ok,
    status: res.status,
    baseUrl,
    apiVersion,
    authMode: auth.authMode,
    latencyMs: Date.now() - started,
    note:
      res.status === 401 || res.status === 403
        ? 'Auth rejected by server (credentials or RBAC). Secrets were not logged.'
        : ok
          ? 'Probe succeeded (or non-5xx). Secrets were not logged or returned.'
          : 'Upstream error. Secrets were not logged or returned.',
  };
}

function envLocalContent(body) {
  const lines = [
    '# Generated by oracle-hcm-mcp setup UI — unofficial, not Oracle.',
    '# Do not commit. Already covered by .gitignore (.env.*).',
    `ORACLE_HCM_BASE_URL=${assertSafeHttpUrl(body.baseUrl, 'baseUrl')}`,
    `ORACLE_HCM_API_VERSION=${String(body.apiVersion ?? '11.13.18.05')}`,
    `ORACLE_HCM_AUTH=${sanitizeAuthMode(body.authMode)}`,
  ];
  const mode = sanitizeAuthMode(body.authMode);
  if (mode === 'basic') {
    lines.push(`ORACLE_HCM_USERNAME=${String(body.username ?? '')}`);
    lines.push(`ORACLE_HCM_PASSWORD=${String(body.password ?? '')}`);
  } else if (mode === 'bearer') {
    lines.push(`ORACLE_HCM_BEARER_TOKEN=${String(body.bearerToken ?? '')}`);
  } else if (mode === 'oauth') {
    lines.push(`ORACLE_HCM_TOKEN_URL=${String(body.tokenUrl ?? '')}`);
    lines.push(`ORACLE_HCM_CLIENT_ID=${String(body.clientId ?? '')}`);
    lines.push(`ORACLE_HCM_CLIENT_SECRET=${String(body.clientSecret ?? '')}`);
  }
  if (body.writeMode) {
    lines.push('ORACLE_HCM_WRITE=1');
  }
  lines.push('');
  return lines.join('\n');
}

function serveStatic(req, res, urlPath) {
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  rel = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(STATIC_DIR, rel);
  if (!filePath.startsWith(STATIC_DIR)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);

  // Localhost bind + Origin/Referer check on mutating APIs (CSRF).
  if (req.method === 'POST' && !isLocalRequest(req)) {
    sendJson(res, 403, { ok: false, error: 'Origin not allowed' });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/meta') {
    sendJson(res, 200, {
      service: 'oracle-hcm-mcp-setup-ui',
      unofficial: true,
      disclaimer:
        'Not an Oracle product. Not affiliated with, endorsed by, or supported by Oracle Corporation.',
      projectRoot: ROOT,
      envLocalPath: path.join(ROOT, '.env.local'),
    });
    return;
  }


  if (req.method === 'POST' && url.pathname === '/api/oauth-token-status') {
    try {
      const body = await readJsonBody(req);
      log('oauth-token-status', {
        tokenUrl: String(body.tokenUrl ?? ''),
        authMode: sanitizeAuthMode(body.authMode),
      });
      if (sanitizeAuthMode(body.authMode) !== 'oauth') {
        sendJson(res, 200, {
          ok: false,
          error: 'authMode is not oauth',
          hint: 'Switch ORACLE_HCM_AUTH to oauth to test token refresh.',
        });
        return;
      }
      const started = Date.now();
      // fetchOAuthToken returns access_token string only — get expiry via raw fetch
      const tokenUrl = assertSafeHttpUrl(body.tokenUrl, 'tokenUrl');
      const clientId = String(body.clientId ?? '');
      const clientSecret = String(body.clientSecret ?? '');
      const form = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      });
      const tres = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
        redirect: 'error',
      });
      if (!tres.ok) {
        sendJson(res, 200, {
          ok: false,
          status: tres.status,
          latencyMs: Date.now() - started,
          error: 'Token request failed',
          note: 'Client secret was not logged or returned.',
        });
        return;
      }
      const data = await tres.json();
      const expiresIn = Number(data.expires_in ?? 3600);
      sendJson(res, 200, {
        ok: true,
        hasToken: Boolean(data.access_token),
        tokenType: data.token_type ?? 'Bearer',
        expiresInSec: expiresIn,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
        refreshAvailable: true,
        latencyMs: Date.now() - started,
        note: 'Access token value never returned. Unofficial setup UI — not Oracle.',
      });
    } catch (e) {
      sendJson(res, e?.status ?? 500, {
        ok: false,
        error: e instanceof Error ? e.message : 'OAuth status failed',
      });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/test-connection') {
    try {
      const body = await readJsonBody(req);
      log('test-connection', {
        baseUrl: String(body.baseUrl ?? '').replace(/\/+$/, ''),
        apiVersion: body.apiVersion ?? '11.13.18.05',
        authMode: sanitizeAuthMode(body.authMode),
        // deliberately omit username/password/token/secret
      });
      const result = await testConnection(body);
      sendJson(res, 200, result);
    } catch (e) {
      const status = e?.status ?? 500;
      log('test-connection failed', e instanceof Error ? e.message : 'error');
      sendJson(res, status, {
        ok: false,
        error: e instanceof Error ? e.message : 'Test failed',
      });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/write-env') {
    try {
      const body = await readJsonBody(req);
      if (!body.baseUrl) {
        sendJson(res, 400, { ok: false, error: 'baseUrl required' });
        return;
      }
      const target = path.join(ROOT, '.env.local');
      const content = envLocalContent(body);
      fs.writeFileSync(target, content, { mode: 0o600 });
      log('wrote .env.local (secrets not logged)', {
        path: target,
        authMode: sanitizeAuthMode(body.authMode),
        writeMode: Boolean(body.writeMode),
      });
      sendJson(res, 200, {
        ok: true,
        path: target,
        note: 'Wrote .env.local with mode 0600. Secrets were not logged or returned.',
      });
    } catch (e) {
      log('write-env failed', e instanceof Error ? e.message : 'error');
      sendJson(res, 500, {
        ok: false,
        error: e instanceof Error ? e.message : 'Write failed',
      });
    }
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res, url.pathname);
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
});

function canBind(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.listen(port, HOST, () => {
      tester.close(() => resolve(true));
    });
  });
}

async function main() {
  const candidates = [PORT, 8792, 8793, 8800, 8879, 8890].filter(
    (p, i, a) => a.indexOf(p) === i,
  );
  let chosen = null;
  for (const port of candidates) {
    if (await canBind(port)) {
      chosen = port;
      break;
    }
    log(`port ${port} in use — trying fallback`);
  }
  if (chosen == null) {
    log('FATAL: could not bind setup UI (8790 and fallbacks busy)');
    process.exit(1);
  }
  server.listen(chosen, HOST, () => {
    log(`listening on http://${HOST}:${chosen}`);
    if (chosen !== PORT) log(`preferred ${PORT} busy; bound ${chosen} instead`);
    log('Unofficial setup wizard — not affiliated with Oracle Corporation.');
    log('Open the URL above in your browser. Secrets stay in the browser / are never logged.');
  });
}

main().catch((e) => {
  log('FATAL', e);
  process.exit(1);
});
