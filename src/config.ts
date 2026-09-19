/**
 * Runtime configuration for the unofficial Oracle HCM MCP server.
 * Not affiliated with Oracle Corporation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export type AuthMode = 'basic' | 'bearer' | 'oauth' | 'none';

export interface Config {
  /** HCM REST base, e.g. https://host/hcmRestApi or http://127.0.0.1:9090/hcmRestApi */
  baseUrl: string;
  /** API version path segment under resources/ */
  apiVersion: string;
  writeMode: boolean;
  /** Enable payslip / bank / national-ID tools (ORACLE_HCM_SENSITIVE=1) */
  sensitiveEnabled: boolean;
  /** Deprecated/compat: --write alone bypasses sensitive gates. Kept for publicConfigView. */
  sensitiveWriteEnabled: boolean;
  authMode: AuthMode;
  username?: string;
  password?: string;
  bearerToken?: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  /** Approval intent TTL in ms (default 15 min) */
  approvalTtlMs: number;
  /** memory | file | sqlite — multi-node shared pending approvals */
  approvalStore: 'memory' | 'file' | 'sqlite';
  /** Path for file/sqlite approval store */
  approvalStorePath?: string;
  /** HMAC secret for webhook receiver (ORACLE_HCM_WEBHOOK_SECRET) */
  webhookSecret?: string;
  /** Atom CDC checkpoint store path */
  atomCheckpointPath?: string;
  httpPort?: number;
  grpcPort?: number;
  webhookPort?: number;
  transport: 'stdio' | 'http' | 'grpc';
  /** Optional named profile label for multi-env setups */
  profile?: string;
  /** Path to profiles.json for multi-env switcher */
  profilesPath?: string;
  /**
   * Token required to approve/deny pending writes (MCP tools + HTTP /approvals).
   * Never returned by tools. Generated at startup if unset (stderr only).
   */
  approvalToken?: string;
  /** Token required for HTTP /mcp, /approvals and gRPC. Defaults to approvalToken. */
  httpToken?: string;
  /** When false, HTTP/gRPC skip bearer auth (debug only). Default true. */
  httpAuthRequired?: boolean;
  /** Fusion REST-Framework-Version header (default 4) */
  restFrameworkVersion?: string;
  /** If-Match for PATCH/DELETE (default * for integration users) */
  ifMatch?: string;
  /** Send ADF resourceitem content-type on POST/PATCH/PUT */
  adfContentType?: boolean;
  /** Optional Effective-Of header (e.g. RangeMode=UPDATE). Empty = omit. */
  effectiveOf?: string;
}

function envFlag(name: string): boolean {
  const v = process.env[name];
  return v === '1' || v === 'true' || v === 'yes';
}

/** Load .env then .env.local from cwd; never override existing process.env. */
export function loadDotenv(cwd = process.cwd()): void {
  for (const name of ['.env', '.env.local']) {
    const file = path.join(cwd, name);
    try {
      if (!fs.existsSync(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq < 1) continue;
        const key = t.slice(0, eq).trim();
        let val = t.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = val;
      }
    } catch {
      /* ignore unreadable env files */
    }
  }
}

function generateToken(label: string): string {
  const t = randomBytes(32).toString('hex');
  console.error(
    `[oracle-hcm-mcp] ${label} not set — generated ephemeral token (stderr only, never returned by tools):`,
  );
  console.error(`  ${t}`);
  return t;
}

export function parseArgs(argv: string[] = process.argv.slice(2)): Config {
  loadDotenv();

  let writeMode = envFlag('ORACLE_HCM_WRITE');
  let baseUrl =
    process.env.ORACLE_HCM_BASE_URL ??
    'http://127.0.0.1:9090/hcmRestApi';
  let httpPort: number | undefined;
  let grpcPort: number | undefined;
  let webhookPort: number | undefined;
  let transport: Config['transport'] = 'stdio';
  let profile = process.env.ORACLE_HCM_PROFILE;

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
    } else if (a === '--webhook') {
      webhookPort = Number(argv[++i] ?? 8795);
    } else if (a === '--base-url') {
      baseUrl = argv[++i] ?? baseUrl;
    } else if (a === '--profile') {
      profile = argv[++i] ?? profile;
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

  const httpAuthRequired = !envFlag('ORACLE_HCM_HTTP_AUTH_OFF');
  let approvalToken = process.env.ORACLE_HCM_APPROVAL_TOKEN;
  if (!approvalToken && !writeMode) {
    approvalToken = generateToken('ORACLE_HCM_APPROVAL_TOKEN');
  }
  let httpToken = process.env.ORACLE_HCM_HTTP_TOKEN ?? approvalToken;
  if (!httpToken && httpAuthRequired && (transport === 'http' || transport === 'grpc')) {
    httpToken = generateToken('ORACLE_HCM_HTTP_TOKEN');
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiVersion: process.env.ORACLE_HCM_API_VERSION ?? '11.13.18.05',
    writeMode,
    sensitiveEnabled: envFlag('ORACLE_HCM_SENSITIVE'),
    sensitiveWriteEnabled: envFlag('ORACLE_HCM_SENSITIVE_WRITE'),
    authMode,
    username: process.env.ORACLE_HCM_USERNAME,
    password: process.env.ORACLE_HCM_PASSWORD,
    bearerToken: process.env.ORACLE_HCM_BEARER_TOKEN,
    tokenUrl: process.env.ORACLE_HCM_TOKEN_URL,
    clientId: process.env.ORACLE_HCM_CLIENT_ID,
    clientSecret: process.env.ORACLE_HCM_CLIENT_SECRET,
    approvalTtlMs: Number(process.env.ORACLE_HCM_APPROVAL_TTL_MS ?? 15 * 60 * 1000),
    approvalStore: resolveApprovalStoreMode(),
    approvalStorePath: process.env.ORACLE_HCM_APPROVAL_STORE_PATH,
    webhookSecret: process.env.ORACLE_HCM_WEBHOOK_SECRET,
    atomCheckpointPath: process.env.ORACLE_HCM_ATOM_CHECKPOINT_PATH,
    httpPort,
    grpcPort,
    webhookPort,
    transport,
    profile,
    profilesPath: process.env.ORACLE_HCM_PROFILES_PATH,
    approvalToken,
    httpToken,
    httpAuthRequired,
    restFrameworkVersion: process.env.ORACLE_HCM_REST_FRAMEWORK_VERSION ?? '4',
    ifMatch: process.env.ORACLE_HCM_IF_MATCH ?? '*',
    adfContentType: envFlag('ORACLE_HCM_ADF_CONTENT_TYPE'),
    effectiveOf: process.env.ORACLE_HCM_EFFECTIVE_OF || undefined,
  };
}

