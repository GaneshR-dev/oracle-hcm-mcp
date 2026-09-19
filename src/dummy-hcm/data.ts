/** Seed data for dummy HCM REST mock */

export type Worker = {
  WorkerId: string;
  PersonNumber: string;
  DisplayName: string;
  FirstName: string;
  LastName: string;
  emails?: { EmailAddress: string }[];
};

export type Absence = {
  AbsenceId: string;
  personNumber: string;
  absenceType: string;
  startDate: string;
  endDate: string;
  status: string;
};

export type Aor = {
  AreaOfResponsibilityId: string;
  ResponsibilityName: string;
  PersonNumber: string;
  Status: string;
};

export type ChecklistTask = {
  TaskId: string;
  TaskName: string;
  status: string;
};

export type Checklist = {
  AllocatedChecklistId: string;
  ChecklistName: string;
  PersonNumber: string;
  tasks: ChecklistTask[];
};

export type Notification = {
  NotificationId: string;
  Subject: string;
  Status: string;
  Assignee: string;
};

export function seedStore() {
  const workers: Worker[] = [
    {
      WorkerId: '1001',
      PersonNumber: 'P1001',
      DisplayName: 'Ada Lovelace',
      FirstName: 'Ada',
      LastName: 'Lovelace',
      emails: [{ EmailAddress: 'ada@example.com' }],
    },
    {
      WorkerId: '1002',
      PersonNumber: 'P1002',
      DisplayName: 'Alan Turing',
      FirstName: 'Alan',
      LastName: 'Turing',
      emails: [{ EmailAddress: 'alan@example.com' }],
    },
  ];

  const absences: Absence[] = [
    {
      AbsenceId: 'A1',
      personNumber: 'P1001',
      absenceType: 'Vacation',
      startDate: '2026-09-01',
      endDate: '2026-09-05',
      status: 'APPROVED',
    },
  ];

  const balances = [
    {
      BalanceId: 'B1',
      personNumber: 'P1001',
      absenceType: 'Vacation',
      balance: 12,
      unit: 'Days',
    },
    {
      BalanceId: 'B2',
      personNumber: 'P1002',
      absenceType: 'Sick',
      balance: 5,
      unit: 'Days',
    },
  ];

  const aors: Aor[] = [
    {
      AreaOfResponsibilityId: 'R1',
      ResponsibilityName: 'Line Manager',
      PersonNumber: 'P1001',
      Status: 'A',
    },
  ];

  const checklists: Checklist[] = [
    {
      AllocatedChecklistId: 'C1',
      ChecklistName: 'Onboarding',
      PersonNumber: 'P1002',
      tasks: [
        { TaskId: 'T1', TaskName: 'Complete I9', status: 'IN_PROGRESS' },
        { TaskId: 'T2', TaskName: 'Laptop setup', status: 'PENDING' },
      ],
    },
  ];

  const notifications: Notification[] = [
    {
      NotificationId: 'N1',
      Subject: 'Absence approval for Ada',
      Status: 'OPEN',
      Assignee: 'P1002',
    },
  ];

  let seq = 2000;
  const nextId = (prefix: string) => `${prefix}${++seq}`;

  return { workers, absences, balances, aors, checklists, notifications, nextId };
}

export type Store = ReturnType<typeof seedStore>;
