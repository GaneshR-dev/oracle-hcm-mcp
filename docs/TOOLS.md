# Tools reference

Unofficial Oracle HCM MCP — **not affiliated with Oracle Corporation.**

## Meta

| Tool | Class | Description |
|------|-------|-------------|
| `hcm_health` | read | Probe configured base URL |
| `hcm_whoami` | read | Local config identity hints (no secrets) |
| `hcm_list_resources` | read | Curated resource catalog |
| `hcm_describe_resource` | read | Describe one curated resource |

## Workers

| Tool | Class |
|------|-------|
| `hcm_search_workers` | read |
| `hcm_get_worker` | read |
| `hcm_get_worker_assignments` | read |
| `hcm_create_worker` | write |
| `hcm_update_worker` | write |

## Absences / plan balances

| Tool | Class | Fusion path |
|------|-------|-------------|
| `hcm_search_absences` | read | `absences` |
| `hcm_get_absence` | read | `absences/{id}` |
| `hcm_create_absence` | write | `absences` |
| `hcm_update_absence` | write | `absences/{id}` |
| `hcm_delete_absence` | write | `absences/{id}` |
| `hcm_absence_balance` | read | `planBalances` |
| `hcm_get_plan_balance` | read | `planBalances/{id}` |

## Areas of responsibility

| Tool | Class |
|------|-------|
| `hcm_search_aor` | read |
| `hcm_get_aor` | read |
| `hcm_create_aor` | write |
| `hcm_update_aor` | write |
| `hcm_delete_aor` | write |

## Checklists / tasks

| Tool | Class | Notes |
|------|-------|-------|
| `hcm_list_checklists` | read | `allocatedChecklists` |
| `hcm_get_checklist` | read | expand `allocatedTasks` |
| `hcm_update_task_status` | write | `…/child/allocatedTasks/{id}/action/updateTaskStatus` |

## Business process / notifications

| Tool | Class | Fusion path |
|------|-------|-------------|
| `hcm_list_notifications` | read | `businessProcessNotifications` |
| `hcm_get_notification` | read | `businessProcessNotifications/{taskId}` |
| `hcm_perform_bp_action` | write | `…/action/performAction` |

## Org LOVs

| Tool | Class |
|------|-------|
| `hcm_search_organizations` / `hcm_get_organization` | read |
| `hcm_search_locations` / `hcm_get_location` | read |
| `hcm_search_jobs` / `hcm_get_job` | read |
| `hcm_search_grades` / `hcm_get_grade` | read |

## Time (read)

| Tool | Class |
|------|-------|
| `hcm_search_time_records` | read |
| `hcm_get_time_record` | read |

## Talent

| Tool | Class |
|------|-------|
| `hcm_search_talent_profiles` | read |
| `hcm_get_talent_profile` | read |
| `hcm_update_talent_profile` | write |

## Payroll (read-only)

| Tool | Class |
|------|-------|
| `hcm_search_payroll_relationships` | read |
| `hcm_get_payroll_relationship` | read |

## Generic REST

| Tool | Class | Notes |
|------|-------|-------|
| `hcm_rest_get` | read | Allowlisted roots only |
| `hcm_rest_mutate` | write | Allowlisted; CE/generative blocklist applied |

## Approval (absent in `--write`)

| Tool | Description |
|------|-------------|
| `hcm_list_pending_approvals` | List pending intents |
| `hcm_approve_write` | Execute pending by `approval_id` |
| `hcm_deny_write` | Cancel pending |

### Pending response shape

```json
{
  "pending_approval": true,
  "approval_id": "uuid",
  "tool": "hcm_create_absence",
  "summary": "…",
  "expires_at": "ISO-8601",
  "message": "Write requires human approval…"
}
```
