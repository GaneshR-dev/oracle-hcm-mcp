/**
 * Multi-env profile switcher — load dummy / sandbox / prod configs without
 * hand-editing mcp.json for every switch. Secrets stay in env / profile files
 * that are gitignored. Unofficial — not an Oracle product.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { AuthMode, Config } from '../config.js';

export type ProfileKind = 'dummy' | 'sandbox' | 'prod' | string;

export type EnvProfile = {
  name: string;
  kind: ProfileKind;
  baseUrl: string;
  apiVersion?: string;
  authMode?: AuthMode;
  username?: string;
  /** Prefer env var name references over inline secrets */
  passwordEnv?: string;
  bearerTokenEnv?: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecretEnv?: string;
  writeMode?: boolean;
  sensitiveEnabled?: boolean;
  note?: string;
};

export type ProfileStore = {
  path: string;
  active?: string;
  profiles: EnvProfile[];
};

const DEFAULT_PROFILES: EnvProfile[] = [
  {
    name: 'dummy',
    kind: 'dummy',
    baseUrl: 'http://127.0.0.1:9090/hcmRestApi',
    apiVersion: '11.13.18.05',
    authMode: 'basic',
    username: 'demo',
    passwordEnv: 'ORACLE_HCM_PASSWORD',
    note: 'Local dummy-hcm mock (demo/demo).',
  },
  {
    name: 'sandbox',
    kind: 'sandbox',
    baseUrl: 'https://fa-xxxx-hcm-test.fa.ocs.oraclecloud.com/hcmRestApi',
    apiVersion: '11.13.18.05',
    authMode: 'oauth',
    tokenUrl: '',
    clientId: '',
    clientSecretEnv: 'ORACLE_HCM_CLIENT_SECRET',
    writeMode: false,
    note: 'Non-prod Fusion — replace host; never commit secrets.',
  },
  {
    name: 'prod',
    kind: 'prod',
    baseUrl: 'https://fa-xxxx-hcm.fa.ocs.oraclecloud.com/hcmRestApi',
    apiVersion: '11.13.18.05',
    authMode: 'oauth',
    writeMode: false,
    sensitiveEnabled: false,
    note: 'Production — read-first; approval-by-default; --write still bypasses (no prod write lock).',
  },
];

export function defaultProfilesPath(): string {
  return (
    process.env.ORACLE_HCM_PROFILES_PATH ??
    path.join(os.homedir(), '.oracle-hcm-mcp', 'profiles.json')
  );
}

export function loadProfileStore(filePath?: string): ProfileStore {
  const p = filePath ?? defaultProfilesPath();
  if (!fs.existsSync(p)) {
    return { path: p, active: 'dummy', profiles: structuredClone(DEFAULT_PROFILES) };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as Partial<ProfileStore>;
    return {
      path: p,
      active: raw.active ?? 'dummy',
      profiles: Array.isArray(raw.profiles) && raw.profiles.length
        ? raw.profiles
        : structuredClone(DEFAULT_PROFILES),
    };
  } catch {
    return { path: p, active: 'dummy', profiles: structuredClone(DEFAULT_PROFILES) };
  }
}

export function saveProfileStore(store: ProfileStore): void {
  const dir = path.dirname(store.path);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    store.path,
    JSON.stringify(
      { active: store.active, profiles: store.profiles, unofficial: true },
      null,
      2,
    ),
    'utf8',
  );
}

export function getActiveProfile(store?: ProfileStore): EnvProfile | undefined {
  const s = store ?? loadProfileStore();
  return s.profiles.find((x) => x.name === s.active) ?? s.profiles[0];
}

export function setActiveProfile(name: string, filePath?: string): ProfileStore {
  const store = loadProfileStore(filePath);
  if (!store.profiles.some((p) => p.name === name)) {
    throw new Error(`Unknown profile: ${name}. Known: ${store.profiles.map((p) => p.name).join(', ')}`);
  }
  store.active = name;
  saveProfileStore(store);
  return store;
}

