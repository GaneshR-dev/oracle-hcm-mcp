/** Seed data for dummy HCM REST mock */

export type Worker = {
  WorkerId: string;
  PersonNumber: string;
  DisplayName: string;
  FirstName: string;
  LastName: string;
  emails?: { EmailAddress: string }[];
  workRelationships?: WorkRelationship[];
};

export type WorkRelationship = {
  PeriodOfServiceId: string;
  LegalEntityId?: string;
  assignments: Assignment[];
};

export type Assignment = {
  AssignmentId: string;
  AssignmentNumber: string;
  WorkerId: string;
  JobId?: string;
  LocationId?: string;
  OrganizationId?: string;
  GradeId?: string;
  AssignmentStatusType?: string;
};

export type Absence = {
  AbsenceId: string;
  personNumber: string;
  absenceType: string;
  startDate: string;
  endDate: string;
  status: string;
};

export type PlanBalance = {
  BalanceId: string;
  personNumber: string;
  absenceType: string;
  planName: string;
  balance: number;
  unit: string;
};

export type Aor = {
  AreaOfResponsibilityId: string;
  ResponsibilityName: string;
  PersonNumber: string;
  Status: string;
};

export type ChecklistTask = {
  TaskId: string;
  AllocatedTaskId: string;
  TaskName: string;
  status: string;
};

export type Checklist = {
  AllocatedChecklistId: string;
  ChecklistName: string;
  PersonNumber: string;
  allocatedTasks: ChecklistTask[];
  /** @deprecated use allocatedTasks — kept for expand/compat */
  tasks?: ChecklistTask[];
};

export type Notification = {
  NotificationId: string;
  taskId: string;
  Subject: string;
  Status: string;
  Assignee: string;
};

export type Organization = {
  OrganizationId: string;
  OrganizationCode: string;
  Name: string;
  Status: string;
};

export type Location = {
  LocationId: string;
  LocationCode: string;
  LocationName: string;
  Country?: string;
};

export type Job = {
  JobId: string;
  JobCode: string;
  Name: string;
  Status: string;
};

export type Grade = {
  GradeId: string;
  GradeCode: string;
  Name: string;
  Status: string;
};

export type TimeRecord = {
  timeRecordId: string;
  personNumber: string;
  startTime: string;
  stopTime: string;
  quantity?: number;
  unit?: string;
};

export type TalentProfile = {
  ProfileId: string;
  PersonNumber: string;
  ProfileType: string;
  Summary?: string;
};

export type PayrollRelationship = {
  PayrollRelationshipId: string;
  PersonNumber: string;
  PayrollId?: string;
  Status: string;
};

