import type { Config } from '../src/config.js';
import { createMcpServer, createToolContext } from '../src/mcp/server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

export const TEST_APPROVAL_TOKEN = 'test-approval-token';
export const TEST_HTTP_TOKEN = 'test-http-token';

export function baseCfg(baseUrl: string, overrides: Partial<Config> = {}): Config {
  return {
    baseUrl,
    apiVersion: '11.13.18.05',
    writeMode: false,
    sensitiveEnabled: false,
    sensitiveWriteEnabled: false,
    authMode: 'basic',
    username: 'demo',
    password: 'demo',
    approvalTtlMs: 60_000,
    approvalStore: 'memory',
    transport: 'stdio',
    approvalToken: TEST_APPROVAL_TOKEN,
    httpToken: TEST_HTTP_TOKEN,
    httpAuthRequired: true,
    ...overrides,
  };
}

export async function withMcp(
  config: Config,
  fn: (c: Client) => Promise<void>,
  name = 'test',
): Promise<void> {
  const ctx = createToolContext(config);
  const mcp = createMcpServer(config, ctx);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name, version: '0.0.0' });
  await Promise.all([mcp.connect(serverTransport), client.connect(clientTransport)]);
  try {
    await fn(client);
  } finally {
    await client.close();
    await mcp.close();
  }
}

export function parseTool(result: { content: Array<{ type: string; text?: string }> }) {
  const text = result.content.find((c) => c.type === 'text')?.text ?? '{}';
  return JSON.parse(text);
}
