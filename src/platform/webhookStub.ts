/**
 * Atom / BP webhook receiver with HMAC signing, rotating secrets, and optional mTLS.
 * Set ORACLE_HCM_WEBHOOK_SECRET (primary) and ORACLE_HCM_WEBHOOK_SECRETS (comma-separated
 * rotating set). Header: X-HCM-Signature: sha256=<hex>
 * mTLS: ORACLE_HCM_WEBHOOK_MTLS=1 + ORACLE_HCM_WEBHOOK_TLS_KEY / _CERT / _CA
 * Unofficial — localhost demos / agent wiring; not an Oracle event bus.
 */

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import { createHmac, timingSafeEqual } from 'node:crypto';

export type WebhookEvent = {
  id: string;
  receivedAt: string;
  source: string;
  headers: Record<string, string>;
  body: unknown;
  signatureValid?: boolean;
  mtlsPeer?: string;
};

export type WebhookReceiverOptions = {
  secret?: string;
  /** Additional rotating secrets (accepted during rotation window) */
  secrets?: string[];
  requireSignature?: boolean;
  /** Enable HTTPS + client cert request */
  mtls?: boolean;
  tlsKeyPath?: string;
  tlsCertPath?: string;
  tlsCaPath?: string;
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

/** Verify against primary + rotating secret set. */
export function verifyAgainstSecrets(
  secrets: string[],
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
): boolean {
  for (const s of secrets) {
    if (s && verifyWebhookSignature(s, rawBody, signatureHeader)) return true;
  }
  return false;
}

function pickSignature(headers: http.IncomingHttpHeaders): string | undefined {
  const h =
    headers['x-hcm-signature'] ??
    headers['x-hub-signature-256'] ??
    headers['x-signature'];
  if (Array.isArray(h)) return h[0];
  return h;
}

function resolveSecrets(opts: WebhookReceiverOptions): string[] {
  const list: string[] = [];
  const primary = opts.secret ?? process.env.ORACLE_HCM_WEBHOOK_SECRET;
  if (primary) list.push(primary);
  if (opts.secrets) list.push(...opts.secrets.filter(Boolean));
  const envRot = process.env.ORACLE_HCM_WEBHOOK_SECRETS;
  if (envRot) {
    for (const part of envRot.split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!list.includes(part)) list.push(part);
    }
  }
  return list;
}

export class WebhookReceiver {
  private events: WebhookEvent[] = [];
  private server?: http.Server | https.Server;
  private seq = 0;
  private secrets: string[];
  private requireSignature: boolean;
  private mtls: boolean;
  private tlsKeyPath?: string;
  private tlsCertPath?: string;
  private tlsCaPath?: string;
  private boundPort?: number;

  constructor(opts: WebhookReceiverOptions = {}) {
    this.secrets = resolveSecrets(opts);
    this.requireSignature = opts.requireSignature ?? this.secrets.length > 0;
    this.mtls =
      opts.mtls ??
      (process.env.ORACLE_HCM_WEBHOOK_MTLS === '1' ||
        process.env.ORACLE_HCM_WEBHOOK_MTLS === 'true');
    this.tlsKeyPath = opts.tlsKeyPath ?? process.env.ORACLE_HCM_WEBHOOK_TLS_KEY;
    this.tlsCertPath = opts.tlsCertPath ?? process.env.ORACLE_HCM_WEBHOOK_TLS_CERT;
    this.tlsCaPath = opts.tlsCaPath ?? process.env.ORACLE_HCM_WEBHOOK_TLS_CA;
  }

  get signingEnabled(): boolean {
    return this.secrets.length > 0;
  }

  get mtlsEnabled(): boolean {
    return this.mtls;
  }

  /** Rotate in a new primary secret; previous secrets remain valid until cleared. */
  rotateSecret(newSecret: string, keepPrevious = true): { secretsCount: number } {
    if (!keepPrevious) this.secrets = [];
    if (!this.secrets.includes(newSecret)) this.secrets.unshift(newSecret);
    this.requireSignature = true;
    return { secretsCount: this.secrets.length };
  }

  list(limit = 50): WebhookEvent[] {
    return this.events.slice(-limit);
  }

  clear(): void {
    this.events = [];
  }

  async start(port: number, host = '127.0.0.1'): Promise<string> {
    if (this.server && this.boundPort != null) {
      const proto = this.mtls ? 'https' : 'http';
      return `${proto}://${host}:${this.boundPort}/webhook`;
    }

    const handler = (req: http.IncomingMessage, res: http.ServerResponse) => {
      if (req.method === 'GET' && req.url?.startsWith('/webhook/events')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            events: this.list(),
            signingEnabled: this.signingEnabled,
            mtlsEnabled: this.mtls,
            rotatingSecrets: this.secrets.length,
          }),
        );
        return;
      }
      if (req.method === 'GET' && (req.url === '/webhook' || req.url === '/webhook/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: true,
            signingEnabled: this.signingEnabled,
            requireSignature: this.requireSignature,
            rotatingSecrets: this.secrets.length,
            mtlsEnabled: this.mtls,
            signatureHeader: 'X-HCM-Signature: sha256=<hmac-hex>',
            note: 'Unofficial webhook stub — HMAC + optional rotating secrets / mTLS.',
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

          if (this.secrets.length && this.requireSignature) {
            const sig = pickSignature(req.headers);
            const ok = verifyAgainstSecrets(this.secrets, rawBuf, sig);
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
          const peer =
            (req.socket as { getPeerCertificate?: () => { subject?: { CN?: string } } })
              .getPeerCertificate?.()?.subject?.CN ?? undefined;
          this.events.push({
            id: `wh-${++this.seq}`,
            receivedAt: new Date().toISOString(),
            source: req.url ?? '/webhook',
            headers,
            body,
            signatureValid: this.secrets.length ? true : undefined,
            mtlsPeer: peer,
          });
          if (this.events.length > 500) this.events = this.events.slice(-400);
          res.writeHead(202, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              accepted: true,
              unofficial: true,
              signed: this.secrets.length > 0,
              mtls: this.mtls,
            }),
          );
        });
        return;
      }
      res.writeHead(404).end();
    };

    if (this.mtls) {
      if (!this.tlsKeyPath || !this.tlsCertPath) {
        throw new Error(
          'mTLS requires ORACLE_HCM_WEBHOOK_TLS_KEY and ORACLE_HCM_WEBHOOK_TLS_CERT (and optional _CA)',
        );
      }
      const tlsOpts: https.ServerOptions = {
        key: fs.readFileSync(this.tlsKeyPath),
        cert: fs.readFileSync(this.tlsCertPath),
        requestCert: true,
        rejectUnauthorized: Boolean(this.tlsCaPath),
      };
      if (this.tlsCaPath) tlsOpts.ca = fs.readFileSync(this.tlsCaPath);
      this.server = https.createServer(tlsOpts, handler);
    } else {
      this.server = http.createServer(handler);
    }

    await new Promise<void>((resolve, reject) => {
      this.server!.listen(port, host, () => resolve());
      this.server!.on('error', reject);
    });
    const addr = this.server.address();
    this.boundPort = typeof addr === 'object' && addr ? addr.port : port;
    const proto = this.mtls ? 'https' : 'http';
    return `${proto}://${host}:${this.boundPort}/webhook`;
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
