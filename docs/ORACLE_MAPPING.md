# Oracle HCM REST mapping (curated)

Unofficial mapping for v1 tools. **Not** a complete ADF resource catalog.
Docs: https://docs.oracle.com/en/cloud/saas/human-resources/farws/rest-endpoints.html

Base: `{ORACLE_HCM_BASE_URL}/resources/{ORACLE_HCM_API_VERSION}/`
Default version: `11.13.18.05`

| MCP tool / domain | Typical REST path |
|-------------------|-------------------|
| workers | `workers`, `workers/{WorkerId}` |
| absences | `absences`, `absences/{AbsenceId}` |
| absence balances | `absencesBalances` |
| AOR | `areasOfResponsibility` |
| checklists | `allocatedChecklists`, `…/child/tasks/{TaskId}` |
| notifications / BP | `workflowNotifications`, `…/action/{Action}` |

Field names and finders vary by Fusion release and customizations. The MCP client sends JSON as provided; it does not rewrite LOVs or DFF segments.

Auth:

- **Basic** — common for integration users in lower environments
- **OAuth client-credentials** — IDCS token URL + client id/secret → Bearer
- **Bearer** — pre-obtained access token

HCM **RBAC** always applies on the real server regardless of MCP mode.
