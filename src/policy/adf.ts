/**
 * Conservative ADF REST helpers.
 * Official Fusion HCM uses ADF REST (`/hcmRestApi/resources/{version}/…`), not GraphQL.
 * Docs: https://docs.oracle.com/en/cloud/saas/human-resources/farws/Access_Metadata.html
 *       https://docs.oracle.com/en/cloud/saas/human-resources/farws/Query_a_Collection.html
 */

export const ADF_CONTENT_TYPE = 'application/vnd.oracle.adf.resourceitem+json';
export const ADF_DESCRIBE_ACCEPT = 'application/vnd.oracle.adf.description+json';
export const ADF_OPENAPI_ACCEPT = 'application/vnd.oracle.openapi3+json';

/** Official `/describe` catalog query values (not valid on a specific resource). */
export const ADF_METADATA_MODES = ['minimal', 'list'] as const;
export type AdfMetadataMode = (typeof ADF_METADATA_MODES)[number];

/**
 * ADF q= operators (REST-Framework-Version ≥ 2).
 * Only queryable attributes (see /describe) are accepted; others → 400.
 */
export const ADF_Q_OPERATORS = [
  '=',
  '>',
  '<',
  '>=',
  '<=',
  '<>',
  'in',
  'is null',
  'is not null',
  'between',
  'like',
  'not like',
  'and',
  'or',
  'upper',
] as const;

/** Fusion Cloud HCM has no public GraphQL API. Do not invent one. */
export const FUSION_GRAPHQL = {
  supported: false,
  officialEndpoint: null as string | null,
  note:
    'Oracle Fusion Cloud HCM does not publish a GraphQL API. Official surfaces are ADF REST (/hcmRestApi/resources/{version}), ADF /describe (+ OpenAPI Accept), SOAP, SCIM (/hcmRestApi/scim), and Atom (/hcmRestApi/atomservlet). BOSS v1 (/api/boss/data/objects/ora/…) is REST, not GraphQL, and is not the HCM workers path. Oracle Database GraphQL, ORDS GraphQL, OIC GraphQL Adapter, and Oracle Hospitality GraphQL are different products.',
} as const;

export function adfEquals(key: string, value: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) {
    throw new Error(`Invalid ADF field name: ${key}`);
  }
  const escaped = String(value).replace(/'/g, "''");
  return `${key}='${escaped}'`;
}

export function isAdfFieldName(key: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(key);
}