/** Apply a named profile onto a Config (secrets resolved from env var names). */
export function applyProfileToConfig(cfg: Config, profile: EnvProfile): Config {
  // --write / ORACLE_HCM_WRITE=1 always wins: profile cannot lock writes off.
  // Profile may enable writeMode, but never disables an already-set writeMode.
  const next: Config = {
    ...cfg,
    baseUrl: profile.baseUrl.replace(/\/+$/, ''),
    apiVersion: profile.apiVersion ?? cfg.apiVersion,
    authMode: profile.authMode ?? cfg.authMode,
    writeMode: Boolean(cfg.writeMode) || Boolean(profile.writeMode),
    sensitiveEnabled: profile.sensitiveEnabled ?? cfg.sensitiveEnabled,
    profile: profile.name,
  };
  if (profile.username != null) next.username = profile.username;
  if (profile.passwordEnv) next.password = process.env[profile.passwordEnv] ?? cfg.password;
  if (profile.bearerTokenEnv) next.bearerToken = process.env[profile.bearerTokenEnv] ?? cfg.bearerToken;
  if (profile.tokenUrl != null) next.tokenUrl = profile.tokenUrl || cfg.tokenUrl;
  if (profile.clientId != null) next.clientId = profile.clientId || cfg.clientId;
  if (profile.clientSecretEnv) {
    next.clientSecret = process.env[profile.clientSecretEnv] ?? cfg.clientSecret;
  }
  return next;
}

/** Emit Cursor mcp.json fragment for a profile (secrets as placeholders). */
export function emitMcpFragmentForProfile(
  profile: EnvProfile,
  opts: { includeWriteServer?: boolean; command?: string; args?: string[] } = {},
): Record<string, unknown> {
  const env: Record<string, string> = {
    ORACLE_HCM_BASE_URL: profile.baseUrl,
    ORACLE_HCM_API_VERSION: profile.apiVersion ?? '11.13.18.05',
    ORACLE_HCM_AUTH: profile.authMode ?? 'basic',
    ORACLE_HCM_PROFILE: profile.name,
  };
  if (profile.authMode === 'basic') {
    env.ORACLE_HCM_USERNAME = profile.username ?? '${ORACLE_HCM_USERNAME}';
    env.ORACLE_HCM_PASSWORD = `\${${profile.passwordEnv ?? 'ORACLE_HCM_PASSWORD'}}`;
  } else if (profile.authMode === 'bearer') {
    env.ORACLE_HCM_BEARER_TOKEN = `\${${profile.bearerTokenEnv ?? 'ORACLE_HCM_BEARER_TOKEN'}}`;
  } else if (profile.authMode === 'oauth') {
    if (profile.tokenUrl) env.ORACLE_HCM_TOKEN_URL = profile.tokenUrl;
    if (profile.clientId) env.ORACLE_HCM_CLIENT_ID = profile.clientId;
    env.ORACLE_HCM_CLIENT_SECRET = `\${${profile.clientSecretEnv ?? 'ORACLE_HCM_CLIENT_SECRET'}}`;
  }
  if (profile.sensitiveEnabled) env.ORACLE_HCM_SENSITIVE = '1';

  const command = opts.command ?? 'node';
  const args = opts.args ?? ['dist/index.js'];
  const servers: Record<string, unknown> = {
    [`oracle-hcm-${profile.name}`]: { command, args, env },
  };
  if (opts.includeWriteServer !== false) {
    servers[`oracle-hcm-${profile.name}-write`] = {
      command,
      args: [...args, '--write'],
      env: { ...env, ORACLE_HCM_WRITE: '1' },
    };
  }
  return {
    mcpServers: servers,
    note: 'Redacted placeholders. Unofficial MCP — not published to npm as a requirement; run from local build.',
  };
}

export { DEFAULT_PROFILES };
