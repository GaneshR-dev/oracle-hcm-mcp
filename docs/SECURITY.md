# Security

**Unofficial software. Not affiliated with Oracle. No warranty. No liability.**

## Threat model (honest)

- This MCP can read and **mutate** HCM data when credentials allow.
- Default mode adds a **human approval gate** in-process; it is not a substitute for IAM, network controls, or change management.
- `--write` disables that gate entirely.
- Pending approvals live **in memory** of the MCP process (lost on restart; not multi-node safe).

## Recommendations

1. Prefer **non-production** Fusion environments while developing.
2. Use least-privilege HCM roles / integration users.
3. Keep `--write` off for interactive AI assistants that may hallucinate mutations.
4. Do not commit secrets; use `.env` locally (see `.env.example`).
5. Treat worker/absence payloads as **PII**.
6. Generic REST is **allowlisted**; CE / generative-AI / internal-style paths are blocked — do not weaken this without review.
7. Bind HTTP/gRPC to localhost unless you add your own authn/authz in front.

## Blocklist

Paths matching CE, generative AI, Oracle-internal, embedding/LLM-style segments are rejected by `policy/allowlist.ts` before the HTTP call.

## Sensitive tools (v0.3)

Payslip, bank account, national identifier, and compensation tools require:

1. `ORACLE_HCM_SENSITIVE=1`
2. Human approval via `hcm_approve_write` **even when** `--write` is set, unless `ORACLE_HCM_SENSITIVE_WRITE=1` is also set.

Tool results pass through redaction middleware (secrets stripped; some ID fields masked).
