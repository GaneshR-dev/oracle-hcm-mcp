/**
 * Curated Fusion ADF finder catalog for LOV / collection resources.
 * Unofficial — not exhaustive of every Fusion release; expands common finders.
 */

export type FinderParam = {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  required?: boolean;
  description?: string;
};

export type FinderDef = {
  name: string;
  resource: string;
  description: string;
  params: FinderParam[];
  /** Dummy matching hint: field=param mapping */
  dummyMatch?: Record<string, string>;
};

/** Common finders across workers / absences / orgs / locations / jobs / grades / positions / payroll */
export const FINDER_CATALOG: FinderDef[] = [
  // workers
  {
    name: 'findByPersonNumber',
    resource: 'workers',
    description: 'Find worker by PersonNumber',
    params: [{ name: 'PersonNumber', type: 'string', required: true }],
    dummyMatch: { PersonNumber: 'PersonNumber' },
  },
  {
    name: 'findByPersonId',
    resource: 'workers',
    description: 'Find worker by PersonId / WorkerId',
    params: [{ name: 'PersonId', type: 'string', required: true }],
    dummyMatch: { PersonId: 'WorkerId' },
  },
  {
    name: 'findByAssignmentNumber',
    resource: 'workers',
    description: 'Find workers by primary assignment number',
    params: [{ name: 'AssignmentNumber', type: 'string', required: true }],
    dummyMatch: { AssignmentNumber: 'AssignmentNumber' },
  },
  {
    name: 'findWorkersByManager',
    resource: 'workers',
    description: 'Direct reports by manager person number',
    params: [{ name: 'ManagerPersonNumber', type: 'string', required: true }],
    dummyMatch: { ManagerPersonNumber: 'ManagerPersonNumber' },
  },
  // absences
  {
    name: 'findByPersonNumber',
    resource: 'absences',
    description: 'Absences for a person',
    params: [{ name: 'PersonNumber', type: 'string', required: true }],
    dummyMatch: { PersonNumber: 'personNumber' },
  },
  {
    name: 'findByAbsenceType',
    resource: 'absences',
    description: 'Absences filtered by type',
    params: [{ name: 'AbsenceType', type: 'string', required: true }],
    dummyMatch: { AbsenceType: 'absenceType' },
  },
  {
    name: 'findByDateRange',
    resource: 'absences',
    description: 'Absences overlapping a date range (dummy: startDate filter)',
    params: [
      { name: 'StartDate', type: 'date', required: true },
      { name: 'EndDate', type: 'date', required: false },
    ],
    dummyMatch: { StartDate: 'startDate' },
  },
  {
    name: 'getAbsenceTypeBalance',
    resource: 'planBalances',
    description: 'Plan balance by person + absence type',
    params: [
      { name: 'PersonNumber', type: 'string', required: true },
      { name: 'AbsenceTypeId', type: 'string', required: false },
    ],
    dummyMatch: { PersonNumber: 'PersonNumber' },
  },
  // organizations
  {
    name: 'findByOrganizationName',
    resource: 'organizations',
    description: 'Organization by name',
    params: [{ name: 'Name', type: 'string', required: true }],
    dummyMatch: { Name: 'Name' },
  },
  {
    name: 'findByClassification',
    resource: 'organizations',
    description: 'Organizations by ClassificationCode',
    params: [{ name: 'ClassificationCode', type: 'string', required: true }],
    dummyMatch: { ClassificationCode: 'ClassificationCode' },
  },
  {
    name: 'findByParentOrganization',
    resource: 'organizations',
    description: 'Child orgs under parent',
    params: [{ name: 'ParentOrganizationId', type: 'string', required: true }],
    dummyMatch: { ParentOrganizationId: 'ParentOrganizationId' },
  },
  // locations
  {
    name: 'findByCountry',
    resource: 'locations',
    description: 'Locations by country code',
    params: [{ name: 'Country', type: 'string', required: true }],
    dummyMatch: { Country: 'Country' },
  },
  {
    name: 'findByLocationCode',
    resource: 'locations',
    description: 'Location by code',
    params: [{ name: 'LocationCode', type: 'string', required: true }],
    dummyMatch: { LocationCode: 'LocationCode' },
  },
  {
    name: 'findByTownOrCity',
    resource: 'locations',
    description: 'Locations by city',
    params: [{ name: 'TownOrCity', type: 'string', required: true }],
    dummyMatch: { TownOrCity: 'TownOrCity' },
  },
  // jobs / grades / positions
  {
    name: 'findByJobCode',
    resource: 'jobs',
    description: 'Job by JobCode',
    params: [{ name: 'JobCode', type: 'string', required: true }],
    dummyMatch: { JobCode: 'JobCode' },
  },
  {
    name: 'findByJobName',
    resource: 'jobs',
    description: 'Job by name',
    params: [{ name: 'JobName', type: 'string', required: true }],
    dummyMatch: { JobName: 'JobName' },
  },
  {
    name: 'findByGradeCode',
    resource: 'grades',
    description: 'Grade by code',
    params: [{ name: 'GradeCode', type: 'string', required: true }],
    dummyMatch: { GradeCode: 'GradeCode' },
  },
  {
    name: 'findByPositionCode',
    resource: 'positions',
    description: 'Position by code',
    params: [{ name: 'PositionCode', type: 'string', required: true }],
    dummyMatch: { PositionCode: 'PositionCode' },
  },
  {
    name: 'findByDepartment',
    resource: 'positions',
    description: 'Positions by organization/department',
    params: [{ name: 'OrganizationId', type: 'string', required: true }],
    dummyMatch: { OrganizationId: 'OrganizationId' },
  },
  // absence types / plans
  {
    name: 'findByName',
    resource: 'absenceTypes',
    description: 'Absence type by name',
    params: [{ name: 'Name', type: 'string', required: true }],
    dummyMatch: { Name: 'Name' },
  },
  {
    name: 'findByPlanName',
    resource: 'absencePlans',
    description: 'Absence plan by name',
    params: [{ name: 'PlanName', type: 'string', required: true }],
    dummyMatch: { PlanName: 'PlanName' },
  },
  // payroll / public
  {
    name: 'findByPersonNumber',
    resource: 'payrollRelationships',
    description: 'Payroll relationship by person',
    params: [{ name: 'PersonNumber', type: 'string', required: true }],
    dummyMatch: { PersonNumber: 'PersonNumber' },
  },
  {
    name: 'findByDisplayName',
    resource: 'publicWorkers',
    description: 'Public worker by display name contains',
    params: [{ name: 'DisplayName', type: 'string', required: true }],
    dummyMatch: { DisplayName: 'DisplayName' },
  },
  // recruiting
  {
    name: 'findByRequisitionNumber',
    resource: 'recruitingJobRequisitions',
    description: 'Requisition by number',
    params: [{ name: 'RequisitionNumber', type: 'string', required: true }],
    dummyMatch: { RequisitionNumber: 'RequisitionNumber' },
  },
];

