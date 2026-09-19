/** Seed data for dummy HCM REST mock */

export type Worker = {
  WorkerId: string;
  PersonNumber: string;
  DisplayName: string;
  FirstName: string;
  LastName: string;
  emails?: { EmailAddress: string }[];
  workRelationships?: WorkRelationship[];
  ManagerPersonNumber?: string;
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
  ParentOrganizationId?: string;
  ClassificationCode?: string;
};

export type Location = {
  LocationId: string;
  LocationCode: string;
  LocationName: string;
  Country?: string;
  TownOrCity?: string;
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


export type Requisition = { RequisitionId: string; RequisitionNumber: string; Title: string; Status: string };
export type Candidate = { CandidateId: string; DisplayName: string; Email?: string; Status: string };
export type BenefitEnrollment = { EnrollmentId: string; PersonNumber: string; PlanName: string; Status: string };
export type Position = { PositionId: string; PositionCode: string; Name: string; Status: string; OrganizationId?: string };
export type Contact = { ContactId: string; PersonNumber: string; ContactName: string; Relationship: string };
export type Phone = { PhoneId: string; PersonNumber: string; PhoneNumber: string; PhoneType: string };
export type EmailRow = { EmailId: string; PersonNumber: string; EmailAddress: string; EmailType: string };
export type NationalId = { NationalIdentifierId: string; PersonNumber: string; NationalIdentifierNumber: string; LegislationCode: string };
export type AbsenceType = { AbsenceTypeId: string; Name: string; Status: string };
export type AbsencePlan = { AbsencePlanId: string; PlanName: string; Status: string };
export type TimeCard = { TimeCardId: string; PersonNumber: string; Status: string; PeriodStart: string; PeriodEnd: string };
export type WorkSchedule = { ScheduleId: string; ScheduleName: string; PersonNumber?: string };
export type Goal = { GoalId: string; PersonNumber: string; GoalName: string; Status: string };
export type PerfDoc = { DocumentId: string; PersonNumber: string; DocumentName: string; Status: string };
export type LearningEnrollment = { EnrollmentId: string; PersonNumber: string; CourseName: string; Status: string };
export type PayslipEarningsLine = {
  ElementName: string;
  Amount: number;
  Units?: number;
  Rate?: number;
};
export type PayslipDeductionLine = {
  ElementName: string;
  Amount: number;
  pretax?: boolean;
};
export type Payslip = {
  PayslipId: string;
  PersonNumber: string;
  PersonId?: string;
  Period: string;
  PeriodStartDate?: string;
  PeriodEndDate?: string;
  PaymentDate?: string;
  PayrollName?: string;
  PayrollId?: string;
  CurrencyCode?: string;
  GrossEarnings?: number;
  TotalDeductions?: number;
  NetPay: number;
  EmployerName?: string;
  LegislationCode?: string;
  PayslipType?: string;
  Status?: string;
  earnings?: PayslipEarningsLine[];
  deductions?: PayslipDeductionLine[];
  employerContributions?: { ElementName: string; Amount: number }[];
  /** Fusion-style links placeholder */
  links?: { rel: string; href: string }[];
};
export type BankAccount = {
  BankAccountId: string;
  PersonNumber: string;
  BankAccountNumber: string;
  BankName: string;
  BankIdentifierCode?: string;
  BranchName?: string;
  AccountType?: string;
  CurrencyCode?: string;
  CountryCode?: string;
  IBAN?: string;
  SecondaryAccountNumber?: string;
};
export type PaymentMethod = {
  PaymentMethodId: string;
  PersonNumber: string;
  MethodType: string;
  Status: string;
  Priority?: number;
  Percentage?: number;
  BankAccountId?: string;
  CurrencyCode?: string;
};
export type Compensation = {
  CompensationId: string;
  PersonNumber: string;
  Amount: number;
  Currency: string;
  EffectiveDate: string;
  CompType?: string;
  Frequency?: string;
  AnnualAmount?: number;
};
export type ElementEntry = {
  ElementEntryId: string;
  PersonNumber: string;
  ElementName: string;
  Amount: number;
  ElementType?: string;
  EffectiveStartDate?: string;
  EffectiveEndDate?: string;
  InputValue?: string;
};
export type CalculationCard = {
  CalculationCardId: string;
  PersonNumber: string;
  CardType: string;
  Status: string;
  LegislationCode?: string;
  EffectiveStartDate?: string;
};
export type AtomEntry = {
  EntryId: string;
  Collection: string;
  Updated: string;
  Title: string;
  ChangeType: string;
  published?: string;
  ResourceId?: string;
  PersonNumber?: string;
  contentType?: string;
  content?: Record<string, unknown>;
  links?: { rel: string; href: string }[];
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
      ManagerPersonNumber: undefined,
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
      ManagerPersonNumber: 'P1001',
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
    { OrganizationId: 'O1', OrganizationCode: 'ENG', Name: 'Engineering', Status: 'A', ClassificationCode: 'DEPT' },
    { OrganizationId: 'O2', OrganizationCode: 'HR', Name: 'Human Resources', Status: 'A', ParentOrganizationId: 'O1', ClassificationCode: 'DEPT' },
  ];

  const locations: Location[] = [
    { LocationId: 'L1', LocationCode: 'SFO', LocationName: 'San Francisco', Country: 'US', TownOrCity: 'San Francisco' },
    { LocationId: 'L2', LocationCode: 'LHR', LocationName: 'London', Country: 'GB', TownOrCity: 'London' },
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

  const requisitions: Requisition[] = [
    { RequisitionId: 'REQ1', RequisitionNumber: 'R-100', Title: 'Software Engineer', Status: 'OPEN' },
  ];
  const candidates: Candidate[] = [
    { CandidateId: 'CAN1', DisplayName: 'Grace Hopper', Email: 'grace@example.com', Status: 'ACTIVE' },
  ];
  const benefitEnrollments: BenefitEnrollment[] = [
    { EnrollmentId: 'BE1', PersonNumber: 'P1001', PlanName: 'Medical PPO', Status: 'ENROLLED' },
  ];
  const positions: Position[] = [
    { PositionId: 'POS1', PositionCode: 'SWE-IC3', Name: 'SWE IC3', Status: 'A', OrganizationId: 'O1' },
  ];
  const contacts: Contact[] = [
    { ContactId: 'CT1', PersonNumber: 'P1001', ContactName: 'Emergency Contact', Relationship: 'Spouse' },
  ];
  const phones: Phone[] = [
    { PhoneId: 'PH1', PersonNumber: 'P1001', PhoneNumber: '+1-555-0100', PhoneType: 'WORK' },
  ];
  const workerEmails: EmailRow[] = [
    { EmailId: 'EM1', PersonNumber: 'P1001', EmailAddress: 'ada@example.com', EmailType: 'WORK' },
  ];
  const nationalIdentifiers: NationalId[] = [
    { NationalIdentifierId: 'NI1', PersonNumber: 'P1001', NationalIdentifierNumber: '123-45-6789', LegislationCode: 'US' },
  ];
  const absenceTypes: AbsenceType[] = [
    { AbsenceTypeId: 'AT1', Name: 'Vacation', Status: 'A' },
    { AbsenceTypeId: 'AT2', Name: 'Sick', Status: 'A' },
  ];
  const absencePlans: AbsencePlan[] = [
    { AbsencePlanId: 'AP1', PlanName: 'Annual Leave', Status: 'A' },
  ];
  const timeCards: TimeCard[] = [
    { TimeCardId: 'TC1', PersonNumber: 'P1001', Status: 'DRAFT', PeriodStart: '2026-09-14', PeriodEnd: '2026-09-20' },
  ];
  const workSchedules: WorkSchedule[] = [
    { ScheduleId: 'WS1', ScheduleName: 'Standard 9-5', PersonNumber: 'P1001' },
  ];
  const goals: Goal[] = [
    { GoalId: 'G1', PersonNumber: 'P1001', GoalName: 'Ship MCP v0.3', Status: 'IN_PROGRESS' },
  ];
  const performanceDocuments: PerfDoc[] = [
    { DocumentId: 'PD1', PersonNumber: 'P1001', DocumentName: '2026 Annual Review', Status: 'OPEN' },
  ];
  const learningEnrollments: LearningEnrollment[] = [
    { EnrollmentId: 'LE1', PersonNumber: 'P1002', CourseName: 'Fusion HCM Basics', Status: 'ENROLLED' },
  ];
  const payslips: Payslip[] = [
    {
      PayslipId: 'PS1',
      PersonNumber: 'P1001',
      PersonId: '1001',
      Period: '2026-08',
      PeriodStartDate: '2026-08-01',
      PeriodEndDate: '2026-08-31',
      PaymentDate: '2026-09-05',
      PayrollName: 'US Semi-Monthly',
      PayrollId: 'PAY1',
      CurrencyCode: 'USD',
      GrossEarnings: 10500,
      TotalDeductions: 2000,
      NetPay: 8500,
      EmployerName: 'Example Corp',
      LegislationCode: 'US',
      PayslipType: 'REGULAR',
      Status: 'AVAILABLE',
      earnings: [
        { ElementName: 'Regular Salary', Amount: 10000, Units: 80, Rate: 125 },
        { ElementName: 'Overtime', Amount: 500, Units: 4, Rate: 125 },
      ],
      deductions: [
        { ElementName: 'Federal Tax', Amount: 1200 },
        { ElementName: '401k', Amount: 500, pretax: true },
        { ElementName: 'Medical', Amount: 300, pretax: true },
      ],
      employerContributions: [
        { ElementName: 'Employer 401k Match', Amount: 250 },
      ],
      links: [{ rel: 'self', href: 'payslips/PS1' }],
    },
    {
      PayslipId: 'PS2',
      PersonNumber: 'P1002',
      PersonId: '1002',
      Period: '2026-08',
      PeriodStartDate: '2026-08-01',
      PeriodEndDate: '2026-08-31',
      PaymentDate: '2026-09-05',
      PayrollName: 'US Semi-Monthly',
      CurrencyCode: 'USD',
      GrossEarnings: 7200,
      TotalDeductions: 1400,
      NetPay: 5800,
      LegislationCode: 'US',
      PayslipType: 'REGULAR',
      Status: 'AVAILABLE',
      earnings: [{ ElementName: 'Regular Salary', Amount: 7200 }],
      deductions: [{ ElementName: 'Federal Tax', Amount: 1400 }],
    },
  ];
  const bankAccounts: BankAccount[] = [
    {
      BankAccountId: 'BA1',
      PersonNumber: 'P1001',
      BankAccountNumber: '000123456789',
      BankName: 'Example Bank',
      BankIdentifierCode: 'EXMPUS33',
      BranchName: 'Downtown',
      AccountType: 'CHECKING',
      CurrencyCode: 'USD',
      CountryCode: 'US',
    },
  ];
  const paymentMethods: PaymentMethod[] = [
    {
      PaymentMethodId: 'PM1',
      PersonNumber: 'P1001',
      MethodType: 'DIRECT_DEPOSIT',
      Status: 'A',
      Priority: 1,
      Percentage: 100,
      BankAccountId: 'BA1',
      CurrencyCode: 'USD',
    },
  ];
  const compensationHistories: Compensation[] = [
    {
      CompensationId: 'CH1',
      PersonNumber: 'P1001',
      Amount: 10000,
      Currency: 'USD',
      EffectiveDate: '2026-01-01',
      CompType: 'SALARY',
      Frequency: 'MONTHLY',
      AnnualAmount: 120000,
    },
  ];
  const elementEntries: ElementEntry[] = [
    {
      ElementEntryId: 'EE1',
      PersonNumber: 'P1001',
      ElementName: 'Regular Salary',
      Amount: 10000,
      ElementType: 'Earnings',
      EffectiveStartDate: '2026-01-01',
      InputValue: 'Amount',
    },
  ];
  const calculationCards: CalculationCard[] = [
    {
      CalculationCardId: 'CC1',
      PersonNumber: 'P1001',
      CardType: 'Tax',
      Status: 'A',
      LegislationCode: 'US',
      EffectiveStartDate: '2026-01-01',
    },
  ];
  const atomfeeds: AtomEntry[] = [
    {
      EntryId: 'AE1',
      Collection: 'workers',
      Updated: '2026-09-18T10:00:00Z',
      published: '2026-09-18T10:00:00Z',
      Title: 'Worker 1001 updated',
      ChangeType: 'UPDATE',
      ResourceId: '1001',
      PersonNumber: 'P1001',
      contentType: 'application/vnd.oracle.adf.resourceitem+json',
      content: { WorkerId: '1001', PersonNumber: 'P1001' },
      links: [{ rel: 'related', href: 'workers/1001' }],
    },
    {
      EntryId: 'AE2',
      Collection: 'absences',
      Updated: '2026-09-19T08:00:00Z',
      published: '2026-09-19T08:00:00Z',
      Title: 'Absence A1 created',
      ChangeType: 'CREATE',
      ResourceId: 'A1',
      PersonNumber: 'P1001',
      content: { AbsenceId: 'A1' },
    },
    {
      EntryId: 'AE3',
      Collection: 'workers',
      Updated: '2026-09-19T12:00:00Z',
      Title: 'Worker 1002 assignment change',
      ChangeType: 'UPDATE',
      ResourceId: '1002',
      PersonNumber: 'P1002',
    },
  ];

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
    requisitions,
    candidates,
    benefitEnrollments,
    positions,
    contacts,
    phones,
    workerEmails,
    nationalIdentifiers,
    absenceTypes,
    absencePlans,
    timeCards,
    workSchedules,
    goals,
    performanceDocuments,
    learningEnrollments,
    payslips,
    bankAccounts,
    paymentMethods,
    compensationHistories,
    elementEntries,
    calculationCards,
    atomfeeds,
    nextId,
  };
}

export type Store = ReturnType<typeof seedStore>;
