/**
 * Streamable HTTP transport — POST /mcp
 */

import { createServer, type Server } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Config } from '../config.js';
import { createMcpServer, createToolContext } from '../mcp/server.js';

export type HttpTransportHandle = {
  port: number;
  url: string;
  close: () => Promise<void>;
};

export async function startHttp(cfg: Config, port: number): Promise<HttpTransportHandle> {
  // Shared tool context so approvals persist across sessions in approval mode
  const sharedCtx = createToolContext(cfg);

  const httpServer: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          service: 'oracle-hcm-mcp',
          unofficial: true,
          writeMode: cfg.writeMode,
          version: '0.5.0',
        }),
      );
      return;
    }

    // Optional HTTP approval helpers for multi-node / ops (same store as MCP tools)
    if (req.method === 'GET' && url.pathname === '/approvals') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          pending: sharedCtx.approvals.listPending().map((i) => ({
            approval_id: i.approvalId,
            tool: i.toolName,
            summary: i.summary,
            expires_at: new Date(i.expiresAt).toISOString(),
          })),
          backend: sharedCtx.approvals.backendKind,
          backendPath: sharedCtx.approvals.backendPath ?? null,
        }),
      );
      return;
    }

    if (url.pathname !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found. Use POST /mcp' }));
      return;
    }

    // Stateless-friendly: new transport + server per request (shared approvals ctx)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const mcp = createMcpServer(cfg, sharedCtx);
    await mcp.connect(transport);

    let body: unknown;
    if (req.method === 'POST') {
      body = await readJsonBody(req);
    }
    await transport.handleRequest(req, res, body);
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(port, '127.0.0.1', () => resolve());
    httpServer.on('error', reject);
  });

  const addr = httpServer.address();
  const bound = typeof addr === 'object' && addr ? addr.port : port;

  console.error(
    `[oracle-hcm-mcp] Streamable HTTP listening on http://127.0.0.1:${bound}/mcp (writeMode=${cfg.writeMode})`,
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

function readJsonBody(req: import('node:http').IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
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
