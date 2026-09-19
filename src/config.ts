/**
 * Runtime configuration for the unofficial Oracle HCM MCP server.
 * Not affiliated with Oracle Corporation.
 */

export type AuthMode = 'basic' | 'bearer' | 'oauth' | 'none';

export interface Config {
  /** HCM REST base, e.g. https://host/hcmRestApi or http://127.0.0.1:9090/hcmRestApi */
  baseUrl: string;
  /** API version path segment under resources/ */
  apiVersion: string;
  writeMode: boolean;
  authMode: AuthMode;
  username?: string;
  password?: string;
  bearerToken?: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  /** Approval intent TTL in ms (default 15 min) */
  approvalTtlMs: number;
  httpPort?: number;
  grpcPort?: number;
  transport: 'stdio' | 'http' | 'grpc';
}

function envFlag(name: string): boolean {
  const v = process.env[name];
  return v === '1' || v === 'true' || v === 'yes';
}

export function parseArgs(argv: string[] = process.argv.slice(2)): Config {
  let writeMode = envFlag('ORACLE_HCM_WRITE');
  let baseUrl =
    process.env.ORACLE_HCM_BASE_URL ??
    'https://fa-xxxx-hcm.fa.ocs.oraclecloud.com/hcmRestApi';
  let httpPort: number | undefined;
  let grpcPort: number | undefined;
  let transport: Config['transport'] = 'stdio';

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--write') {
      writeMode = true;
    } else if (a === '--http') {
      transport = 'http';
      httpPort = Number(argv[++i] ?? 8788);
    } else if (a === '--grpc') {
      transport = 'grpc';
      grpcPort = Number(argv[++i] ?? 8789);
    } else if (a === '--base-url') {
      baseUrl = argv[++i] ?? baseUrl;
    } else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  const authEnv = (process.env.ORACLE_HCM_AUTH ?? 'basic').toLowerCase();
  let authMode: AuthMode = 'basic';
  if (authEnv === 'oauth' || authEnv === 'client_credentials') authMode = 'oauth';
  else if (authEnv === 'bearer' || authEnv === 'token') authMode = 'bearer';
  else if (authEnv === 'none' || authEnv === 'off') authMode = 'none';

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiVersion: process.env.ORACLE_HCM_API_VERSION ?? '11.13.18.05',
    writeMode,
    authMode,
    username: process.env.ORACLE_HCM_USERNAME,
    password: process.env.ORACLE_HCM_PASSWORD,
    bearerToken: process.env.ORACLE_HCM_BEARER_TOKEN,
    tokenUrl: process.env.ORACLE_HCM_TOKEN_URL,
    clientId: process.env.ORACLE_HCM_CLIENT_ID,
    clientSecret: process.env.ORACLE_HCM_CLIENT_SECRET,
    approvalTtlMs: Number(process.env.ORACLE_HCM_APPROVAL_TTL_MS ?? 15 * 60 * 1000),
    httpPort,
    grpcPort,
    transport,
  };
}

function printHelp(): void {
  console.log(`oracle-hcm-mcp — unofficial Oracle Fusion Cloud HCM MCP server

NOT affiliated with, endorsed by, or supported by Oracle Corporation.
MIT License. Use at your own risk.

Usage:
  oracle-hcm-mcp                     # stdio, approval required for writes
  oracle-hcm-mcp --write             # stdio, unrestricted writes
  oracle-hcm-mcp --http 8788
  oracle-hcm-mcp --grpc 8789
  oracle-hcm-mcp --base-url http://127.0.0.1:9090/hcmRestApi

Env:
  ORACLE_HCM_BASE_URL, ORACLE_HCM_AUTH (basic|oauth|bearer|none),
  ORACLE_HCM_USERNAME/PASSWORD, ORACLE_HCM_TOKEN_URL, CLIENT_ID/SECRET,
  ORACLE_HCM_BEARER_TOKEN, ORACLE_HCM_WRITE=1, ORACLE_HCM_API_VERSION
`);
}

export function resourcesBase(cfg: Config): string {
  return `${cfg.baseUrl}/resources/${cfg.apiVersion}`;
}
