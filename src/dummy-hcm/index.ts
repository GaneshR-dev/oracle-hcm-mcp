#!/usr/bin/env node
/**
 * Dummy Oracle HCM REST mock for local E2E tests.
 * Unofficial — not affiliated with Oracle. Basic auth demo/demo.
 */

import express from 'express';
import { seedStore, type Store } from './data.js';

const API = '/hcmRestApi/resources/11.13.18.05';
const PORT = Number(process.env.DUMMY_HCM_PORT ?? 9090);

function basicAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const h = req.headers.authorization;
  if (!h?.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="dummy-hcm"');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const decoded = Buffer.from(h.slice(6), 'base64').toString('utf8');
  const [user, pass] = decoded.split(':');
  if (user !== 'demo' || pass !== 'demo') {
    res.status(401).json({ error: 'Invalid credentials (use demo/demo)' });
    return;
  }
  next();
}

function collection<T>(items: T[]) {
  return { items, count: items.length, hasMore: false };
}

function matchQ<T extends Record<string, unknown>>(items: T[], q?: string): T[] {
  if (!q) return items;
  // very small ADF-ish filter: key=value or key LIKE 'x' / contains
  const m = q.match(/^(\w+)\s*=\s*'?([^']+)'?$/i);
  if (m) {
    const [, key, val] = m;
    return items.filter((it) => String(it[key] ?? it[key as keyof T] ?? '') === val);
  }
  const lower = q.toLowerCase();
  return items.filter((it) => JSON.stringify(it).toLowerCase().includes(lower));
}

