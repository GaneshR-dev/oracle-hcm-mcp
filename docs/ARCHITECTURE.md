# Architecture

Unofficial MCP server — **not an Oracle product.**

```
src/
  index.ts              CLI (--write, --http, --grpc, --base-url)
  config.ts             Env + argv
  mcp/server.ts         McpServer wiring (@modelcontextprotocol/sdk)
  mcp/tools/            Tool registration (curated domains + generic)
  policy/
    classify.ts         read vs write (unknown => write)
    approval.ts         Pending intents + TTL
    allowlist.ts        Path allow/block lists
  client/hcmClient.ts   fetch, auth, pagination helpers
  transports/
    stdio.ts
    http.ts             Streamable HTTP POST /mcp
    grpc.ts             Custom gRPC JSON-RPC bridge
  dummy-hcm/            Express mock for E2E
proto/mcp_bridge.proto
```

## Approval flow

1. Client calls a write tool.
2. If `writeMode`: client executes against HCM immediately.
3. Else: `ApprovalStore.create` → return `pending_approval`.
4. `hcm_approve_write` re-runs the stored args through the same client paths.
5. Intents expire after `ORACLE_HCM_APPROVAL_TTL_MS` (default 15 minutes).

## Transports

- **stdio**: `StdioServerTransport`
- **HTTP**: Node `http` + `StreamableHTTPServerTransport` (stateless per request; shared approval store)
- **gRPC**: `McpBridge.Call` / `Stream` with `json_rpc` string payloads

## Dummy HCM

`dummy-hcm` listens on `:9090` with Basic `demo`/`demo` and a subset of
`/hcmRestApi/resources/11.13.18.05/{workers,absences,…}`.
