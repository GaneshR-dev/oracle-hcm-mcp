# oracle-hcm-mcp

Unofficial Model Context Protocol (MCP) server for **Oracle Fusion Cloud HCM** REST APIs.

> **Not an Oracle product.** Not affiliated with, endorsed by, or supported by Oracle Corporation.
> Provided as-is under the MIT License. **You** are responsible for compliance with your Oracle
> licenses, HCM security roles, privacy/PII rules, and any damage caused by write operations.

## Status

Under active development. See docs as they land.

## Safety modes

- **Default:** mutating tools require human approval (`hcm_approve_write` / `hcm_deny_write`).
- **`--write`:** mutations run end-to-end with **no** approval gate (trusted automation only).

## Transports

- stdio (default)
- Streamable HTTP
- gRPC (custom / pluggable transport)
