/**
 * Pending write intents. Default is in-memory; set ORACLE_HCM_APPROVAL_STORE_PATH
 * (or ORACLE_HCM_APPROVAL_STORE=file|sqlite:…) for multi-process / multi-node sharing.
 * Unofficial — not a substitute for IAM.
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

export interface PendingIntent {
  approvalId: string;
  toolName: string;
  args: Record<string, unknown>;
  summary: string;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'approved' | 'denied' | 'executed' | 'expired';
}

export type ExecuteFn = (toolName: string, args: Record<string, unknown>) => Promise<unknown>;

type IntentMap = Record<string, PendingIntent>;

export interface ApprovalBackend {
  load(): IntentMap;
  save(map: IntentMap): void;
  transact?<T>(fn: (map: IntentMap) => T): T;
  readonly kind: string;
  readonly path?: string;
}

class MemoryBackend implements ApprovalBackend {
  kind = 'memory';
  private data: IntentMap = {};
  load(): IntentMap {
    return { ...this.data };
  }
  save(map: IntentMap): void {
    this.data = { ...map };
  }
  transact<T>(fn: (map: IntentMap) => T): T {
    const map = { ...this.data };
    const result = fn(map);
    this.data = { ...map };
    return result;
  }
}

class FileBackend implements ApprovalBackend {
  kind = 'file';
  path: string;
  constructor(filePath: string) {
    this.path = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  load(): IntentMap {
    let out: IntentMap = {};
    this.withLock(() => {
      out = this.readUnlocked();
    });
    return out;
  }
  save(map: IntentMap): void {
    this.withLock(() => this.writeUnlocked(map));
  }
  transact<T>(fn: (map: IntentMap) => T): T {
    let result!: T;
    this.withLock(() => {
      const map = this.readUnlocked();
      result = fn(map);
      this.writeUnlocked(map);
    });
    return result;
  }
  private readUnlocked(): IntentMap {
    try {
      if (!fs.existsSync(this.path)) return {};
      const raw = fs.readFileSync(this.path, 'utf8');
      return JSON.parse(raw) as IntentMap;
    } catch {
      return {};
    }
  }
  private writeUnlocked(map: IntentMap): void {
    const tmp = `${this.path}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(map, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, this.path);
    try {
      fs.chmodSync(this.path, 0o600);
    } catch {
      /* ignore */
    }
  }

  private withLock(fn: () => void): void {
    const lock = `${this.path}.lock`;
    const deadline = Date.now() + 5000;
    for (;;) {
      try {
        const fd = fs.openSync(lock, 'wx');
        try {
          fn();
        } finally {
          fs.closeSync(fd);
          try {
            fs.unlinkSync(lock);
          } catch {
            /* ignore */
          }
        }
        return;
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (code !== 'EEXIST') throw e;
        if (Date.now() > deadline) throw new Error('Approval file store lock timeout');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
      }
    }
  }
}

/**
 * SQLite-backed store using Node's built-in node:sqlite (Node 22.5+).
 * Falls back to file JSON if DatabaseSync is unavailable.
 */
class SqliteBackend implements ApprovalBackend {
  kind = 'sqlite';
  path: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any;

