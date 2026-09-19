/**
 * Redaction audit log — records which sensitive fields were stripped/masked
 * and when. Complements redactDeep(); used by tools to expose audit trail.
 * Unofficial — local process only.
 */

export type RedactionEvent = {
  ts: string;
  tool?: string;
  path: string;
  field: string;
  action: 'redacted' | 'masked';
};

const MAX = 1000;
const events: RedactionEvent[] = [];

export function recordRedaction(ev: Omit<RedactionEvent, 'ts'> & { ts?: string }): void {
  events.push({
    ts: ev.ts ?? new Date().toISOString(),
    tool: ev.tool,
    path: ev.path,
    field: ev.field,
    action: ev.action,
  });
  if (events.length > MAX) events.splice(0, events.length - 800);
}

export function listRedactionEvents(limit = 50, tool?: string): RedactionEvent[] {
  let list = events;
  if (tool) list = list.filter((e) => e.tool === tool);
  return list.slice(-limit);
}

export function clearRedactionEvents(): void {
  events.length = 0;
}

export function redactionStats(): { total: number; byAction: Record<string, number> } {
  const byAction: Record<string, number> = {};
  for (const e of events) byAction[e.action] = (byAction[e.action] ?? 0) + 1;
  return { total: events.length, byAction };
}
