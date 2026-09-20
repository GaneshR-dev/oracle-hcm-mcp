#!/usr/bin/env node
/**
 * Dummy Oracle HCM REST mock for local E2E tests.
 * Official Fusion 11.13.18.05 collection names only — invented roots 404.
 * Unofficial — not affiliated with Oracle. Basic auth demo/demo.
 */

import express from 'express';
import { seedStore, type Store, type ChecklistTask, type Worker } from './data.js';
import { applyFinderFilter, parseFinderExpression } from '../policy/finders.js';
import { entriesToAtomXml, parseAtomEntry } from '../platform/atomCdc.js';
import { ATOM_FEEDS } from '../policy/atom.js';
import { ALLOWED_ROOTS } from '../policy/allowlist.js';
import {
  buildCatalogDescribe,
  buildResourceDescribe,
  wrapResources,
  adfDescribeToOpenApi,
  wantsOpenApi,
  parseDescribePath,
  knownAdfResource,
} from '../platform/adfDescribe.js';
import { ADF_OPENAPI_ACCEPT, ADF_DESCRIBE_ACCEPT, FUSION_GRAPHQL } from '../policy/adf.js';

const API = '/hcmRestApi/resources/11.13.18.05';
const ATOM = '/hcmRestApi/atomservlet';
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
  const m = q.match(/^(\w+)\s*=\s*'?([^']+)'?$/i);
  if (m) {
    const [, key, val] = m;
    return items.filter((it) => String(it[key] ?? '') === val);
  }
  const lower = q.toLowerCase();
  return items.filter((it) => JSON.stringify(it).toLowerCase().includes(lower));
}

function findTask(c: { allocatedTasks: ChecklistTask[]; tasks?: ChecklistTask[] }, taskId: string) {
  return (
    c.allocatedTasks.find((x) => x.TaskId === taskId || x.AllocatedTaskId === taskId) ??
    c.tasks?.find((x) => x.TaskId === taskId || x.AllocatedTaskId === taskId)
  );
}

function etagFor(obj: unknown): string {
  const json = JSON.stringify(obj);
  let h = 0;
  for (let i = 0; i < json.length; i++) h = (h * 31 + json.charCodeAt(i)) | 0;
  return `W/"${(h >>> 0).toString(16)}"`;
}

