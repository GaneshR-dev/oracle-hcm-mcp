/**
 * Sensitive tools AND resource roots (payslip / bank via payment methods / national-ID /
 * compensation / payroll costing). Classification matters **only in default
 * (approval) mode**.
 *
 * Roots are enforced in HcmClient so hcm_rest_get / lov / batch cannot bypass
 * the named-tool SENSITIVE gate. Child segments of workers (nationalIdentifiers,
 * legislativeInfo) are also gated.
 *
 * Under `--write` / ORACLE_HCM_WRITE=1 these gates are **fully bypassed**.
 */

import { canonicalizeResourcePath } from './allowlist.js';

export const SENSITIVE_TOOLS = new Set([
  'hcm_get_payslip',
  'hcm_search_payslips',
  'hcm_search_national_identifiers',
  'hcm_get_national_identifier',
  'hcm_search_payment_methods',
  'hcm_get_compensation',
  'hcm_search_compensation',
  'hcm_update_compensation',
  'hcm_get_offer_letter_fields',
  'hcm_search_salary_bases',
  'hcm_get_salary_basis',
  'hcm_search_grade_steps',
  'hcm_get_grade_step',
  'hcm_search_payroll_costing',
  'hcm_get_element_entry',
  'hcm_create_element_entry',
  'hcm_update_element_entry',
  'hcm_search_element_entries',
  'hcm_search_calculation_cards',
  'hcm_get_legislative_data',
  'hcm_search_addresses',
  'hcm_get_address',
  'hcm_create_address',
  'hcm_update_address',
  'hcm_search_visas',
  'hcm_get_visa',
  'hcm_search_passports',
  'hcm_get_passport',
  'hcm_search_disabilities',
  'hcm_search_driver_licenses',
  'hcm_search_ethnicities',
  'hcm_search_religions',
  'hcm_search_external_identifiers',
]);

/** Official Fusion collection roots that require ORACLE_HCM_SENSITIVE=1 (unless --write). */
export const SENSITIVE_ROOTS = new Set([
  'payslips',
  'personalPaymentMethods',
  'salaries',
  'salaryBasisLov',
  'gradeStepsLOV',
  'assignmentCosting',
  'payrollRelationshipCosting',
  'elementEntries',
  'calculationEntries',
]);

/** Child segments that are SENSITIVE even when the root (workers) is not. */
export const SENSITIVE_CHILD_SEGMENTS = new Set([
  'nationalIdentifiers',
  'legislativeInfo',
  'addresses',
  'visasPermits',
  'passports',
  'disabilities',
  'driverLicenses',
  'ethnicities',
  'religions',
  'externalIdentifiers',
]);

export function isSensitiveTool(name: string): boolean {
  return SENSITIVE_TOOLS.has(name);
}

export function isSensitiveRoot(root: string): boolean {
  return SENSITIVE_ROOTS.has(root);
}

export function isSensitivePath(path: string): boolean {
  try {
    const c = canonicalizeResourcePath(path);
    if (isSensitiveRoot(c.root)) return true;
    const hay = `${c.resourcePath}${c.query ? `?${c.query}` : ''}`;
    const segs = c.resourcePath.split('/').map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
    if (segs.some((s) => SENSITIVE_CHILD_SEGMENTS.has(s))) return true;
    return SENSITIVE_CHILD_SEGMENTS.has(c.root) || /nationalIdentifiers|legislativeInfo|visasPermits|passports/i.test(hay);
  } catch {
    return false;
  }
}

export function sensitiveRootDeniedMessage(root: string): string {
  return (
    `Resource '${root}' is SENSITIVE (payslip/bank/national-ID/compensation/payroll). ` +
    `Set ORACLE_HCM_SENSITIVE=1 in default mode, or use --write / ORACLE_HCM_WRITE=1 to bypass.`
  );
}
