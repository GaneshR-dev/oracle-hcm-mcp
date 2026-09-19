# Oracle HCM MCP — E2E Report

- Date: 2026-09-19T15:58:10.035Z (box UTC; user zone Asia/Calcutta)
- Target: http://127.0.0.1:9090 (dummy HCM, basic auth demo/demo)
- Script: scripts/e2e-stdio.mjs (MCP Client + StdioClientTransport)
- Server: node dist/index.js [ --write ]  (v0.7.0)

## Verdict: **PASS — stdio MCP e2e against dummy HCM (approval, --write, v0.3, v0.6, v0.7)**

| Result | Count |
| --- | --- |
| PASS | 84 |
| FAIL | 0 |

## A) Approval mode (no --write)

| Step | Result | Detail |
| --- | --- | --- |
| listTools — approval tools present, curated suite | PASS | `count=216; approval=true; tools=hcm_health,hcm_whoami,hcm_list_resources,hcm_describe_resource,hcm_search_workers,hcm_get_worker,hcm_get_worker_assignments,hcm_create_worker,hcm_update_worker,hcm_search_absences,hcm_get_absence,hcm_create_absence,hcm_update_absence,hcm_delete_absence,hcm_absence_balance,hcm_get_plan_balance,hcm_search_aor,hcm_get_aor,hcm_create_aor,hcm_update_aor,hcm_delete_aor,hcm_list_checklists,hcm_get_checklist,hcm_update_task_status,hcm_list_notifications,hcm_get_notificati` |
| hcm_health | PASS | `{"ok":true,"baseUrl":"http://127.0.0.1:9090/hcmRestApi","writeMode":false,"authMode":"basic","profile":null,"oauth":{"hasToken":false,"expiresAt":null,"expiresInSec":null,"refreshAvailable":false}}` |
| hcm_whoami | PASS | `{"authMode":"basic","username":"demo","clientId":null,"baseUrl":"http://127.0.0.1:9090/hcmRestApi","apiVersion":"11.13.18.05","writeMode":false,"profile":null,"oauth":{"hasToken":false,"expiresAt":null,"expiresInSec":null,"refreshAvailable":false},"note":"Unofficial MCP — identity reflects local config; HCM RBAC applies on server."}` |
| hcm_list_resources | PASS | `{"resources":[{"name":"workers","path":"workers","description":"HCM workers (person + work relationships)"},{"name":"absences","path":"absences","description":"Absence entries"},{"name":"planBalances"` |
| hcm_describe_resource(workers) | PASS | `{"name":"workers","path":"workers","description":"HCM workers (person + work relationships)"}` |
| hcm_search_workers | PASS | `count=2` |
| hcm_get_worker | PASS | `{"WorkerId":"1001","PersonNumber":"P1001","DisplayName":"Ada Lovelace","FirstName":"Ada","LastName":"Lovelace","emails":[{"EmailAddress":"********.com"}],"workRelationships":[{"PeriodOfServiceId":"WR1` |
| hcm_search_absences | PASS | `count=1` |
| hcm_get_absence | PASS | `{"AbsenceId":"A1","personNumber":"P1001","absenceType":"Vacation","startDate":"2026-09-01","endDate":"2026-09-05","status":"APPROVED"}` |
| hcm_absence_balance (planBalances) | PASS | `{"items":[{"BalanceId":"B1","personNumber":"P1001","absenceType":"Vacation","planName":"Annual Leave","balance":12,"unit":"Days"}],"count":1,"hasMore":false}` |
| hcm_get_plan_balance | PASS | `{"BalanceId":"B1","personNumber":"P1001","absenceType":"Vacation","planName":"Annual Leave","balance":12,"unit":"Days"}` |
| hcm_get_worker_assignments | PASS | `{"WorkerId":"1001","PersonNumber":"P1001","DisplayName":"Ada Lovelace","FirstName":"Ada","LastName":"Lovelace","emails":[{"EmailAddress":"********.com"}],"workRelationships":[{"PeriodOfServiceId":"WR1` |
| hcm_search_aor | PASS | `count=1` |
| hcm_get_aor | PASS | `{"AreaOfResponsibilityId":"R1","ResponsibilityName":"Line Manager","PersonNumber":"P1001","Status":"A"}` |
| hcm_list_checklists | PASS | `count=1` |
| hcm_get_checklist | PASS | `{"AllocatedChecklistId":"C1","ChecklistName":"Onboarding","PersonNumber":"P1002","allocatedTasks":[{"TaskId":"T1","AllocatedTaskId":"T1","TaskName":"Complete I9","status":"IN_PROGRESS"},{"TaskId":"T2"` |
| hcm_list_notifications | PASS | `count=1` |
| hcm_get_notification (businessProcessNotifications) | PASS | `{"NotificationId":"N1","taskId":"N1","Subject":"Absence approval for Ada","Status":"OPEN","Assignee":"P1002"}` |
| hcm_search_organizations | PASS | `count=2` |
| hcm_get_organization | PASS | `{"OrganizationId":"O1","OrganizationCode":"ENG","Name":"Engineering","Status":"A","ClassificationCode":"DEPT"}` |
| hcm_search_locations | PASS | `count=2` |
| hcm_get_location | PASS | `{"LocationId":"L1","LocationCode":"SFO","LocationName":"San Francisco","Country":"US","TownOrCity":"San Francisco"}` |
| hcm_search_jobs | PASS | `count=2` |
| hcm_get_job | PASS | `{"JobId":"J1","JobCode":"SWE","Name":"Software Engineer","Status":"A"}` |
| hcm_search_grades | PASS | `count=2` |
| hcm_search_time_records | PASS | `count=2` |
| hcm_get_time_record | PASS | `{"timeRecordId":"TR1","personNumber":"P1001","startTime":"2026-09-15T09:00:00","stopTime":"2026-09-15T17:00:00","quantit` |
| hcm_search_talent_profiles | PASS | `count=1` |
| hcm_get_talent_profile | PASS | `{"ProfileId":"TP1","PersonNumber":"P1001","ProfileType":"PERSON","Summary":"Pioneer of computing"}` |
| hcm_search_payroll_relationships | PASS | `count=1` |
| hcm_get_payroll_relationship | PASS | `{"PayrollRelationshipId":"PR1","PersonNumber":"P1001","PayrollId":"PAY1","Status":"A"}` |
| hcm_rest_get planBalances | PASS | `{"items":[{"BalanceId":"B1","personNumber":"P1001","absenceType":"Vacation","planName":"Annual Leave","balance":12,"unit` |
| hcm_rest_get businessProcessNotifications | PASS | `{"items":[{"NotificationId":"N1","taskId":"N1","Subject":"Absence approval for Ada","Status":"OPEN","Assignee":"P1002"}]` |
| hcm_rest_get allocatedTasks | PASS | `{"items":[{"TaskId":"T1","AllocatedTaskId":"T1","TaskName":"Complete I9","status":"IN_PROGRESS"},{"TaskId":"T2","Allocat` |
| hcm_rest_get | PASS | `{"items":[{"WorkerId":"1001","PersonNumber":"P1001","DisplayName":"Ada Lovelace","FirstName":"Ada","LastName":"Lovelace","emails":[{"EmailAddress":"********.com"}],"workRelationships":[{"PeriodOfServi` |
| hcm_create_absence → pending_approval | PASS | `{"pending_approval":true,"approval_id":"ff992b82-faa1-4108-b0dd-2aeeeaeefad2","tool":"hcm_create_absence","summary":"hcm_create_absence(body={\"personNumber\":\"P1001\",\"absenceType\":\"Vacation\",\"startDate\":\"2026-12-01\",\"endDa)","expires_at":"2026-09-19T16:13:08.313Z","message":"Write queued` |
| hcm_list_pending_approvals | PASS | `pending=1` |
| hcm_deny_write | PASS | `{"denied":true,"approval_id":"0068ddcc-f278-409a-9c12-93d80159bc8e","tool":"hcm_create_absence"}` |
| hcm_approve_write | PASS | `{"approved":true,"approval_id":"427071de-6833-4d1c-a76a-3c7c60c30e3e","tool":"hcm_create_absence","result":{"AbsenceId":"A2001","personNumber":"P1001","absenceType":"Vacation","startDate":"2026-12-20","endDate":"2026-12-21","status":"SUBMITTED"}}` |
| verify approved absence via hcm_get_absence | PASS | `{"AbsenceId":"A2001","personNumber":"P1001","absenceType":"Vacation","startDate":"2026-12-20","endDate":"2026-12-21","status":"SUBMITTED"}` |
| verify via hcm_search_absences | PASS | `items=1` |
| hcm_rest_mutate blocklisted path → fail/block | PASS | `{"error":"Path blocked by policy (Oracle-internal / CE generative AI style paths are not allowed): ce/generativeAi/chat"}` |
## B) Write mode (--write)

