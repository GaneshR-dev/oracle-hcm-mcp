# Roadmap — oracle-hcm-mcp (unofficial)

> Not an Oracle product. Priorities may change. Perfect ADF coverage is **not** a goal.

## Shipped in v0.6

| # | Capability | Notes |
|---|------------|--------|
| 1 | **Performance Management** | review cycles, feedback, check-ins |
| 2 | **Learning depth** | assignments, completions |
| 3 | **Compensation packs** | salary basis / grade step LOVs + offer letter fields (SENSITIVE in default only) |
| 4 | **Workforce Structures** | departments tree, job families, position hierarchy |
| 5 | **Document Records** | list/upload + local PII redaction; approval in default |
| 6 | **Journeys / onboarding** | journey tasks beyond allocated checklists |
| 7 | **Absence enhancements** | entitlement calc preview, accrual by date, type/plan LOV |
| 8 | **Recipes** | transfer, terminate, promote, contingent worker, mass absence approve |
| 9 | **Dry-run write preview** | `hcm_preview_write` (optional; not required under --write) |
| 10 | **Field maps** | Oracle ↔ friendly names |
| 11 | **Role/privilege probe** | smoke + 403 → duty hints |
| 12 | **Live Atom CDC + durable cursors** | `hcm_atom_cdc_status` |
| 13 | **Webhook replay protection** | nonce + timestamp → 409 |
| 14 | **Approval UI polish** | domain filter, bulk approve, audit export |
| 15 | **Tenant OpenAPI → allowlist** | `hcm_refresh_allowlist_from_openapi` |
| 16 | **Multi-tenant profiles** | `--write` always wins (no prod write lock) |
| 17 | **OTBI thin read** | catalog stub |
| 18 | **Benefits dependents / life events** | curated search |
| 19 | **Payroll costing / element entries** | SENSITIVE in default only |
| 20 | **Talent pools** | curated + dummy |

### Safety invariant (v0.6 lock)

- Default = approval-by-default for writes.
- **`--write` / `ORACLE_HCM_WRITE=1` bypasses approval + SENSITIVE + prod-profile lock.**
- SENSITIVE classification matters **only** in default mode.

## Shipped in v0.5

Smoke probe, OAuth/setup polish, person deep-read, recruiting depth, time E2E, benefits write,
recipes, redaction audit, multi-env profiles, Atom replay, webhook rotate/mTLS, approval UI,
OpenAPI codegen, batch GET, learning/goals writes, compensation update, absence LOVs.

## Shipped in v0.4

Atom CDC poll/consume + checkpoints, HMAC webhooks, file/sqlite approvals, curated finders,
payslip field parity, HTTP/gRPC e2e.

## Gaps / not claimed

- Full Oracle CDC product parity / every Atom collection in every pod
- Perfect payslip / bank field parity with every Fusion release
- Exhaustive ADF finder catalog for *all* LOVs
- Full OTBI execute / BI Publisher
- npm publish (intentionally out of scope for this tree)
