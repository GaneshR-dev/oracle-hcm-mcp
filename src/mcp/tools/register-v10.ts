/**
 * v0.10 official ADF /describe schema + Fusion API-surface (no GraphQL).
 * Unofficial — not affiliated with Oracle.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './helpers.js';
import { runRead } from './helpers.js';
import { summarizeAdfDescribe, FUSION_API_SURFACE } from '../../platform/adfDescribe.js';
import { ADF_Q_OPERATORS, FUSION_GRAPHQL } from '../../policy/adf.js';
import { ALLOWED_ROOTS, isAllowlistedPath } from '../../policy/allowlist.js';

export function registerV10Tools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'hcm_adf_describe',
    {
      description:
        'GET official Fusion ADF /describe for a resource (attributes, queryable flags, finders, children, actions). Not GraphQL. Example: { "resource": "workers", "format": "summary" }',
      inputSchema: {
        resource: z
          .string()
          .describe('Allowlisted collection or nested path, e.g. workers or workers/1001/child/addresses'),
        includeChildren: z.boolean().optional().describe('Include child resource links (default true)'),
        format: z
          .enum(['summary', 'raw', 'openapi'])
          .optional()
          .describe('summary (default) | raw ADF describe | OpenAPI 3 (Accept vnd.oracle.openapi3+json)'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        const resource = args.resource.replace(/^\/+|\/+$/g, '').replace(/\/describe$/i, '');
        if (!isAllowlistedPath(resource)) {
          throw new Error(`Path not in allowlist: ${resource}`);
        }
        const format = args.format ?? 'summary';
        const raw = await ctx.client.describeResource(resource, {
          includeChildren: args.includeChildren,
          format: format === 'openapi' ? 'openapi' : 'adf',
        });
        if (format === 'raw' || format === 'openapi') {
          return {
            resource,
            format,
            describe: raw,
            graphql: FUSION_GRAPHQL,
            unofficial: true,
          };
        }
        return summarizeAdfDescribe(raw, resource.split('/').filter((s) => s !== 'child').pop());
      }, ctx, 'hcm_adf_describe'),
  );

  server.registerTool(
    'hcm_adf_catalog',
    {
      description:
        'GET official Fusion catalog describe: /hcmRestApi/resources/{version}/describe?metadataMode=minimal|list. Lists collection roots + describe links. Not GraphQL.',
      inputSchema: {
        metadataMode: z.enum(['minimal', 'list']).optional().describe('minimal (default) or list (links only)'),
        includeChildren: z.boolean().optional(),
        format: z.enum(['summary', 'raw', 'openapi']).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runRead(async () => {
        const format = args.format ?? 'summary';
        const raw = await ctx.client.describeCatalog({
          metadataMode: args.metadataMode ?? 'minimal',
          includeChildren: args.includeChildren,
          format: format === 'openapi' ? 'openapi' : 'adf',
        });
        if (format === 'raw' || format === 'openapi') {
          return { format, catalog: raw, graphql: FUSION_GRAPHQL, unofficial: true };
        }
        const rec = (raw ?? {}) as { Resources?: Record<string, unknown> };
        const names = Object.keys(rec.Resources ?? {}).sort();
        return {
          metadataMode: args.metadataMode ?? 'minimal',
          count: names.length,
          resources: names,
          allowlisted: ALLOWED_ROOTS.length,
          graphql: FUSION_GRAPHQL,
          unofficial: true,
        };
      }, ctx, 'hcm_adf_catalog'),
  );

  server.registerTool(
    'hcm_fusion_api_surface',
    {
      description:
        'Official Oracle Fusion Cloud HCM API surfaces. GraphQL is NOT supported. ADF REST /describe is the schema. Use this instead of inventing GraphQL.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () =>
      runRead(async () => {
        return {
          ...FUSION_API_SURFACE,
          adfQuery: {
            header: 'REST-Framework-Version ≥ 2',
            operators: [...ADF_Q_OPERATORS],
            examples: [
              "q=PersonNumber='1000'",
              'q=PersonNumber between 1000 and 1100',
              "q=names.FirstName like '%Ki%'",
              'finder=findByPersonId;PersonId=1564072335',
            ],
            note: 'Only attributes with queryable=true on /describe may appear in q=. Non-queryable → 400.',
            docs: 'https://docs.oracle.com/en/cloud/saas/human-resources/farws/Query_a_Collection.html',
          },
        };
      }, ctx, 'hcm_fusion_api_surface'),
  );
}
