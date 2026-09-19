/**
 * MCP server wiring for unofficial Oracle HCM MCP.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Config } from '../config.js';
import { HcmClient } from '../client/hcmClient.js';
import { createApprovalStore } from '../policy/approval.js';
import { createCheckpointStoreFromEnv, createFileCheckpointStore, createMemoryCheckpointStore } from '../platform/atomCdc.js';
import { registerAllTools } from './tools/register.js';
import type { ToolContext } from './tools/helpers.js';

export const SERVER_INFO = {
  name: 'oracle-hcm-mcp',
  version: '0.7.0',
  title: 'Unofficial Oracle HCM MCP',
};

export function createToolContext(cfg: Config): ToolContext {
  const atomCheckpoints = cfg.atomCheckpointPath
    ? createFileCheckpointStore(cfg.atomCheckpointPath)
    : createCheckpointStoreFromEnv();

  return {
    client: new HcmClient(cfg),
    approvals: createApprovalStore(cfg.approvalTtlMs, {
      store: cfg.approvalStore,
      storePath: cfg.approvalStorePath,
    }),
    writeMode: cfg.writeMode,
    config: cfg,
    executors: new Map(),
    auditTrail: [],
    atomCheckpoints,
  };
}

export function createMcpServer(cfg: Config, ctx?: ToolContext): McpServer {
  const toolCtx = ctx ?? createToolContext(cfg);
  const server = new McpServer(
    {
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
    },
    {
      instructions: [
        'Unofficial MCP server for Oracle Fusion Cloud HCM REST APIs.',
        'NOT affiliated with, endorsed by, or supported by Oracle Corporation.',
        cfg.writeMode
          ? 'Running in --write mode: ALL mutating tools (including sensitive) execute immediately — no approval queue, no SENSITIVE gate.'
          : 'Default mode: mutating tools return pending_approval. Approving requires ORACLE_HCM_APPROVAL_TOKEN (never returned to the agent). Sensitive resource roots also need ORACLE_HCM_SENSITIVE=1.',
        'HTTP/gRPC require Authorization: Bearer <ORACLE_HCM_HTTP_TOKEN>. Generic REST paths are canonicalized; .. traversal is rejected. SENSITIVE roots cannot be reached via hcm_rest_get without the flag.',
        'Atom CDC: hcm_atom_poll / hcm_atom_consume with local checkpoints. Webhooks verify HMAC when ORACLE_HCM_WEBHOOK_SECRET is set.',
        'HCM RBAC and your Oracle licenses still apply. Handle PII carefully.',
      ].join(' '),
      capabilities: {
        tools: {},
      },
    },
  );
  registerAllTools(server, toolCtx);
  return server;
}

// silence unused import when tree-shaken oddly
void createMemoryCheckpointStore;