export function seedStore() {
  const assignments1001: Assignment[] = [
    {
      AssignmentId: 'AS1',
      AssignmentNumber: 'E1001',
      WorkerId: '1001',
      JobId: 'J1',
      LocationId: 'L1',
      OrganizationId: 'O1',
      GradeId: 'G1',
      AssignmentStatusType: 'ACTIVE',
    },
  ];
  const assignments1002: Assignment[] = [
    {
      AssignmentId: 'AS2',
      AssignmentNumber: 'E1002',
      WorkerId: '1002',
      JobId: 'J2',
      LocationId: 'L2',
      OrganizationId: 'O1',
      GradeId: 'G2',
      AssignmentStatusType: 'ACTIVE',
    },
  ];

  const workers: Worker[] = [
    {
      WorkerId: '1001',
      PersonNumber: 'P1001',
      DisplayName: 'Ada Lovelace',
      FirstName: 'Ada',
      LastName: 'Lovelace',
      emails: [{ EmailAddress: 'ada@example.com' }],
      workRelationships: [
        {
          PeriodOfServiceId: 'WR1',
          LegalEntityId: 'LE1',
          assignments: assignments1001,
        },
      ],
    },
    {
      WorkerId: '1002',
      PersonNumber: 'P1002',
      DisplayName: 'Alan Turing',
      FirstName: 'Alan',
      LastName: 'Turing',
      emails: [{ EmailAddress: 'alan@example.com' }],
      workRelationships: [
        {
          PeriodOfServiceId: 'WR2',
          LegalEntityId: 'LE1',
          assignments: assignments1002,
        },
      ],
    },
  ];

  const workerAssignments: Assignment[] = [...assignments1001, ...assignments1002];

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

  const balances: PlanBalance[] = [
    {
      BalanceId: 'B1',
      personNumber: 'P1001',
      absenceType: 'Vacation',
      planName: 'Annual Leave',
      balance: 12,
      unit: 'Days',
    },
    {
      BalanceId: 'B2',
      personNumber: 'P1002',
      absenceType: 'Sick',
      planName: 'Sick Leave',
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

  const tasksC1: ChecklistTask[] = [
    { TaskId: 'T1', AllocatedTaskId: 'T1', TaskName: 'Complete I9', status: 'IN_PROGRESS' },
    { TaskId: 'T2', AllocatedTaskId: 'T2', TaskName: 'Laptop setup', status: 'PENDING' },
  ];

  const checklists: Checklist[] = [
    {
      AllocatedChecklistId: 'C1',
      ChecklistName: 'Onboarding',
      PersonNumber: 'P1002',
      allocatedTasks: tasksC1,
      tasks: tasksC1,
    },
  ];

  const notifications: Notification[] = [
    {
      NotificationId: 'N1',
      taskId: 'N1',
      Subject: 'Absence approval for Ada',
      Status: 'OPEN',
      Assignee: 'P1002',
    },
  ];

  const organizations: Organization[] = [
    { OrganizationId: 'O1', OrganizationCode: 'ENG', Name: 'Engineering', Status: 'A' },
    { OrganizationId: 'O2', OrganizationCode: 'HR', Name: 'Human Resources', Status: 'A' },
  ];

  const locations: Location[] = [
    { LocationId: 'L1', LocationCode: 'SFO', LocationName: 'San Francisco', Country: 'US' },
    { LocationId: 'L2', LocationCode: 'LHR', LocationName: 'London', Country: 'GB' },
  ];

  const jobs: Job[] = [
    { JobId: 'J1', JobCode: 'SWE', Name: 'Software Engineer', Status: 'A' },
    { JobId: 'J2', JobCode: 'PM', Name: 'Product Manager', Status: 'A' },
  ];

  const grades: Grade[] = [
    { GradeId: 'G1', GradeCode: 'IC3', Name: 'Individual Contributor 3', Status: 'A' },
    { GradeId: 'G2', GradeCode: 'M1', Name: 'Manager 1', Status: 'A' },
  ];

  const timeRecords: TimeRecord[] = [
    {
      timeRecordId: 'TR1',
      personNumber: 'P1001',
      startTime: '2026-09-15T09:00:00',
      stopTime: '2026-09-15T17:00:00',
      quantity: 8,
      unit: 'HOURS',
    },
    {
      timeRecordId: 'TR2',
      personNumber: 'P1002',
      startTime: '2026-09-15T08:30:00',
      stopTime: '2026-09-15T16:30:00',
      quantity: 8,
      unit: 'HOURS',
    },
  ];

  const talentProfiles: TalentProfile[] = [
    {
      ProfileId: 'TP1',
      PersonNumber: 'P1001',
      ProfileType: 'PERSON',
      Summary: 'Pioneer of computing',
    },
  ];

  const payrollRelationships: PayrollRelationship[] = [
    {
      PayrollRelationshipId: 'PR1',
      PersonNumber: 'P1001',
      PayrollId: 'PAY1',
      Status: 'A',
    },
  ];

  let seq = 2000;
  const nextId = (prefix: string) => `${prefix}${++seq}`;

  return {
    workers,
    workerAssignments,
    absences,
    balances,
    aors,
    checklists,
    notifications,
    organizations,
    locations,
    jobs,
    grades,
    timeRecords,
    talentProfiles,
    payrollRelationships,
    nextId,
  };
}

export type Store = ReturnType<typeof seedStore>;
