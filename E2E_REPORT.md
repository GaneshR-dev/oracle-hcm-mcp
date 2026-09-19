# Oracle HCM MCP — E2E Report

- Date: 2026-09-19T13:08:58.880Z (box UTC; user zone Asia/Calcutta)
- Target: http://127.0.0.1:9090 (dummy HCM, basic auth demo/demo)
- Script: scripts/e2e-stdio.mjs (MCP Client + StdioClientTransport)
- Server: node dist/index.js [ --write ]

## Verdict: **PASS — both approval and --write modes work against dummy HCM**

| Result | Count |
| --- | --- |
| PASS | 62 |
| FAIL | 0 |

## A) Approval mode (no --write)

| Step | Result | Detail |
| --- | --- | --- |
| listTools — approval tools present, curated suite | PASS | `count=110; approval=true; tools=hcm_health,hcm_whoami,hcm_list_resources,hcm_describe_resource,hcm_search_workers,hcm_get_worker,hcm_get_worker_assignments,hcm_create_worker,hcm_update_worker,hcm_search_absences,hcm_get_absence,hcm_create_absence,hcm_update_absence,hcm_delete_absence,hcm_absence_balance,hcm_get_plan_balance,hcm_search_aor,hcm_get_aor,hcm_create_aor,hcm_update_aor,hcm_delete_aor,hcm_list_checklists,hcm_get_checklist,hcm_update_task_status,hcm_list_notifications,hcm_get_notificati` |
| hcm_health | PASS | `{"ok":true,"baseUrl":"http://127.0.0.1:9090/hcmRestApi","writeMode":false,"authMode":"basic"}` |
| hcm_whoami | PASS | `{"authMode":"basic","username":"demo","clientId":null,"baseUrl":"http://127.0.0.1:9090/hcmRestApi","apiVersion":"11.13.18.05","writeMode":false,"note":"Unofficial MCP — identity reflects local config; HCM RBAC applies on server."}` |
| hcm_list_resources | PASS | `{"resources":[{"name":"workers","path":"workers","description":"HCM workers (person + work relationships)"},{"name":"absences","path":"absences","description":"Absence entries"},{"name":"planBalances"` |
| hcm_describe_resource(workers) | PASS | `{"name":"workers","path":"workers","description":"HCM workers (person + work relationships)"}` |
| hcm_search_workers | PASS | `count=5` |
| hcm_get_worker | PASS | `{"WorkerId":"1001","PersonNumber":"P1001","DisplayName":"Ada Lovelace","FirstName":"Ada","LastName":"Lovelace","emails":[{"EmailAddress":"ada@example.com"}],"workRelationships":[{"PeriodOfServiceId":"` |
| hcm_search_absences | PASS | `count=5` |
| hcm_get_absence | PASS | `{"AbsenceId":"A1","personNumber":"P1001","absenceType":"Vacation","startDate":"2026-09-01","endDate":"2026-09-05","status":"APPROVED"}` |
| hcm_absence_balance (planBalances) | PASS | `{"items":[{"BalanceId":"B1","personNumber":"P1001","absenceType":"Vacation","planName":"Annual Leave","balance":12,"unit":"Days"}],"count":1,"hasMore":false}` |
| hcm_get_plan_balance | PASS | `{"BalanceId":"B1","personNumber":"P1001","absenceType":"Vacation","planName":"Annual Leave","balance":12,"unit":"Days"}` |
| hcm_get_worker_assignments | PASS | `{"WorkerId":"1001","PersonNumber":"P1001","DisplayName":"Ada Lovelace","FirstName":"Ada","LastName":"Lovelace","emails":[{"EmailAddress":"ada@example.com"}],"workRelationships":[{"PeriodOfServiceId":"` |
| hcm_search_aor | PASS | `count=1` |
| hcm_get_aor | PASS | `{"AreaOfResponsibilityId":"R1","ResponsibilityName":"Line Manager","PersonNumber":"P1001","Status":"A"}` |
| hcm_list_checklists | PASS | `count=1` |
| hcm_get_checklist | PASS | `{"AllocatedChecklistId":"C1","ChecklistName":"Onboarding","PersonNumber":"P1002","allocatedTasks":[{"TaskId":"T1","AllocatedTaskId":"T1","TaskName":"Complete I9","status":"COMPLETED","TaskStatus":"COM` |
| hcm_list_notifications | PASS | `count=1` |
| hcm_get_notification (businessProcessNotifications) | PASS | `{"NotificationId":"N1","taskId":"N1","Subject":"Absence approval for Ada","Status":"APPROVE","Assignee":"P1002"}` |
| hcm_search_organizations | PASS | `count=2` |
| hcm_get_organization | PASS | `{"OrganizationId":"O1","OrganizationCode":"ENG","Name":"Engineering","Status":"A"}` |
| hcm_search_locations | PASS | `count=2` |
| hcm_get_location | PASS | `{"LocationId":"L1","LocationCode":"SFO","LocationName":"San Francisco","Country":"US"}` |
| hcm_search_jobs | PASS | `count=2` |
| hcm_get_job | PASS | `{"JobId":"J1","JobCode":"SWE","Name":"Software Engineer","Status":"A"}` |
| hcm_search_grades | PASS | `count=2` |
| hcm_search_time_records | PASS | `count=2` |
| hcm_get_time_record | PASS | `{"timeRecordId":"TR1","personNumber":"P1001","startTime":"2026-09-15T09:00:00","stopTime":"2026-09-15T17:00:00","quantit` |
| hcm_search_talent_profiles | PASS | `count=1` |
| hcm_get_talent_profile | PASS | `{"ProfileId":"TP1","PersonNumber":"P1001","ProfileType":"PERSON","Summary":"E2E updated summary"}` |
| hcm_search_payroll_relationships | PASS | `count=1` |
| hcm_get_payroll_relationship | PASS | `{"PayrollRelationshipId":"PR1","PersonNumber":"P1001","PayrollId":"PAY1","Status":"A"}` |
| hcm_rest_get planBalances | PASS | `{"items":[{"BalanceId":"B1","personNumber":"P1001","absenceType":"Vacation","planName":"Annual Leave","balance":12,"unit` |
| hcm_rest_get businessProcessNotifications | PASS | `{"items":[{"NotificationId":"N1","taskId":"N1","Subject":"Absence approval for Ada","Status":"APPROVE","Assignee":"P1002` |
| hcm_rest_get allocatedTasks | PASS | `{"items":[{"TaskId":"T1","AllocatedTaskId":"T1","TaskName":"Complete I9","status":"COMPLETED","TaskStatus":"COMPLETED"},` |
| hcm_rest_get | PASS | `{"items":[{"WorkerId":"1001","PersonNumber":"P1001","DisplayName":"Ada Lovelace","FirstName":"Ada","LastName":"Lovelace","emails":[{"EmailAddress":"ada@example.com"}],"workRelationships":[{"PeriodOfSe` |
| hcm_create_absence → pending_approval | PASS | `{"pending_approval":true,"approval_id":"d511d8ad-041a-4a8e-9912-11697cbda48b","tool":"hcm_create_absence","summary":"hcm_create_absence(body={\"personNumber\":\"P1001\",\"absenceType\":\"Vacation\",\"startDate\":\"2026-12-01\",\"endDa)","expires_at":"2026-09-19T13:23:57.458Z","message":"Write requir` |
| hcm_list_pending_approvals | PASS | `pending=1` |
| hcm_deny_write | PASS | `{"denied":true,"approval_id":"7416a781-026b-4c64-8a94-71a5610818d4","tool":"hcm_create_absence"}` |
| hcm_approve_write | PASS | `{"approved":true,"approval_id":"937fc65a-a4b9-42d0-b3df-5e1e25497ce8","tool":"hcm_create_absence","result":{"AbsenceId":"A2013","personNumber":"P1001","absenceType":"Vacation","startDate":"2026-12-20","endDate":"2026-12-21","status":"SUBMITTED"}}` |
| verify approved absence via hcm_get_absence | PASS | `{"AbsenceId":"A2013","personNumber":"P1001","absenceType":"Vacation","startDate":"2026-12-20","endDate":"2026-12-21","status":"SUBMITTED"}` |
| verify via hcm_search_absences | PASS | `items=1` |
| hcm_rest_mutate blocklisted path → fail/block | PASS | `{"error":"Path blocked by policy (Oracle-internal / CE generative AI style paths are not allowed): ce/generativeAi/chat"}` |
## B) Write mode (--write)

