/**
 * Fusion Atom feed CDC helpers — unofficial change detection.
 * Cursor/checkpoint is local (file), not Oracle CDC.
 */

import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export type AtomFeedMeta = {
  feedId: string;
  title: string;
  collection: string;
  href: string;
  updated?: string;
};

export type ParsedAtomEntry = {
  entryId: string;
  title: string;
  updated: string;
  published?: string;
  collection?: string;
  changeType?: string;
  contentType?: string;
  content?: unknown;
  links?: { rel?: string; href?: string }[];
  raw?: unknown;
};

export type AtomCheckpoint = {
  feedId: string;
  cursor: string;
  updatedAt: string;
  lastEntryId?: string;
  consumedCount: number;
};

export type CheckpointStore = {
  get(feedId: string): AtomCheckpoint | undefined;
  set(cp: AtomCheckpoint): void;
  list(): AtomCheckpoint[];
  clear(feedId?: string): void;
  path?: string;
};

/** Parse Fusion-ish Atom entry objects (JSON collection items or XML-derived). */
export function parseAtomEntry(raw: Record<string, unknown>): ParsedAtomEntry {
  const entryId = String(
    raw.EntryId ?? raw.id ?? raw.Id ?? raw['atom:id'] ?? randomUUID(),
  );
  const title = String(raw.Title ?? raw.title ?? raw['atom:title'] ?? entryId);
  const updated = String(
    raw.Updated ?? raw.updated ?? raw.published ?? raw['atom:updated'] ?? new Date().toISOString(),
  );
  const published = raw.published != null ? String(raw.published) : undefined;
  const collection = raw.Collection != null ? String(raw.Collection) : raw.collection != null ? String(raw.collection) : undefined;
  const changeType = raw.ChangeType != null ? String(raw.ChangeType) : raw.changeType != null ? String(raw.changeType) : undefined;
  return {
    entryId,
    title,
    updated,
    published,
    collection,
    changeType,
    contentType: raw.contentType != null ? String(raw.contentType) : undefined,
    content: raw.content ?? raw.Content ?? undefined,
    links: Array.isArray(raw.links) ? (raw.links as { rel?: string; href?: string }[]) : undefined,
    raw,
  };
}

/** Build a stable cursor from updated timestamp + entry id. */
export function entryCursor(entry: ParsedAtomEntry): string {
  return `${entry.updated}::${entry.entryId}`;
}

export function compareCursors(a: string, b: string): number {
  const [au, aid] = a.split('::');
  const [bu, bid] = b.split('::');
  const ta = Date.parse(au ?? '') || 0;
  const tb = Date.parse(bu ?? '') || 0;
  if (ta !== tb) return ta - tb;
  return String(aid ?? '').localeCompare(String(bid ?? ''));
}

/** Filter entries strictly after a cursor (updated::id). */
export function entriesAfterCursor(
  entries: ParsedAtomEntry[],
  cursor?: string | null,
): ParsedAtomEntry[] {
  if (!cursor) return [...entries].sort((x, y) => compareCursors(entryCursor(x), entryCursor(y)));
  return entries
    .filter((e) => compareCursors(entryCursor(e), cursor) > 0)
    .sort((x, y) => compareCursors(entryCursor(x), entryCursor(y)));
}

/** Minimal Atom XML document for e2e (dummy / local). */
export function entriesToAtomXml(
  feedTitle: string,
  feedId: string,
  entries: ParsedAtomEntry[],
): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const parts = entries.map((e) => {
    return `  <entry>
    <id>${esc(e.entryId)}</id>
    <title>${esc(e.title)}</title>
    <updated>${esc(e.updated)}</updated>
    ${e.collection ? `<category term="${esc(e.collection)}"/>` : ''}
    ${e.changeType ? `<summary>${esc(e.changeType)}</summary>` : ''}
  </entry>`;
  });
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${esc(feedId)}</id>
  <title>${esc(feedTitle)}</title>
  <updated>${esc(entries[0]?.updated ?? new Date().toISOString())}</updated>
${parts.join('\n')}
</feed>
`;
}

/** Parse a minimal Atom XML feed into entries (sufficient for dummy e2e). */
export function parseAtomXml(xml: string): ParsedAtomEntry[] {
  const entries: ParsedAtomEntry[] = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml))) {
    const block = m[1];
    const grab = (tag: string) => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
      return r ? r[1].trim() : undefined;
    };
    const cat = /<category[^>]*term="([^"]+)"/i.exec(block);
    entries.push(
      parseAtomEntry({
        EntryId: grab('id'),
        Title: grab('title'),
        Updated: grab('updated'),
        Collection: cat?.[1],
        ChangeType: grab('summary'),
      }),
    );
  }
  return entries;
}

export function createMemoryCheckpointStore(): CheckpointStore {
  const map = new Map<string, AtomCheckpoint>();
  return {
    get: (id) => map.get(id),
    set: (cp) => {
      map.set(cp.feedId, cp);
    },
    list: () => [...map.values()],
    clear: (feedId) => {
      if (feedId) map.delete(feedId);
      else map.clear();
    },
  };
}

export function createFileCheckpointStore(filePath: string): CheckpointStore {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const readAll = (): Record<string, AtomCheckpoint> => {
    try {
      if (!fs.existsSync(filePath)) return {};
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, AtomCheckpoint>;
    } catch {
      return {};
    }
  };

  const writeAll = (data: Record<string, AtomCheckpoint>) => {
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
  };

  return {
    path: filePath,
    get: (id) => readAll()[id],
    set: (cp) => {
      const all = readAll();
      all[cp.feedId] = cp;
      writeAll(all);
    },
    list: () => Object.values(readAll()),
    clear: (feedId) => {
      if (!feedId) {
        writeAll({});
        return;
      }
      const all = readAll();
      delete all[feedId];
      writeAll(all);
    },
  };
}

export function defaultCheckpointPath(): string {
  const env = process.env.ORACLE_HCM_ATOM_CHECKPOINT_PATH;
  if (env) return env;
  return path.join(os.tmpdir(), 'oracle-hcm-mcp', 'atom-checkpoints.json');
}

export function createCheckpointStoreFromEnv(): CheckpointStore {
  const mode = (process.env.ORACLE_HCM_ATOM_CHECKPOINT ?? 'file').toLowerCase();
  if (mode === 'memory' || mode === 'mem') return createMemoryCheckpointStore();
  return createFileCheckpointStore(defaultCheckpointPath());
}

export function feedIdForCollection(collection: string): string {
  return `atom:${collection}`;
}

export function hashBody(body: string): string {
  return createHash('sha256').update(body).digest('hex').slice(0, 16);
}
