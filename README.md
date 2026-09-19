# oracle-hcm-mcp

Unofficial Model Context Protocol (MCP) server for **Oracle Fusion Cloud HCM** REST APIs.

> **Not an Oracle product.** Not affiliated with, endorsed by, or supported by Oracle Corporation.
> Provided as-is under the MIT License. **You** are responsible for compliance with your Oracle
> licenses, HCM security roles, privacy/PII rules, and any damage caused by write operations.
> This project does **not** claim to be an official Oracle integration, SDK, or partner solution.
> Oracle® and Java® are trademarks of Oracle Corporation. Use of these names does not imply endorsement.

## Status

v0.7 — split-principal approvals (`ORACLE_HCM_APPROVAL_TOKEN` never returned by tools),
HTTP/gRPC bearer, path canonicalization (no `..` / host escape), SENSITIVE **resource roots**
(so `hcm_rest_get` cannot bypass payslip/bank gates), profiles cannot enable `--write`,
Fusion `REST-Framework-Version` / `If-Match`, ADF `q=` quoting, XSS-safe Approval UI,
setup-UI CSRF/SSRF guards, dotenv. **190+ tools**.
Perfect ADF coverage is **not** a goal. See [docs/ROADMAP.md](docs/ROADMAP.md).

### Honest coverage

| Domain | Curated tools | Fusion roots |
|--------|---------------|--------------|
| Workers + assignments | search/get/create/update + assignments deep-read | `workers`, `workerAssignments` |
| Absences | CRUD | `absences` |
| Plan balances | search + get (`hcm_absence_balance`, `hcm_get_plan_balance`) | **`planBalances`** |
| AOR | CRUD | `areasOfResponsibility` |
| Checklists / tasks | list/get + status update | `allocatedChecklists` / **`child/allocatedTasks`** |
| BP notifications | list/get + performAction | **`businessProcessNotifications`** |
| Org LOVs | orgs, locations, jobs, grades | `organizations`, `locations`, `jobs`, `grades` |
| Time | search/get (read) | `timeRecords` |
| Talent | search/get + light update | `talentPersonProfiles` |
| Payroll | search/get (read-only) | `payrollRelationships` |
| Generic | allowlisted get/mutate | see allowlist; **CE / generative AI blocked** |

## Safety modes

| Mode | Behavior |
|------|----------|
| **Default** | Mutating tools return `pending_approval` with an `approval_id`. A **human/ops principal** must call `hcm_approve_write` / `hcm_deny_write` with `approval_token` (`ORACLE_HCM_APPROVAL_TOKEN` — never returned by tools) or use the Approval UI (HTTP bearer). **SENSITIVE** reads need `ORACLE_HCM_SENSITIVE=1` then execute; sensitive **writes** also queue. |
| **`--write`** / `ORACLE_HCM_WRITE=1` | **Bypasses everything**: no approval queue, no SENSITIVE gate, no prod-profile write lock — mutations (including payslip/bank/comp) run **immediately**. Use only for trusted automation. |

Unknown / future `hcm_*` tools are classified as **write** (safe default).

## Transports

- **stdio** (default) — for Claude Desktop / Cursor / MCP clients
- **Streamable HTTP** — `POST /mcp` (plus `GET /health`). Bearer required on `/mcp` and `/approvals`.
- **gRPC** — custom bridge wrapping MCP JSON-RPC (`proto/mcp_bridge.proto`). Same bearer via `authorization` / `x-hcm-token` metadata.


## Approval UI (humans)

```bash
# MCP HTTP must be running, e.g. npx oracle-hcm-mcp --http 8788
npm run approval-ui
# open http://127.0.0.1:8796
```

Tiny localhost page to list / approve / deny pending writes. Paste `ORACLE_HCM_HTTP_TOKEN`.
Tool/summary text is rendered as text (not HTML). Unofficial — not Oracle.

## Setup UI (local wizard)

Interactive setup at **http://127.0.0.1:8790** (localhost only):

```bash
npm run setup-ui
# open http://127.0.0.1:8790  (falls back to 8792+ if 8790 is busy)
```

Walks through Dummy vs Real Fusion → base URL / API version → auth (basic / bearer / oauth) →
approval vs `--write` → test connection → copy Cursor `mcp.json` fragments for `oracle-hcm` and
`oracle-hcm-write` → a short how-to cheat sheet.

**Secrets** stay in the browser for generating config. Optional write to `.env.local` (gitignored).
The setup server can proxy a health/test-connection probe and **never logs or returns** passwords,
bearer tokens, or client secrets.

> Unofficial wizard for an unofficial MCP — not an Oracle product.

## Quick start

```bash
npm install
npm run build
npm test
npm run e2e        # dummy HCM + stdio/HTTP/gRPC + setup/approval UI

# Local mock HCM (basic auth demo/demo) on :9090
npm run dummy-hcm

# MCP over stdio against the mock (approval mode)
ORACLE_HCM_BASE_URL=http://127.0.0.1:9090/hcmRestApi \
ORACLE_HCM_USERNAME=demo ORACLE_HCM_PASSWORD=demo \
npx oracle-hcm-mcp

# Unrestricted writes (trusted only)
npx oracle-hcm-mcp --write --base-url http://127.0.0.1:9090/hcmRestApi

# Streamable HTTP
npx oracle-hcm-mcp --http 8788 --base-url http://127.0.0.1:9090/hcmRestApi

# gRPC bridge
npx oracle-hcm-mcp --grpc 8789 --base-url http://127.0.0.1:9090/hcmRestApi
```

### CLI

