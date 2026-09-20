/**
 * ADF REST /describe catalog — official Fusion metadata shape.
 * Unofficial MCP helper. Not an Oracle product. Not GraphQL.
 *
 * GET {resource}/describe
 * GET /describe?metadataMode=minimal|list
 * Accept: application/vnd.oracle.openapi3+json → OpenAPI 3
 */

import { ALLOWED_ROOTS } from '../policy/allowlist.js';
import { FINDER_CATALOG } from '../policy/finders.js';
import {
  ADF_CONTENT_TYPE,
  ADF_OPENAPI_ACCEPT,
  FUSION_GRAPHQL,
} from '../policy/adf.js';

export type AdfAttribute = {
  name: string;
  type: string;
  updatable: boolean;
  mandatory: boolean;
  queryable: boolean;
  precision?: number;
  allowChanges?: string;
};

export type AdfFinderMeta = {
  name: string;
  title?: string;
  attributes?: { name: string; type: string; mandatory?: boolean }[];
};

export type AdfActionMeta = { name: string; method: string };

export type AdfResourceDescribe = {
  discrColumnType: boolean;
  attributes: AdfAttribute[];
  collection: {
    finders: AdfFinderMeta[];
    actions: AdfActionMeta[];
    links: AdfLink[];
  };
  item: { actions: AdfActionMeta[]; links: AdfLink[] };
  children?: Record<string, { links: AdfLink[] }>;
  links: AdfLink[];
};

export type AdfLink = { rel: string; href: string; name: string; kind: string };

export type AdfDescribeSummary = {
  resource: string;
  attributes: AdfAttribute[];
  queryable: string[];
  notQueryable: string[];
  finders: { name: string; params: string[] }[];
  children: string[];
  collectionActions: string[];
  itemActions: string[];
  graphql: typeof FUSION_GRAPHQL;
  unofficial: true;
};

const attr = (
  name: string,
  type: string,
  extra: Partial<AdfAttribute> = {},
): AdfAttribute => ({
  name,
  type,
  updatable: extra.updatable ?? true,
  mandatory: extra.mandatory ?? false,
  queryable: extra.queryable ?? true,
  ...extra,
});

/** Official nested children (11.13.18.05). Keys are ADF resource names. */
export const ADF_CHILDREN: Record<string, string[]> = {
  workers: [
    'emails',
    'phones',
    'nationalIdentifiers',
    'legislativeInfo',
    'addresses',
    'names',
    'photos',
    'citizenships',
    'visasPermits',
    'passports',
    'disabilities',
    'driverLicenses',
    'ethnicities',
    'religions',
    'externalIdentifiers',
    'otherCommunicationAccounts',
    'messages',
    'workRelationships',
  ],
  workRelationships: ['assignments'],
  assignments: ['gradeSteps'],
  allocatedChecklists: ['allocatedTasks'],
  timeRecordGroups: ['timeRecords'],
  timeEventRequests: ['timeEvents'],
  recruitingJobRequisitions: ['skills', 'attachments', 'publishedJobs'],
  recruitingCandidates: ['attachments', 'citizenships'],
  benefitEnrollments: ['dependents', 'costs', 'providers'],
  goalPlans: ['performanceGoals'],
  learnerLearningRecords: ['completionDetails'],
  workerJourneys: ['tasks'],
  documentRecords: [],
};

/** Official collection custom actions (POST …/action/{name}). Not MCP wrappers. */
export const ADF_COLLECTION_ACTIONS: Record<string, AdfActionMeta[]> = {
  absences: [
    { name: 'loadProjectedBalance', method: 'POST' },
    { name: 'getAbsenceTypeBalance', method: 'POST' },
  ],
  allocatedChecklists: [{ name: 'allocateChecklist', method: 'POST' }],
  businessProcessNotifications: [{ name: 'performAction', method: 'POST' }],
  documentRecords: [
    { name: 'downloadAttachments', method: 'POST' },
    { name: 'generateDraftLetter', method: 'POST' },
    { name: 'findByAdvancedSearchQuery', method: 'POST' },
    { name: 'checkPersonDocumentTypeManageAccess', method: 'POST' },
  ],
};

export const ADF_ITEM_ACTIONS: Record<string, AdfActionMeta[]> = {
  allocatedTasks: [{ name: 'updateTaskStatus', method: 'POST' }],
};

