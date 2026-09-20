/** Seed data for dummy HCM REST mock — official Fusion 11.13.18.05 shapes only. */

export type Worker = {
  WorkerId: string;
  PersonNumber: string;
  DisplayName: string;
  FirstName: string;
  LastName: string;
  emails: EmailRow[];
  phones: Phone[];
  nationalIdentifiers: NationalId[];
  legislativeInfo: LegislativeData[];
  addresses: Address[];
  names: PersonName[];
  photos: Photo[];
  citizenships: Citizenship[];
  visasPermits: VisaPermit[];
  passports: Passport[];
  disabilities: Disability[];
  driverLicenses: DriverLicense[];
  ethnicities: Ethnicity[];
  religions: Religion[];
  externalIdentifiers: ExternalIdentifier[];
  otherCommunicationAccounts: OtherComm[];
  messages: WorkerMessage[];
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
  employmentHistory?: AssignmentHistory[];
  gradeSteps?: AsgGradeStep[];
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
  PersonNumber?: string;
  absenceType: string;
  planName: string;
  balance: number;
  unit: string;
  asOfDate?: string;
  accruedToDate?: number;
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
  TimeRecordId?: string;
  personNumber: string;
  startTime: string;
  stopTime: string;
  quantity?: number;
  unit?: string;
};

export type TimeRecordGroup = {
  TimeRecordGroupId: string;
  personNumber: string;
  Status?: string;
  PeriodStart?: string;
  PeriodEnd?: string;
  timeRecords: TimeRecord[];
};

export type TimeRecordEventRequest = {
  TimeRecordEventRequestId: string;
  PersonNumber: string;
  Status: string;
  PeriodStart?: string;
  PeriodEnd?: string;
};

export type TalentProfile = {
  ProfileId: string;
  PersonNumber: string;
  ProfileType: string;
  Summary?: string;
};

