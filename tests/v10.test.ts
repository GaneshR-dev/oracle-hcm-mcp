import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDummyApp } from '../src/dummy-hcm/index.js';
import { seedStore } from '../src/dummy-hcm/data.js';
import type { Server } from 'node:http';
import type { Config } from '../src/config.js';
import { createMcpServer, createToolContext } from '../src/mcp/server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { HcmClient } from '../src/client/hcmClient.js';
import { extractRootsFromOpenApi } from '../src/platform/openapiAllowlist.js';
import { FUSION_GRAPHQL, ADF_Q_OPERATORS, adfEquals } from '../src/policy/adf.js';
import { summarizeAdfDescribe, knownAdfResource } from '../src/platform/adfDescribe.js';

let server: Server;
let baseUrl: string;
let port: number;

function cfg(overrides: Partial<Config> = {}): Config {
  return {
    baseUrl,
    apiVersion: '11.13.18.05',
    writeMode: false,
    sensitiveEnabled: false,
    sensitiveWriteEnabled: false,
    authMode: 'basic',
    username: 'demo',
    password: 'demo',
    approvalToken: 'test-approval-token',
    httpToken: 'test-http-token',
    approvalTtlMs: 60_000,
    approvalStore: 'memory',
    transport: 'stdio',
    ...overrides,
  };
}

async function withClient(config: Config, fn: (c: Client) => Promise<void>) {
  const ctx = createToolContext(config);
  const mcp = createMcpServer(config, ctx);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-v10', version: '0.0.0' });
  await Promise.all([mcp.connect(serverTransport), client.connect(clientTransport)]);
  try {
    await fn(client);
  } finally {
    await client.close();
    await mcp.close();
  }
}

function parse(result: { content: { type: string; text?: string }[] }) {
  const text = result.content.find((c) => c.type === 'text')?.text ?? '{}';
  return JSON.parse(text);
}

function auth() {
  return { Authorization: `Basic ${Buffer.from('demo:demo').toString('base64')}` };
}

function resources(p: string) {
  return `http://127.0.0.1:${port}/hcmRestApi/resources/11.13.18.05/${p}`;
}

beforeAll(async () => {
  const app = createDummyApp(seedStore());
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  port = addr.port;
  baseUrl = `http://127.0.0.1:${port}/hcmRestApi`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe('v0.10 ADF describe + GraphQL absence', () => {
  it('dummy GET workers/describe returns ADF attributes and finders', async () => {
    const res = await fetch(resources('workers/describe'), { headers: auth() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { Resources: { workers: { attributes: { name: string; queryable: boolean }[] } } };
    const attrs = body.Resources.workers.attributes;
    expect(attrs.find((a) => a.name === 'PersonNumber')?.queryable).toBe(true);
    expect(attrs.find((a) => a.name === 'CorrespondenceLanguage')?.queryable).toBe(false);
  });

  it('catalog describe metadataMode=minimal lists workers', async () => {
    const res = await fetch(resources('describe?metadataMode=minimal'), { headers: auth() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { Resources: Record<string, unknown> };
    expect(body.Resources.workers).toBeTruthy();
    expect(body.Resources.absences).toBeTruthy();
  });

  it('includeChildren on catalog nests emails under workers', async () => {
    const res = await fetch(resources('describe?metadataMode=minimal&includeChildren=true'), {
      headers: auth(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      Resources: { workers: { children?: { emails?: unknown } } };
    };
    expect(body.Resources.workers.children?.emails).toBeTruthy();
  });

  it('OpenAPI Accept returns openapi 3', async () => {
    const res = await fetch(resources('workers/describe'), {
      headers: { ...auth(), Accept: 'application/vnd.oracle.openapi3+json' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(body.openapi.startsWith('3.')).toBe(true);
    expect(body.paths['/workers']).toBeTruthy();
  });

  it('nested child describe 200s; invented child 404s', async () => {
    const ok = await fetch(resources('workers/1001/child/addresses/describe'), { headers: auth() });
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { Resources: { addresses: unknown } };
    expect(body.Resources.addresses).toBeTruthy();
    const bad = await fetch(resources('workers/1001/child/inventedThing/describe'), { headers: auth() });
    expect(bad.status).toBe(404);
  });

  it('GraphQL paths 404 — Fusion HCM has no GraphQL', async () => {
    const paths = [
      `http://127.0.0.1:${port}/graphql`,
      `http://127.0.0.1:${port}/hcmRestApi/graphql`,
      resources('graphql'),
    ];
    for (const p of paths) {
      const res = await fetch(p, { headers: auth() });
      expect(res.status, p).toBe(404);
      const body = (await res.json()) as { graphql?: { supported: boolean } };
      expect(body.graphql?.supported).toBe(false);
    }
    expect(FUSION_GRAPHQL.supported).toBe(false);
    expect(FUSION_GRAPHQL.officialEndpoint).toBeNull();
  });

  it('HcmClient.describeResource + describeCatalog', async () => {
    const client = new HcmClient(cfg());
    const workers = await client.describeResource('workers');
    const summary = summarizeAdfDescribe(workers, 'workers');
    expect(summary.queryable).toContain('PersonNumber');
    expect(summary.notQueryable).toContain('CorrespondenceLanguage');
    expect(summary.children).toContain('emails');
    const catalog = (await client.describeCatalog({ metadataMode: 'minimal' })) as {
      Resources: Record<string, unknown>;
    };
    expect(catalog.Resources.workers).toBeTruthy();
  });

  it('MCP hcm_adf_describe / catalog / api_surface', async () => {
    await withClient(cfg(), async (c) => {
      const { tools } = await c.listTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain('hcm_adf_describe');
      expect(names).toContain('hcm_adf_catalog');
      expect(names).toContain('hcm_fusion_api_surface');
      expect(names.length).toBeGreaterThanOrEqual(243);

      const d = parse(
        await c.callTool({ name: 'hcm_adf_describe', arguments: { resource: 'workers' } }),
      );
      expect(d.resource).toBe('workers');
      expect(d.queryable).toContain('PersonNumber');
      expect(d.graphql.supported).toBe(false);

      const cat = parse(await c.callTool({ name: 'hcm_adf_catalog', arguments: {} }));
      expect(cat.resources).toContain('workers');
      expect(cat.graphql.supported).toBe(false);

      const surface = parse(await c.callTool({ name: 'hcm_fusion_api_surface', arguments: {} }));
      expect(surface.graphql.supported).toBe(false);
      expect(surface.adfRest.describe).toContain('/describe');
      expect(surface.adfQuery.operators).toEqual(expect.arrayContaining(['like', 'between', 'in']));

      const live = parse(
        await c.callTool({
          name: 'hcm_describe_resource',
          arguments: { name: 'workers', live: true },
        }),
      );
      expect(live.live).toBe(true);
      expect(live.describe.Resources.workers).toBeTruthy();
    });
  });

  it('ADF Resources catalog keys extract as OpenAPI roots', () => {
    const roots = extractRootsFromOpenApi({
      Resources: { workers: { links: [] }, absences: { links: [] }, ce: { links: [] } },
    });
    expect(roots).toContain('workers');
    expect(roots).toContain('absences');
    expect(roots).not.toContain('ce');
  });

  it('known resources include nested children; quoting still conservative', () => {
    expect(knownAdfResource('addresses')).toBe(true);
    expect(knownAdfResource('gradeSteps')).toBe(true);
    expect(knownAdfResource('inventedThing')).toBe(false);
    expect(adfEquals('PersonNumber', "O'Brien")).toBe("PersonNumber='O''Brien'");
    expect(ADF_Q_OPERATORS).toContain('like');
  });
});