| Step | Result | Detail |
| --- | --- | --- |
| listTools — approval tools PRESENT (v0.3 sensitive gate) | PASS | `count=216; hasApprovalTools=true` |
| hcm_create_worker immediate | PASS | `{"WorkerId":"W2003","PersonNumber":"P-E2E-W","DisplayName":"E2E Writer","FirstName":"E2E","LastName":"Writer","workRelationships":[]}` |
| hcm_update_worker immediate | PASS | `{"WorkerId":"W2003","PersonNumber":"P-E2E-W","DisplayName":"E2E Writer Updated","FirstName":"E2E","LastName":"Writer","workRelationships":[]}` |
| hcm_create_absence immediate | PASS | `{"AbsenceId":"A2004","personNumber":"P1002","absenceType":"Vacation","startDate":"2027-01-01","endDate":"2027-01-03","status":"SUBMITTED"}` |
| hcm_update_absence immediate | PASS | `{"AbsenceId":"A2004","personNumber":"P1002","absenceType":"Vacation","startDate":"2027-01-01","endDate":"2027-01-03","status":"APPROVED"}` |
| hcm_delete_absence immediate | PASS | `{"deleted":true,"status":204}` |
| hcm_create_aor immediate | PASS | `{"AreaOfResponsibilityId":"R2005","ResponsibilityName":"E2E AOR","PersonNumber":"P1002","Status":"A"}` |
| hcm_update_aor immediate | PASS | `{"AreaOfResponsibilityId":"R2005","ResponsibilityName":"E2E AOR","PersonNumber":"P1002","Status":"I"}` |
| hcm_delete_aor immediate | PASS | `{"deleted":true,"status":204}` |
| hcm_update_task_status immediate (allocatedTasks) | PASS | `{"TaskId":"T1","AllocatedTaskId":"T1","TaskName":"Complete I9","status":"COMPLETED","TaskStatus":"COMPLETED"}` |
| hcm_update_talent_profile immediate | PASS | `{"ProfileId":"TP1","PersonNumber":"P1001","ProfileType":"PERSON","Summary":"E2E updated summary"}` |
| hcm_perform_bp_action immediate | PASS | `{"NotificationId":"N1","taskId":"N1","Subject":"Absence approval for Ada","Status":"APPROVE","Assignee":"P1002","actionResult":"OK","comment":"e2e ok"}` |
| hcm_rest_mutate allowlisted immediate | PASS | `{"WorkerId":"W2006","PersonNumber":"PW2006","DisplayName":"Rest Mutate","FirstName":"Rest","LastName":"Mutate","workRelationships":[]}` |
| hcm_rest_mutate blocklisted → fail | PASS | `{"error":"Path blocked by policy (Oracle-internal / CE generative AI style paths are not allowed): ce/generativeAi/chat"}` |
| hcm_get_payslip immediate under --write (SENSITIVE bypass) | PASS | `{"PayslipId":"PS1","PersonNumber":"P1001","PersonId":"1001","Period":"2026-08","PeriodStartDate":"2026-08-01","PeriodEndDate":"2026-08-31","PaymentDate":"2026-09-05","PayrollName":"US Semi-Monthly","P` |
## C) v0.3 smoke (approval mode)