function resolveApprovalStoreMode(): Config['approvalStore'] {
  const raw = (process.env.ORACLE_HCM_APPROVAL_STORE ?? '').toLowerCase();
  if (raw.startsWith('sqlite')) return 'sqlite';
  if (raw.startsWith('file') || process.env.ORACLE_HCM_APPROVAL_STORE_PATH) return 'file';
  if (raw === 'memory' || raw === 'mem') return 'memory';
  return 'memory';
}

function printHelp(): void {
  console.log(`oracle-hcm-mcp — unofficial Oracle Fusion Cloud HCM MCP server

NOT affiliated with, endorsed by, or supported by Oracle Corporation.
MIT License. Use at your own risk.

Usage:
  oracle-hcm-mcp                     # stdio, approval required for writes
  oracle-hcm-mcp --write             # stdio, unrestricted writes (bypasses approval + SENSITIVE + prod lock)
  oracle-hcm-mcp --http 8788
  oracle-hcm-mcp --grpc 8789
  oracle-hcm-mcp --webhook 8795
  oracle-hcm-mcp --base-url http://127.0.0.1:9090/hcmRestApi
  oracle-hcm-mcp --profile sandbox

Env:
  ORACLE_HCM_BASE_URL, ORACLE_HCM_AUTH (basic|oauth|bearer|none),
  ORACLE_HCM_USERNAME/PASSWORD, ORACLE_HCM_TOKEN_URL, CLIENT_ID/SECRET,
  ORACLE_HCM_BEARER_TOKEN, ORACLE_HCM_WRITE=1, ORACLE_HCM_API_VERSION,
  ORACLE_HCM_SENSITIVE=1, ORACLE_HCM_SENSITIVE_WRITE=1, ORACLE_HCM_PROFILE,
  ORACLE_HCM_APPROVAL_TOKEN (required to approve writes; generated to stderr if unset),
  ORACLE_HCM_HTTP_TOKEN (HTTP/gRPC bearer; defaults to approval token),
  ORACLE_HCM_HTTP_AUTH_OFF=1 (debug: disable HTTP/gRPC auth — do not use),
  ORACLE_HCM_APPROVAL_STORE=memory|file|sqlite, ORACLE_HCM_APPROVAL_STORE_PATH,
  ORACLE_HCM_WEBHOOK_SECRET, ORACLE_HCM_WEBHOOK_SECRETS, ORACLE_HCM_WEBHOOK_MTLS,
  ORACLE_HCM_ATOM_CHECKPOINT_PATH, ORACLE_HCM_PROFILES_PATH, ORACLE_HCM_SMOKE_DIR,
  ORACLE_HCM_REST_FRAMEWORK_VERSION, ORACLE_HCM_IF_MATCH, ORACLE_HCM_ADF_CONTENT_TYPE,
  ORACLE_HCM_EFFECTIVE_OF
`);
}

export function resourcesBase(cfg: Config): string {
  return `${cfg.baseUrl}/resources/${cfg.apiVersion}`;
}

/** Redacted view safe for setup/status tools and logs */
export function publicConfigView(cfg: Config): Record<string, unknown> {
  return {
    baseUrl: cfg.baseUrl,
    apiVersion: cfg.apiVersion,
    authMode: cfg.authMode,
    writeMode: cfg.writeMode,
    sensitiveEnabled: cfg.sensitiveEnabled,
    sensitiveWriteEnabled: cfg.sensitiveWriteEnabled,
    username: cfg.username ?? null,
    clientId: cfg.clientId ?? null,
    tokenUrl: cfg.tokenUrl ?? null,
    hasPassword: Boolean(cfg.password),
    hasBearerToken: Boolean(cfg.bearerToken),
    hasClientSecret: Boolean(cfg.clientSecret),
    hasApprovalToken: Boolean(cfg.approvalToken),
    hasHttpToken: Boolean(cfg.httpToken),
    httpAuthRequired: cfg.httpAuthRequired,
    profile: cfg.profile ?? null,
    profilesPath: cfg.profilesPath ?? null,
    transport: cfg.transport,
    approvalStore: cfg.approvalStore,
    approvalStorePath: cfg.approvalStorePath ?? null,
    webhookSigningConfigured: Boolean(cfg.webhookSecret),
    atomCheckpointPath: cfg.atomCheckpointPath ?? null,
    restFrameworkVersion: cfg.restFrameworkVersion,
    unofficial: true,
    note: 'Secrets never included. Not an Oracle product.',
  };
}
