import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './helpers.js';
import { registerCoreTools } from './register-core.js';
import { registerExtraTools } from './register-extra.js';

export function registerAllTools(server: McpServer, ctx: ToolContext): void {
  registerCoreTools(server, ctx);
  registerExtraTools(server, ctx);
}

export { RESOURCE_CATALOG } from './register-core.js';
