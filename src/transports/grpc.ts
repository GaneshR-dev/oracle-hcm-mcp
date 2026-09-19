/**
 * Custom gRPC transport wrapping MCP JSON-RPC messages.
 * See proto/mcp_bridge.proto
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import type { Config } from '../config.js';
import { createMcpServer, createToolContext } from '../mcp/server.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Minimal in-process MCP JSON-RPC bridge used by gRPC Call / Bidirectional stream */
class InProcessJsonRpcBridge {
  private server;
  private pending = new Map<
    string | number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private started = false;

  constructor(cfg: Config) {
    const ctx = createToolContext(cfg);
    this.server = createMcpServer(cfg, ctx);
  }

  async start(): Promise<void> {
    if (this.started) return;
    const self = this;
    const transport = {
      async start() {},
      async close() {},
      async send(message: JSONRPCMessage) {
        if ('id' in message && message.id !== undefined && message.id !== null) {
          const p = self.pending.get(message.id);
          if (p) {
            self.pending.delete(message.id);
            p.resolve(message);
          }
        }
      },
      onmessage: undefined as ((msg: JSONRPCMessage) => void) | undefined,
      onclose: undefined as (() => void) | undefined,
      onerror: undefined as ((e: Error) => void) | undefined,
    };
    await this.server.connect(transport as never);
    this.started = true;
    (this as unknown as { _transport: typeof transport })._transport = transport;
  }

  async call(rawJson: string): Promise<string> {
    await this.start();
    const msg = JSON.parse(rawJson) as JSONRPCMessage;
    const transport = (this as unknown as { _transport: { onmessage?: (m: JSONRPCMessage) => void } })
      ._transport;
    if (!('id' in msg) || msg.id === undefined || msg.id === null) {
      transport.onmessage?.(msg);
      return JSON.stringify({ ok: true });
    }
    const id = msg.id;
    const resultPromise = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('MCP JSON-RPC timeout'));
        }
      }, 60_000);
    });
    transport.onmessage?.(msg);
    const response = await resultPromise;
    return JSON.stringify(response);
  }
}

export async function startGrpc(cfg: Config, port: number): Promise<void> {
  const protoPath = path.resolve(__dirname, '../../proto/mcp_bridge.proto');
  const packageDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const loaded = grpc.loadPackageDefinition(packageDef) as {
    mcpbridge: {
      McpBridge: grpc.ServiceClientConstructor & {
        service: grpc.ServiceDefinition;
      };
    };
  };

  const bridge = new InProcessJsonRpcBridge(cfg);
  await bridge.start();

  const grpcServer = new grpc.Server();
  grpcServer.addService(loaded.mcpbridge.McpBridge.service, {
    Call: async (
      call: grpc.ServerUnaryCall<{ json_rpc: string }, { json_rpc: string }>,
      cb: grpc.sendUnaryData<{ json_rpc: string }>,
    ) => {
      try {
        const out = await bridge.call(call.request.json_rpc);
        cb(null, { json_rpc: out });
      } catch (e) {
        cb({
          code: grpc.status.INTERNAL,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    },
    Stream: (call: grpc.ServerDuplexStream<{ json_rpc: string }, { json_rpc: string }>) => {
      call.on('data', async (req: { json_rpc: string }) => {
        try {
          const out = await bridge.call(req.json_rpc);
          call.write({ json_rpc: out });
        } catch (e) {
          call.write({
            json_rpc: JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32000, message: e instanceof Error ? e.message : String(e) },
            }),
          });
        }
      });
    },
  });

  await new Promise<void>((resolve, reject) => {
    grpcServer.bindAsync(
      `127.0.0.1:${port}`,
      grpc.ServerCredentials.createInsecure(),
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });

  console.error(
    `[oracle-hcm-mcp] gRPC McpBridge listening on 127.0.0.1:${port} (writeMode=${cfg.writeMode})`,
  );
  console.error('[oracle-hcm-mcp] Unofficial — not affiliated with Oracle Corporation.');
}