| Step | Result | Detail |
| --- | --- | --- |
| listTools — approval tools PRESENT (v0.3 sensitive gate) | PASS | `count=110; hasApprovalTools=true` |
| hcm_create_worker immediate | PASS | `{"WorkerId":"W2015","PersonNumber":"P-E2E-W","DisplayName":"E2E Writer","FirstName":"E2E","LastName":"Writer","workRelationships":[]}` |
| hcm_update_worker immediate | PASS | `{"WorkerId":"W2015","PersonNumber":"P-E2E-W","DisplayName":"E2E Writer Updated","FirstName":"E2E","LastName":"Writer","workRelationships":[]}` |
| hcm_create_absence immediate | PASS | `{"AbsenceId":"A2016","personNumber":"P1002","absenceType":"Vacation","startDate":"2027-01-01","endDate":"2027-01-03","status":"SUBMITTED"}` |
| hcm_update_absence immediate | PASS | `{"AbsenceId":"A2016","personNumber":"P1002","absenceType":"Vacation","startDate":"2027-01-01","endDate":"2027-01-03","status":"APPROVED"}` |
| hcm_delete_absence immediate | PASS | `{"deleted":true,"status":204}` |
| hcm_create_aor immediate | PASS | `{"AreaOfResponsibilityId":"R2017","ResponsibilityName":"E2E AOR","PersonNumber":"P1002","Status":"A"}` |
| hcm_update_aor immediate | PASS | `{"AreaOfResponsibilityId":"R2017","ResponsibilityName":"E2E AOR","PersonNumber":"P1002","Status":"I"}` |
| hcm_delete_aor immediate | PASS | `{"deleted":true,"status":204}` |
| hcm_update_task_status immediate (allocatedTasks) | PASS | `{"TaskId":"T1","AllocatedTaskId":"T1","TaskName":"Complete I9","status":"COMPLETED","TaskStatus":"COMPLETED"}` |
| hcm_update_talent_profile immediate | PASS | `{"ProfileId":"TP1","PersonNumber":"P1001","ProfileType":"PERSON","Summary":"E2E updated summary"}` |
| hcm_perform_bp_action immediate | PASS | `{"NotificationId":"N1","taskId":"N1","Subject":"Absence approval for Ada","Status":"APPROVE","Assignee":"P1002","actionResult":"OK","comment":"e2e ok"}` |
| hcm_rest_mutate allowlisted immediate | PASS | `{"WorkerId":"W2018","PersonNumber":"PW2018","DisplayName":"Rest Mutate","FirstName":"Rest","LastName":"Mutate","workRelationships":[]}` |
| hcm_rest_mutate blocklisted → fail | PASS | `{"error":"Path blocked by policy (Oracle-internal / CE generative AI style paths are not allowed): ce/generativeAi/chat"}` |
## C) v0.3 smoke (approval mode)

