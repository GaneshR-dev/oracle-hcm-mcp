/**
 * Classify MCP tool calls as read vs write for approval gating.
 * Unknown action/* tools default to write (safe default).
 */

export type OpClass = 'read' | 'write';

const READ_TOOLS = new Set([
  'hcm_health',
  'hcm_whoami',
  'hcm_list_resources',
  'hcm_describe_resource',
  'hcm_search_workers',
  'hcm_get_worker',
  'hcm_get_worker_assignments',
  'hcm_search_absences',
  'hcm_get_absence',
  'hcm_absence_balance',
  'hcm_get_plan_balance',
  'hcm_search_aor',
  'hcm_get_aor',
  'hcm_list_checklists',
  'hcm_get_checklist',
  'hcm_list_notifications',
  'hcm_get_notification',
  'hcm_search_organizations',
  'hcm_get_organization',
  'hcm_search_locations',
  'hcm_get_location',
  'hcm_search_jobs',
  'hcm_get_job',
  'hcm_search_grades',
  'hcm_get_grade',
  'hcm_search_time_records',
  'hcm_get_time_record',
  'hcm_search_talent_profiles',
  'hcm_get_talent_profile',
  'hcm_search_payroll_relationships',
  'hcm_get_payroll_relationship',
  'hcm_rest_get',
  'hcm_list_pending_approvals',
]);

const WRITE_TOOLS = new Set([
  'hcm_create_worker',
  'hcm_update_worker',
  'hcm_create_absence',
  'hcm_update_absence',
  'hcm_delete_absence',
  'hcm_create_aor',
  'hcm_update_aor',
  'hcm_delete_aor',
  'hcm_update_task_status',
  'hcm_perform_bp_action',
  'hcm_update_talent_profile',
  'hcm_rest_mutate',
  'hcm_approve_write',
  'hcm_deny_write',
]);

export function classifyTool(name: string): OpClass {
  if (READ_TOOLS.has(name)) return 'read';
  if (WRITE_TOOLS.has(name)) return 'write';
  // Unknown / future tools: treat as write
  if (name.startsWith('hcm_') && /create|update|delete|mutate|perform|patch|post|put/i.test(name)) {
    return 'write';
  }
  if (name.startsWith('hcm_')) return 'write';
  return 'write';
}

export function isReadTool(name: string): boolean {
  return classifyTool(name) === 'read';
}

export function isWriteTool(name: string): boolean {
  return classifyTool(name) === 'write';
}