export type Requisition = {
  RequisitionId: string;
  RequisitionNumber: string;
  Title: string;
  Status: string;
  skills?: { SkillId: string; Name: string; Importance?: number }[];
  attachments?: { AttachmentId: string; FileName: string; ContentType: string }[];
  publishedJobs?: { PublishedJobId: string; Site?: string; Status?: string }[];
};
export type CandidateAttachment = { AttachmentId: string; CandidateId: string; FileName: string; ContentType: string; UploadedAt: string };
export type Candidate = {
  CandidateId: string;
  DisplayName: string;
  Email?: string;
  Status: string;
  attachments?: CandidateAttachment[];
  citizenships?: Citizenship[];
};
export type JobOffer = { OfferId: string; CandidateId: string; RequisitionId: string; Status: string; ProposedSalary?: number; Currency?: string };
export type LegislativeData = { LegislativeDataId: string; PersonNumber: string; WorkerId?: string; LegislationCode: string; MaritalStatus?: string; Sex?: string };
export type AssignmentHistory = { HistoryId: string; WorkerId: string; AssignmentId: string; EffectiveStartDate: string; EffectiveEndDate?: string; ActionCode?: string; JobId?: string };
export type BenefitDependent = { DependentId: string; PersonNumber: string; DependentName: string; Relationship: string; BirthDate?: string };
export type BenefitEnrollment = {
  EnrollmentId: string;
  PersonNumber: string;
  PlanName: string;
  Status: string;
  dependents?: BenefitDependent[];
  costs?: { CostId: string; Amount: number; Currency?: string }[];
  providers?: { ProviderId: string; ProviderName: string }[];
};
export type Position = { PositionId: string; PositionCode: string; Name: string; Status: string; OrganizationId?: string };
export type Contact = { ContactId: string; PersonNumber: string; ContactName: string; Relationship: string };
export type Phone = { PhoneId: string; PersonNumber: string; PhoneNumber: string; PhoneType: string };
export type EmailRow = { EmailId: string; PersonNumber: string; EmailAddress: string; EmailType: string };
export type NationalId = { NationalIdentifierId: string; PersonNumber: string; NationalIdentifierNumber: string; LegislationCode: string };
export type Address = {
  AddressId: string;
  PersonNumber: string;
  AddressLine1: string;
  TownOrCity?: string;
  Country?: string;
  AddressType?: string;
};
export type PersonName = {
  NameId: string;
  PersonNumber: string;
  FirstName: string;
  LastName: string;
  NameType?: string;
};
export type Photo = {
  PhotoId: string;
  PersonNumber: string;
  PhotoName: string;
  PhotoType?: string;
  PrimaryFlag?: boolean;
};
export type Citizenship = {
  CitizenshipId: string;
  PersonNumber?: string;
  CandidateId?: string;
  CitizenshipLegislationCode: string;
  CitizenshipStatus?: string;
};
export type VisaPermit = {
  VisaPermitId: string;
  PersonNumber: string;
  VisaPermitType: string;
  IssuingCountry?: string;
  ExpirationDate?: string;
};
export type Passport = {
  PassportId: string;
  PersonNumber: string;
  PassportNumber: string;
  IssuingCountry?: string;
  ExpirationDate?: string;
};
export type Disability = { DisabilityId: string; PersonNumber: string; Category?: string; Status?: string };
export type DriverLicense = {
  DriverLicenseId: string;
  PersonNumber: string;
  LicenseNumber: string;
  IssuingCountry?: string;
};
export type Ethnicity = { EthnicityId: string; PersonNumber: string; Ethnicity?: string; LegislationCode?: string };
export type Religion = { ReligionId: string; PersonNumber: string; Religion?: string };
export type ExternalIdentifier = {
  ExternalIdentifierId: string;
  PersonNumber: string;
  IdentifierType: string;
  IdentifierNumber: string;
};
export type OtherComm = {
  OtherCommunicationAccountId: string;
  PersonNumber: string;
  AccountName: string;
  Provider?: string;
};
export type WorkerMessage = { MessageId: string; PersonNumber: string; MessageText: string };
export type AsgGradeStep = { GradeStepId: string; GradeStepName: string; GradeId?: string };
export type TimeEventRequest = {
  timeEventRequestId: string;
  TimeEventRequestId?: string;
  requestNumber?: string;
  sourceId?: string;
  Status?: string;
  timeEvents?: Record<string, unknown>[];
};
export type AbsenceType = { AbsenceTypeId: string; Name: string; Status: string };
export type Goal = { GoalId: string; PersonNumber: string; GoalName: string; Status: string };
export type GoalPlan = {
  GoalPlanId: string;
  PersonNumber: string;
  PlanName: string;
  Status: string;
  performanceGoals: Goal[];
};
export type PerfEval = { EvaluationId: string; DocumentId?: string; PersonNumber: string; DocumentName: string; Status: string };
export type LearningCompletion = { CompletionId: string; PersonNumber: string; CourseName: string; CompletionDate: string; Score?: number };
export type LearningRecord = {
  LearningRecordId: string;
  PersonNumber: string;
  CourseName: string;
  Status: string;
  DueDate?: string;
  AssignmentId?: string;
  EnrollmentId?: string;
  completionDetails?: LearningCompletion[];
};
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
  links?: { rel: string; href: string }[];
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
export type Salary = {
  SalaryId: string;
  CompensationId?: string;
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
export type CalculationEntry = {
  CalculationEntryId: string;
  CalculationCardId?: string;
  PersonNumber: string;
  CardType: string;
  Status: string;
  LegislationCode?: string;
  EffectiveStartDate?: string;
};
export type AtomEntry = {
  EntryId: string;
  Collection: string;
  Workspace?: string;
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

export type CheckInDocument = {
  CheckInDocumentId: string;
  CheckInId?: string;
  PersonNumber: string;
  ManagerPersonNumber: string;
  ScheduledDate: string;
  Status: string;
  Notes?: string;
};
export type SalaryBasis = { SalaryBasisId: string; Name: string; Frequency: string; Currency: string; Status: string };
export type GradeStep = { GradeStepId: string; GradeId: string; StepName: string; Sequence: number; Amount: number };
export type JobFamily = { JobFamilyId: string; JobFamilyCode: string; JobFamilyName: string; Status: string };
export type DocumentRecord = { DocumentRecordId: string; PersonNumber: string; DocumentType: string; FileName: string; UploadedAt: string; Status: string };
export type JourneyTask = { JourneyTaskId: string; JourneyId: string; TaskName: string; Status: string; DueDate?: string };
export type WorkerJourney = {
  JourneyId: string;
  PersonNumber: string;
  JourneyName: string;
  Status: string;
  JourneyType: string;
  tasks?: JourneyTask[];
};
export type LifeEvent = { LifeEventId: string; PersonNumber: string; EventType: string; EventDate: string; Status: string };
export type TalentPool = { TalentPoolId: string; PoolName: string; Status: string; MemberCount: number };
export type PayrollCosting = { CostingId: string; PersonNumber: string; CostCenter: string; Percentage: number; ElementName?: string };

export type PayrollRelationship = {
  PayrollRelationshipId: string;
  PersonNumber: string;
  PayrollId?: string;
  Status: string;
};

export function seedStore() {
  const history1001: AssignmentHistory[] = [
    { HistoryId: 'AH1', WorkerId: '1001', AssignmentId: 'AS1', EffectiveStartDate: '2024-01-15', ActionCode: 'HIRE', JobId: 'J1' },
    { HistoryId: 'AH2', WorkerId: '1001', AssignmentId: 'AS1', EffectiveStartDate: '2025-06-01', ActionCode: 'PROMOTION', JobId: 'J1' },
  ];
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
      employmentHistory: history1001,
      gradeSteps: [{ GradeStepId: 'AGS1', GradeStepName: 'Step 1', GradeId: 'G1' }],
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
      employmentHistory: [],
      gradeSteps: [],
    },
  ];

  const phones1001: Phone[] = [
    { PhoneId: 'PH1', PersonNumber: 'P1001', PhoneNumber: '+1-555-0100', PhoneType: 'WORK' },
  ];
  const emails1001: EmailRow[] = [
    { EmailId: 'EM1', PersonNumber: 'P1001', EmailAddress: 'ada@example.com', EmailType: 'WORK' },
  ];
  const nids1001: NationalId[] = [
    { NationalIdentifierId: 'NI1', PersonNumber: 'P1001', NationalIdentifierNumber: '123-45-6789', LegislationCode: 'US' },
  ];
  const legis1001: LegislativeData[] = [
    { LegislativeDataId: 'LD1', PersonNumber: 'P1001', WorkerId: '1001', LegislationCode: 'US', MaritalStatus: 'M', Sex: 'F' },
  ];
  const emptyPersonKids = {
    addresses: [] as Address[],
    names: [] as PersonName[],
    photos: [] as Photo[],
    citizenships: [] as Citizenship[],
    visasPermits: [] as VisaPermit[],
    passports: [] as Passport[],
    disabilities: [] as Disability[],
    driverLicenses: [] as DriverLicense[],
    ethnicities: [] as Ethnicity[],
    religions: [] as Religion[],
    externalIdentifiers: [] as ExternalIdentifier[],
    otherCommunicationAccounts: [] as OtherComm[],
    messages: [] as WorkerMessage[],
  };

  const workers: Worker[] = [
    {
      WorkerId: '1001',
      PersonNumber: 'P1001',
      DisplayName: 'Ada Lovelace',
      FirstName: 'Ada',
      LastName: 'Lovelace',
      emails: emails1001,
      phones: phones1001,
      nationalIdentifiers: nids1001,
      legislativeInfo: legis1001,
      addresses: [
        { AddressId: 'AD1', PersonNumber: 'P1001', AddressLine1: '1 Analytical Engine', TownOrCity: 'London', Country: 'GB', AddressType: 'HOME' },
      ],
      names: [{ NameId: 'NM1', PersonNumber: 'P1001', FirstName: 'Ada', LastName: 'Lovelace', NameType: 'GLOBAL' }],
      photos: [{ PhotoId: 'PHTO1', PersonNumber: 'P1001', PhotoName: 'ada.jpg', PhotoType: 'PROFILE', PrimaryFlag: true }],
      citizenships: [
        { CitizenshipId: 'CZ1', PersonNumber: 'P1001', CitizenshipLegislationCode: 'GB', CitizenshipStatus: 'A' },
      ],
      visasPermits: [
        { VisaPermitId: 'VS1', PersonNumber: 'P1001', VisaPermitType: 'WORK', IssuingCountry: 'US', ExpirationDate: '2027-12-31' },
      ],
      passports: [
        { PassportId: 'PP1', PersonNumber: 'P1001', PassportNumber: 'P-ADA-1', IssuingCountry: 'GB', ExpirationDate: '2030-01-01' },
      ],
      disabilities: [{ DisabilityId: 'DI1', PersonNumber: 'P1001', Category: 'NONE', Status: 'A' }],
      driverLicenses: [
        { DriverLicenseId: 'DL1', PersonNumber: 'P1001', LicenseNumber: 'GB-DL-1', IssuingCountry: 'GB' },
      ],
      ethnicities: [{ EthnicityId: 'ET1', PersonNumber: 'P1001', Ethnicity: 'NOT_DISCLOSED', LegislationCode: 'GB' }],
      religions: [{ ReligionId: 'RG1', PersonNumber: 'P1001', Religion: 'NOT_DISCLOSED' }],
      externalIdentifiers: [
        { ExternalIdentifierId: 'EX1', PersonNumber: 'P1001', IdentifierType: 'BADGE', IdentifierNumber: 'B-1001' },
      ],
      otherCommunicationAccounts: [
        { OtherCommunicationAccountId: 'OC1', PersonNumber: 'P1001', AccountName: '@ada', Provider: 'X' },
      ],
      messages: [{ MessageId: 'WM1', PersonNumber: 'P1001', MessageText: 'Welcome' }],
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
      emails: [{ EmailId: 'EM2', PersonNumber: 'P1002', EmailAddress: 'alan@example.com', EmailType: 'WORK' }],
      phones: [{ PhoneId: 'PH2', PersonNumber: 'P1002', PhoneNumber: '+1-555-0101', PhoneType: 'WORK' }],
      nationalIdentifiers: [],
      legislativeInfo: [],
      ...emptyPersonKids,
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
      PersonNumber: 'P1001',
      absenceType: 'Vacation',
      planName: 'Annual Leave',
      balance: 12,
      unit: 'Days',
    },
    {
      BalanceId: 'B2',
      personNumber: 'P1002',
      PersonNumber: 'P1002',
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

  const timeRecords1001: TimeRecord[] = [
    {
      timeRecordId: 'TR1',
      TimeRecordId: 'TR1',
      personNumber: 'P1001',
      startTime: '2026-09-15T09:00:00',
      stopTime: '2026-09-15T17:00:00',
      quantity: 8,
      unit: 'HOURS',
    },
  ];
  const timeRecords1002: TimeRecord[] = [
    {
      timeRecordId: 'TR2',
      TimeRecordId: 'TR2',
      personNumber: 'P1002',
      startTime: '2026-09-15T08:30:00',
      stopTime: '2026-09-15T16:30:00',
      quantity: 8,
      unit: 'HOURS',
    },
  ];
  const timeRecordGroups: TimeRecordGroup[] = [
    {
      TimeRecordGroupId: 'TRG1',
      personNumber: 'P1001',
      Status: 'DRAFT',
      PeriodStart: '2026-09-14',
      PeriodEnd: '2026-09-20',
      timeRecords: timeRecords1001,
    },
    {
      TimeRecordGroupId: 'TRG2',
      personNumber: 'P1002',
      Status: 'DRAFT',
      PeriodStart: '2026-09-14',
      PeriodEnd: '2026-09-20',
      timeRecords: timeRecords1002,
    },
  ];
  const timeRecordEventRequests: TimeRecordEventRequest[] = [];

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
    {
      RequisitionId: 'REQ1',
      RequisitionNumber: 'R-100',
      Title: 'Software Engineer',
      Status: 'OPEN',
      skills: [{ SkillId: 'SK1', Name: 'Java', Importance: 1 }],
      attachments: [{ AttachmentId: 'RATT1', FileName: 'jd.pdf', ContentType: 'application/pdf' }],
      publishedJobs: [{ PublishedJobId: 'PJ1', Site: 'CAREER', Status: 'POSTED' }],
    },
  ];
  const candidateAttachments: CandidateAttachment[] = [
    { AttachmentId: 'ATT1', CandidateId: 'CAN1', FileName: 'resume.pdf', ContentType: 'application/pdf', UploadedAt: '2026-09-10T12:00:00Z' },
  ];
  const candidates: Candidate[] = [
    { CandidateId: 'CAN1', DisplayName: 'Grace Hopper', Email: 'grace@example.com', Status: 'ACTIVE', attachments: candidateAttachments, citizenships: [{ CitizenshipId: 'CCZ1', CandidateId: 'CAN1', CitizenshipLegislationCode: 'US', CitizenshipStatus: 'A' }] },
  ];
  const benefitDependents: BenefitDependent[] = [
    { DependentId: 'BD1', PersonNumber: 'P1001', DependentName: 'Charles Babbage', Relationship: 'Spouse', BirthDate: '1985-03-01' },
  ];
  const benefitEnrollments: BenefitEnrollment[] = [
    { EnrollmentId: 'BE1', PersonNumber: 'P1001', PlanName: 'Medical PPO', Status: 'ENROLLED', dependents: benefitDependents, costs: [{ CostId: 'BC1', Amount: 420, Currency: 'USD' }], providers: [{ ProviderId: 'BP1', ProviderName: 'Example Health' }] },
  ];
  const positions: Position[] = [
    { PositionId: 'POS1', PositionCode: 'SWE-IC3', Name: 'SWE IC3', Status: 'A', OrganizationId: 'O1' },
  ];
  const contacts: Contact[] = [
    { ContactId: 'CT1', PersonNumber: 'P1001', ContactName: 'Emergency Contact', Relationship: 'Spouse' },
  ];
  const absenceTypesLOV: AbsenceType[] = [
    { AbsenceTypeId: 'AT1', Name: 'Vacation', Status: 'A' },
    { AbsenceTypeId: 'AT2', Name: 'Sick', Status: 'A' },
  ];
  const absencePlansLOV = [
    { AbsencePlanId: 'AP1', PlanName: 'Annual Leave', Status: 'A' },
    { AbsencePlanId: 'AP2', PlanName: 'Sick Accrual', Status: 'A' },
  ];
  const workforceScheduleDefinitions = [
    { ScheduleDefinitionId: 'WS1', ScheduleId: 'WS1', ScheduleName: 'Standard 9-5', PersonNumber: 'P1001' },
  ];
  const goals: Goal[] = [
    { GoalId: 'G1', PersonNumber: 'P1001', GoalName: 'Ship MCP v0.3', Status: 'IN_PROGRESS' },
  ];
  const goalPlans: GoalPlan[] = [
    { GoalPlanId: 'GP1', PersonNumber: 'P1001', PlanName: '2026 Goals', Status: 'ACTIVE', performanceGoals: goals },
  ];
  const performanceEvaluations: PerfEval[] = [
    { EvaluationId: 'PD1', DocumentId: 'PD1', PersonNumber: 'P1001', DocumentName: '2026 Annual Review', Status: 'OPEN' },
  ];
  const learningCompletions: LearningCompletion[] = [
    { CompletionId: 'LC1', PersonNumber: 'P1001', CourseName: 'Security Awareness', CompletionDate: '2026-08-15', Score: 95 },
  ];
  const learnerLearningRecords: LearningRecord[] = [
    {
      LearningRecordId: 'LE1',
      EnrollmentId: 'LE1',
      PersonNumber: 'P1002',
      CourseName: 'Fusion HCM Basics',
      Status: 'ENROLLED',
      DueDate: '2026-10-01',
      AssignmentId: 'LA1',
      completionDetails: [],
    },
    {
      LearningRecordId: 'LA1',
      AssignmentId: 'LA1',
      PersonNumber: 'P1002',
      CourseName: 'Fusion HCM Basics',
      Status: 'ASSIGNED',
      DueDate: '2026-10-01',
      completionDetails: [],
    },
    {
      LearningRecordId: 'LC1R',
      PersonNumber: 'P1001',
      CourseName: 'Security Awareness',
      Status: 'COMPLETED',
      completionDetails: learningCompletions,
    },
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
  const salaries: Salary[] = [
    {
      SalaryId: 'CH1',
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
  const calculationEntries: CalculationEntry[] = [
    {
      CalculationEntryId: 'CC1',
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
      Collection: 'empupdate',
      Workspace: 'employee',
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
      Collection: 'empupdate',
      Workspace: 'employee',
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
      Collection: 'empassignment',
      Workspace: 'employee',
      Updated: '2026-09-19T12:00:00Z',
      Title: 'Worker 1002 assignment change',
      ChangeType: 'UPDATE',
      ResourceId: '1002',
      PersonNumber: 'P1002',
    },
    {
      EntryId: 'AE4',
      Collection: 'workrelshipupdate',
      Workspace: 'employee',
      Updated: '2026-09-19T14:00:00Z',
      Title: 'Work relationship update 1001',
      ChangeType: 'UPDATE',
      ResourceId: 'WR1',
      PersonNumber: 'P1001',
    },
  ];

  const offers: JobOffer[] = [
    { OfferId: 'OFF1', CandidateId: 'CAN1', RequisitionId: 'REQ1', Status: 'EXTENDED', ProposedSalary: 145000, Currency: 'USD' },
  ];

  const checkInDocuments: CheckInDocument[] = [
    { CheckInDocumentId: 'CI1', CheckInId: 'CI1', PersonNumber: 'P1002', ManagerPersonNumber: 'P1001', ScheduledDate: '2026-09-25', Status: 'SCHEDULED', Notes: 'Career chat' },
  ];
  const salaryBasisLov: SalaryBasis[] = [
    { SalaryBasisId: 'SB1', Name: 'US Monthly', Frequency: 'MONTHLY', Currency: 'USD', Status: 'A' },
    { SalaryBasisId: 'SB2', Name: 'US Annual', Frequency: 'ANNUAL', Currency: 'USD', Status: 'A' },
  ];
  const gradeStepsLOV: GradeStep[] = [
    { GradeStepId: 'GS1', GradeId: 'G1', StepName: 'Step 1', Sequence: 1, Amount: 90000 },
    { GradeStepId: 'GS2', GradeId: 'G1', StepName: 'Step 2', Sequence: 2, Amount: 100000 },
  ];
  const jobFamilies: JobFamily[] = [
    { JobFamilyId: 'JF1', JobFamilyCode: 'ENG', JobFamilyName: 'Engineering', Status: 'A' },
    { JobFamilyId: 'JF2', JobFamilyCode: 'PROD', JobFamilyName: 'Product', Status: 'A' },
  ];
  const documentRecords: DocumentRecord[] = [
    { DocumentRecordId: 'DR1', PersonNumber: 'P1001', DocumentType: 'I9', FileName: 'i9.pdf', UploadedAt: '2026-01-10T10:00:00Z', Status: 'ACTIVE' },
  ];
  const journeyTasks: JourneyTask[] = [
    { JourneyTaskId: 'JT1', JourneyId: 'JN1', TaskName: 'Complete profile', Status: 'COMPLETE', DueDate: '2026-09-01' },
    { JourneyTaskId: 'JT2', JourneyId: 'JN1', TaskName: 'Benefits enrollment', Status: 'PENDING', DueDate: '2026-09-30' },
  ];
  const workerJourneys: WorkerJourney[] = [
    { JourneyId: 'JN1', PersonNumber: 'P1002', JourneyName: 'New Hire Onboarding', Status: 'IN_PROGRESS', JourneyType: 'ONBOARDING', tasks: journeyTasks },
  ];
  const lifeEventsLOV: LifeEvent[] = [
    { LifeEventId: 'LE1', PersonNumber: 'P1001', EventType: 'MARRIAGE', EventDate: '2026-06-01', Status: 'PROCESSED' },
  ];
  const talentPoolsLOV: TalentPool[] = [
    { TalentPoolId: 'TPOL1', PoolName: 'High Potential IC', Status: 'A', MemberCount: 2 },
  ];
  const assignmentCosting: PayrollCosting[] = [
    { CostingId: 'PC1', PersonNumber: 'P1001', CostCenter: 'CC-ENG', Percentage: 100, ElementName: 'Regular Salary' },
  ];
  const payrollRelationshipCosting: PayrollCosting[] = [
    { CostingId: 'PRC1', PersonNumber: 'P1001', CostCenter: 'CC-ENG', Percentage: 100, ElementName: 'Regular Salary' },
  ];
  const timeEventRequests: TimeEventRequest[] = [
    {
      timeEventRequestId: 'TER1',
      TimeEventRequestId: 'TER1',
      requestNumber: '20107',
      sourceId: 'HWM_CLOCK_TIME',
      Status: 'PROCESSED',
      timeEvents: [{ timeEventId: 'TE1', supplierDeviceEvent: 'HWM_CLOCK_TIME_IN' }],
    },
  ];
  const jobsLov = jobs.map((j) => ({ ...j }));
  const gradesLov = grades.map((g) => ({ ...g }));
  const locationsLov = locations.map((l) => ({ ...l }));
  const gradeLaddersLov = [{ GradeLadderId: 'GL1', Name: 'US Comp Ladder', Status: 'A' }];
  const gradeRatesLOV = [{ GradeRateId: 'GR1', Name: 'US Annual Rate', Currency: 'USD' }];

  return {
    workers,
    absences,
    balances,
    aors,
    checklists,
    notifications,
    organizations,
    locations,
    jobs,
    grades,
    timeRecordGroups,
    timeRecordEventRequests,
    talentProfiles,
    payrollRelationships,
    requisitions,
    candidates,
    benefitEnrollments,
    positions,
    contacts,
    absenceTypesLOV,
    absencePlansLOV,
    workforceScheduleDefinitions,
    goalPlans,
    performanceEvaluations,
    learnerLearningRecords,
    payslips,
    paymentMethods,
    salaries,
    elementEntries,
    calculationEntries,
    atomfeeds,
    offers,
    checkInDocuments,
    salaryBasisLov,
    gradeStepsLOV,
    jobFamilies,
    documentRecords,
    workerJourneys,
    journeyTasks,
    lifeEventsLOV,
    talentPoolsLOV,
    assignmentCosting,
    payrollRelationshipCosting,
    timeEventRequests,
    jobsLov,
    gradesLov,
    locationsLov,
    gradeLaddersLov,
    gradeRatesLOV,
    nextId,
  };
}

export type Store = ReturnType<typeof seedStore>;
