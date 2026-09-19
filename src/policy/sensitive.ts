/**
 * Sensitive tools (payslip / bank / national-ID / compensation / payroll costing /
 * offer letter fields). Classification matters **only in default (approval) mode**:
 * they require ORACLE_HCM_SENSITIVE=1 and then queue for approval.
 *
 * Under `--write` / ORACLE_HCM_WRITE=1 these gates are **fully bypassed** — no
 * SENSITIVE flag and no approval queue. See docs/SECURITY.md.
 */

export const SENSITIVE_TOOLS = new Set([
  'hcm_get_payslip',
  'hcm_search_payslips',
  'hcm_search_national_identifiers',
  'hcm_get_national_identifier',
  'hcm_search_bank_accounts',
  'hcm_get_bank_account',
  'hcm_search_payment_methods',
  'hcm_get_compensation',
  'hcm_search_compensation',
  'hcm_update_compensation',
  // v0.6
  'hcm_get_offer_letter_fields',
  'hcm_search_salary_bases',
  'hcm_get_salary_basis',
  'hcm_search_grade_steps',
  'hcm_get_grade_step',
  'hcm_search_payroll_costing',
  'hcm_get_element_entry',
  'hcm_create_element_entry',
  'hcm_update_element_entry',
]);

export function isSensitiveTool(name: string): boolean {
  return SENSITIVE_TOOLS.has(name);
}
