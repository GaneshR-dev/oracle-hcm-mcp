# Security

**Unofficial software. Not affiliated with Oracle. No warranty. No liability.**

## Threat model (honest)

- This MCP can read and **mutate** HCM data when credentials allow.
- Default mode adds a **human approval gate** in-process; it is not a substitute for IAM, network controls, or change management.
- `--write` / `ORACLE_HCM_WRITE=1` **bypasses everything**: no approval queue, no SENSITIVE gate, no prod-profile write lock — mutations run immediately.
- Pending approvals default to **in memory**. For multi-process / multi-node, set `ORACLE_HCM_APPROVAL_STORE=file|sqlite` and `ORACLE_HCM_APPROVAL_STORE_PATH` so approval-mode and HTTP `GET /approvals` share the same store.

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

## Sensitive tools (v0.3+; model clarified in v0.6)

Payslip, bank account, national identifier, compensation, salary basis / grade step LOVs,
offer letter fields, and payroll costing / element entries are **SENSITIVE**.

**Default (approval) mode only:**

1. `ORACLE_HCM_SENSITIVE=1` must be set, otherwise the tool errors.
2. Calls then queue for human approval via `hcm_approve_write` / `hcm_deny_write`.

**`--write` / `ORACLE_HCM_WRITE=1`:** SENSITIVE classification is **ignored**. No env flag and
no approval are required — the mutation/read executes immediately. Multi-tenant prod profiles
cannot lock this off when `--write` is set.

`ORACLE_HCM_SENSITIVE_WRITE` is retained for compatibility but is unnecessary once `--write` is on.

Tool results still pass through redaction middleware (secrets stripped; some ID fields masked).

## Webhook signing (v0.4)

When `ORACLE_HCM_WEBHOOK_SECRET` is set (or passed to `hcm_start_webhook_receiver`):

- Clients must send `X-HCM-Signature: sha256=<hmac-sha256-hex of raw body>`
- Aliases accepted: `X-Hub-Signature-256`, `X-Signature`
- Missing or invalid signatures → **401** (body not stored)

```bash
# Example (Node)
import { createHmac } from 'node:crypto';
const body = JSON.stringify({ event: 'demo' });
const sig = 'sha256=' + createHmac('sha256', process.env.ORACLE_HCM_WEBHOOK_SECRET)
  .update(body).digest('hex');
await fetch('http://127.0.0.1:8795/webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-HCM-Signature': sig },
  body,
});
```

## Atom CDC checkpoints (v0.4)

`hcm_atom_poll` / `hcm_atom_consume` store cursors locally (`ORACLE_HCM_ATOM_CHECKPOINT_PATH`).
This is **not** Oracle CDC — local unofficial change detection over Atom feeds.


## Webhook rotating secrets / mTLS (v0.5)

- `ORACLE_HCM_WEBHOOK_SECRET` — primary HMAC secret
- `ORACLE_HCM_WEBHOOK_SECRETS` — comma-separated additional secrets accepted during rotation
- `hcm_webhook_rotate_secret` — rotate on a running receiver (keeps previous by default)
- mTLS: `ORACLE_HCM_WEBHOOK_MTLS=1` + `ORACLE_HCM_WEBHOOK_TLS_KEY` / `_CERT` / optional `_CA`


## Webhook replay protection (v0.6)

When enabled (default unless `ORACLE_HCM_WEBHOOK_REPLAY_PROTECTION=0`):

- Optional headers: `X-HCM-Timestamp`, `X-HCM-Nonce`
- Reused nonce within the replay window → **409**
- Stale timestamp outside `ORACLE_HCM_WEBHOOK_REPLAY_WINDOW_MS` (default 5 min) → **409**
- Set `ORACLE_HCM_WEBHOOK_REQUIRE_REPLAY_HEADERS=1` to require both headers