export function listFinders(resource?: string): FinderDef[] {
  if (!resource) return FINDER_CATALOG;
  const r = resource.replace(/^\/+/, '').split('/')[0];
  return FINDER_CATALOG.filter((f) => f.resource === r);
}

export function describeFinder(resource: string, finderName: string): FinderDef | undefined {
  const base = finderName.split(';')[0].trim();
  return FINDER_CATALOG.find((f) => f.resource === resource && f.name === base);
}

/**
 * Parse Fusion-style finder expression:
 *   findByCountry;Country=US
 *   findByPersonNumber;PersonNumber=P1001,Status=A
 */
export function parseFinderExpression(finder: string): {
  name: string;
  params: Record<string, string>;
} {
  const [namePart, rest] = finder.split(';');
  const name = (namePart ?? '').trim();
  const params: Record<string, string> = {};
  if (rest) {
    for (const pair of rest.split(',')) {
      const idx = pair.indexOf('=');
      if (idx <= 0) continue;
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim().replace(/^'|'$/g, '');
      if (k) params[k] = v;
    }
  }
  return { name, params };
}

/** Apply catalog dummyMatch filters to a list of items. */
export function applyFinderFilter<T extends Record<string, unknown>>(
  items: T[],
  resource: string,
  finder?: string,
): T[] {
  if (!finder) return items;
  const { name, params } = parseFinderExpression(finder);
  const def = describeFinder(resource, name);
  if (!def?.dummyMatch) {
    // Fallback: try params as direct field equality
    return items.filter((it) =>
      Object.entries(params).every(([k, v]) => String(it[k] ?? '') === v || String(it[k] ?? '').includes(v)),
    );
  }
  return items.filter((it) =>
    Object.entries(def.dummyMatch!).every(([paramName, field]) => {
      const want = params[paramName];
      if (want == null || want === '') return true;
      let got = it[field];
      if (got == null) {
        const alt = Object.keys(it).find((k) => k.toLowerCase() === field.toLowerCase());
        got = alt ? it[alt] : undefined;
      }
      const s = String(got ?? '');
      return s === want || s.toLowerCase().includes(want.toLowerCase());
    }),
  );
}

/** Build finder= query string from name + params. */
export function buildFinderExpression(name: string, params?: Record<string, string | number | boolean>): string {
  if (!params || Object.keys(params).length === 0) return name;
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${v}`);
  return pairs.length ? `${name};${pairs.join(',')}` : name;
}
