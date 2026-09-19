# Tools (v0.3)

Unofficial MCP tool catalog. Not an Oracle product. ~110 tools.

## Meta / setup

`hcm_health`, `hcm_whoami`, `hcm_list_resources`, `hcm_describe_resource`,
`hcm_setup_status`, `hcm_test_connection`, `hcm_emit_mcp_config`, `hcm_export_config`

## Workers / assignments

`hcm_search_workers`, `hcm_get_worker`, `hcm_get_worker_assignments`,
`hcm_create_worker`, `hcm_update_worker`,
`hcm_create_worker_assignment`, `hcm_update_worker_assignment`,
`hcm_get_work_relationship`, `hcm_list_direct_reports`

## Absences / plans

`hcm_search_absences`, `hcm_get_absence`, `hcm_create_absence`, `hcm_update_absence`, `hcm_delete_absence`,
`hcm_absence_balance`, `hcm_get_plan_balance`,
`hcm_search_absence_types`, `hcm_search_absence_plans`, `hcm_get_absence_type_balance`

## AOR / checklists / BP

`hcm_search_aor` … `hcm_delete_aor`,
`hcm_list_checklists`, `hcm_get_checklist`, `hcm_update_task_status`,
`hcm_allocate_checklist`, `hcm_force_close_checklist`,
`hcm_list_notifications`, `hcm_get_notification`, `hcm_perform_bp_action`,
`hcm_bulk_bp_dry_run`, `hcm_bulk_approve_notifications`, `hcm_bulk_deny_notifications`

## Org LOVs / positions / public

Organizations, locations, jobs, grades search/get;
`hcm_search_positions`, `hcm_get_position`, `hcm_find_locations`, `hcm_get_org_hierarchy`,
`hcm_search_public_workers`, `hcm_get_public_worker`,
`hcm_search_contacts`, `hcm_get_contact`, `hcm_search_phones`, `hcm_search_emails`

## Recruiting / benefits / atom

`hcm_search_requisitions`, `hcm_get_requisition`, `hcm_search_candidates`, `hcm_get_candidate`,
`hcm_search_benefit_enrollments`, `hcm_get_benefit_enrollment`,
`hcm_list_atom_entries`, `hcm_detect_changes`

## Time / talent / learning

`hcm_search_time_records`, `hcm_get_time_record`, `hcm_submit_time_card`,
`hcm_search_schedules`, `hcm_get_schedule`,
`hcm_search_talent_profiles`, `hcm_get_talent_profile`, `hcm_update_talent_profile`,
`hcm_search_goals`, `hcm_get_goal`,
`hcm_search_performance_documents`, `hcm_get_performance_document`,
`hcm_search_learning_enrollments`, `hcm_get_learning_enrollment`

## Payroll / compensation (partly SENSITIVE)

`hcm_search_payroll_relationships`, `hcm_get_payroll_relationship`,
`hcm_search_element_entries`, `hcm_search_calculation_cards`,
**Sensitive** (need `ORACLE_HCM_SENSITIVE=1`):
`hcm_search_payslips`, `hcm_get_payslip`,
`hcm_search_national_identifiers`, `hcm_get_national_identifier`,
`hcm_search_bank_accounts`, `hcm_get_bank_account`,
`hcm_search_payment_methods`,
`hcm_search_compensation`, `hcm_get_compensation`

## Agent UX / platform

`hcm_lov_finder`, `hcm_resolve_uniq_key`,
`hcm_explain_tool`, `hcm_dry_run_mutate`, `hcm_probe_capabilities`, `hcm_rbac_hint`,
`hcm_list_audit_trail`,
`hcm_start_webhook_receiver`, `hcm_list_webhook_events`,
`hcm_rest_get`, `hcm_rest_mutate`

## Approval

`hcm_list_pending_approvals`, `hcm_approve_write`, `hcm_deny_write`
(always registered; sensitive tools use them even under `--write`)
