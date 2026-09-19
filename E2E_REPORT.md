# Oracle HCM MCP — E2E Report

- Date: 2026-09-19T12:21:53.515Z (box UTC; user zone Asia/Calcutta)
- Target: http://127.0.0.1:9090 (dummy HCM, basic auth demo/demo)
- Script: scripts/e2e-stdio.mjs (MCP Client + StdioClientTransport)
- Server: node dist/index.js [ --write ]

## Verdict: **PASS — both approval and --write modes work against dummy HCM**

| Result | Count |
| --- | --- |
| PASS | 37 |
| FAIL | 0 |

## A) Approval mode (no --write)

| Step | Result | Detail |
| --- | --- | --- |
| listTools — approval tools present, ~30 tools | PASS | `count=30; approval=true; tools=hcm_health,hcm_whoami,hcm_list_resources,hcm_describe_resource,hcm_search_workers,hcm_get_worker,hcm_create_worker,hcm_update_worker,hcm_search_absences,hcm_get_absence,hcm_create_absence,hcm_update_absence,hcm_delete_absence,hcm_absence_balance,hcm_search_aor,hcm_get_aor,hcm_create_aor,hcm_update_aor,hcm_delete_aor,hcm_list_checklists,hcm_get_checklist,hcm_update_task_status,hcm_list_notifications,hcm_get_notification,hcm_perform_bp_action,hcm_rest_get,hcm_rest_mu` |
| hcm_health | PASS | `{"ok":true,"baseUrl":"http://127.0.0.1:9090/hcmRestApi","writeMode":false,"authMode":"basic"}` |
| hcm_whoami | PASS | `{"authMode":"basic","username":"demo","clientId":null,"baseUrl":"http://127.0.0.1:9090/hcmRestApi","apiVersion":"11.13.18.05","writeMode":false,"note":"Unofficial MCP — identity reflects local config; HCM RBAC applies on server."}` |
| hcm_list_resources | PASS | `{"resources":[{"name":"workers","path":"workers","description":"HCM workers (person + work relationships)"},{"name":"absences","path":"absences","description":"Absence entries"},{"name":"absencesBalan` |
| hcm_describe_resource(workers) | PASS | `{"name":"workers","path":"workers","description":"HCM workers (person + work relationships)"}` |
| hcm_search_workers | PASS | `count=2` |
| hcm_get_worker | PASS | `{"WorkerId":"1001","PersonNumber":"P1003","DisplayName":"Grace Hopper","FirstName":"Grace","LastName":"Hopper","emails":[{"EmailAddress":"ada@example.com"}]}` |
| hcm_search_absences | PASS | `count=3` |
| hcm_get_absence | PASS | `{"AbsenceId":"A1","personNumber":"P1001","absenceType":"Vacation","startDate":"2026-09-01","endDate":"2026-09-05","status":"APPROVED"}` |
| hcm_absence_balance | PASS | `{"items":[{"BalanceId":"B1","personNumber":"P1001","absenceType":"Vacation","balance":12,"unit":"Days"}],"count":1,"hasMore":false}` |
| hcm_search_aor | PASS | `count=2` |
| hcm_get_aor | PASS | `{"AreaOfResponsibilityId":"R1","ResponsibilityName":"Line Manager","PersonNumber":"P1001","Status":"A"}` |
| hcm_list_checklists | PASS | `count=1` |
| hcm_get_checklist | PASS | `{"AllocatedChecklistId":"C1","ChecklistName":"Onboarding","PersonNumber":"P1002","tasks":[{"TaskId":"T1","TaskName":"Complete I9","status":"IN_PROGRESS"},{"TaskId":"T2","TaskName":"Laptop setup","stat` |
| hcm_list_notifications | PASS | `count=1` |
| hcm_get_notification | PASS | `{"NotificationId":"N1","Subject":"Absence approval for Ada","Status":"OPEN","Assignee":"P1002"}` |
| hcm_rest_get | PASS | `{"items":[{"WorkerId":"1001","PersonNumber":"P1003","DisplayName":"Grace Hopper","FirstName":"Grace","LastName":"Hopper","emails":[{"EmailAddress":"ada@example.com"}]},{"WorkerId":"1002","PersonNumber` |
| hcm_create_absence → pending_approval | PASS | `{"pending_approval":true,"approval_id":"8a62730d-72b8-4be6-a2b9-3f35efbfc9f0","tool":"hcm_create_absence","summary":"hcm_create_absence(body={\"personNumber\":\"P1001\",\"absenceType\":\"Vacation\",\"startDate\":\"2026-12-01\",\"endDa)","expires_at":"2026-09-19T12:36:52.990Z","message":"Write requir` |
| hcm_list_pending_approvals | PASS | `pending=1` |
| hcm_deny_write | PASS | `{"denied":true,"approval_id":"6ecd42de-dd2e-4118-9d0a-af5dedc76e84","tool":"hcm_create_absence"}` |
| hcm_approve_write | PASS | `{"approved":true,"approval_id":"54585bfb-bb97-46d8-ad18-bdec8fee198f","tool":"hcm_create_absence","result":{"AbsenceId":"A2004","personNumber":"P1001","absenceType":"Vacation","startDate":"2026-12-20","endDate":"2026-12-21","status":"SUBMITTED"}}` |
| verify approved absence via hcm_get_absence | PASS | `{"AbsenceId":"A2004","personNumber":"P1001","absenceType":"Vacation","startDate":"2026-12-20","endDate":"2026-12-21","status":"SUBMITTED"}` |
| verify via hcm_search_absences | PASS | `items=1` |
| hcm_rest_mutate blocklisted path → fail/block | PASS | `{"error":"Path blocked by policy (Oracle-internal / CE generative AI style paths are not allowed): ce/generativeAi/chat"}` |
## B) Write mode (--write)