| Step | Result | Detail |
| --- | --- | --- |
| tool count >= 100 | PASS | `count=110` |
| hcm_setup_status | PASS | `{"baseUrl":"http://127.0.0.1:9090/hcmRestApi","apiVersion":"11.13.18.05","authMode":"basic","writeMode":false,"sensitiveEnabled":false,"sensitiveWriteEnabled":false,"username":"demo","clientId":null,"` |
| hcm_list_atom_entries | PASS | `{"items":[{"EntryId":"AE1","Collection":"workers","Updated":"2026-09-18T10:00:00Z","Title":"Worker 1001 updated","ChangeType":"UPDATE"},{"EntryId":"AE2","Collection":"absences","Updated":"2026-09-19T0` |
| hcm_search_requisitions | PASS | `{"items":[{"RequisitionId":"REQ1","RequisitionNumber":"R-100","Title":"Software Engineer","Status":"OPEN"}],"count":1,"hasMore":false}` |
| hcm_get_payslip gated without SENSITIVE | PASS | `{"error":"hcm_get_payslip is gated. Set ORACLE_HCM_SENSITIVE=1 to enable payslip/bank/national-ID style tools."}` |
| hcm_dry_run_mutate | PASS | `{"ok":true,"dry_run":true,"method":"POST","path":"absences","bodyPreview":{"x":1},"wouldRequireApproval":true}` |

## Notes

- Approval tools remain registered in `--write` mode (v0.3) so sensitive tools can still require approval unless `ORACLE_HCM_SENSITIVE_WRITE=1`.
- `hcm_rest_mutate` to CE/generative-AI style paths is rejected by allowlist/blocklist before pending approval or execution.
- Dummy HCM covers v0.3 paths including atomfeeds, recruiting, benefits, payslips (gated), checklists allocate/forceClose, nested assignments, etc.