/** Curated official-ish attribute lists for dummy + summary. Fusion tenant /describe is authoritative. */
const ATTRS: Record<string, AdfAttribute[]> = {
  workers: [
    attr('PersonId', 'integer', { mandatory: true, allowChanges: 'inCreate', precision: 18 }),
    attr('WorkerId', 'string', { mandatory: true, allowChanges: 'inCreate' }),
    attr('PersonNumber', 'string', { queryable: true }),
    attr('DisplayName', 'string'),
    attr('FirstName', 'string'),
    attr('LastName', 'string'),
    attr('CorrespondenceLanguage', 'string', { queryable: false }),
    attr('DateOfBirth', 'date'),
    attr('CreatedBy', 'string', { updatable: false }),
    attr('CreationDate', 'datetime', { updatable: false }),
    attr('LastUpdatedBy', 'string', { updatable: false }),
    attr('LastUpdateDate', 'datetime', { updatable: false }),
  ],
  publicWorkers: [
    attr('PersonId', 'integer', { mandatory: true, updatable: false }),
    attr('PersonNumber', 'string', { updatable: false }),
    attr('DisplayName', 'string', { updatable: false }),
  ],
  emails: [
    attr('EmailId', 'string', { mandatory: true, allowChanges: 'inCreate' }),
    attr('EmailAddress', 'string', { mandatory: true }),
    attr('EmailType', 'string'),
    attr('PersonNumber', 'string', { queryable: true }),
  ],
  phones: [
    attr('PhoneId', 'string', { mandatory: true, allowChanges: 'inCreate' }),
    attr('PhoneNumber', 'string', { mandatory: true }),
    attr('PhoneType', 'string'),
  ],
  nationalIdentifiers: [
    attr('NationalIdentifierId', 'string', { mandatory: true, allowChanges: 'inCreate' }),
    attr('NationalIdentifierNumber', 'string', { mandatory: true }),
    attr('LegislationCode', 'string'),
  ],
  legislativeInfo: [
    attr('LegislativeDataId', 'string', { mandatory: true, allowChanges: 'inCreate' }),
    attr('LegislationCode', 'string'),
    attr('MaritalStatus', 'string'),
    attr('Sex', 'string'),
  ],
  addresses: [
    attr('AddressId', 'string', { mandatory: true, allowChanges: 'inCreate' }),
    attr('AddressLine1', 'string'),
    attr('TownOrCity', 'string', { queryable: true }),
    attr('Country', 'string', { queryable: true }),
    attr('PostalCode', 'string'),
  ],
  names: [
    attr('NameId', 'string', { mandatory: true, allowChanges: 'inCreate' }),
    attr('FirstName', 'string', { queryable: true }),
    attr('LastName', 'string', { queryable: true }),
    attr('DisplayName', 'string'),
  ],
  photos: [attr('PhotoId', 'string', { mandatory: true }), attr('PhotoName', 'string')],
  citizenships: [
    attr('CitizenshipId', 'string', { mandatory: true }),
    attr('CitizenshipStatus', 'string', { queryable: true }),
    attr('LegislationCode', 'string'),
  ],
  visasPermits: [attr('VisaPermitId', 'string', { mandatory: true }), attr('VisaPermitType', 'string')],
  passports: [attr('PassportId', 'string', { mandatory: true }), attr('PassportNumber', 'string', { queryable: false })],
  disabilities: [attr('DisabilityId', 'string', { mandatory: true }), attr('Category', 'string')],
  driverLicenses: [attr('DriverLicenseId', 'string', { mandatory: true }), attr('LicenseNumber', 'string')],
  ethnicities: [attr('EthnicityId', 'string', { mandatory: true }), attr('Ethnicity', 'string')],
  religions: [attr('ReligionId', 'string', { mandatory: true }), attr('Religion', 'string')],
  externalIdentifiers: [
    attr('ExternalIdentifierId', 'string', { mandatory: true }),
    attr('ExternalIdentifierNumber', 'string'),
  ],
  otherCommunicationAccounts: [
    attr('OtherCommunicationAccountId', 'string', { mandatory: true }),
    attr('AccountName', 'string'),
  ],
  messages: [attr('MessageId', 'string', { mandatory: true }), attr('Subject', 'string')],
  workRelationships: [
    attr('PeriodOfServiceId', 'string', { mandatory: true }),
    attr('LegalEntityId', 'string'),
  ],
  assignments: [
    attr('AssignmentId', 'string', { mandatory: true }),
    attr('AssignmentNumber', 'string', { queryable: true }),
    attr('AssignmentStatusType', 'string'),
    attr('BusinessUnitId', 'integer'),
    attr('JobId', 'string'),
    attr('PositionId', 'integer'),
    attr('GradeId', 'string'),
    attr('LocationId', 'string'),
    attr('OrganizationId', 'string'),
  ],
  gradeSteps: [
    attr('GradeStepId', 'string', { mandatory: true }),
    attr('GradeStepName', 'string'),
    attr('GradeId', 'string'),
  ],
  absences: [
    attr('AbsenceId', 'string', { mandatory: true }),
    attr('personNumber', 'string', { queryable: true }),
    attr('PersonNumber', 'string', { queryable: true }),
    attr('absenceType', 'string'),
    attr('startDate', 'date', { queryable: true }),
    attr('endDate', 'date'),
    attr('status', 'string'),
  ],
  planBalances: [
    attr('BalanceId', 'string', { mandatory: true }),
    attr('personNumber', 'string', { queryable: true }),
    attr('PersonNumber', 'string', { queryable: true }),
    attr('planName', 'string'),
    attr('balance', 'number'),
    attr('asOfDate', 'date'),
  ],
  organizations: [
    attr('OrganizationId', 'string', { mandatory: true }),
    attr('Name', 'string', { queryable: true }),
    attr('ClassificationCode', 'string', { queryable: true }),
  ],
  locations: [
    attr('LocationId', 'string', { mandatory: true }),
    attr('LocationCode', 'string', { queryable: true }),
    attr('Country', 'string', { queryable: true }),
    attr('TownOrCity', 'string', { queryable: true }),
  ],
  locationsV2: [
    attr('LocationId', 'string', { mandatory: true }),
    attr('LocationCode', 'string', { queryable: true }),
    attr('Country', 'string', { queryable: true }),
  ],
  jobs: [
    attr('JobId', 'string', { mandatory: true }),
    attr('JobCode', 'string', { queryable: true }),
    attr('JobName', 'string', { queryable: true }),
    attr('ActiveStatus', 'string'),
  ],
  grades: [
    attr('GradeId', 'string', { mandatory: true }),
    attr('GradeCode', 'string', { queryable: true }),
    attr('GradeName', 'string'),
  ],
  positions: [
    attr('PositionId', 'string', { mandatory: true }),
    attr('PositionCode', 'string', { queryable: true }),
    attr('OrganizationId', 'string', { queryable: true }),
  ],
  timeRecordGroups: [
    attr('TimeRecordGroupId', 'string', { mandatory: true }),
    attr('PersonNumber', 'string', { queryable: true }),
  ],
  timeRecords: [attr('TimeRecordId', 'string', { mandatory: true }), attr('Measure', 'number')],
  timeEventRequests: [
    attr('TimeEventRequestId', 'string', { mandatory: true }),
    attr('PersonNumber', 'string', { queryable: true }),
  ],
  timeEvents: [attr('TimeEventId', 'string', { mandatory: true }), attr('EventDateTime', 'datetime')],
  documentRecords: [
    attr('DocumentRecordId', 'string', { mandatory: true }),
    attr('PersonNumber', 'string', { queryable: true }),
    attr('DocumentType', 'string'),
    attr('FileName', 'string'),
  ],
  recruitingJobRequisitions: [
    attr('RequisitionId', 'string', { mandatory: true }),
    attr('RequisitionNumber', 'string', { queryable: true }),
  ],
  recruitingCandidates: [attr('CandidateId', 'string', { mandatory: true })],
  benefitEnrollments: [attr('EnrollmentId', 'string', { mandatory: true }), attr('PersonNumber', 'string')],
  payslips: [
    attr('PayslipId', 'string', { mandatory: true }),
    attr('PersonNumber', 'string', { queryable: true }),
  ],
  salaries: [attr('SalaryId', 'string', { mandatory: true }), attr('SalaryAmount', 'number')],
};