```
oracle-hcm-mcp                     # stdio, approval required for writes
oracle-hcm-mcp --write             # stdio, unrestricted writes
oracle-hcm-mcp --http 8788
oracle-hcm-mcp --grpc 8789
oracle-hcm-mcp --base-url http://127.0.0.1:9090/hcmRestApi
```

### Environment

| Variable | Meaning |
|----------|---------|
| `ORACLE_HCM_BASE_URL` | e.g. `https://fa-….fa.ocs.oraclecloud.com/hcmRestApi` |
| `ORACLE_HCM_API_VERSION` | default `11.13.18.05` |
| `ORACLE_HCM_AUTH` | `basic` \| `oauth` \| `bearer` \| `none` |
| `ORACLE_HCM_USERNAME` / `PASSWORD` | Basic auth |
| `ORACLE_HCM_BEARER_TOKEN` | Bearer token |
| `ORACLE_HCM_TOKEN_URL` / `CLIENT_ID` / `CLIENT_SECRET` | OAuth client-credentials (IDCS) |
| `ORACLE_HCM_WRITE=1` | Same as `--write` |
| `ORACLE_HCM_APPROVAL_TTL_MS` | Pending intent TTL (default 15 min) |
| `ORACLE_HCM_SENSITIVE=1` | Enable payslip / bank / national-ID tools |
| `ORACLE_HCM_SENSITIVE_WRITE=1` | Allow sensitive tools to skip approval when combined with `--write` |
| `ORACLE_HCM_PROFILE` | Optional multi-env profile label |
| `ORACLE_HCM_APPROVAL_STORE` | `memory` (default) \| `file` \| `sqlite` — multi-node pending approvals |
| `ORACLE_HCM_APPROVAL_STORE_PATH` | Path for file/sqlite approval store |
| `ORACLE_HCM_WEBHOOK_SECRET` | HMAC-SHA256 secret for webhook receiver (`X-HCM-Signature`) |
| `ORACLE_HCM_ATOM_CHECKPOINT_PATH` | Atom CDC checkpoint JSON path |
| `ORACLE_HCM_PROFILES_PATH` | Multi-env profiles.json path |
| `ORACLE_HCM_SMOKE_DIR` | Smoke probe report directory |
| `ORACLE_HCM_WEBHOOK_SECRETS` | Comma-separated rotating webhook HMAC secrets |
| `ORACLE_HCM_WEBHOOK_MTLS` | `1` to enable webhook mTLS (needs TLS key/cert/ca env) |

Auth note: credentials open the HTTP door; **HCM RBAC** still decides what the user/app can do.

## Tools (v0.5)

**Meta / setup:** `hcm_health`, `hcm_whoami`, `hcm_list_resources`, `hcm_describe_resource`, `hcm_setup_status`, `hcm_test_connection`, `hcm_emit_mcp_config`, `hcm_export_config`

**Workers:** `hcm_search_workers`, `hcm_get_worker`, `hcm_get_worker_assignments`, `hcm_create_worker`, `hcm_update_worker`

**Absences / balances:** `hcm_search_absences`, `hcm_get_absence`, `hcm_create_absence`, `hcm_update_absence`, `hcm_delete_absence`, `hcm_absence_balance` → `planBalances`, `hcm_get_plan_balance`

**AOR:** `hcm_search_aor`, `hcm_get_aor`, `hcm_create_aor`, `hcm_update_aor`, `hcm_delete_aor`

**Checklists:** `hcm_list_checklists`, `hcm_get_checklist`, `hcm_update_task_status` → `child/allocatedTasks/…/action/updateTaskStatus`

**BP / notifications:** `hcm_list_notifications`, `hcm_get_notification`, `hcm_perform_bp_action` → `businessProcessNotifications/action/performAction`

**Org LOVs:** `hcm_search_organizations`, `hcm_get_organization`, `hcm_search_locations`, `hcm_get_location`, `hcm_search_jobs`, `hcm_get_job`, `hcm_search_grades`, `hcm_get_grade`

**Time:** `hcm_search_time_records`, `hcm_get_time_record`

**Talent:** `hcm_search_talent_profiles`, `hcm_get_talent_profile`, `hcm_update_talent_profile`

**Payroll (read-only):** `hcm_search_payroll_relationships`, `hcm_get_payroll_relationship`

**Generic (allowlisted):** `hcm_rest_get`, `hcm_rest_mutate`

**Atom CDC:** `hcm_list_atom_feeds`, `hcm_get_atom_feed`, `hcm_list_atom_entries`, `hcm_get_atom_entry`,
`hcm_detect_changes`, `hcm_atom_poll`, `hcm_atom_consume`, `hcm_atom_get_checkpoint`, `hcm_atom_reset_checkpoint`

**Finders:** `hcm_lov_finder`, `hcm_lov_find`, `hcm_describe_finder`, `hcm_resolve_uniq_key`

**Approval:** `hcm_list_pending_approvals`, `hcm_approve_write`, `hcm_deny_write`
(always registered; file/sqlite store optional for multi-node)

CE / generative-AI / Oracle-internal style paths are **blocklisted** for generic REST.

## Docs

- [docs/TOOLS.md](docs/TOOLS.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/SECURITY.md](docs/SECURITY.md)
- [docs/ORACLE_MAPPING.md](docs/ORACLE_MAPPING.md)

## Reference

- HCM REST base pattern: `/hcmRestApi/resources/11.13.18.05/`
- Oracle docs: https://docs.oracle.com/en/cloud/saas/human-resources/farws/rest-endpoints.html

## License

MIT — see [LICENSE](LICENSE). No warranty. No liability. Not an Oracle product.