export function createDummyApp(store?: Store): express.Express {
  const s = store ?? seedStore();
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'dummy-hcm', unofficial: true });
  });

  app.use(API, basicAuth);

  // Workers
  app.get(`${API}/workers`, (req, res) => {
    const items = matchQ(s.workers as unknown as Record<string, unknown>[], req.query.q as string);
    const limit = Number(req.query.limit ?? 25);
    const offset = Number(req.query.offset ?? 0);
    res.json(collection(items.slice(offset, offset + limit)));
  });

  app.get(`${API}/workers/:id`, (req, res) => {
    const w = s.workers.find((x) => x.WorkerId === req.params.id);
    if (!w) return res.status(404).json({ error: 'Not found' });
    res.json(w);
  });

  app.post(`${API}/workers`, (req, res) => {
    const id = s.nextId('W');
    const body = req.body ?? {};
    const w = {
      WorkerId: id,
      PersonNumber: body.PersonNumber ?? `P${id}`,
      DisplayName: body.DisplayName ?? `${body.FirstName ?? ''} ${body.LastName ?? ''}`.trim(),
      FirstName: body.FirstName ?? 'New',
      LastName: body.LastName ?? 'Worker',
      emails: body.emails,
    };
    s.workers.push(w);
    res.status(201).json(w);
  });

  app.patch(`${API}/workers/:id`, (req, res) => {
    const w = s.workers.find((x) => x.WorkerId === req.params.id);
    if (!w) return res.status(404).json({ error: 'Not found' });
    Object.assign(w, req.body);
    res.json(w);
  });

  // Absences
  app.get(`${API}/absences`, (req, res) => {
    const items = matchQ(s.absences as unknown as Record<string, unknown>[], req.query.q as string);
    res.json(collection(items));
  });

  app.get(`${API}/absences/:id`, (req, res) => {
    const a = s.absences.find((x) => x.AbsenceId === req.params.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    res.json(a);
  });

  app.post(`${API}/absences`, (req, res) => {
    const id = s.nextId('A');
    const a = {
      AbsenceId: id,
      personNumber: req.body.personNumber ?? 'P1001',
      absenceType: req.body.absenceType ?? 'Vacation',
      startDate: req.body.startDate ?? '2026-10-01',
      endDate: req.body.endDate ?? '2026-10-02',
      status: req.body.status ?? 'SUBMITTED',
    };
    s.absences.push(a);
    res.status(201).json(a);
  });

  app.patch(`${API}/absences/:id`, (req, res) => {
    const a = s.absences.find((x) => x.AbsenceId === req.params.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    Object.assign(a, req.body);
    res.json(a);
  });

  app.delete(`${API}/absences/:id`, (req, res) => {
    const idx = s.absences.findIndex((x) => x.AbsenceId === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Not found' });
    s.absences.splice(idx, 1);
    res.status(204).end();
  });

  app.get(`${API}/absencesBalances`, (req, res) => {
    const items = matchQ(s.balances as unknown as Record<string, unknown>[], req.query.q as string);
    res.json(collection(items));
  });

  // AOR
  app.get(`${API}/areasOfResponsibility`, (req, res) => {
    const items = matchQ(s.aors as unknown as Record<string, unknown>[], req.query.q as string);
    res.json(collection(items));
  });

  app.get(`${API}/areasOfResponsibility/:id`, (req, res) => {
    const a = s.aors.find((x) => x.AreaOfResponsibilityId === req.params.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    res.json(a);
  });

  app.post(`${API}/areasOfResponsibility`, (req, res) => {
    const id = s.nextId('R');
    const a = {
      AreaOfResponsibilityId: id,
      ResponsibilityName: req.body.ResponsibilityName ?? 'Responsibility',
      PersonNumber: req.body.PersonNumber ?? 'P1001',
      Status: req.body.Status ?? 'A',
    };
    s.aors.push(a);
    res.status(201).json(a);
  });

  app.patch(`${API}/areasOfResponsibility/:id`, (req, res) => {
    const a = s.aors.find((x) => x.AreaOfResponsibilityId === req.params.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    Object.assign(a, req.body);
    res.json(a);
  });

  app.delete(`${API}/areasOfResponsibility/:id`, (req, res) => {
    const idx = s.aors.findIndex((x) => x.AreaOfResponsibilityId === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Not found' });
    s.aors.splice(idx, 1);
    res.status(204).end();
  });

  // Checklists
  app.get(`${API}/allocatedChecklists`, (req, res) => {
    const items = matchQ(
      s.checklists as unknown as Record<string, unknown>[],
      req.query.q as string,
    );
    res.json(collection(items));
  });

  app.get(`${API}/allocatedChecklists/:id`, (req, res) => {
    const c = s.checklists.find((x) => x.AllocatedChecklistId === req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
  });

  app.patch(`${API}/allocatedChecklists/:id/child/tasks/:taskId`, (req, res) => {
    const c = s.checklists.find((x) => x.AllocatedChecklistId === req.params.id);
    if (!c) return res.status(404).json({ error: 'Checklist not found' });
    const t = c.tasks.find((x) => x.TaskId === req.params.taskId);
    if (!t) return res.status(404).json({ error: 'Task not found' });
    Object.assign(t, req.body);
    res.json(t);
  });

  // Notifications / BP
  app.get(`${API}/workflowNotifications`, (req, res) => {
    const items = matchQ(
      s.notifications as unknown as Record<string, unknown>[],
      req.query.q as string,
    );
    res.json(collection(items));
  });

  app.get(`${API}/workflowNotifications/:id`, (req, res) => {
    const n = s.notifications.find((x) => x.NotificationId === req.params.id);
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json(n);
  });

  app.post(`${API}/workflowNotifications/:id/action/:action`, (req, res) => {
    const n = s.notifications.find((x) => x.NotificationId === req.params.id);
    if (!n) return res.status(404).json({ error: 'Not found' });
    n.Status = String(req.params.action).toUpperCase();
    res.json({ ...n, actionResult: 'OK', comment: req.body?.comment });
  });

  // Blocklist demo: generative AI style path returns 404-ish policy message if hit via raw HTTP
  app.all(`${API}/ce/*path`, (_req, res) => {
    res.status(403).json({ error: 'Blocked by dummy policy (CE paths)' });
  });

  return app;
}

export function startDummyServer(port = PORT): Promise<{ port: number; close: () => Promise<void> }> {
  const app = createDummyApp();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => {
      console.error(`[dummy-hcm] listening on http://127.0.0.1:${port}${API}`);
      console.error('[dummy-hcm] basic auth: demo / demo — unofficial mock, not Oracle');
      resolve({
        port,
        close: () =>
          new Promise((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
          }),
      });
    });
    server.on('error', reject);
  });
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('dummy-hcm/index.ts') ||
    process.argv[1].endsWith('dummy-hcm/index.js') ||
    process.argv[1].includes('dummy-hcm'));

if (isMain) {
  startDummyServer().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
