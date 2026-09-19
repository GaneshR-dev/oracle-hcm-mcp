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
import { pickBearerOrHeader, safeEqual } from '../policy/cryptoSafe.js';

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

export type GrpcTransportHandle = {
  port: number;
  close: () => Promise<void>;
};

export async function startGrpc(cfg: Config, port: number): Promise<GrpcTransportHandle> {
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
  const tokenOk = (metadata: grpc.Metadata): boolean => {
    if (cfg.httpAuthRequired === false) return true;
    const expected = cfg.httpToken ?? cfg.approvalToken;
    if (!expected) return false;
    const auth = metadata.get('authorization')[0];
    const extra = metadata.get('x-hcm-token')[0];
    const provided = pickBearerOrHeader(
      typeof auth === 'string' ? auth : undefined,
      typeof extra === 'string' ? extra : extra ? extra.toString() : undefined,
    );
    return Boolean(provided && safeEqual(provided, expected));
  };
  grpcServer.addService(loaded.mcpbridge.McpBridge.service, {
    Call: async (
      call: grpc.ServerUnaryCall<{ json_rpc: string }, { json_rpc: string }>,
      cb: grpc.sendUnaryData<{ json_rpc: string }>,
    ) => {
      if (!tokenOk(call.metadata)) {
        cb({ code: grpc.status.UNAUTHENTICATED, message: 'Missing or invalid x-hcm-token' });
        return;
      }
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
      if (!tokenOk(call.metadata)) {
        call.destroy(new Error('UNAUTHENTICATED'));
        return;
      }
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

  const boundPort = await new Promise<number>((resolve, reject) => {
    grpcServer.bindAsync(
      `127.0.0.1:${port}`,
      grpc.ServerCredentials.createInsecure(),
      (err, portBound) => {
        if (err) reject(err);
        else resolve(portBound);
      },
    );
  });

  console.error(
    `[oracle-hcm-mcp] gRPC McpBridge listening on 127.0.0.1:${boundPort} (writeMode=${cfg.writeMode})`,
  );
  console.error('[oracle-hcm-mcp] Unofficial — not affiliated with Oracle Corporation.');

  return {
    port: boundPort,
    close: () =>
      new Promise<void>((resolve) => {
        grpcServer.tryShutdown(() => resolve());
      }),
  };
}

/** Helper for tests / scripts: unary JSON-RPC via gRPC Call */
export async function createGrpcClient(port: number, token?: string) {
  const protoPath = path.resolve(__dirname, '../../proto/mcp_bridge.proto');
  const packageDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const loaded = grpc.loadPackageDefinition(packageDef) as unknown as {
    mcpbridge: {
      McpBridge: new (
        addr: string,
        creds: grpc.ChannelCredentials,
      ) => {
        Call: (
          req: { json_rpc: string },
          metadata: grpc.Metadata,
          cb: (err: grpc.ServiceError | null, res: { json_rpc: string }) => void,
        ) => void;
        close: () => void;
      };
    };
  };
  const client = new loaded.mcpbridge.McpBridge(
    `127.0.0.1:${port}`,
    grpc.credentials.createInsecure(),
  );
  const md = new grpc.Metadata();
  if (token) {
    md.set('authorization', `Bearer ${token}`);
    md.set('x-hcm-token', token);
  }
  return {
    call: (msg: unknown) =>
      new Promise<unknown>((resolve, reject) => {
        client.Call({ json_rpc: JSON.stringify(msg) }, md, (err, res) => {
          if (err) reject(err);
          else resolve(JSON.parse(res.json_rpc));
        });
      }),
    close: () => client.close(),
  };
}
