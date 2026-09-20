# Tools (v0.10)

Unofficial MCP tool catalog. Not an Oracle product. 243 tools. Official Fusion 11.13.18.05 paths only.

Dropped (no public HCM REST equivalent): `hcm_search_review_cycles`, `hcm_get_review_cycle`,
`hcm_search_feedback`, `hcm_get_feedback`, `hcm_create_feedback`, `hcm_otbi_query`,
`hcm_search_bank_accounts`, `hcm_get_bank_account`, `hcm_search_interviews`, `hcm_get_interview`,
`hcm_enroll_benefit`, `hcm_opt_out_benefit`, `hcm_search_absence_plans`,
`hcm_get_absence_plan`, `hcm_force_close_checklist`.
`hcm_list_absence_plan_lov` is kept and remapped to official `absencePlansLOV`.

## Meta / setup

`hcm_health`, `hcm_whoami`, `hcm_list_resources`, `hcm_describe_resource`,
`hcm_adf_describe`, `hcm_adf_catalog`, `hcm_fusion_api_surface`,
`hcm_setup_status`, `hcm_test_connection`, `hcm_emit_mcp_config`, `hcm_export_config`

## Workers / assignments

`hcm_search_workers`, `hcm_get_worker`, `hcm_get_worker_assignments`,
`hcm_create_worker`, `hcm_update_worker`,
`hcm_create_worker_assignment`, `hcm_update_worker_assignment`,
`hcm_get_work_relationship`, `hcm_list_direct_reports`

## Absences / plans

`hcm_search_absences`, `hcm_get_absence`, `hcm_create_absence`, `hcm_update_absence`, `hcm_delete_absence`,
`hcm_absence_balance`, `hcm_get_plan_balance`,
`hcm_search_absence_types`, `hcm_get_absence_type_balance`,
`hcm_list_absence_type_lov` (`absenceTypesLOV`), `hcm_list_absence_plan_lov` (`absencePlansLOV`),
`hcm_preview_entitlement_calc` (`absences/action/loadProjectedBalance`),
`hcm_accrual_balances_by_date` (`planBalances?finder=findByBalanceAsOfDate`)

## Worker children (official nested)

`hcm_search_addresses`, `hcm_get_address`, `hcm_create_address`, `hcm_update_address` (SENSITIVE),
`hcm_search_names`, `hcm_get_name`,
`hcm_search_photos`, `hcm_get_photo`, `hcm_create_photo`,
`hcm_search_citizenships`, `hcm_get_citizenship`,
`hcm_search_visas`, `hcm_get_visa`, `hcm_search_passports`, `hcm_get_passport` (SENSITIVE),
`hcm_search_disabilities`, `hcm_search_driver_licenses`, `hcm_search_ethnicities`, `hcm_search_religions`,
`hcm_search_external_identifiers` (SENSITIVE),
`hcm_search_other_communication`, `hcm_search_worker_messages`,
`hcm_list_assignment_grade_steps`

## Time extras

`hcm_search_time_event_requests`, `hcm_submit_time_event` (`POST timeEventRequests`)

## Work-structure LOVs

`hcm_list_jobs_lov`, `hcm_list_grades_lov`, `hcm_list_grade_ladders_lov`,
`hcm_list_grade_rates_lov`, `hcm_list_locations_lov`

## Recruiting / benefits children

`hcm_list_requisition_skills`, `hcm_list_requisition_attachments`, `hcm_list_published_jobs`,
`hcm_list_candidate_citizenships`,
`hcm_search_benefit_costs`, `hcm_search_benefit_providers`

## Document records actions

`hcm_download_document_attachments`, `hcm_generate_document_letter`,
`hcm_find_document_records_advanced`

## AOR / checklists / BP

`hcm_search_aor` … `hcm_delete_aor`,
`hcm_list_checklists`, `hcm_get_checklist`, `hcm_update_task_status`,
`hcm_allocate_checklist`,
`hcm_list_notifications`, `hcm_get_notification`, `hcm_perform_bp_action`,
`hcm_bulk_bp_dry_run`, `hcm_bulk_approve_notifications`, `hcm_bulk_deny_notifications`

## Time / schedules

`hcm_search_time_records` (`timeRecordGroups`), `hcm_get_time_record`,
`hcm_validate_time_card` (local schema only), `hcm_submit_time_card` (`POST timeRecordEventRequests`),
`hcm_search_schedules` (`workforceScheduleDefinitions`)

## Atom

Official servlet: `hcm_list_atom_feeds`, `hcm_atom_poll`, `hcm_atom_consume`, `hcm_atom_replay`
(default `employee/empupdate`).
