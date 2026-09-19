/**
 * Minimal Atom / BP webhook receiver stub (localhost).
 * Not a production event bus — for local agent wiring demos only.
 */

import http from 'node:http';

export type WebhookEvent = {
  id: string;
  receivedAt: string;
  source: string;
  headers: Record<string, string>;
  body: unknown;
};

export class WebhookReceiver {
  private events: WebhookEvent[] = [];
  private server?: http.Server;
  private seq = 0;

  list(limit = 50): WebhookEvent[] {
    return this.events.slice(-limit);
  }

  clear(): void {
    this.events = [];
  }

  async start(port: number, host = '127.0.0.1'): Promise<string> {
    if (this.server) return `http://${host}:${port}/webhook`;
    this.server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url?.startsWith('/webhook/events')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ events: this.list() }));
        return;
      }
      if (req.method === 'POST' && (req.url === '/webhook' || req.url?.startsWith('/webhook/'))) {
        const chunks: Buffer[] = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          let body: unknown = Buffer.concat(chunks).toString('utf8');
          try {
            body = JSON.parse(String(body));
          } catch {
            /* keep raw */
          }
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(req.headers)) {
            if (typeof v === 'string') headers[k] = v;
          }
          this.events.push({
            id: `wh-${++this.seq}`,
            receivedAt: new Date().toISOString(),
            source: req.url ?? '/webhook',
            headers,
            body,
          });
          if (this.events.length > 500) this.events = this.events.slice(-400);
          res.writeHead(202, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ accepted: true, unofficial: true }));
        });
        return;
      }
      res.writeHead(404).end();
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.listen(port, host, () => resolve());
      this.server!.on('error', reject);
    });
    return `http://${host}:${port}/webhook`;
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve, reject) => {
      this.server!.close((err) => (err ? reject(err) : resolve()));
    });
    this.server = undefined;
  }
}
