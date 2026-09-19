# Security

**Unofficial software. Not affiliated with Oracle. No warranty. No liability.**

## Threat model (honest)

- This MCP can read and **mutate** HCM data when credentials allow.
- Default mode adds a **human approval gate**. Approving is a **separate principal**:
  `ORACLE_HCM_APPROVAL_TOKEN` is never returned by tools (printed on stderr at startup
  if generated). The same agent session that queued a write cannot approve it unless it
  already had the token out-of-band.
- `--write` / `ORACLE_HCM_WRITE=1` **bypasses everything**: no approval queue, no SENSITIVE
  gate, no prod-profile write lock — mutations run immediately.
- Pending approvals default to **in memory**. For multi-process / multi-node, set
  `ORACLE_HCM_APPROVAL_STORE=file|sqlite` and `ORACLE_HCM_APPROVAL_STORE_PATH`.
- HTTP `/mcp` and `/approvals` and gRPC require `Authorization: Bearer <ORACLE_HCM_HTTP_TOKEN>`
  unless `ORACLE_HCM_HTTP_AUTH_OFF=1` (debug only). `GET /health` stays unauthenticated.

## Recommendations

1. Prefer **non-production** Fusion environments while developing.
2. Use least-privilege HCM roles / integration users.
3. Keep `--write` off for interactive AI assistants that may hallucinate mutations.
4. Do not commit secrets; use `.env` locally (see `.env.example`).
5. Treat worker/absence payloads as **PII**.
6. Generic REST is **allowlisted** after path canonicalization (`..`, `%2e%2e`, schemes
   rejected). CE / generative-AI / internal-style paths are blocked.
7. Bind HTTP/gRPC to localhost. Do not set `ORACLE_HCM_HTTP_AUTH_OFF=1` on a reachable bind.
8. Set `ORACLE_HCM_APPROVAL_TOKEN` (and `ORACLE_HCM_HTTP_TOKEN` if different) in the
   human/ops environment, not in the agent’s MCP config.

## Blocklist / canonicalization (v0.7)

`policy/allowlist.ts` decodes path segments (including `%2e%2e`), rejects `.` / `..`,
rejects absolute and scheme-relative URLs, then matches the first resource root against
the curated allowlist. Invalid paths are treated as blocked.

## Sensitive tools **and roots** (v0.3+; roots enforced in v0.7)

Payslip, bank account, national identifier, compensation, salary basis / grade step LOVs,
offer letter fields, payroll costing / element entries, calculation cards, and
`workerLegislativeData` are **SENSITIVE**.

Roots are enforced in `HcmClient` so `hcm_rest_get` / lov / batch cannot bypass the
named-tool gate.

**Default (approval) mode only:**

1. `ORACLE_HCM_SENSITIVE=1` must be set, otherwise the tool/root errors.
2. **Sensitive reads execute** (flag required). **Sensitive writes queue** for a human
   principal (`hcm_approve_write` + `approval_token`, or HTTP `POST /approvals/:id/approve`
   with bearer).

**`--write` / `ORACLE_HCM_WRITE=1`:** SENSITIVE classification is **ignored**.

`ORACLE_HCM_SENSITIVE_WRITE` is retained for compatibility but is unnecessary once `--write` is on.

Tool results still pass through redaction middleware (secrets stripped; some ID fields masked).

## Profiles cannot enable writes (v0.7)

`hcm_switch_profile` / `hcm_upsert_profile` are approval-gated. A profile’s `writeMode`
field is ignored: only CLI `--write` / `ORACLE_HCM_WRITE=1` turns writes on. `--write`
cannot be turned off by switching to a prod profile.

## Webhook signing (v0.4)

When `ORACLE_HCM_WEBHOOK_SECRET` is set (or passed to `hcm_start_webhook_receiver`):

- Clients must send `X-HCM-Signature: sha256=<hmac-sha256-hex of raw body>`
- Aliases accepted: `X-Hub-Signature-256`, `X-Signature`
- Missing or invalid signatures → **401** (body not stored)
- `GET /webhook/events` requires bearer (`ORACLE_HCM_HTTP_TOKEN` or the webhook secret)

```bash
# Example (Node)
import { createHmac } from 'node:crypto';
const body = JSON.stringify({ event: 'demo' });
const sig = 'sha256=' + createHmac('sha256', process.env.ORACLE_HCM_WEBHOOK_SECRET)
  .update(body).digest('hex');
await fetch('http://127.0.0.1:8795/webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-HCM-Signature': sig,
    'X-HCM-Timestamp': new Date().toISOString(),
    'X-HCM-Nonce': crypto.randomUUID(),
  },
  body,
});
```

## Atom CDC checkpoints (v0.4)

`hcm_atom_poll` / `hcm_atom_consume` store cursors locally (`ORACLE_HCM_ATOM_CHECKPOINT_PATH`).
This is **not** Oracle CDC — local unofficial change detection over Atom feeds.
`hcm_atom_reset_checkpoint` is a write (approval-gated).

## Webhook rotating secrets / mTLS (v0.5)

- `ORACLE_HCM_WEBHOOK_SECRET` — primary HMAC secret
- `ORACLE_HCM_WEBHOOK_SECRETS` — comma-separated additional secrets accepted during rotation
- `hcm_webhook_rotate_secret` — rotate on a running receiver (keeps previous by default; approval-gated)
- mTLS: `ORACLE_HCM_WEBHOOK_MTLS=1` + `ORACLE_HCM_WEBHOOK_TLS_KEY` / `_CERT` / **required** `_CA`
  (`rejectUnauthorized: true`)

## Webhook replay protection (v0.6 / tightened in v0.7)

When signing is on, `X-HCM-Timestamp` and `X-HCM-Nonce` are **required** (no silent replay):

- Reused nonce within the replay window → **409**
- Stale timestamp outside `ORACLE_HCM_WEBHOOK_REPLAY_WINDOW_MS` (default 5 min) → **409**
- Missing headers when signing is on → **409**

Set `ORACLE_HCM_WEBHOOK_REPLAY_PROTECTION=0` only for local unsigned stubs.

## Setup UI (v0.7)

Local wizard binds `127.0.0.1` only. POST APIs reject non-localhost `Origin`/`Referer`.
`baseUrl` / `tokenUrl` must be `http(s)` (no `file:`, no embedded credentials). Fetches
use `redirect: 'error'`.
