/**
 * Streamable HTTP transport — POST /mcp
 * Bearer auth required unless ORACLE_HCM_HTTP_AUTH_OFF=1.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Config } from '../config.js';
import { createMcpServer, createToolContext, SERVER_INFO } from '../mcp/server.js';
import { pickBearerOrHeader, safeEqual } from '../policy/cryptoSafe.js';
import { executeApproved } from '../mcp/tools/helpers.js';

export type HttpTransportHandle = {
  port: number;
  url: string;
  close: () => Promise<void>;
};

const MAX_BODY = 1024 * 1024;

function localhostOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // non-browser
  try {
    const u = new URL(origin);
    return u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.hostname === '::1';
  } catch {
    return false;
  }
}

function applyCors(res: ServerResponse, origin: string | undefined): void {
  if (origin && localhostOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-HCM-Token, Accept');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
  }
}

function httpAuthOk(req: IncomingMessage, cfg: Config): boolean {
  if (cfg.httpAuthRequired === false) return true;
  const expected = cfg.httpToken ?? cfg.approvalToken;
  if (!expected) return false;
  const provided = pickBearerOrHeader(req.headers.authorization, req.headers['x-hcm-token']);
  return Boolean(provided && safeEqual(provided, expected));
}

function sendJson(res: ServerResponse, status: number, body: unknown, origin?: string): void {
  applyCors(res, origin);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

export async function startHttp(cfg: Config, port: number): Promise<HttpTransportHandle> {
  const sharedCtx = createToolContext(cfg);

  const httpServer: Server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
      const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;

      if (origin && !localhostOrigin(origin)) {
        sendJson(res, 403, { error: 'Origin not allowed' }, origin);
        return;
      }

      if (req.method === 'OPTIONS') {
        applyCors(res, origin);
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(
          res,
          200,
          {
            ok: true,
            service: 'oracle-hcm-mcp',
            unofficial: true,
            writeMode: cfg.writeMode,
            version: SERVER_INFO.version,
            authRequired: cfg.httpAuthRequired !== false,
          },
          origin,
        );
        return;
      }

      if (!httpAuthOk(req, cfg)) {
        applyCors(res, origin);
        res.setHeader('WWW-Authenticate', 'Bearer');
        sendJson(
          res,
          401,
          {
            error: 'Unauthorized. Send Authorization: Bearer <ORACLE_HCM_HTTP_TOKEN>',
          },
          origin,
        );
        return;
      }

      if (req.method === 'GET' && url.pathname === '/approvals') {
        sendJson(
          res,
          200,
          {
            pending: sharedCtx.approvals.listPending().map((i) => ({
              approval_id: i.approvalId,
              tool: i.toolName,
              summary: i.summary,
              expires_at: new Date(i.expiresAt).toISOString(),
            })),
            backend: sharedCtx.approvals.backendKind,
            backendPath: sharedCtx.approvals.backendPath ?? null,
          },
          origin,
        );
        return;
      }

      const approveMatch = url.pathname.match(/^\/approvals\/([^/]+)\/(approve|deny)$/);
      if (req.method === 'POST' && approveMatch) {
        const approvalId = decodeURIComponent(approveMatch[1]!);
        const action = approveMatch[2];
        try {
          if (action === 'deny') {
            const intent = sharedCtx.approvals.deny(approvalId);
            sendJson(
              res,
              200,
              { denied: true, approval_id: intent.approvalId, tool: intent.toolName },
              origin,
            );
            return;
          }
          const { intent, result } = await sharedCtx.approvals.approve(approvalId, (toolName, args) =>
            executeApproved(sharedCtx, toolName, args),
          );
          sendJson(
            res,
            200,
            {
              approved: true,
              approval_id: intent.approvalId,
              tool: intent.toolName,
              result,
            },
            origin,
          );
        } catch (e) {
          sendJson(res, 400, { error: e instanceof Error ? e.message : String(e) }, origin);
        }
        return;
      }

      if (req.method === 'POST' && url.pathname === '/approvals/bulk-approve') {
        const body = (await readJsonBody(req)) as { ids?: string[] };
        const ids = Array.isArray(body?.ids) ? body.ids : [];
        const results: unknown[] = [];
        for (const id of ids) {
          try {
            const { intent, result } = await sharedCtx.approvals.approve(id, (toolName, args) =>
              executeApproved(sharedCtx, toolName, args),
            );
            results.push({ approval_id: id, ok: true, tool: intent.toolName, result });
          } catch (e) {
            results.push({ approval_id: id, ok: false, error: e instanceof Error ? e.message : String(e) });
          }
        }
        sendJson(res, 200, { bulk: true, results }, origin);
        return;
      }

      if (url.pathname !== '/mcp') {
        sendJson(res, 404, { error: 'Not found. Use POST /mcp' }, origin);
        return;
      }

      applyCors(res, origin);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      const mcp = createMcpServer(cfg, sharedCtx);
      await mcp.connect(transport);

      let body: unknown;
      if (req.method === 'POST') {
        body = await readJsonBody(req);
      }
      try {
        await transport.handleRequest(req, res, body);
      } finally {
        try {
          await transport.close();
        } catch {
          /* ignore */
        }
        try {
          await mcp.close();
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      if (!res.headersSent) {
        sendJson(res, 500, { error: e instanceof Error ? e.message : 'Internal error' });
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(port, '127.0.0.1', () => resolve());
    httpServer.on('error', reject);
  });

  const addr = httpServer.address();
  const bound = typeof addr === 'object' && addr ? addr.port : port;

  console.error(
    `[oracle-hcm-mcp] Streamable HTTP listening on http://127.0.0.1:${bound}/mcp (writeMode=${cfg.writeMode}, auth=${cfg.httpAuthRequired !== false})`,
  );
  console.error('[oracle-hcm-mcp] Unofficial — not affiliated with Oracle Corporation.');

  return {
    port: bound,
    url: `http://127.0.0.1:${bound}/mcp`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c) => {
      const buf = Buffer.isBuffer(c) ? c : Buffer.from(c);
      size += buf.length;
      if (size > MAX_BODY) {
        req.destroy();
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}
