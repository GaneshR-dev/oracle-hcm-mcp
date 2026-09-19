# Roadmap — oracle-hcm-mcp (unofficial)

> Not an Oracle product. Priorities may change. Perfect ADF coverage is **not** a goal.

## Shipped in v0.5

| # | Capability | Notes |
|---|------------|--------|
| 1 | **Live Fusion smoke profile** | `hcm_smoke_probe` / `hcm_list_smoke_reports` — 200/403/404 matrix saved per env |
| 2 | **OAuth UI polish** | Setup wizard token refresh/expiry + “test as user”; MCP `hcm_oauth_*` / `hcm_test_as_user` |
| 3 | **Cursor MCP one-click export** | Setup UI reinstall steps + `hcm_emit_profile_mcp_config` |
| 4 | **Bulk BP dry-run / preview** | `hcm_bulk_bp_dry_run` + richer `hcm_bulk_bp_preview` |
| 5 | **Person deep-read pack** | Legislative, work relationships, assignment history, `hcm_person_deep_read` |
| 6 | **Recruiting depth** | Offers, interviews, candidate attachments (curated) |
| 7 | **Time submit E2E** | `hcm_validate_time_card` → `hcm_submit_time_card` / `hcm_recipe_time_submit` |
| 8 | **Benefits enroll/opt-out** | Approval-gated `hcm_enroll_benefit` / `hcm_opt_out_benefit` |
| 9 | **Recipes** | `hcm_recipe_new_hire_checklist`, `hcm_recipe_absence_balance_approve`, `hcm_recipe_time_submit` |
| 10 | **Stronger schemas/examples** | Zod describes + examples on v0.5 tools |
| 11 | **Redaction audit log** | `hcm_list_redaction_audit` — fields stripped/masked |
| 12 | **Multi-env switcher** | Profiles dummy/sandbox/prod — `hcm_list_profiles` / `hcm_switch_profile` |
| 13 | **Atom CDC real-pod hooks + replay** | `hcm_atom_replay`, `hcm_atom_real_pod_guide` |
| 14 | **Webhook mTLS / rotating secrets** | `ORACLE_HCM_WEBHOOK_SECRETS`, mTLS env, `hcm_webhook_rotate_secret` |
| 15 | **Approval UI** | Tiny localhost page (`npm run approval-ui`) |
| 16 | **OpenAPI → allowlist codegen** | `scripts/openapi-allowlist-codegen.mjs` |
| 17 | **Perf** | Connection pool agents, 429 backoff tuning, `hcm_batch_get` |
| + | **Learning/goals writes** | Approval-gated create/update/enroll |
| + | **Compensation light update** | Sensitive-gated PATCH |
| + | **Absence LOV helpers** | get type/plan + `hcm_balance_by_plan` |

## Shipped in v0.4

Atom CDC poll/consume + checkpoints, HMAC webhooks, file/sqlite approvals, curated finders, payslip field parity, HTTP/gRPC e2e.

## Gaps / not claimed

- Full Oracle CDC product parity / every Atom collection in every pod
- Perfect payslip / bank field parity with every Fusion release
- Exhaustive ADF finder catalog for *all* LOVs
- npm publish (intentionally out of scope for this tree)

## Safety invariants (keep)

- Unofficial disclaimer everywhere
- Approval-by-default for writes
- `--write` / `ORACLE_HCM_WRITE=1`
- CE / generative-AI blocklist
- Sensitive tools: `ORACLE_HCM_SENSITIVE=1` + approval unless `ORACLE_HCM_SENSITIVE_WRITE=1` with `--write`