const DEFAULT_ATTRS: AdfAttribute[] = [
  attr('Id', 'string', { mandatory: true, allowChanges: 'inCreate' }),
  attr('Name', 'string', { queryable: true }),
];

export function knownAdfResource(name: string): boolean {
  if (ALLOWED_ROOTS.includes(name)) return true;
  for (const kids of Object.values(ADF_CHILDREN)) {
    if (kids.includes(name)) return true;
  }
  return name in ATTRS;
}

export function attributesFor(resource: string): AdfAttribute[] {
  return ATTRS[resource] ?? DEFAULT_ATTRS;
}

function findersFor(resource: string): AdfFinderMeta[] {
  const list = FINDER_CATALOG.filter((f) => f.resource === resource);
  const primary: AdfFinderMeta = {
    name: 'PrimaryKey',
    title: 'Find by primary key',
    attributes: [{ name: 'Id', type: 'string', mandatory: true }],
  };
  const named = list.map((f) => ({
    name: f.name,
    title: f.description,
    attributes: f.params.map((p) => ({
      name: p.name,
      type: p.type,
      mandatory: Boolean(p.required),
    })),
  }));
  return [primary, ...named];
}

function link(kind: 'describe' | 'item' | 'collection', href: string, name = 'self'): AdfLink {
  return { rel: name === 'self' ? 'self' : name, href, name, kind };
}