| Step | Result | Detail |
| --- | --- | --- |
| listTools — approval tools ABSENT | PASS | `count=27; hasApprovalTools=false` |
| hcm_create_worker immediate | PASS | `{"WorkerId":"W2006","PersonNumber":"P-E2E-W","DisplayName":"E2E Writer","FirstName":"E2E","LastName":"Writer"}` |
| hcm_update_worker immediate | PASS | `{"WorkerId":"W2006","PersonNumber":"P-E2E-W","DisplayName":"E2E Writer Updated","FirstName":"E2E","LastName":"Writer"}` |
| hcm_create_absence immediate | PASS | `{"AbsenceId":"A2007","personNumber":"P1002","absenceType":"Vacation","startDate":"2027-01-01","endDate":"2027-01-03","status":"SUBMITTED"}` |
| hcm_update_absence immediate | PASS | `{"AbsenceId":"A2007","personNumber":"P1002","absenceType":"Vacation","startDate":"2027-01-01","endDate":"2027-01-03","status":"APPROVED"}` |
| hcm_delete_absence immediate | PASS | `{"deleted":true,"status":204}` |
| hcm_create_aor immediate | PASS | `{"AreaOfResponsibilityId":"R2008","ResponsibilityName":"E2E AOR","PersonNumber":"P1002","Status":"A"}` |
| hcm_update_aor immediate | PASS | `{"AreaOfResponsibilityId":"R2008","ResponsibilityName":"E2E AOR","PersonNumber":"P1002","Status":"I"}` |
| hcm_delete_aor immediate | PASS | `{"deleted":true,"status":204}` |
| hcm_update_task_status immediate | PASS | `{"TaskId":"T1","TaskName":"Complete I9","status":"COMPLETED"}` |
| hcm_perform_bp_action immediate | PASS | `{"NotificationId":"N1","Subject":"Absence approval for Ada","Status":"APPROVE","Assignee":"P1002","actionResult":"OK","comment":"e2e ok"}` |
| hcm_rest_mutate allowlisted immediate | PASS | `{"WorkerId":"W2009","PersonNumber":"PW2009","DisplayName":"Rest Mutate","FirstName":"Rest","LastName":"Mutate"}` |
| hcm_rest_mutate blocklisted → fail | PASS | `{"error":"Path blocked by policy (Oracle-internal / CE generative AI style paths are not allowed): ce/generativeAi/chat"}` |

## Notes

- Approval tools (`hcm_list_pending_approvals`, `hcm_approve_write`, `hcm_deny_write`) are registered only when not in `--write` mode.
- `hcm_rest_mutate` to CE/generative-AI style paths is rejected by allowlist/blocklist before pending approval or execution.
- Dummy HCM supports workers, absences, balances, AOR, checklists/tasks, and BP notification actions.
