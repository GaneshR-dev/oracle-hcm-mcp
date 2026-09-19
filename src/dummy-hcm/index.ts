#!/usr/bin/env node
/**
 * Dummy Oracle HCM REST mock for local E2E tests.
 * Unofficial — not affiliated with Oracle. Basic auth demo/demo.
 * Uses Fusion path names (planBalances, businessProcessNotifications, allocatedTasks).
 */

import express from 'express';
import { seedStore, type Store, type ChecklistTask } from './data.js';
import { applyFinderFilter } from '../policy/finders.js';
import { entriesToAtomXml, parseAtomEntry } from '../platform/atomCdc.js';

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


function bodyNum(body: unknown): string {
  if (body && typeof body === 'object' && 'AssignmentNumber' in body) {
    return String((body as { AssignmentNumber?: string }).AssignmentNumber ?? 'E-NEW');
  }
  return 'E-NEW';
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
    let items = matchQ(s.workers as unknown as Record<string, unknown>[], req.query.q as string);
    items = applyFinderFilter(items, 'workers', req.query.finder as string | undefined);
    const limit = Number(req.query.limit ?? 25);
    const offset = Number(req.query.offset ?? 0);
    res.json({ ...collection(items.slice(offset, offset + limit)), finder: req.query.finder ?? null });
  });

  app.get(`${API}/workers/:id`, (req, res) => {
    const w = s.workers.find((x) => x.WorkerId === req.params.id);
    if (!w) return res.status(404).json({ error: 'Not found' });
    const expand = String(req.query.expand ?? '');
    if (expand.includes('workRelationships') || expand.includes('assignments')) {
      return res.json(w);
    }
    // Strip nested expand payload when not requested (still include ids)
    const { workRelationships: _wr, ...rest } = w;
    void _wr;
    res.json({ ...rest, workRelationships: w.workRelationships });
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
      workRelationships: [],
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

  // Nested assignments under workers (Fusion-shaped)
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

  // Top-level workerAssignments (allowlisted deep-read helper)
  app.get(`${API}/workerAssignments`, (req, res) => {
    const items = matchQ(
      s.workerAssignments as unknown as Record<string, unknown>[],
      req.query.q as string,
    );
    res.json(collection(items));
  });

  app.get(`${API}/workerAssignments/:id`, (req, res) => {
    const a = s.workerAssignments.find((x) => x.AssignmentId === req.params.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    res.json(a);
  });

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

  // Plan balances (primary) + legacy absencesBalances alias
  const listBalances = (req: express.Request, res: express.Response) => {
    const items = matchQ(s.balances as unknown as Record<string, unknown>[], req.query.q as string);
    res.json(collection(items));
  };
  app.get(`${API}/planBalances`, listBalances);
  app.get(`${API}/absencesBalances`, listBalances);

  app.get(`${API}/planBalances/:id`, (req, res) => {
    const b = s.balances.find((x) => x.BalanceId === req.params.id);
    if (!b) return res.status(404).json({ error: 'Not found' });
    res.json(b);
  });
  app.get(`${API}/absencesBalances/:id`, (req, res) => {
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

  // Checklists + allocatedTasks
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
  // Legacy child/tasks alias
  app.patch(`${API}/allocatedChecklists/:id/child/tasks/:taskId`, updateTask);

  // Business process notifications (primary) + legacy workflowNotifications
  const listNotifs = (req: express.Request, res: express.Response) => {
    const items = matchQ(
      s.notifications as unknown as Record<string, unknown>[],
      req.query.q as string,
    );
    res.json(collection(items));
  };
  app.get(`${API}/businessProcessNotifications`, listNotifs);
  app.get(`${API}/workflowNotifications`, listNotifs);

  const getNotif = (req: express.Request, res: express.Response) => {
    const n = s.notifications.find(
      (x) => x.NotificationId === req.params.id || x.taskId === req.params.id,
    );
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json(n);
  };
  app.get(`${API}/businessProcessNotifications/:id`, getNotif);
  app.get(`${API}/workflowNotifications/:id`, getNotif);

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
  // Legacy shaped paths
  app.post(`${API}/workflowNotifications/:id/action/:action`, performBp);
  app.post(`${API}/businessProcessNotifications/:id/action/:action`, performBp);

  // Org LOVs
  app.get(`${API}/organizations`, (req, res) => {
    res.json(
      {
        ...collection(
          applyFinderFilter(
            matchQ(s.organizations as unknown as Record<string, unknown>[], req.query.q as string),
            'organizations',
            req.query.finder as string | undefined,
          ),
        ),
        finder: req.query.finder ?? null,
      },
    );
  });
  app.get(`${API}/organizations/:id`, (req, res) => {
    const o = s.organizations.find((x) => x.OrganizationId === req.params.id);
    if (!o) return res.status(404).json({ error: 'Not found' });
    res.json(o);
  });

  app.get(`${API}/locations`, (req, res) => {
    res.json(
      {
        ...collection(
          applyFinderFilter(
            matchQ(s.locations as unknown as Record<string, unknown>[], req.query.q as string),
            'locations',
            req.query.finder as string | undefined,
          ),
        ),
        finder: req.query.finder ?? null,
      },
    );
  });
  app.get(`${API}/locations/:id`, (req, res) => {
    const o = s.locations.find((x) => x.LocationId === req.params.id);
    if (!o) return res.status(404).json({ error: 'Not found' });
    res.json(o);
  });

  app.get(`${API}/jobs`, (req, res) => {
    res.json(
      {
        ...collection(
          applyFinderFilter(
            matchQ(s.jobs as unknown as Record<string, unknown>[], req.query.q as string),
            'jobs',
            req.query.finder as string | undefined,
          ),
        ),
        finder: req.query.finder ?? null,
      },
    );
  });
  app.get(`${API}/jobs/:id`, (req, res) => {
    const o = s.jobs.find((x) => x.JobId === req.params.id);
    if (!o) return res.status(404).json({ error: 'Not found' });
    res.json(o);
  });

  app.get(`${API}/grades`, (req, res) => {
    res.json(
      {
        ...collection(
          applyFinderFilter(
            matchQ(s.grades as unknown as Record<string, unknown>[], req.query.q as string),
            'grades',
            req.query.finder as string | undefined,
          ),
        ),
        finder: req.query.finder ?? null,
      },
    );
  });
  app.get(`${API}/grades/:id`, (req, res) => {
    const o = s.grades.find((x) => x.GradeId === req.params.id);
    if (!o) return res.status(404).json({ error: 'Not found' });
    res.json(o);
  });

  // Time records
  app.get(`${API}/timeRecords`, (req, res) => {
    res.json(
      collection(
        matchQ(s.timeRecords as unknown as Record<string, unknown>[], req.query.q as string),
      ),
    );
  });
  app.get(`${API}/timeRecords/:id`, (req, res) => {
    const o = s.timeRecords.find((x) => x.timeRecordId === req.params.id);
    if (!o) return res.status(404).json({ error: 'Not found' });
    res.json(o);
  });

  // Talent profiles
  app.get(`${API}/talentPersonProfiles`, (req, res) => {
    res.json(
      collection(
        matchQ(s.talentProfiles as unknown as Record<string, unknown>[], req.query.q as string),
      ),
    );
  });
  app.get(`${API}/talentPersonProfiles/:id`, (req, res) => {
    const o = s.talentProfiles.find((x) => x.ProfileId === req.params.id);
    if (!o) return res.status(404).json({ error: 'Not found' });
    res.json(o);
  });
  app.patch(`${API}/talentPersonProfiles/:id`, (req, res) => {
    const o = s.talentProfiles.find((x) => x.ProfileId === req.params.id);
    if (!o) return res.status(404).json({ error: 'Not found' });
    Object.assign(o, req.body);
    res.json(o);
  });

  // Payroll relationships (read-only in MCP; GET only here)
  app.get(`${API}/payrollRelationships`, (req, res) => {
    res.json(
      collection(
        matchQ(
          s.payrollRelationships as unknown as Record<string, unknown>[],
          req.query.q as string,
        ),
      ),
    );
  });
  app.get(`${API}/payrollRelationships/:id`, (req, res) => {
    const o = s.payrollRelationships.find((x) => x.PayrollRelationshipId === req.params.id);
    if (!o) return res.status(404).json({ error: 'Not found' });
    res.json(o);
  });


  // --- v0.3 resources ---
  const crud = <T extends Record<string, unknown>>(
    root: string,
    items: T[],
    idField: string,
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
      res.json(o);
    });
  };

  crud('recruitingJobRequisitions', s.requisitions as unknown as Record<string, unknown>[], 'RequisitionId');
  crud('recruitingCandidates', s.candidates as unknown as Record<string, unknown>[], 'CandidateId');
  crud('recruitingJobOffers', s.offers as unknown as Record<string, unknown>[], 'OfferId');
  crud('recruitingInterviews', s.interviews as unknown as Record<string, unknown>[], 'InterviewId');
  crud('recruitingCandidateAttachments', s.candidateAttachments as unknown as Record<string, unknown>[], 'AttachmentId');
  crud('workerLegislativeData', s.legislativeData as unknown as Record<string, unknown>[], 'LegislativeDataId');
  crud('assignmentHistories', s.assignmentHistories as unknown as Record<string, unknown>[], 'HistoryId');
  crud('benefitEnrollments', s.benefitEnrollments as unknown as Record<string, unknown>[], 'EnrollmentId');
  crud('positions', s.positions as unknown as Record<string, unknown>[], 'PositionId');
  crud('hcmContacts', s.contacts as unknown as Record<string, unknown>[], 'ContactId');
  crud('workerPhones', s.phones as unknown as Record<string, unknown>[], 'PhoneId');
  crud('workerEmails', s.workerEmails as unknown as Record<string, unknown>[], 'EmailId');
  crud('nationalIdentifiers', s.nationalIdentifiers as unknown as Record<string, unknown>[], 'NationalIdentifierId');
  crud('absenceTypes', s.absenceTypes as unknown as Record<string, unknown>[], 'AbsenceTypeId');
  crud('absencePlans', s.absencePlans as unknown as Record<string, unknown>[], 'AbsencePlanId');
  crud('timeCards', s.timeCards as unknown as Record<string, unknown>[], 'TimeCardId');
  crud('workSchedules', s.workSchedules as unknown as Record<string, unknown>[], 'ScheduleId');
  crud('goals', s.goals as unknown as Record<string, unknown>[], 'GoalId');
  crud('performanceDocuments', s.performanceDocuments as unknown as Record<string, unknown>[], 'DocumentId');
  crud('learningEnrollments', s.learningEnrollments as unknown as Record<string, unknown>[], 'EnrollmentId');
  crud('payslips', s.payslips as unknown as Record<string, unknown>[], 'PayslipId');
  crud('bankAccounts', s.bankAccounts as unknown as Record<string, unknown>[], 'BankAccountId');
  crud('personalPaymentMethods', s.paymentMethods as unknown as Record<string, unknown>[], 'PaymentMethodId');
  crud('compensationHistories', s.compensationHistories as unknown as Record<string, unknown>[], 'CompensationId');
  crud('elementEntries', s.elementEntries as unknown as Record<string, unknown>[], 'ElementEntryId');
  crud('calculationCards', s.calculationCards as unknown as Record<string, unknown>[], 'CalculationCardId');
  // Atom feeds — JSON collection + Atom XML for CDC e2e
  const atomList = (req: express.Request) => {
    let list = matchQ(s.atomfeeds as unknown as Record<string, unknown>[], req.query.q as string);
    const since = req.query.since as string | undefined;
    if (since) {
      const ms = Date.parse(since);
      list = list.filter((it) => Date.parse(String(it.Updated ?? '')) >= ms);
    }
    return list;
  };

  app.get(`${API}/atomfeeds`, (req, res) => {
    const list = atomList(req);
    const limit = Number(req.query.limit ?? 25);
    const offset = Number(req.query.offset ?? 0);
    const wantAtom =
      req.query.format === 'atom' ||
      String(req.headers.accept ?? '').includes('application/atom+xml');
    if (wantAtom) {
      const parsed = list.map((x) => parseAtomEntry(x));
      const xml = entriesToAtomXml('HCM Atom Feed', 'atom:all', parsed);
      res.setHeader('Content-Type', 'application/atom+xml; charset=utf-8');
      res.send(xml);
      return;
    }
    res.json(collection(list.slice(offset, offset + limit)));
  });
  app.get(`${API}/atomfeeds/:id`, (req, res) => {
    const o = s.atomfeeds.find((x) => x.EntryId === req.params.id);
    if (!o) return res.status(404).json({ error: 'Not found' });
    res.json(o);
  });
  // alias
  app.get(`${API}/atomFeeds`, (req, res) => {
    const list = atomList(req);
    res.json(collection(list));
  });
  app.get(`${API}/atomFeeds/:id`, (req, res) => {
    const o = s.atomfeeds.find((x) => x.EntryId === req.params.id);
    if (!o) return res.status(404).json({ error: 'Not found' });
    res.json(o);
  });

  // publicWorkers — mirror workers lightly
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

  // Checklist allocate / forceClose
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
  app.post(`${API}/allocatedChecklists/:id/action/forceClose`, (req, res) => {
    const c = s.checklists.find((x) => x.AllocatedChecklistId === req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    for (const t of c.allocatedTasks) t.status = 'CLOSED';
    res.json({ ...c, Status: 'CLOSED', forceClosed: true });
  });

  // Nested assignment create
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
        ...(req.body ?? {}),
      };
      wr.assignments.push(asg);
      s.workerAssignments.push(asg);
      res.status(201).json(asg);
    },
  );
  app.patch(`${API}/workerAssignments/:id`, (req, res) => {
    const a = s.workerAssignments.find((x) => x.AssignmentId === req.params.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    Object.assign(a, req.body);
    res.json(a);
  });

  // Time card submit
  app.post(`${API}/timeCards/action/submit`, (req, res) => {
    const id = s.nextId('TC');
    const row = {
      TimeCardId: id,
      PersonNumber: req.body?.PersonNumber ?? 'P1001',
      Status: 'SUBMITTED',
      PeriodStart: req.body?.PeriodStart ?? '2026-09-14',
      PeriodEnd: req.body?.PeriodEnd ?? '2026-09-20',
    };
    s.timeCards.push(row);
    res.status(201).json(row);
  });



  // Time card validate (v0.5 E2E)
  app.post(`${API}/timeCards/action/validate`, (req, res) => {
    const body = req.body ?? {};
    const issues: string[] = [];
    if (!body.PersonNumber && !body.personNumber) issues.push('PersonNumber required');
    if (!body.PeriodStart && !body.periodStart) issues.push('PeriodStart required');
    if (!body.PeriodEnd && !body.periodEnd) issues.push('PeriodEnd required');
    res.json({ valid: issues.length === 0, issues, unofficial: true });
  });

  // Benefits enroll / opt-out
  app.post(`${API}/benefitEnrollments/action/enroll`, (req, res) => {
    const id = s.nextId('BE');
    const row = {
      EnrollmentId: id,
      PersonNumber: req.body?.PersonNumber ?? 'P1001',
      PlanName: req.body?.PlanName ?? 'Medical PPO',
      Status: 'ENROLLED',
    };
    s.benefitEnrollments.push(row);
    res.status(201).json(row);
  });
  app.post(`${API}/benefitEnrollments/:id/action/optOut`, (req, res) => {
    const row = s.benefitEnrollments.find((x) => x.EnrollmentId === req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    row.Status = 'OPTED_OUT';
    res.json({ ...row, optedOut: true });
  });

  // Goals create already via generic POST if crud supports — ensure POST/PATCH on goals/learning
  // crud() only does GET; add write routes
  app.post(`${API}/goals`, (req, res) => {
    const id = s.nextId('G');
    const row = {
      GoalId: id,
      PersonNumber: req.body?.PersonNumber ?? 'P1001',
      GoalName: req.body?.GoalName ?? 'Goal',
      Status: req.body?.Status ?? 'IN_PROGRESS',
    };
    s.goals.push(row);
    res.status(201).json(row);
  });
  app.patch(`${API}/goals/:id`, (req, res) => {
    const row = s.goals.find((x) => x.GoalId === req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    Object.assign(row, req.body);
    res.json(row);
  });
  app.post(`${API}/learningEnrollments`, (req, res) => {
    const id = s.nextId('LE');
    const row = {
      EnrollmentId: id,
      PersonNumber: req.body?.PersonNumber ?? 'P1001',
      CourseName: req.body?.CourseName ?? 'Course',
      Status: req.body?.Status ?? 'ENROLLED',
    };
    s.learningEnrollments.push(row);
    res.status(201).json(row);
  });
  app.patch(`${API}/learningEnrollments/:id`, (req, res) => {
    const row = s.learningEnrollments.find((x) => x.EnrollmentId === req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    Object.assign(row, req.body);
    res.json(row);
  });
  app.patch(`${API}/compensationHistories/:id`, (req, res) => {
    const row = s.compensationHistories.find((x) => x.CompensationId === req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    Object.assign(row, req.body);
    res.json(row);
  });

  // Blocklist demo
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