export function buildResourceDescribe(
  resource: string,
  opts: { hrefBase: string; includeChildren?: boolean } = { hrefBase: '' },
): AdfResourceDescribe {
  const base = opts.hrefBase.replace(/\/+$/, '');
  const self = `${base}/${resource}/describe`;
  const childrenNames = ADF_CHILDREN[resource] ?? [];
  const children: Record<string, { links: AdfLink[] }> | undefined =
    opts.includeChildren !== false && childrenNames.length
      ? Object.fromEntries(
          childrenNames.map((c) => [
            c,
            {
              links: [
                link('describe', `${base}/{id}/child/${c}/describe`),
                { rel: 'canonical', href: `${base}/{id}/child/${c}/describe`, name: 'canonical', kind: 'describe' },
              ],
            },
          ]),
        )
      : undefined;

  const collectionActions: AdfActionMeta[] = [
    { name: 'get', method: 'GET' },
    { name: 'create', method: 'POST' },
    ...(ADF_COLLECTION_ACTIONS[resource] ?? []),
  ];
  const itemActions: AdfActionMeta[] = [
    { name: 'get', method: 'GET' },
    { name: 'update', method: 'PATCH' },
    { name: 'delete', method: 'DELETE' },
    ...(ADF_ITEM_ACTIONS[resource] ?? []),
  ];

  return {
    discrColumnType: false,
    attributes: attributesFor(resource),
    collection: {
      finders: findersFor(resource),
      actions: collectionActions,
      links: [link('collection', `${base}/${resource}`)],
    },
    item: {
      actions: itemActions,
      links: [link('item', `${base}/${resource}/{id}`)],
    },
    ...(children ? { children } : {}),
    links: [link('describe', self), { rel: 'canonical', href: self, name: 'canonical', kind: 'describe' }],
  };
}

export function buildCatalogDescribe(
  opts: {
    hrefBase: string;
    metadataMode?: 'minimal' | 'list';
    includeChildren?: boolean;
    roots?: string[];
  },
): { Resources: Record<string, unknown> } {
  const base = opts.hrefBase.replace(/\/+$/, '');
  const roots = opts.roots ?? [...ALLOWED_ROOTS];
  const Resources: Record<string, unknown> = {};
  const mode = opts.metadataMode ?? 'minimal';
  for (const r of roots) {
    const self = `${base}/${r}/describe`;
    const links = [link('describe', self)];
    if (mode === 'list') {
      Resources[r] = { links };
      continue;
    }
    const entry: Record<string, unknown> = {
      title: r,
      titlePlural: r,
      links,
    };
    if (opts.includeChildren) {
      const kids = ADF_CHILDREN[r] ?? [];
      if (kids.length) {
        entry.children = Object.fromEntries(
          kids.map((c) => [c, { links: [link('describe', `${base}/{id}/child/${c}/describe`)] }]),
        );
      }
    }
    Resources[r] = entry;
  }
  return { Resources };
}

export function wrapResources(name: string, body: AdfResourceDescribe): { Resources: Record<string, AdfResourceDescribe> } {
  return { Resources: { [name]: body } };
}

