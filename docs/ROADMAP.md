# Roadmap — oracle-hcm-mcp (unofficial)

> Not an Oracle product. Priorities may change. Perfect ADF coverage is **not** a goal.

## Shipped in v0.4

| # | Gap | What shipped |
|---|-----|----------------|
| 1 | **True Fusion Atom CDC** | Feed list/get, entry parse, file checkpoint store, `hcm_atom_poll` / `hcm_atom_consume` / checkpoint tools; dummy serves Atom XML + JSON |
| 2 | **Production webhook signing** | HMAC-SHA256 (`ORACLE_HCM_WEBHOOK_SECRET`, `X-HCM-Signature`); reject unsigned/bad sig; SECURITY.md + e2e |
| 3 | **Multi-node approvals** | File / sqlite-backed `ApprovalStore` (`ORACLE_HCM_APPROVAL_STORE` + `_PATH`); HTTP `GET /approvals`; shared across processes |
| 4 | **Exhaustive ADF finders** | Curated finder catalog; `hcm_lov_find` / `hcm_describe_finder`; dummy applies `finder=` params |
| 5 | **Fuller payslip field parity** | Richer payslip (+ bank/payment/comp) Fusion-shaped fields; `ORACLE_HCM_SENSITIVE` gates unchanged |
| 6 | **Heavier HTTP/gRPC e2e** | Vitest `transport-e2e` + `scripts/e2e-http-grpc.mjs` — health, curated tools, approval path |

## Shipped in v0.3

| # | Capability | Status on dummy |
|---|------------|-----------------|
| 1 | Atom feeds / change detection | **Real mock** (`atomfeeds`) — extended in v0.4 |
| 2 | Recruiting requisitions + candidates | **Real mock** |
| 3 | Benefits enrollments | **Real mock** |
| 4 | Checklist allocate / forceClose | **Real mock** actions |
| 5 | Nested worker assignment writes | **Real mock** nested POST + PATCH |
| 6 | LOV finders + uniq-key helpers | **Real mock** — catalog expanded in v0.4 |
| 7 | Payslip read (hard-gated) | **Real mock** + `ORACLE_HCM_SENSITIVE` — fields expanded in v0.4 |
| 8 | Setup tools | **Local** |
| 9–38 | Core HR extras, talent, learning, compensation, agent UX, rate-limit, webhook stub | See v0.3 commit |

## Gaps / not claimed

- Full Oracle CDC product parity / every Atom collection in every pod
- IDCS-complete OAuth edge cases
- Perfect payslip / bank field parity with every Fusion release
- Exhaustive ADF finder catalog for *all* LOVs (curated common set only)

## Safety invariants (keep)

- Unofficial disclaimer everywhere
- Approval-by-default for writes
- `--write` / `ORACLE_HCM_WRITE=1`
- CE / generative-AI blocklist
- Sensitive tools: `ORACLE_HCM_SENSITIVE=1` + approval unless `ORACLE_HCM_SENSITIVE_WRITE=1` with `--write`