  constructor(dbPath: string) {
    this.path = dbPath;
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    // node:sqlite DatabaseSync (Node 22.5+); createRequire for ESM
    const req = createRequire(import.meta.url);
    const sqlite = req('node:sqlite') as {
      DatabaseSync: new (p: string) => {
        exec: (s: string) => void;
        prepare: (s: string) => {
          run: (...a: unknown[]) => void;
          all: (...a: unknown[]) => { id: string; payload: string }[];
        };
      };
    };
    this.db = new sqlite.DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL
      );
    `);
  }

  load(): IntentMap {
    const rows = this.db.prepare('SELECT id, payload FROM approvals').all() as {
      id: string;
      payload: string;
    }[];
    const map: IntentMap = {};
    for (const r of rows) {
      try {
        map[r.id] = JSON.parse(r.payload) as PendingIntent;
      } catch {
        /* skip corrupt */
      }
    }
    return map;
  }

  save(map: IntentMap): void {
    this.db.exec('BEGIN');
    try {
      this.db.exec('DELETE FROM approvals');
      const stmt = this.db.prepare('INSERT INTO approvals (id, payload) VALUES (?, ?)');
      for (const [id, intent] of Object.entries(map)) {
        stmt.run(id, JSON.stringify(intent));
      }
      this.db.exec('COMMIT');
    } catch (e) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw e;
    }
  }
}

function trySqlite(dbPath: string): ApprovalBackend | undefined {
  try {
    return new SqliteBackend(dbPath);
  } catch {
    return undefined;
  }
}

export function resolveApprovalBackend(opts?: {
  store?: string;
  storePath?: string;
}): ApprovalBackend {
  const store = (opts?.store ?? process.env.ORACLE_HCM_APPROVAL_STORE ?? '').toLowerCase();
  const storePath =
    opts?.storePath ??
    process.env.ORACLE_HCM_APPROVAL_STORE_PATH ??
    (store.startsWith('file:') || store.startsWith('sqlite:')
      ? store.replace(/^(file|sqlite):/, '')
      : undefined);

  if (store === 'memory' || store === 'mem' || (!store && !storePath)) {
    if (!storePath && (store === 'memory' || store === 'mem' || store === '')) {
      return new MemoryBackend();
    }
  }

  if (store.startsWith('sqlite') || store === 'sqlite') {
    const p =
      storePath ||
      path.join(os.tmpdir(), 'oracle-hcm-mcp', 'approvals.sqlite');
    return trySqlite(p) ?? new FileBackend(p.replace(/\.sqlite$/, '.json'));
  }

  if (store.startsWith('file') || store === 'file' || storePath) {
    const p =
      storePath ||
      path.join(os.tmpdir(), 'oracle-hcm-mcp', 'approvals.json');
    return new FileBackend(p);
  }

  return new MemoryBackend();
}

export class ApprovalStore {
  private backend: ApprovalBackend;
  private ttlMs: number;

  constructor(ttlMs = 15 * 60 * 1000, backend?: ApprovalBackend) {
    this.ttlMs = ttlMs;
    this.backend = backend ?? new MemoryBackend();
  }

  get backendKind(): string {
    return this.backend.kind;
  }

  get backendPath(): string | undefined {
    return this.backend.path;
  }

  private withMap<T>(fn: (map: IntentMap) => T): T {
    if (this.backend.transact) {
      return this.backend.transact((map) => {
        this.purgeExpiredIn(map);
        return fn(map);
      });
    }
    const map = this.backend.load();
    this.purgeExpiredIn(map);
    const result = fn(map);
    this.backend.save(map);
    return result;
  }

  create(toolName: string, args: Record<string, unknown>, summary: string): PendingIntent {
    return this.withMap((map) => {
      const now = Date.now();
      const intent: PendingIntent = {
        approvalId: randomUUID(),
        toolName,
        args,
        summary,
        createdAt: now,
        expiresAt: now + this.ttlMs,
        status: 'pending',
      };
      map[intent.approvalId] = intent;
      return intent;
    });
  }

  get(approvalId: string): PendingIntent | undefined {
    return this.withMap((map) => map[approvalId]);
  }

  listPending(): PendingIntent[] {
    return this.withMap((map) =>
      Object.values(map).filter((i) => i.status === 'pending'),
    );
  }

  deny(approvalId: string): PendingIntent {
    return this.withMap((map) => {
      const intent = this.requirePendingIn(map, approvalId);
      intent.status = 'denied';
      return intent;
    });
  }

  async approve(
    approvalId: string,
    execute: ExecuteFn,
  ): Promise<{ intent: PendingIntent; result: unknown }> {
    // Mark approved then execute outside lock window for long calls; re-load after
    const intent = this.withMap((map) => {
      const i = this.requirePendingIn(map, approvalId);
      i.status = 'approved';
      return { ...i, args: { ...i.args } };
    });
    try {
      const result = await execute(intent.toolName, intent.args);
      this.withMap((map) => {
        const i = map[approvalId];
        if (i) i.status = 'executed';
      });
      return { intent: { ...intent, status: 'executed' }, result };
    } catch (e) {
      // Roll back to pending so retry is possible
      this.withMap((map) => {
        const i = map[approvalId];
        if (i && i.status === 'approved') i.status = 'pending';
      });
      throw e;
    }
  }

  private requirePendingIn(map: IntentMap, approvalId: string): PendingIntent {
    const intent = map[approvalId];
    if (!intent) throw new Error(`Unknown approval_id: ${approvalId}`);
    if (intent.status === 'expired' || intent.expiresAt < Date.now()) {
      intent.status = 'expired';
      throw new Error(`Approval expired: ${approvalId}`);
    }
    if (intent.status !== 'pending') {
      throw new Error(`Approval not pending (status=${intent.status}): ${approvalId}`);
    }
    return intent;
  }

  private purgeExpiredIn(map: IntentMap): void {
    const now = Date.now();
    for (const [id, intent] of Object.entries(map)) {
      if (intent.status === 'pending' && intent.expiresAt < now) {
        intent.status = 'expired';
      }
      if (intent.status !== 'pending' && now - intent.createdAt > 60 * 60 * 1000) {
        delete map[id];
      }
    }
  }

  purgeExpired(): void {
    this.withMap(() => undefined);
  }

  clear(): void {
    this.backend.save({});
  }
}

export function createApprovalStore(
  ttlMs = 15 * 60 * 1000,
  opts?: { store?: string; storePath?: string },
): ApprovalStore {
  return new ApprovalStore(ttlMs, resolveApprovalBackend(opts));
}

export function summarizeMutation(toolName: string, args: Record<string, unknown>): string {
  const secret = /token|secret|password|authorization|bearer/i;
  const keys = Object.keys(args).filter((k) => !secret.test(k)).slice(0, 8);
  const brief = keys
    .map((k) => {
      const v = args[k];
      const s = typeof v === 'string' ? v : JSON.stringify(v);
      return `${k}=${(s ?? '').slice(0, 80)}`;
    })
    .join(', ');
  return `${toolName}(${brief})`;
}
