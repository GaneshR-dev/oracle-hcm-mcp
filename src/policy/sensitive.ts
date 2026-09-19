/**
 * Hard gate for payslip / bank / national-ID style tools.
 * Requires ORACLE_HCM_SENSITIVE=1. Even with --write, approval is required
 * unless ORACLE_HCM_SENSITIVE_WRITE=1 is also set.
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
]);

export function isSensitiveTool(name: string): boolean {
  return SENSITIVE_TOOLS.has(name);
}