| Step | Result | Detail |
| --- | --- | --- |
| tool count >= 100 | PASS | `count=216` |
| hcm_setup_status | PASS | `{"baseUrl":"http://127.0.0.1:9090/hcmRestApi","apiVersion":"11.13.18.05","authMode":"basic","writeMode":false,"sensitiveEnabled":false,"sensitiveWriteEnabled":false,"username":"demo","clientId":null,"` |
| hcm_list_atom_entries | PASS | `{"items":[{"EntryId":"AE1","Collection":"workers","Updated":"2026-09-18T10:00:00Z","published":"2026-09-18T10:00:00Z","Title":"Worker 1001 updated","ChangeType":"UPDATE","ResourceId":"1001","PersonNum` |
| hcm_search_requisitions | PASS | `{"items":[{"RequisitionId":"REQ1","RequisitionNumber":"R-100","Title":"Software Engineer","Status":"OPEN"}],"count":1,"hasMore":false}` |
| hcm_get_payslip gated without SENSITIVE | PASS | `{"error":"hcm_get_payslip is gated. Set ORACLE_HCM_SENSITIVE=1 to enable payslip/bank/national-ID style tools in default (approval) mode. Or use --write / ORACLE_HCM_WRITE=1 to bypass."}` |
| hcm_dry_run_mutate | PASS | `{"ok":true,"dry_run":true,"method":"POST","path":"absences","bodyPreview":{"x":1},"wouldRequireApproval":true}` |
## D) v0.7 security (stdio process)

