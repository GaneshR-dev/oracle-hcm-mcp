# Roadmap — oracle-hcm-mcp (unofficial)

> Not an Oracle product. Priorities may change. Perfect ADF coverage is **not** a goal.

## Shipped in v0.9

| # | Capability | Notes |
|---|------------|--------|
| 1 | **Worker children pack** | Official `workers/{id}/child/{addresses,names,photos,citizenships,visasPermits,passports,disabilities,driverLicenses,ethnicities,religions,externalIdentifiers,otherCommunicationAccounts,messages}` |
| 2 | **Assignment gradeSteps** | Nested official child, not `gradeStepsLOV` |
| 3 | **timeEventRequests** | Clock in/out (distinct from `timeRecordEventRequests`) |
| 4 | **Work-structure LOVs** | `jobsLov`, `gradesLov`, `gradeLaddersLov`, `gradeRatesLOV`, `locationsLov` |
| 5 | **Recruiting children** | skills / attachments / publishedJobs / candidate citizenships (no CE/UI) |
| 6 | **Benefits children** | `costs`, `providers` (plus existing dependents) |
| 7 | **documentRecords actions** | downloadAttachments, generateDraftLetter, findByAdvancedSearchQuery |
| 8 | **Atom workrelshipupdate** | Official employee feed |
| 9 | **Dummy If-Match** | PATCH/DELETE 412 unless `If-Match: *` or matching ETag |
| 10 | **SENSITIVE children** | addresses, visas, passports, disabilities, licenses, ethnicities, religions, externalIdentifiers |

## Shipped in v0.8

| # | Capability | Notes |
|---|------------|--------|
| 1 | **Official Fusion paths only** | Allowlist is 11.13.18.05 collection names; invented aliases 404 |
| 2 | **Nested worker children** | emails/phones/NIDs/legislative/assignments via `workers/{id}/child/...` |
| 3 | **Time** | `timeRecordGroups` + `POST timeRecordEventRequests` (no `timeCards`) |
| 4 | **Atom servlet** | `/hcmRestApi/atomservlet/{workspace}/{collection}` — not `resources/atomfeeds` |
| 5 | **Dropped invented tools** | review cycles, feedback, OTBI, FSCM bankAccounts, interviews, enroll/optOut, forceClose |
| 6 | **SENSITIVE children** | `nationalIdentifiers` / `legislativeInfo` gated even under `workers` |

## Shipped in v0.7

| # | Capability | Notes |
|---|------------|--------|
| 1 | **Split-principal approvals** | `ORACLE_HCM_APPROVAL_TOKEN` never returned by tools |
| 2 | **HTTP/gRPC bearer** | Fail-closed; `GET /health` public |
| 3 | **Path canonicalization** | Decode, reject `..` / `%2e%2e` / schemes before allowlist |
| 4 | **SENSITIVE resource roots** | `hcm_rest_get` cannot bypass payslip/bank gates |
| 5 | **Profiles cannot enable writes** | `writeMode` on a profile is ignored |
| 6 | **Fusion REST headers** | `REST-Framework-Version`, `If-Match` |
| 7 | **ADF q= quoting** | `adfEquals()` |
| 8 | **Approval UI** | XSS-safe rendering + bearer token + REST approve |
| 9 | **Setup UI** | CSRF Origin + http(s)-only URLs |
| 10 | **Webhook replay headers** | Timestamp + nonce required when signing |
| 11 | **dotenv** | `.env` / `.env.local` without overriding process.env |
| 12 | **CI** | typecheck + vitest |

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
