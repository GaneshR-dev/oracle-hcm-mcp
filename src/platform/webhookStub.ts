/**
 * Atom / BP webhook receiver with optional HMAC signature verification.
 * Set ORACLE_HCM_WEBHOOK_SECRET to require signed payloads (production-style).
 * Header: X-HCM-Signature: sha256=<hex>  (HMAC-SHA256 of raw body)
 * Also accepts: X-Hub-Signature-256: sha256=<hex> (GitHub-style alias)
 * Unofficial — localhost demos / agent wiring; not an Oracle event bus.
 */

import http from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';

export type WebhookEvent = {
  id: string;
  receivedAt: string;
  source: string;
  headers: Record<string, string>;
  body: unknown;
  signatureValid?: boolean;
};

export type WebhookReceiverOptions = {
  /** Shared secret for HMAC-SHA256. If set, unsigned / bad signatures are rejected (401). */
  secret?: string;
  /** When secret is set, require signature (default true). */
  requireSignature?: boolean;
};

export function signWebhookBody(secret: string, rawBody: string | Buffer): string {
  const mac = createHmac('sha256', secret).update(rawBody).digest('hex');
  return `sha256=${mac}`;
}

export function verifyWebhookSignature(
  secret: string,
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader) return false;
  const expected = signWebhookBody(secret, rawBody);
  const provided = signatureHeader.trim();
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function pickSignature(headers: http.IncomingHttpHeaders): string | undefined {
  const h =
    headers['x-hcm-signature'] ??
    headers['x-hub-signature-256'] ??
    headers['x-signature'];
  if (Array.isArray(h)) return h[0];
  return h;
}

export class WebhookReceiver {
  private events: WebhookEvent[] = [];
  private server?: http.Server;
  private seq = 0;
  private secret?: string;
  private requireSignature: boolean;

  constructor(opts: WebhookReceiverOptions = {}) {
    this.secret = opts.secret ?? process.env.ORACLE_HCM_WEBHOOK_SECRET;
    this.requireSignature = opts.requireSignature ?? Boolean(this.secret);
  }

  get signingEnabled(): boolean {
    return Boolean(this.secret);
  }

  list(limit = 50): WebhookEvent[] {
    return this.events.slice(-limit);
  }

  clear(): void {
    this.events = [];
  }

  private boundPort?: number;

  async start(port: number, host = '127.0.0.1'): Promise<string> {
    if (this.server && this.boundPort != null) return `http://${host}:${this.boundPort}/webhook`;
    this.server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url?.startsWith('/webhook/events')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ events: this.list(), signingEnabled: this.signingEnabled }));
        return;
      }
      if (req.method === 'GET' && (req.url === '/webhook' || req.url === '/webhook/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: true,
            signingEnabled: this.signingEnabled,
            requireSignature: this.requireSignature,
            signatureHeader: 'X-HCM-Signature: sha256=<hmac-hex>',
            note: 'Unofficial webhook stub — POST body with HMAC when ORACLE_HCM_WEBHOOK_SECRET is set.',
          }),
        );
        return;
      }
      if (req.method === 'POST' && (req.url === '/webhook' || req.url?.startsWith('/webhook/'))) {
        const chunks: Buffer[] = [];
        req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        req.on('end', () => {
          const rawBuf = Buffer.concat(chunks);
          const raw = rawBuf.toString('utf8');

          if (this.secret && this.requireSignature) {
            const sig = pickSignature(req.headers);
            const ok = verifyWebhookSignature(this.secret, rawBuf, sig);
            if (!ok) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  accepted: false,
                  error: 'Invalid or missing webhook signature',
                  hint: 'Send X-HCM-Signature: sha256=<hmac-sha256-hex of raw body>',
                }),
              );
              return;
            }
          }

          let body: unknown = raw;
          try {
            body = JSON.parse(raw);
          } catch {
            /* keep raw */
          }
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(req.headers)) {
            if (typeof v === 'string') headers[k] = v;
          }
          const signed = Boolean(this.secret);
          this.events.push({
            id: `wh-${++this.seq}`,
            receivedAt: new Date().toISOString(),
            source: req.url ?? '/webhook',
            headers,
            body,
            signatureValid: signed ? true : undefined,
          });
          if (this.events.length > 500) this.events = this.events.slice(-400);
          res.writeHead(202, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ accepted: true, unofficial: true, signed }));
        });
        return;
      }
      res.writeHead(404).end();
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.listen(port, host, () => resolve());
      this.server!.on('error', reject);
    });
    const addr = this.server.address();
    this.boundPort = typeof addr === 'object' && addr ? addr.port : port;
    return `http://${host}:${this.boundPort}/webhook`;
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve, reject) => {
      this.server!.close((err) => (err ? reject(err) : resolve()));
    });
    this.server = undefined;
    this.boundPort = undefined;
  }
}
