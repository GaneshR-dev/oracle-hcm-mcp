#!/usr/bin/env node
/**
 * CLI entry: unofficial Oracle Fusion Cloud HCM MCP server.
 * NOT affiliated with Oracle Corporation. MIT License — use at your own risk.
 */

import { parseArgs } from './config.js';
import { createMcpServer } from './mcp/server.js';
import { startStdio } from './transports/stdio.js';
import { startHttp } from './transports/http.js';
import { startGrpc } from './transports/grpc.js';

async function main(): Promise<void> {
  const cfg = parseArgs();

  if (cfg.transport === 'http') {
    await startHttp(cfg, cfg.httpPort ?? 8788);
    return;
  }
  if (cfg.transport === 'grpc') {
    await startGrpc(cfg, cfg.grpcPort ?? 8789);
    return;
  }

  const server = createMcpServer(cfg);
  console.error(
    `[oracle-hcm-mcp] stdio transport ready (writeMode=${cfg.writeMode}, baseUrl=${cfg.baseUrl})`,
  );
  console.error('[oracle-hcm-mcp] Unofficial — not affiliated with Oracle Corporation.');
  await startStdio(server);
}

main().catch((err) => {
  console.error('[oracle-hcm-mcp] fatal:', err);
  process.exit(1);
});
