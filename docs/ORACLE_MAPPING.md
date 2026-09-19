# Oracle HCM REST mapping (curated)

Unofficial mapping for v0.2 tools. **Not** a complete ADF resource catalog.
Docs: https://docs.oracle.com/en/cloud/saas/human-resources/farws/rest-endpoints.html

Base: `{ORACLE_HCM_BASE_URL}/resources/{ORACLE_HCM_API_VERSION}/`
Default version: `11.13.18.05`

| MCP tool / domain | Fusion REST path |
|-------------------|------------------|
| workers | `workers`, `workers/{WorkerId}` |
| worker assignments | `workers/{id}?expand=workRelationships.assignments`, `workerAssignments` |
| absences | `absences`, `absences/{AbsenceId}` |
| absence / plan balances | **`planBalances`** (legacy `absencesBalances` aliased in dummy/allowlist) |
| AOR | `areasOfResponsibility` |
| checklists | `allocatedChecklists` |
| checklist tasks | `allocatedChecklists/{id}/child/allocatedTasks` |
| task status | `…/child/allocatedTasks/{taskId}/action/updateTaskStatus` (POST) |
| BP notifications | **`businessProcessNotifications`** (legacy `workflowNotifications` aliased) |
| BP action | `businessProcessNotifications/action/performAction` (POST) |
| organizations | `organizations` |
| locations | `locations` |
| jobs | `jobs` |
| grades | `grades` (optional) |
| time | `timeRecords` (read-focused) |
| talent profiles | `talentPersonProfiles` |
| payroll | `payrollRelationships` (MCP read-only) |

Field names and finders vary by Fusion release and customizations. The MCP client sends JSON as provided; it does not rewrite LOVs or DFF segments.

Auth:

- **Basic** — common for integration users in lower environments
- **OAuth client-credentials** — IDCS token URL + client id/secret → Bearer
- **Bearer** — pre-obtained access token

HCM **RBAC** always applies on the real server regardless of MCP mode.

## MCP tool name stability

Curated tool names such as `hcm_absence_balance`, `hcm_list_notifications`, and
`hcm_update_task_status` are **stable** for Cursor MCP wiring. Internals were
realigned to Fusion path names above; legacy roots remain on the allowlist and
dummy for compatibility.