function ifMatchOk(req: express.Request, current: unknown): boolean {
  const im = req.headers['if-match'];
  if (im == null || im === '' || im === '*') return true;
  const tag = etagFor(current);
  return im === tag || im === tag.replace(/^W\//, '');
}

function bodyNum(body: unknown): string {
  if (body && typeof body === 'object' && 'AssignmentNumber' in body) {
    return String((body as { AssignmentNumber?: string }).AssignmentNumber ?? 'E-NEW');
  }
  return 'E-NEW';
}

export function createDummyApp(store?: Store): express.Express {
  const s = store ?? seedStore();
  const app = express();
  app.use(express.json({ limit: '2mb', type: ['json', 'application/vnd.oracle.adf.resourceitem+json'] }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'dummy-hcm', unofficial: true });
  });

  app.use(API, basicAuth);
  app.use(ATOM, basicAuth);

  const hrefBase = API;
  const sendDescribe = (req: express.Request, res: express.Response, rest: string): boolean => {
    const parsed = parseDescribePath(rest);
    if (!parsed) return false;
    const openapi = wantsOpenApi(String(req.headers.accept ?? ''));
    const includeChildren =
      req.query.includeChildren === 'true' || req.query.includeChildren === '1';
    if (parsed.kind === 'catalog') {
      const mode = req.query.metadataMode === 'list' ? 'list' : 'minimal';
      const catalog = buildCatalogDescribe({
        hrefBase,
        metadataMode: mode,
        includeChildren,
        roots: [...ALLOWED_ROOTS],
      });
      if (openapi) {
        res.setHeader('Content-Type', ADF_OPENAPI_ACCEPT);
        res.json({
          openapi: '3.0.1',
          info: { title: 'Oracle Fusion HCM catalog (dummy)', version: '11.13.18.05' },
          paths: Object.fromEntries(ALLOWED_ROOTS.map((r) => [`/${r}`, { get: {} }])),
          'x-fusion-graphql': FUSION_GRAPHQL,
        });
        return true;
      }
      res.setHeader('Content-Type', ADF_DESCRIBE_ACCEPT);
      res.json(catalog);
      return true;
    }
    const resource = parsed.resource!;
    const root = parsed.root!;
    if (!ALLOWED_ROOTS.includes(root) || !knownAdfResource(resource)) {
      res.status(404).json({ error: 'Unknown resource describe', resource, root });
      return true;
    }
    const body = buildResourceDescribe(resource, {
      hrefBase,
      includeChildren: req.query.includeChildren === 'false' ? false : true,
    });
    if (openapi) {
      res.setHeader('Content-Type', ADF_OPENAPI_ACCEPT);
      res.json(adfDescribeToOpenApi(resource, body));
      return true;
    }
    res.setHeader('Content-Type', ADF_DESCRIBE_ACCEPT);
    res.json(wrapResources(resource, body));
    return true;
  };

  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (!req.path.startsWith(API)) return next();
    const rest = req.path.slice(API.length) || '/';
    if (rest === '/describe' || rest.endsWith('/describe')) {
      if (sendDescribe(req, res, rest)) return;
    }
    next();
  });

  const graphqlGone = (_req: express.Request, res: express.Response) => {
    res.status(404).json({
      error: 'GraphQL is not an Oracle Fusion Cloud HCM API',
      graphql: FUSION_GRAPHQL,
    });
  };
  app.all('/graphql', graphqlGone);
  app.all('/hcmRestApi/graphql', graphqlGone);
  app.all(`${API}/graphql`, graphqlGone);

  const crud = <T extends Record<string, unknown>>(
    root: string,
    items: T[],
    idField: string,
    writable: { post?: boolean; patch?: boolean; del?: boolean } = {},
  ) => {
    app.get(`${API}/${root}`, (req, res) => {
      let list = matchQ(items as unknown as Record<string, unknown>[], req.query.q as string);
      list = applyFinderFilter(list, root, req.query.finder as string | undefined);
      const limit = Number(req.query.limit ?? 25);
      const offset = Number(req.query.offset ?? 0);
      res.json({
        ...collection(list.slice(offset, offset + limit)),
        finder: req.query.finder ?? null,
      });
    });
    app.get(`${API}/${root}/:id`, (req, res) => {
      const o = items.find((x) => String(x[idField]) === req.params.id);
      if (!o) return res.status(404).json({ error: 'Not found' });
      res.setHeader('ETag', etagFor(o));
      res.json(o);
    });
    if (writable.post) {
      app.post(`${API}/${root}`, (req, res) => {
        const id = s.nextId(root.slice(0, 2).toUpperCase());
        const row = { [idField]: id, ...(req.body ?? {}) } as T;
        items.push(row);
        res.status(201).json(row);
      });
    }
    if (writable.patch) {
      app.patch(`${API}/${root}/:id`, (req, res) => {
        const o = items.find((x) => String(x[idField]) === req.params.id);
        if (!o) return res.status(404).json({ error: 'Not found' });
        if (!ifMatchOk(req, o)) return res.status(412).json({ error: 'Precondition Failed (If-Match)' });
        Object.assign(o, req.body);
        res.setHeader('ETag', etagFor(o));
        res.json(o);
      });
    }
    if (writable.del) {
      app.delete(`${API}/${root}/:id`, (req, res) => {
        const idx = items.findIndex((x) => String(x[idField]) === req.params.id);
        if (idx < 0) return res.status(404).json({ error: 'Not found' });
        if (!ifMatchOk(req, items[idx])) return res.status(412).json({ error: 'Precondition Failed (If-Match)' });
        items.splice(idx, 1);
        res.status(204).end();
      });
    }
  };

  // --- workers ---
  app.get(`${API}/workers`, (req, res) => {
    let items = matchQ(s.workers as unknown as Record<string, unknown>[], req.query.q as string);
    items = applyFinderFilter(items, 'workers', req.query.finder as string | undefined);
    const limit = Number(req.query.limit ?? 25);
    const offset = Number(req.query.offset ?? 0);
    res.json({ ...collection(items.slice(offset, offset + limit)), finder: req.query.finder ?? null });
  });

  app.get(`${API}/workers/:id`, (req, res) => {
    const w = s.workers.find((x) => x.WorkerId === req.params.id);
    if (!w) return res.status(404).json({ error: 'Not found' });
    res.json(w);
  });

  app.post(`${API}/workers`, (req, res) => {
    const id = s.nextId('W');
    const body = req.body ?? {};
    const w: Worker = {
      WorkerId: id,
      PersonNumber: body.PersonNumber ?? `P${id}`,
      DisplayName: body.DisplayName ?? `${body.FirstName ?? ''} ${body.LastName ?? ''}`.trim(),
      FirstName: body.FirstName ?? 'New',
      LastName: body.LastName ?? 'Worker',
      emails: body.emails ?? [],
      phones: body.phones ?? [],
      nationalIdentifiers: body.nationalIdentifiers ?? [],
      legislativeInfo: body.legislativeInfo ?? [],
      addresses: body.addresses ?? [],
      names: body.names ?? [],
      photos: body.photos ?? [],
      citizenships: body.citizenships ?? [],
      visasPermits: body.visasPermits ?? [],
      passports: body.passports ?? [],
      disabilities: body.disabilities ?? [],
      driverLicenses: body.driverLicenses ?? [],
      ethnicities: body.ethnicities ?? [],
      religions: body.religions ?? [],
      externalIdentifiers: body.externalIdentifiers ?? [],
      otherCommunicationAccounts: body.otherCommunicationAccounts ?? [],
      messages: body.messages ?? [],
      workRelationships: [],
    };
    s.workers.push(w);
    res.status(201).json(w);
  });

  app.patch(`${API}/workers/:id`, (req, res) => {
    const w = s.workers.find((x) => x.WorkerId === req.params.id);
    if (!w) return res.status(404).json({ error: 'Not found' });
    if (!ifMatchOk(req, w)) return res.status(412).json({ error: 'Precondition Failed (If-Match)' });
    Object.assign(w, req.body);
    res.setHeader('ETag', etagFor(w));
    res.json(w);
  });

  const workerChild = <T extends Record<string, unknown>>(
    name: string,
    getArr: (w: Worker) => T[],
    idField: string,
    writable: { post?: boolean; patch?: boolean } = {},
  ) => {
    app.get(`${API}/workers/:id/child/${name}`, (req, res) => {
      const w = s.workers.find((x) => x.WorkerId === req.params.id);
      if (!w) return res.status(404).json({ error: 'Not found' });
      res.json(collection(getArr(w)));
    });
    app.get(`${API}/workers/:id/child/${name}/:cid`, (req, res) => {
      const w = s.workers.find((x) => x.WorkerId === req.params.id);
      if (!w) return res.status(404).json({ error: 'Not found' });
      const row = getArr(w).find((x) => String(x[idField]) === req.params.cid);
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.setHeader('ETag', etagFor(row));
      res.json(row);
    });
    if (writable.post) {
      app.post(`${API}/workers/:id/child/${name}`, (req, res) => {
        const w = s.workers.find((x) => x.WorkerId === req.params.id);
        if (!w) return res.status(404).json({ error: 'Not found' });
        const id = s.nextId(name.slice(0, 2).toUpperCase());
        const row = { [idField]: id, PersonNumber: w.PersonNumber, ...(req.body ?? {}) } as T;
        getArr(w).push(row);
        res.status(201).json(row);
      });
    }
    if (writable.patch) {
      app.patch(`${API}/workers/:id/child/${name}/:cid`, (req, res) => {
        const w = s.workers.find((x) => x.WorkerId === req.params.id);
        if (!w) return res.status(404).json({ error: 'Not found' });
        const row = getArr(w).find((x) => String(x[idField]) === req.params.cid);
        if (!row) return res.status(404).json({ error: 'Not found' });
        if (!ifMatchOk(req, row)) return res.status(412).json({ error: 'Precondition Failed (If-Match)' });
        Object.assign(row, req.body);
        res.setHeader('ETag', etagFor(row));
        res.json(row);
      });
    }
  };

  workerChild('emails', (w) => w.emails as unknown as Record<string, unknown>[], 'EmailId');
  workerChild('phones', (w) => w.phones as unknown as Record<string, unknown>[], 'PhoneId');
  workerChild(
    'nationalIdentifiers',
    (w) => w.nationalIdentifiers as unknown as Record<string, unknown>[],
    'NationalIdentifierId',
  );
  workerChild(
    'legislativeInfo',
    (w) => w.legislativeInfo as unknown as Record<string, unknown>[],
    'LegislativeDataId',
  );
  workerChild('addresses', (w) => w.addresses as unknown as Record<string, unknown>[], 'AddressId', {
    post: true,
    patch: true,
  });
  workerChild('names', (w) => w.names as unknown as Record<string, unknown>[], 'NameId');
  workerChild('photos', (w) => w.photos as unknown as Record<string, unknown>[], 'PhotoId', { post: true });
  workerChild('citizenships', (w) => w.citizenships as unknown as Record<string, unknown>[], 'CitizenshipId');
  workerChild('visasPermits', (w) => w.visasPermits as unknown as Record<string, unknown>[], 'VisaPermitId');
  workerChild('passports', (w) => w.passports as unknown as Record<string, unknown>[], 'PassportId');
  workerChild('disabilities', (w) => w.disabilities as unknown as Record<string, unknown>[], 'DisabilityId');
  workerChild('driverLicenses', (w) => w.driverLicenses as unknown as Record<string, unknown>[], 'DriverLicenseId');
  workerChild('ethnicities', (w) => w.ethnicities as unknown as Record<string, unknown>[], 'EthnicityId');
  workerChild('religions', (w) => w.religions as unknown as Record<string, unknown>[], 'ReligionId');
  workerChild(
    'externalIdentifiers',
    (w) => w.externalIdentifiers as unknown as Record<string, unknown>[],
    'ExternalIdentifierId',
  );
  workerChild(
    'otherCommunicationAccounts',
    (w) => w.otherCommunicationAccounts as unknown as Record<string, unknown>[],
    'OtherCommunicationAccountId',
  );
  workerChild('messages', (w) => w.messages as unknown as Record<string, unknown>[], 'MessageId');

  app.get(`${API}/workers/:id/child/workRelationships`, (req, res) => {
    const w = s.workers.find((x) => x.WorkerId === req.params.id);
    if (!w) return res.status(404).json({ error: 'Not found' });
    res.json(collection(w.workRelationships ?? []));
  });

  app.get(
    `${API}/workers/:id/child/workRelationships/:wrId/child/assignments`,
    (req, res) => {
      const w = s.workers.find((x) => x.WorkerId === req.params.id);
      if (!w) return res.status(404).json({ error: 'Not found' });
      const wr = w.workRelationships?.find((x) => x.PeriodOfServiceId === req.params.wrId);
      if (!wr) return res.status(404).json({ error: 'WR not found' });
      res.json(collection(wr.assignments));
    },
  );

  app.get(
    `${API}/workers/:id/child/workRelationships/:wrId/child/assignments/:asgId`,
    (req, res) => {
      const w = s.workers.find((x) => x.WorkerId === req.params.id);
      if (!w) return res.status(404).json({ error: 'Not found' });
      const wr = w.workRelationships?.find((x) => x.PeriodOfServiceId === req.params.wrId);
      if (!wr) return res.status(404).json({ error: 'WR not found' });
      const a = wr.assignments.find((x) => x.AssignmentId === req.params.asgId);
      if (!a) return res.status(404).json({ error: 'Not found' });
      res.json(a);
    },
  );

  app.get(
    `${API}/workers/:id/child/workRelationships/:wrId/child/assignments/:asgId/child/gradeSteps`,
    (req, res) => {
      const w = s.workers.find((x) => x.WorkerId === req.params.id);
      if (!w) return res.status(404).json({ error: 'Not found' });
      const wr = w.workRelationships?.find((x) => x.PeriodOfServiceId === req.params.wrId);
      if (!wr) return res.status(404).json({ error: 'WR not found' });
      const a = wr.assignments.find((x) => x.AssignmentId === req.params.asgId);
      if (!a) return res.status(404).json({ error: 'Not found' });
      res.json(collection(a.gradeSteps ?? []));
    },
  );

  app.post(
    `${API}/workers/:wid/child/workRelationships/:wrid/child/assignments`,
    (req, res) => {
      const w = s.workers.find((x) => x.WorkerId === req.params.wid);
      if (!w) return res.status(404).json({ error: 'Worker not found' });
      const wr = w.workRelationships?.find((x) => x.PeriodOfServiceId === req.params.wrid);
      if (!wr) return res.status(404).json({ error: 'Work relationship not found' });
      const id = s.nextId('AS');
      const asg = {
        AssignmentId: id,
        AssignmentNumber: bodyNum(req.body),
        WorkerId: w.WorkerId,
        employmentHistory: [],
        ...(req.body ?? {}),
      };
      wr.assignments.push(asg);
      res.status(201).json(asg);
    },
  );

  app.patch(
    `${API}/workers/:wid/child/workRelationships/:wrid/child/assignments/:asgId`,
    (req, res) => {
      const w = s.workers.find((x) => x.WorkerId === req.params.wid);
      if (!w) return res.status(404).json({ error: 'Worker not found' });
      const wr = w.workRelationships?.find((x) => x.PeriodOfServiceId === req.params.wrid);
      if (!wr) return res.status(404).json({ error: 'Work relationship not found' });
      const a = wr.assignments.find((x) => x.AssignmentId === req.params.asgId);
      if (!a) return res.status(404).json({ error: 'Not found' });
      if (!ifMatchOk(req, a)) return res.status(412).json({ error: 'Precondition Failed (If-Match)' });
      Object.assign(a, req.body);
      res.setHeader('ETag', etagFor(a));
      res.json(a);
    },
  );

  // emps — official collection, mirror workers
  app.get(`${API}/emps`, (req, res) => {
    const items = s.workers.map((w) => ({ PersonId: w.WorkerId, ...w }));
    res.json(collection(matchQ(items as unknown as Record<string, unknown>[], req.query.q as string)));
  });
  app.get(`${API}/emps/:id`, (req, res) => {
    const w = s.workers.find((x) => x.WorkerId === req.params.id);
    if (!w) return res.status(404).json({ error: 'Not found' });
    res.json({ PersonId: w.WorkerId, ...w });
  });

  // publicWorkers + nested employmentHistory
  app.get(`${API}/publicWorkers`, (req, res) => {
    const items = s.workers.map((w) => ({
      PublicWorkerId: w.WorkerId,
      PersonNumber: w.PersonNumber,
      DisplayName: w.DisplayName,
    }));
    res.json(collection(matchQ(items as unknown as Record<string, unknown>[], req.query.q as string)));
  });
  app.get(`${API}/publicWorkers/:id`, (req, res) => {
    const w = s.workers.find((x) => x.WorkerId === req.params.id);
    if (!w) return res.status(404).json({ error: 'Not found' });
    res.json({ PublicWorkerId: w.WorkerId, PersonNumber: w.PersonNumber, DisplayName: w.DisplayName });
  });
  app.get(`${API}/publicWorkers/:id/child/assignments`, (req, res) => {
    const w = s.workers.find((x) => x.WorkerId === req.params.id);
    if (!w) return res.status(404).json({ error: 'Not found' });
    const asgs = (w.workRelationships ?? []).flatMap((wr) => wr.assignments);
    res.json(collection(asgs));
  });
  app.get(
    `${API}/publicWorkers/:id/child/assignments/:asgId/child/employmentHistory`,
    (req, res) => {
      const w = s.workers.find((x) => x.WorkerId === req.params.id);
      if (!w) return res.status(404).json({ error: 'Not found' });
      const asgs = (w.workRelationships ?? []).flatMap((wr) => wr.assignments);
      const a = asgs.find((x) => x.AssignmentId === req.params.asgId);
      if (!a) return res.status(404).json({ error: 'Not found' });
      res.json(collection(a.employmentHistory ?? []));
    },
  );

  // Absences
  app.get(`${API}/absences`, (req, res) => {
    let items = matchQ(s.absences as unknown as Record<string, unknown>[], req.query.q as string);
    items = applyFinderFilter(items, 'absences', req.query.finder as string | undefined);
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

  // Official projected-balance action (NOT previewEntitlement)
  app.post(`${API}/absences/action/loadProjectedBalance`, (req, res) => {
    const person = req.body?.PersonNumber ?? req.body?.personNumber ?? 'P1001';
    const type = req.body?.absenceType ?? req.body?.AbsenceType ?? 'Vacation';
    const start = req.body?.startDate ?? req.body?.StartDate ?? '2026-10-01';
    const end = req.body?.endDate ?? req.body?.EndDate ?? '2026-10-03';
    const days = Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1);
    const bal = s.balances.find((b) => b.personNumber === person);
    res.json({
      PersonNumber: person,
      absenceType: type,
      startDate: start,
      endDate: end,
      requestedDays: days,
      availableBalance: bal?.balance ?? 0,
      sufficient: (bal?.balance ?? 0) >= days,
      projectedBalance: Math.max(0, (bal?.balance ?? 0) - days),
      preview: true,
      unofficial: true,
    });
  });

  // Plan balances + official as-of-date finder
  app.get(`${API}/planBalances`, (req, res) => {
    let items = matchQ(s.balances as unknown as Record<string, unknown>[], req.query.q as string);
    const finder = req.query.finder as string | undefined;
    items = applyFinderFilter(items, 'planBalances', finder);
    if (finder) {
      const parsed = parseFinderExpression(finder);
      if (parsed.name === 'findByBalanceAsOfDate' || parsed.name === 'findByPersonIdPlanIdLevelDate') {
        const asOf = parsed.params.balanceAsOfDate ?? parsed.params.asOf ?? parsed.params.date;
        items = items.map((b) => ({
          ...b,
          asOfDate: asOf,
          accruedToDate: (b as { balance?: number }).balance,
        }));
      }
    }
    res.json(collection(items));
  });
  app.get(`${API}/planBalances/:id`, (req, res) => {
    if (req.params.id === 'action') return res.status(404).json({ error: 'Not found' });
    const b = s.balances.find((x) => x.BalanceId === req.params.id);
    if (!b) return res.status(404).json({ error: 'Not found' });
    res.json(b);
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
    const items = matchQ(s.checklists as unknown as Record<string, unknown>[], req.query.q as string);
    res.json(collection(items));
  });
  app.get(`${API}/allocatedChecklists/:id`, (req, res) => {
    const c = s.checklists.find((x) => x.AllocatedChecklistId === req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
  });
  app.get(`${API}/allocatedChecklists/:id/child/allocatedTasks`, (req, res) => {
    const c = s.checklists.find((x) => x.AllocatedChecklistId === req.params.id);
    if (!c) return res.status(404).json({ error: 'Checklist not found' });
    res.json(collection(c.allocatedTasks));
  });
  app.get(`${API}/allocatedChecklists/:id/child/allocatedTasks/:taskId`, (req, res) => {
    const c = s.checklists.find((x) => x.AllocatedChecklistId === req.params.id);
    if (!c) return res.status(404).json({ error: 'Checklist not found' });
    const t = findTask(c, req.params.taskId);
    if (!t) return res.status(404).json({ error: 'Task not found' });
    res.json(t);
  });
  const updateTask = (req: express.Request, res: express.Response) => {
    const c = s.checklists.find((x) => x.AllocatedChecklistId === String(req.params.id));
    if (!c) return res.status(404).json({ error: 'Checklist not found' });
    const t = findTask(c, String(req.params.taskId));
    if (!t) return res.status(404).json({ error: 'Task not found' });
    const status = req.body?.status ?? req.body?.TaskStatus ?? req.body?.taskStatus;
    Object.assign(t, req.body ?? {});
    if (status) t.status = String(status);
    res.json(t);
  };
  app.patch(`${API}/allocatedChecklists/:id/child/allocatedTasks/:taskId`, updateTask);
  app.post(
    `${API}/allocatedChecklists/:id/child/allocatedTasks/:taskId/action/updateTaskStatus`,
    updateTask,
  );
  app.post(`${API}/allocatedChecklists/action/allocateChecklist`, (req, res) => {
    const id = s.nextId('C');
    const body = req.body ?? {};
    const row = {
      AllocatedChecklistId: id,
      ChecklistName: body.ChecklistName ?? 'Allocated',
      PersonNumber: body.PersonNumber ?? 'P1001',
      allocatedTasks: [],
      tasks: [],
    };
    s.checklists.push(row);
    res.status(201).json(row);
  });

  // BP notifications — official action only
  app.get(`${API}/businessProcessNotifications`, (req, res) => {
    const items = matchQ(
      s.notifications as unknown as Record<string, unknown>[],
      req.query.q as string,
    );
    res.json(collection(items));
  });
  app.get(`${API}/businessProcessNotifications/:id`, (req, res) => {
    const n = s.notifications.find(
      (x) => x.NotificationId === req.params.id || x.taskId === req.params.id,
    );
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json(n);
  });
  const performBp = (req: express.Request, res: express.Response) => {
    const id =
      req.body?.taskId ??
      req.body?.notificationId ??
      req.params.id ??
      req.body?.IdentificationKey;
    const action =
      req.body?.actionName ?? req.body?.action ?? req.params.action ?? 'APPROVE';
    const n = s.notifications.find(
      (x) => x.NotificationId === String(id) || x.taskId === String(id),
    );
    if (!n) return res.status(404).json({ error: 'Not found' });
    n.Status = String(action).toUpperCase();
    res.json({ ...n, actionResult: 'OK', comment: req.body?.comment });
  };
  app.post(`${API}/businessProcessNotifications/action/performAction`, performBp);
  app.post(`${API}/businessProcessNotifications/action/performActionWithComments`, performBp);

  // Org LOVs
  const listLov = (root: string, items: Record<string, unknown>[]) => {
    app.get(`${API}/${root}`, (req, res) => {
      res.json({
        ...collection(
          applyFinderFilter(matchQ(items, req.query.q as string), root, req.query.finder as string | undefined),
        ),
        finder: req.query.finder ?? null,
      });
    });
  };
  listLov('organizations', s.organizations as unknown as Record<string, unknown>[]);
  app.get(`${API}/organizations/:id`, (req, res) => {
    const o = s.organizations.find((x) => x.OrganizationId === req.params.id);
    if (!o) return res.status(404).json({ error: 'Not found' });
    res.json(o);
  });
  listLov('locations', s.locations as unknown as Record<string, unknown>[]);
  listLov('locationsV2', s.locations as unknown as Record<string, unknown>[]);
  app.get(`${API}/locations/:id`, (req, res) => {
    const o = s.locations.find((x) => x.LocationId === req.params.id);
    if (!o) return res.status(404).json({ error: 'Not found' });
    res.json(o);
  });
  app.get(`${API}/locationsV2/:id`, (req, res) => {
    const o = s.locations.find((x) => x.LocationId === req.params.id);
    if (!o) return res.status(404).json({ error: 'Not found' });
    res.json(o);
  });
  listLov('jobs', s.jobs as unknown as Record<string, unknown>[]);
  app.get(`${API}/jobs/:id`, (req, res) => {
    const o = s.jobs.find((x) => x.JobId === req.params.id);
    if (!o) return res.status(404).json({ error: 'Not found' });
    res.json(o);
  });
  listLov('grades', s.grades as unknown as Record<string, unknown>[]);
  app.get(`${API}/grades/:id`, (req, res) => {
    const o = s.grades.find((x) => x.GradeId === req.params.id);
    if (!o) return res.status(404).json({ error: 'Not found' });
    res.json(o);
  });

  // Time — official timeRecordGroups + child timeRecords; events via timeRecordEventRequests
  app.get(`${API}/timeRecordGroups`, (req, res) => {
    const items = matchQ(
      s.timeRecordGroups as unknown as Record<string, unknown>[],
      req.query.q as string,
    );
    res.json(collection(items));
  });
  app.get(`${API}/timeRecordGroups/:id`, (req, res) => {
    const g = s.timeRecordGroups.find((x) => x.TimeRecordGroupId === req.params.id);
    if (!g) return res.status(404).json({ error: 'Not found' });
    res.json(g);
  });
  app.get(`${API}/timeRecordGroups/:id/child/timeRecords`, (req, res) => {
    const g = s.timeRecordGroups.find((x) => x.TimeRecordGroupId === req.params.id);
    if (!g) return res.status(404).json({ error: 'Not found' });
    res.json(collection(g.timeRecords));
  });
  app.get(`${API}/timeRecordGroups/:id/child/timeRecords/:rid`, (req, res) => {
    const g = s.timeRecordGroups.find((x) => x.TimeRecordGroupId === req.params.id);
    if (!g) return res.status(404).json({ error: 'Not found' });
    const r = g.timeRecords.find(
      (x) => x.timeRecordId === req.params.rid || x.TimeRecordId === req.params.rid,
    );
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json(r);
  });
  app.get(`${API}/timeRecordEventRequests`, (req, res) => {
    res.json(
      collection(
        matchQ(s.timeRecordEventRequests as unknown as Record<string, unknown>[], req.query.q as string),
      ),
    );
  });
  app.get(`${API}/timeRecordEventRequests/:id`, (req, res) => {
    const row = s.timeRecordEventRequests.find((x) => x.TimeRecordEventRequestId === req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });
  app.post(`${API}/timeRecordEventRequests`, (req, res) => {
    const id = s.nextId('TRE');
    const row = {
      TimeRecordEventRequestId: id,
      PersonNumber: req.body?.PersonNumber ?? req.body?.personNumber ?? 'P1001',
      Status: 'SUBMITTED',
      PeriodStart: req.body?.PeriodStart ?? req.body?.periodStart,
      PeriodEnd: req.body?.PeriodEnd ?? req.body?.periodEnd,
    };
    s.timeRecordEventRequests.push(row);
    res.status(201).json(row);
  });

  crud('timeEventRequests', s.timeEventRequests as unknown as Record<string, unknown>[], 'timeEventRequestId', {
    post: true,
  });
  app.get(`${API}/timeEventRequests/:id/child/timeEvents`, (req, res) => {
    const row = s.timeEventRequests.find(
      (x) => x.timeEventRequestId === req.params.id || x.TimeEventRequestId === req.params.id,
    );
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(collection(row.timeEvents ?? []));
  });

  crud('jobsLov', s.jobsLov as unknown as Record<string, unknown>[], 'JobId');
  crud('gradesLov', s.gradesLov as unknown as Record<string, unknown>[], 'GradeId');
  crud('locationsLov', s.locationsLov as unknown as Record<string, unknown>[], 'LocationId');
  crud('gradeLaddersLov', s.gradeLaddersLov as unknown as Record<string, unknown>[], 'GradeLadderId');
  crud('gradeRatesLOV', s.gradeRatesLOV as unknown as Record<string, unknown>[], 'GradeRateId');

  crud('talentPersonProfiles', s.talentProfiles as unknown as Record<string, unknown>[], 'ProfileId', {
    patch: true,
  });
  crud('payrollRelationships', s.payrollRelationships as unknown as Record<string, unknown>[], 'PayrollRelationshipId');
  crud('recruitingJobRequisitions', s.requisitions as unknown as Record<string, unknown>[], 'RequisitionId');
  crud('recruitingCandidates', s.candidates as unknown as Record<string, unknown>[], 'CandidateId');
  app.get(`${API}/recruitingCandidates/:id/child/attachments`, (req, res) => {
    const c = s.candidates.find((x) => x.CandidateId === req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(collection(c.attachments ?? []));
  });
  app.get(`${API}/recruitingCandidates/:id/child/citizenships`, (req, res) => {
    const c = s.candidates.find((x) => x.CandidateId === req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(collection(c.citizenships ?? []));
  });
  app.get(`${API}/recruitingJobRequisitions/:id/child/skills`, (req, res) => {
    const r = s.requisitions.find((x) => x.RequisitionId === req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json(collection(r.skills ?? []));
  });
  app.get(`${API}/recruitingJobRequisitions/:id/child/attachments`, (req, res) => {
    const r = s.requisitions.find((x) => x.RequisitionId === req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json(collection(r.attachments ?? []));
  });
  app.get(`${API}/recruitingJobRequisitions/:id/child/publishedJobs`, (req, res) => {
    const r = s.requisitions.find((x) => x.RequisitionId === req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json(collection(r.publishedJobs ?? []));
  });
  crud('recruitingJobOffers', s.offers as unknown as Record<string, unknown>[], 'OfferId');
  crud('benefitEnrollments', s.benefitEnrollments as unknown as Record<string, unknown>[], 'EnrollmentId');
  app.get(`${API}/benefitEnrollments/:id/child/dependents`, (req, res) => {
    const e = s.benefitEnrollments.find((x) => x.EnrollmentId === req.params.id);
    if (!e) return res.status(404).json({ error: 'Not found' });
    res.json(collection(e.dependents ?? []));
  });
  app.get(`${API}/benefitEnrollments/:id/child/costs`, (req, res) => {
    const e = s.benefitEnrollments.find((x) => x.EnrollmentId === req.params.id);
    if (!e) return res.status(404).json({ error: 'Not found' });
    res.json(collection(e.costs ?? []));
  });
  app.get(`${API}/benefitEnrollments/:id/child/providers`, (req, res) => {
    const e = s.benefitEnrollments.find((x) => x.EnrollmentId === req.params.id);
    if (!e) return res.status(404).json({ error: 'Not found' });
    res.json(collection(e.providers ?? []));
  });
  crud('positions', s.positions as unknown as Record<string, unknown>[], 'PositionId');
  crud('hcmContacts', s.contacts as unknown as Record<string, unknown>[], 'ContactId');
  crud('jobFamilies', s.jobFamilies as unknown as Record<string, unknown>[], 'JobFamilyId');
  crud('documentRecords', s.documentRecords as unknown as Record<string, unknown>[], 'DocumentRecordId', {
    post: true,
  });
  app.post(`${API}/documentRecords/action/downloadAttachments`, (req, res) => {
    const id = String(req.body?.DocumentsOfRecordId ?? req.body?.documentRecordId ?? 'DR1');
    const row = s.documentRecords.find((x) => x.DocumentRecordId === id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({
      DocumentsOfRecordId: row.DocumentRecordId,
      FileName: row.FileName,
      contentEncoding: 'base64',
      content: Buffer.from(`dummy:${row.FileName}`).toString('base64'),
      unofficial: true,
    });
  });
  app.post(`${API}/documentRecords/action/generateDraftLetter`, (req, res) => {
    const id = String(req.body?.DocumentsOfRecordId ?? req.body?.documentRecordId ?? 'DR1');
    res.json({ DocumentsOfRecordId: id, letterStatus: 'DRAFT', unofficial: true });
  });
  app.post(`${API}/documentRecords/action/findByAdvancedSearchQuery`, (req, res) => {
    const q = String(req.body?.searchTerms ?? req.body?.q ?? '');
    const items = q
      ? s.documentRecords.filter((d) => JSON.stringify(d).toLowerCase().includes(q.toLowerCase()))
      : s.documentRecords;
    res.json(collection(items));
  });
  app.post(`${API}/documentRecords/action/checkPersonDocumentTypeManageAccess`, (_req, res) => {
    res.json({ allowed: true, unofficial: true });
  });
  crud('workerJourneys', s.workerJourneys as unknown as Record<string, unknown>[], 'JourneyId');
  app.get(`${API}/workerJourneys/:id/child/tasks`, (req, res) => {
    const j = s.workerJourneys.find((x) => x.JourneyId === req.params.id);
    if (!j) return res.status(404).json({ error: 'Not found' });
    res.json(collection(j.tasks ?? s.journeyTasks.filter((t) => t.JourneyId === j.JourneyId)));
  });
  app.patch(`${API}/workerJourneys/:id/child/tasks/:tid`, (req, res) => {
    const t = s.journeyTasks.find(
      (x) => x.JourneyTaskId === req.params.tid && x.JourneyId === req.params.id,
    );
    if (!t) return res.status(404).json({ error: 'Not found' });
    Object.assign(t, req.body);
    res.json(t);
  });
  crud('workerJourneyTasks', s.journeyTasks as unknown as Record<string, unknown>[], 'JourneyTaskId', {
    patch: true,
  });
  crud(
    'workforceScheduleDefinitions',
    s.workforceScheduleDefinitions as unknown as Record<string, unknown>[],
    'ScheduleDefinitionId',
  );
  crud('goalPlans', s.goalPlans as unknown as Record<string, unknown>[], 'GoalPlanId', { post: true });
  app.get(`${API}/goalPlans/:id/child/performanceGoals`, (req, res) => {
    const p = s.goalPlans.find((x) => x.GoalPlanId === req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(collection(p.performanceGoals));
  });
  app.get(`${API}/goalPlans/:id/child/performanceGoals/:gid`, (req, res) => {
    const p = s.goalPlans.find((x) => x.GoalPlanId === req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    const g = p.performanceGoals.find((x) => x.GoalId === req.params.gid);
    if (!g) return res.status(404).json({ error: 'Not found' });
    res.json(g);
  });
  app.post(`${API}/goalPlans/:id/child/performanceGoals`, (req, res) => {
    const p = s.goalPlans.find((x) => x.GoalPlanId === req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    const id = s.nextId('G');
    const row = {
      GoalId: id,
      PersonNumber: req.body?.PersonNumber ?? p.PersonNumber,
      GoalName: req.body?.GoalName ?? 'Goal',
      Status: req.body?.Status ?? 'IN_PROGRESS',
    };
    p.performanceGoals.push(row);
    res.status(201).json(row);
  });
  app.patch(`${API}/goalPlans/:id/child/performanceGoals/:gid`, (req, res) => {
    const p = s.goalPlans.find((x) => x.GoalPlanId === req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    const g = p.performanceGoals.find((x) => x.GoalId === req.params.gid);
    if (!g) return res.status(404).json({ error: 'Not found' });
    Object.assign(g, req.body);
    res.json(g);
  });
  crud(
    'performanceEvaluations',
    s.performanceEvaluations as unknown as Record<string, unknown>[],
    'EvaluationId',
  );
  crud('checkInDocuments', s.checkInDocuments as unknown as Record<string, unknown>[], 'CheckInDocumentId', {
    post: true,
  });
  crud(
    'learnerLearningRecords',
    s.learnerLearningRecords as unknown as Record<string, unknown>[],
    'LearningRecordId',
    { post: true, patch: true },
  );
  app.get(`${API}/learnerLearningRecords/:id/child/completionDetails`, (req, res) => {
    const r = s.learnerLearningRecords.find((x) => x.LearningRecordId === req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json(collection(r.completionDetails ?? []));
  });
  app.post(`${API}/learnerLearningRecords/:id/child/completionDetails`, (req, res) => {
    const r = s.learnerLearningRecords.find((x) => x.LearningRecordId === req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    const id = s.nextId('LC');
    const row = {
      CompletionId: id,
      PersonNumber: req.body?.PersonNumber ?? r.PersonNumber,
      CourseName: req.body?.CourseName ?? r.CourseName,
      CompletionDate: req.body?.CompletionDate ?? new Date().toISOString().slice(0, 10),
      Score: req.body?.Score,
    };
    r.completionDetails = r.completionDetails ?? [];
    r.completionDetails.push(row);
    res.status(201).json(row);
  });
  crud('payslips', s.payslips as unknown as Record<string, unknown>[], 'PayslipId');
  crud(
    'personalPaymentMethods',
    s.paymentMethods as unknown as Record<string, unknown>[],
    'PaymentMethodId',
  );
  crud('salaries', s.salaries as unknown as Record<string, unknown>[], 'SalaryId', { patch: true });
  crud('elementEntries', s.elementEntries as unknown as Record<string, unknown>[], 'ElementEntryId', {
    post: true,
    patch: true,
  });
  crud(
    'calculationEntries',
    s.calculationEntries as unknown as Record<string, unknown>[],
    'CalculationEntryId',
  );
  crud('salaryBasisLov', s.salaryBasisLov as unknown as Record<string, unknown>[], 'SalaryBasisId');
  crud('gradeStepsLOV', s.gradeStepsLOV as unknown as Record<string, unknown>[], 'GradeStepId');
  crud('absenceTypesLOV', s.absenceTypesLOV as unknown as Record<string, unknown>[], 'AbsenceTypeId');
  crud('absencePlansLOV', s.absencePlansLOV as unknown as Record<string, unknown>[], 'AbsencePlanId');
  crud('lifeEventsLOV', s.lifeEventsLOV as unknown as Record<string, unknown>[], 'LifeEventId');
  crud('talentPoolsLOV', s.talentPoolsLOV as unknown as Record<string, unknown>[], 'TalentPoolId');
  crud('assignmentCosting', s.assignmentCosting as unknown as Record<string, unknown>[], 'CostingId');
  crud(
    'payrollRelationshipCosting',
    s.payrollRelationshipCosting as unknown as Record<string, unknown>[],
    'CostingId',
  );

  // Official Atom servlet — not under resources/
  const atomEntriesFor = (workspace: string, collection: string) => {
    const known = ATOM_FEEDS.some((f) => f.workspace === workspace && f.collection === collection);
    if (!known) return null;
    return s.atomfeeds.filter(
      (e) =>
        (e.Workspace ?? 'employee') === workspace &&
        (e.Collection === collection ||
          (workspace === 'employee' && collection === 'empupdate' && !e.Workspace)),
    );
  };

  app.get(`${ATOM}/:workspace/:collection`, (req, res) => {
    const list = atomEntriesFor(req.params.workspace, req.params.collection);
    if (!list) return res.status(404).json({ error: 'Unknown Atom feed' });
    let filtered = list as unknown as Record<string, unknown>[];
    const since = req.query.since as string | undefined;
    if (since) {
      const ms = Date.parse(since);
      filtered = filtered.filter((it) => Date.parse(String(it.Updated ?? '')) >= ms);
    }
    const wantAtom =
      req.query.format === 'atom' ||
      String(req.headers.accept ?? '').includes('application/atom+xml');
    if (wantAtom) {
      const parsed = filtered.map((x) => parseAtomEntry(x));
      const xml = entriesToAtomXml(
        `${req.params.workspace}/${req.params.collection}`,
        `atom:${req.params.workspace}/${req.params.collection}`,
        parsed,
      );
      res.setHeader('Content-Type', 'application/atom+xml; charset=utf-8');
      res.send(xml);
      return;
    }
    res.json(collection(filtered));
  });
  app.get(`${ATOM}/:workspace/:collection/:entryId`, (req, res) => {
    const list = atomEntriesFor(req.params.workspace, req.params.collection);
    if (!list) return res.status(404).json({ error: 'Unknown Atom feed' });
    const o = list.find((x) => x.EntryId === req.params.entryId);
    if (!o) return res.status(404).json({ error: 'Not found' });
    res.json(o);
  });

  // Blocklist demo — CE paths stay blocked
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
      console.error('[dummy-hcm] atom servlet: /hcmRestApi/atomservlet/{workspace}/{collection}');
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
