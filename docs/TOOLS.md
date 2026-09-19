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
| `hcm_create_worker` | write |
| `hcm_update_worker` | write |

## Absences

| Tool | Class |
|------|-------|
| `hcm_search_absences` | read |
| `hcm_get_absence` | read |
| `hcm_create_absence` | write |
| `hcm_update_absence` | write |
| `hcm_delete_absence` | write |
| `hcm_absence_balance` | read |

## Areas of responsibility

| Tool | Class |
|------|-------|
| `hcm_search_aor` | read |
| `hcm_get_aor` | read |
| `hcm_create_aor` | write |
| `hcm_update_aor` | write |
| `hcm_delete_aor` | write |

## Checklists / tasks

| Tool | Class |
|------|-------|
| `hcm_list_checklists` | read |
| `hcm_get_checklist` | read |
| `hcm_update_task_status` | write |

## Business process / notifications

| Tool | Class |
|------|-------|
| `hcm_list_notifications` | read |
| `hcm_get_notification` | read |
| `hcm_perform_bp_action` | write |

## Generic REST

| Tool | Class | Notes |
|------|-------|-------|
| `hcm_rest_get` | read | Allowlisted roots only |
| `hcm_rest_mutate` | write | Allowlisted; blocklist applied |

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
