# Roadmap — oracle-hcm-mcp (unofficial)

> Not an Oracle product. Priorities may change. Perfect ADF coverage is **not** a goal.

## Shipped in v0.3

| # | Capability | Status on dummy |
|---|------------|-----------------|
| 1 | Atom feeds / change detection | **Real mock** (`atomfeeds`) |
| 2 | Recruiting requisitions + candidates | **Real mock** |
| 3 | Benefits enrollments | **Real mock** |
| 4 | Checklist allocate / forceClose | **Real mock** actions |
| 5 | Nested worker assignment writes | **Real mock** nested POST + PATCH |
| 6 | LOV finders + uniq-key helpers | **Real mock** (finder accepted) |
| 7 | Payslip read (hard-gated) | **Real mock** + `ORACLE_HCM_SENSITIVE` |
| 8 | Setup tools (`hcm_setup_status`, `hcm_test_connection`, `hcm_emit_mcp_config`) | **Local** (no Fusion) |
| 9–12 | publicWorkers / contacts / phones / emails; national IDs; work relationships; positions | **Real mock** (national ID sensitive) |
| 13–15 | Direct reports; org hierarchy; location finders | **Real mock** (simplified hierarchy) |
| 16–18 | Absence types/plans + type balance; time card submit; schedules | **Real mock** |
| 19–20 | Goals / performance; learning enrollments | **Real mock** |
| 21–23 | Compensation; bank/payment; element entries / calculation cards | **Real mock** (bank/comp sensitive) |
| 24–26 | Richer BP filters; bulk dry-run + bulk approve/deny; audit trail | **Local audit** + dummy BP |
| 27–32 | explain_tool; dry_run_mutate; richer schemas; capability probe; RBAC hint; redaction | **Local** |
| 33–38 | Setup UI multi-env notes; config export; rate-limit/backoff; webhook stub | **Local stubs** |
| — | HTTP + gRPC e2e parity | Partial — stdio/vitest covered; transport smoke via existing HTTP health |

## Gaps / not claimed

- Full Fusion Atom CDC, true org tree APIs, IDCS-complete OAuth edge cases
- Production webhook verification / signing
- Multi-node approval store
- Exhaustive ADF finder catalog per LOV
- Perfect payslip / bank field parity with every Fusion release

## Safety invariants (keep)

- Unofficial disclaimer everywhere
- Approval-by-default for writes
- `--write` / `ORACLE_HCM_WRITE=1`
- CE / generative-AI blocklist
- Sensitive tools: `ORACLE_HCM_SENSITIVE=1` + approval unless `ORACLE_HCM_SENSITIVE_WRITE=1` with `--write`