| Step | Result | Detail |
| --- | --- | --- |
| pending payload never includes approval token | PASS | `{"pending_approval":true,"approval_id":"ccfdd366-7a8d-44a7-8ad0-446a45c61785","tool":"hcm_create_absence","summary":"hcm_create_absence(body={\"personNumber\":\"P1001\",\"absenceType\":\"Vacation\",\"startDate\":\"2026-11-01\"})","expires_at":"2026-09-19T16:13:09.342Z","message":"Write queued for a ` |
| approve without token fails | PASS | `{"_raw":"MCP error -32602: Input validation error: Invalid arguments for tool hcm_approve_write: Required at approval_token"}` |
| approve with wrong token fails | PASS | `{"error":"Invalid or missing approval_token. Pass the human/ops token from ORACLE_HCM_APPROVAL_TOKEN — it is never included in pending_approval payloads."}` |
| deny with correct split-principal token works | PASS | `{"denied":true,"approval_id":"ccfdd366-7a8d-44a7-8ad0-446a45c61785","tool":"hcm_create_absence"}` |
| path traversal rest_get blocked | PASS | `{"error":"Path traversal rejected: workers/../ce/foo"}` |
| encoded .. rest_get blocked | PASS | `{"error":"Path traversal rejected: workers/%2e%2e/ce"}` |
| scheme rest_get blocked | PASS | `{"error":"Absolute / scheme-relative paths are not allowed: https://evil.example/workers"}` |
| hcm_rest_get payslips blocked without SENSITIVE | PASS | `{"error":"Resource 'payslips' is SENSITIVE (payslip/bank/national-ID/compensation/payroll). Set ORACLE_HCM_SENSITIVE=1 in default mode, or use --write / ORACLE_HCM_WRITE=1 to bypass."}` |
| hcm_rest_get bankAccounts blocked without SENSITIVE | PASS | `{"error":"Resource 'bankAccounts' is SENSITIVE (payslip/bank/national-ID/compensation/payroll). Set ORACLE_HCM_SENSITIVE=1 in default mode, or use --write / ORACLE_HCM_WRITE=1 to bypass."}` |
| hcm_rest_get payslips allowed with SENSITIVE=1 | PASS | `{"PayslipId":"PS1","PersonNumber":"P1001","PersonId":"1001","Period":"2026-08","PeriodStartDate":"2026-08-01","PeriodEndDate":"2026-08-31","PaymentDate":"2026-09-05","PayrollName":"US Semi-Monthly","P` |
| hcm_get_payslip allowed with SENSITIVE=1 | PASS | `{"PayslipId":"PS1","PersonNumber":"P1001","PersonId":"1001","Period":"2026-08","PeriodStartDate":"2026-08-01","PeriodEndDate":"2026-08-31","PaymentDate":"2026-09-05","PayrollName":"US Semi-Monthly","P` |
## E) v0.6 domain smoke (approval mode)

