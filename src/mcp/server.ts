/**
 * MCP server wiring for unofficial Oracle HCM MCP.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Config } from '../config.js';
import { HcmClient } from '../client/hcmClient.js';
import { ApprovalStore } from '../policy/approval.js';
import { registerAllTools } from './tools/register.js';
import type { ToolContext } from './tools/helpers.js';

export const SERVER_INFO = {
  name: 'oracle-hcm-mcp',
  version: '0.3.0',
  title: 'Unofficial Oracle HCM MCP',
};

export function createToolContext(cfg: Config): ToolContext {
  return {
    client: new HcmClient(cfg),
    approvals: new ApprovalStore(cfg.approvalTtlMs),
    writeMode: cfg.writeMode,
    config: cfg,
    executors: new Map(),
    auditTrail: [],
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
          ? 'Running in --write mode: mutating tools execute immediately (no approval), except sensitive tools unless ORACLE_HCM_SENSITIVE_WRITE=1.'
          : 'Default mode: mutating tools return pending_approval; use hcm_approve_write / hcm_deny_write.',
        'Sensitive payslip/bank/national-ID tools require ORACLE_HCM_SENSITIVE=1.',
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
