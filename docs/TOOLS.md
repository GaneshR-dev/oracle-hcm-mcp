# Tools (v0.6)

Unofficial MCP tool catalog. Not an Oracle product. 190+ tools (v0.6).

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

## Recruiting / benefits / atom CDC

`hcm_search_requisitions`, `hcm_get_requisition`, `hcm_search_candidates`, `hcm_get_candidate`,
`hcm_search_benefit_enrollments`, `hcm_get_benefit_enrollment`,
`hcm_list_atom_feeds`, `hcm_get_atom_feed`, `hcm_list_atom_entries`, `hcm_get_atom_entry`,
`hcm_detect_changes`, `hcm_atom_poll`, `hcm_atom_consume`, `hcm_atom_get_checkpoint`, `hcm_atom_reset_checkpoint`

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

`hcm_lov_finder`, `hcm_lov_find`, `hcm_describe_finder`, `hcm_resolve_uniq_key`,
`hcm_explain_tool`, `hcm_dry_run_mutate`, `hcm_probe_capabilities`, `hcm_rbac_hint`,
`hcm_list_audit_trail`,
`hcm_start_webhook_receiver`, `hcm_list_webhook_events`,
`hcm_rest_get`, `hcm_rest_mutate`

## Approval

`hcm_list_pending_approvals`, `hcm_approve_write` (`approval_token` required), `hcm_deny_write` (`approval_token` required)
(always registered; under `--write` approvals are unused — mutations run immediately including sensitive)


## v0.5 additions

**Smoke / profiles:** `hcm_smoke_probe`, `hcm_list_smoke_reports`, `hcm_list_profiles`, `hcm_switch_profile`, `hcm_upsert_profile`, `hcm_emit_profile_mcp_config`

**OAuth / identity:** `hcm_oauth_token_status`, `hcm_oauth_refresh`, `hcm_test_as_user`

**Person deep-read:** `hcm_get_legislative_data`, `hcm_list_work_relationships`, `hcm_get_assignment_history`, `hcm_person_deep_read`

**Recruiting depth:** `hcm_search_offers`, `hcm_get_offer`, `hcm_search_interviews`, `hcm_get_interview`, `hcm_list_candidate_attachments`

**Time E2E:** `hcm_validate_time_card`, `hcm_get_time_card`, `hcm_recipe_time_submit`

**Benefits write:** `hcm_enroll_benefit`, `hcm_opt_out_benefit`

**Recipes:** `hcm_recipe_new_hire_checklist`, `hcm_recipe_absence_balance_approve`

**Redaction / batch / atom / webhook:** `hcm_list_redaction_audit`, `hcm_clear_redaction_audit`, `hcm_batch_get`, `hcm_atom_replay`, `hcm_atom_real_pod_guide`, `hcm_webhook_rotate_secret`, `hcm_bulk_bp_preview`

**Learning / goals writes:** `hcm_create_goal`, `hcm_update_goal`, `hcm_enroll_learning`, `hcm_update_learning_enrollment`

**Compensation / absence LOVs:** `hcm_update_compensation` (SENSITIVE), `hcm_get_absence_type`, `hcm_get_absence_plan`, `hcm_balance_by_plan`

## v0.6 additions

**Performance:** `hcm_search_review_cycles`, `hcm_get_review_cycle`, `hcm_search_feedback`, `hcm_get_feedback`, `hcm_create_feedback`, `hcm_search_check_ins`, `hcm_get_check_in`, `hcm_create_check_in`

**Learning depth:** `hcm_search_learning_assignments`, `hcm_get_learning_assignment`, `hcm_list_learning_completions`, `hcm_record_learning_completion`

**Compensation packs (SENSITIVE in default only):** `hcm_search_salary_bases`, `hcm_get_salary_basis`, `hcm_search_grade_steps`, `hcm_get_grade_step`, `hcm_get_offer_letter_fields`

**Workforce structures:** `hcm_search_departments`, `hcm_get_department_tree`, `hcm_search_job_families`, `hcm_get_job_family`, `hcm_list_position_hierarchy`

**Document records:** `hcm_search_document_records`, `hcm_get_document_record`, `hcm_upload_document_record`, `hcm_redact_document_pii`

**Journeys:** `hcm_search_journeys`, `hcm_get_journey`, `hcm_list_journey_tasks`, `hcm_update_journey_task`

**Absence enhancements:** `hcm_preview_entitlement_calc`, `hcm_accrual_balances_by_date`, `hcm_list_absence_type_lov`, `hcm_list_absence_plan_lov`

**Recipes:** `hcm_recipe_transfer`, `hcm_recipe_terminate`, `hcm_recipe_promote`, `hcm_recipe_new_contingent_worker`, `hcm_recipe_mass_absence_approve`

**Agent UX:** `hcm_preview_write`, `hcm_list_field_maps`, `hcm_field_map`, `hcm_role_privilege_probe`

**Platform:** `hcm_atom_cdc_status`, `hcm_refresh_allowlist_from_openapi`, `hcm_export_approval_audit`, `hcm_bulk_approve_writes`, `hcm_list_pending_approvals_by_domain`

**Nice/later:** `hcm_otbi_query`, `hcm_search_benefit_dependents`, `hcm_search_life_events`, `hcm_search_payroll_costing`, `hcm_get_element_entry`, `hcm_create_element_entry`, `hcm_update_element_entry`, `hcm_search_talent_pools`, `hcm_get_talent_pool`

> **Safety (v0.6):** `--write` / `ORACLE_HCM_WRITE=1` bypasses approval **and** SENSITIVE gates. SENSITIVE only applies in default mode.