export function summarizeAdfDescribe(doc: unknown, fallbackName?: string): AdfDescribeSummary {
  const rec = (doc && typeof doc === 'object' ? doc : {}) as Record<string, unknown>;
  const resources = (rec.Resources ?? rec.resources ?? rec) as Record<string, unknown>;
  const names = Object.keys(resources ?? {});
  const name = fallbackName && names.includes(fallbackName) ? fallbackName : names[0] ?? fallbackName ?? 'unknown';
  const body = (resources?.[name] ?? rec) as Record<string, unknown>;
  const attributes = (Array.isArray(body.attributes) ? body.attributes : []) as AdfAttribute[];
  const collection = (body.collection ?? {}) as Record<string, unknown>;
  const item = (body.item ?? {}) as Record<string, unknown>;
  const finders = (Array.isArray(collection.finders) ? collection.finders : []) as AdfFinderMeta[];
  const childrenObj = (body.children ?? {}) as Record<string, unknown>;
  const collectionActions = (Array.isArray(collection.actions) ? collection.actions : []) as AdfActionMeta[];
  const itemActions = (Array.isArray(item.actions) ? item.actions : []) as AdfActionMeta[];
  return {
    resource: name,
    attributes,
    queryable: attributes.filter((a) => a.queryable !== false).map((a) => a.name),
    notQueryable: attributes.filter((a) => a.queryable === false).map((a) => a.name),
    finders: finders.map((f) => ({
      name: f.name,
      params: (f.attributes ?? []).map((a) => a.name),
    })),
    children: Object.keys(childrenObj),
    collectionActions: collectionActions.map((a) => a.name),
    itemActions: itemActions.map((a) => a.name),
    graphql: FUSION_GRAPHQL,
    unofficial: true,
  };
}

export function adfDescribeToOpenApi(
  resource: string,
  describe: AdfResourceDescribe,
  apiVersion = '11.13.18.05',
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const a of describe.attributes) {
    properties[a.name] = {
      type: a.type === 'integer' || a.type === 'number' ? a.type : 'string',
      description: a.queryable ? 'queryable' : 'not queryable',
    };
  }
  return {
    openapi: '3.0.1',
    info: { title: `Oracle Fusion HCM ${resource}`, version: apiVersion },
    paths: {
      [`/${resource}`]: {
        get: { summary: `Get ${resource}`, responses: { '200': { description: 'OK' } } },
        post: { summary: `Create ${resource}`, responses: { '201': { description: 'Created' } } },
      },
      [`/${resource}/{id}`]: {
        get: { summary: `Get ${resource} item`, responses: { '200': { description: 'OK' } } },
        patch: { summary: `Update ${resource}`, responses: { '200': { description: 'OK' } } },
        delete: { summary: `Delete ${resource}`, responses: { '204': { description: 'Deleted' } } },
      },
    },
    components: {
      schemas: {
        [`${resource}-item`]: { type: 'object', properties },
      },
    },
    'x-oracle-media-types': { contentType: ADF_CONTENT_TYPE, openapiAccept: ADF_OPENAPI_ACCEPT },
    'x-fusion-graphql': FUSION_GRAPHQL,
  };
}

export function wantsOpenApi(accept: string | undefined): boolean {
  return (accept ?? '').toLowerCase().includes('vnd.oracle.openapi3');
}

export function parseDescribePath(rest: string): {
  kind: 'catalog' | 'resource';
  root?: string;
  resource?: string;
} | null {
  const segs = rest.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  if (segs.length === 1 && segs[0] === 'describe') return { kind: 'catalog' };
  if (segs[segs.length - 1] !== 'describe') return null;
  const pathSegs = segs.slice(0, -1);
  if (pathSegs.length === 0) return { kind: 'catalog' };
  const root = pathSegs[0]!;
  let resource = root;
  for (let i = 0; i < pathSegs.length - 1; i++) {
    if (pathSegs[i] === 'child') resource = pathSegs[i + 1]!;
  }
  return { kind: 'resource', root, resource };
}

export const FUSION_API_SURFACE = {
  unofficial: true as const,
  graphql: FUSION_GRAPHQL,
  adfRest: {
    resources: '/hcmRestApi/resources/11.13.18.05/{collection}',
    describe: '/hcmRestApi/resources/11.13.18.05/{collection}/describe',
    catalog: '/hcmRestApi/resources/11.13.18.05/describe?metadataMode=minimal',
    nestedDescribe: '/hcmRestApi/resources/11.13.18.05/{parent}/{id}/child/{child}/describe',
    contentType: ADF_CONTENT_TYPE,
    openapiAccept: ADF_OPENAPI_ACCEPT,
    docs: 'https://docs.oracle.com/en/cloud/saas/human-resources/farws/Access_Metadata.html',
  },
  soap: { docs: 'https://docs.oracle.com/en/cloud/saas/human-resources/api.html' },
  scim: { path: '/hcmRestApi/scim/Schemas', note: 'Identity schemas, not HCM workers ADF.' },
  atom: { path: '/hcmRestApi/atomservlet/{workspace}/{collection}' },
  bossV1: {
    path: '/api/boss/data/objects/ora/{module}/{domain}/v1/$en/{resource}',
    note: 'REST (not GraphQL). HCM workers remain ADF 11.13.18.05.',
    openapi: '/api/boss/data/objects/{module}/v1/$openapi',
  },
};