| Step | Result | Detail |
| --- | --- | --- |
| tool count >= 190 | PASS | `count=216` |
| v0.6 tools registered | PASS | `all present` |
| hcm_search_review_cycles | PASS | `{"items":[{"ReviewCycleId":"RC1","CycleName":"2026 Annual","Status":"OPEN","StartDate":"2026-01-01","EndDate":"2026-12-31"}],"count":1,"hasMore":false}` |
| hcm_search_learning_assignments | PASS | `{"items":[{"AssignmentId":"LA1","PersonNumber":"P1002","CourseName":"Fusion HCM Basics","DueDate":"2026-10-01","Status":"ASSIGNED"}],"count":1,"hasMore":false}` |
| hcm_search_document_records | PASS | `{"items":[{"DocumentRecordId":"DR1","PersonNumber":"P1001","DocumentType":"I9","FileName":"i9.pdf","UploadedAt":"2026-01-10T10:00:00Z","Status":"ACTIVE"}],"count":1,"hasMore":false}` |
| hcm_search_talent_pools | PASS | `{"items":[{"TalentPoolId":"TPOL1","PoolName":"High Potential IC","Status":"A","MemberCount":2}],"count":1,"hasMore":false}` |
| hcm_preview_write dry-run | PASS | `{"dry_run":true,"toolName":"hcm_create_absence","args":{"body":{"personNumber":"P1001","absenceType":"Vacation","startDate":"2026-11-15"}},"inferredMethod":"POST","inferredPath":null,"writeMode":false` |
| hcm_recipe_transfer → pending_approval | PASS | `{"pending_approval":true,"approval_id":"13077904-2028-438f-ba87-2a31ea7350c3","tool":"hcm_recipe_transfer","summary":"hcm_recipe_transfer(workerId=1001, body={\"OrganizationId\":\"O1\"})","expires_at"` |
| hcm_atom_poll | PASS | `{"feedId":"atom:workers","checkpoint":null,"cursorUsed":null,"count":2,"entries":[{"entryId":"AE1","title":"Worker 1001 updated","updated":"2026-09-18T10:00:00Z","published":"2026-09-18T10:00:00Z","co` |
| hcm_field_map | PASS | `{"entries":[{"oracle":"PersonNumber","friendly":"person_number","domain":"worker"},{"oracle":"WorkerId","friendly":"worker_id","domain":"worker"},{"oracle":"DisplayName","friendly":"display_name","dom` |

## Notes

- Approval tools remain registered in `--write` mode so sensitive tools can still require approval unless `ORACLE_HCM_SENSITIVE_WRITE=1` or `--write` (which bypasses all gates).
- `hcm_rest_mutate` to CE/generative-AI style paths is rejected by allowlist/blocklist before pending approval or execution.
- v0.7: `ORACLE_HCM_APPROVAL_TOKEN` is never returned in pending payloads; HTTP/gRPC bearer is fail-closed; SENSITIVE resource roots apply to `hcm_rest_get`.
- Dummy HCM covers v0.3–v0.6 paths including atomfeeds, recruiting, benefits, payslips (gated), checklists, performance, learning, recipes.

## F) Setup UI + Approval UI (live)

| Step | Result | Detail |
| --- | --- | --- |
| setup-ui GET / | PASS | `bytes=9615` |
| setup-ui /api/meta unofficial | PASS | `{"service":"oracle-hcm-mcp-setup-ui","unofficial":true,"disclaimer":"Not an Oracle product. Not affiliated with, endorsed by, or supported by Oracle Corporation.","projectRoot":"/tmp/oracle-hcm-mcp","` |
| setup-ui test-connection against dummy | PASS | `{"ok":true,"status":200,"baseUrl":"http://127.0.0.1:9090/hcmRestApi","apiVersion":"11.13.18.05","authMode":"basic","latencyMs":14,"note":"Probe succeeded (or non-5xx). Secrets were not logged or returned."}` |
| setup-ui test-connection does not echo password | PASS | `secretLeakCheck=true` |
| setup-ui CSRF Origin 403 | PASS | `status=403` |
| setup-ui SSRF file:// rejected | PASS | `{"ok":false,"error":"baseUrl must be http(s)"}` |
| approval-ui GET / | PASS | `bytes=1888` |
| approval-ui XSS-safe (textContent, no innerHTML assignment of tool text) | PASS | `jsBytes=7958` |

UI extra: 8 passed, 0 failed. HTTP/gRPC live script ran separately (see console).
