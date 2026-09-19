/**
 * Thin fetch wrapper for Oracle Fusion Cloud HCM REST.
 * Supports Basic, Bearer, and OAuth client-credentials.
 * v0.5: connection pool agents, tuned 429 backoff, batch GET, probe helper, token expiry.
 * Unofficial — HCM RBAC still applies on the real server.
 */

import type { Config } from '../config.js';
import { resourcesBase } from '../config.js';
import { assertAllowlisted, normalizeResourcePath } from '../policy/allowlist.js';
import { RateLimiter, withBackoff } from '../platform/rateLimit.js';
import { agentForUrl } from '../platform/connectionPool.js';

export class HcmHttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
    public retryAfterSec?: number,
  ) {
    super(message);
    this.name = 'HcmHttpError';
  }
}

export interface ListResult<T = unknown> {
  items: T[];
  count?: number;
  hasMore?: boolean;
  links?: unknown[];
}

export type OAuthTokenInfo = {
  hasToken: boolean;
  expiresAt: string | null;
  expiresInSec: number | null;
  refreshAvailable: boolean;
};

export class HcmClient {
  private cachedToken?: { value: string; expiresAt: number };
  private limiter = new RateLimiter();
  /** Last Retry-After from a 429 (seconds) */
  private lastRetryAfterSec?: number;

  constructor(private cfg: Config) {}

  get config(): Config {
    return this.cfg;
  }

  /** Hot-swap config (multi-env profile switch without restarting process). */
  applyConfig(next: Config): void {
    this.cfg = next;
    this.cachedToken = undefined;
  }

  resourcesUrl(path: string): string {
    const p = normalizeResourcePath(path);
    return `${resourcesBase(this.cfg)}/${p}`;
  }

  oauthTokenInfo(): OAuthTokenInfo {
    if (!this.cachedToken) {
      return {
        hasToken: false,
        expiresAt: null,
        expiresInSec: null,
        refreshAvailable: this.cfg.authMode === 'oauth',
      };
    }
    const expiresInSec = Math.max(0, Math.floor((this.cachedToken.expiresAt - Date.now()) / 1000));
    return {
      hasToken: true,
      expiresAt: new Date(this.cachedToken.expiresAt).toISOString(),
      expiresInSec,
      refreshAvailable: this.cfg.authMode === 'oauth',
    };
  }

  /** Force OAuth token refresh (client-credentials). */
  async refreshOAuthToken(): Promise<OAuthTokenInfo> {
    this.cachedToken = undefined;
    if (this.cfg.authMode !== 'oauth') {
      return this.oauthTokenInfo();
    }
    await this.getOAuthToken();
    return this.oauthTokenInfo();
  }

  async health(): Promise<{
    ok: boolean;
    baseUrl: string;
    writeMode: boolean;
    authMode: string;
    profile?: string | null;
    oauth?: OAuthTokenInfo;
  }> {
    try {
      const url = this.resourcesUrl('workers?limit=1');
      const res = await this.rawFetch(url, { method: 'GET' });
      return {
        ok: res.status < 500,
        baseUrl: this.cfg.baseUrl,
        writeMode: this.cfg.writeMode,
        authMode: this.cfg.authMode,
        profile: this.cfg.profile ?? null,
        oauth: this.oauthTokenInfo(),
      };
    } catch {
      return {
        ok: false,
        baseUrl: this.cfg.baseUrl,
        writeMode: this.cfg.writeMode,
        authMode: this.cfg.authMode,
        profile: this.cfg.profile ?? null,
        oauth: this.oauthTokenInfo(),
      };
    }
  }

  async whoami(): Promise<Record<string, unknown>> {
    return {
      authMode: this.cfg.authMode,
      username: this.cfg.username ?? null,
      clientId: this.cfg.clientId ?? null,
      baseUrl: this.cfg.baseUrl,
      apiVersion: this.cfg.apiVersion,
      writeMode: this.cfg.writeMode,
      profile: this.cfg.profile ?? null,
      oauth: this.oauthTokenInfo(),
      note: 'Unofficial MCP — identity reflects local config; HCM RBAC applies on server.',
    };
  }

  /**
   * Probe that returns status without throwing on 4xx — for smoke matrices.
   * Exposed for smokeProbe.
   */
  async probe(path: string): Promise<{ status: number; ok: boolean; ms: number; bodySnippet?: string }> {
    const t0 = Date.now();
    const url = this.resourcesUrl(path);
    const res = await this.rawFetchAllowError(url, { method: 'GET' });
    const text = await res.text().catch(() => '');
    return {
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
      ms: Date.now() - t0,
      bodySnippet: text.slice(0, 200),
    };
  }

  async getJson<T = unknown>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(this.resourcesUrl(path));
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
      }
    }
    const res = await this.rawFetch(url.toString(), { method: 'GET' });
    return this.parseJson<T>(res);
  }

  async list<T = unknown>(
    path: string,
    query?: Record<string, string | number | undefined>,
  ): Promise<ListResult<T>> {
    const data = await this.getJson<Record<string, unknown>>(path, query);
    if (Array.isArray(data)) {
      return { items: data as T[], count: data.length, hasMore: false };
    }
    const items = (data.items as T[]) ?? (data.Items as T[]) ?? [];
    return {
      items,
      count: (data.count as number) ?? items.length,
      hasMore: Boolean(data.hasMore),
      links: data.links as unknown[],
    };
  }

  /** Parallel batch GET of allowlisted paths (connection-pooled). */
  async batchGet(
    paths: string[],
    opts: { concurrency?: number } = {},
  ): Promise<{ path: string; ok: boolean; status?: number; data?: unknown; error?: string }[]> {
    const concurrency = Math.max(1, Math.min(opts.concurrency ?? 6, 16));
    const results: { path: string; ok: boolean; status?: number; data?: unknown; error?: string }[] =
      new Array(paths.length);
    let idx = 0;
    const worker = async () => {
      for (;;) {
        const i = idx++;
        if (i >= paths.length) return;
        const p = paths[i]!;
        try {
          assertAllowlisted(p);
          const data = await this.getJson(p);
          results[i] = { path: p, ok: true, status: 200, data };
        } catch (e) {
          results[i] = {
            path: p,
            ok: false,
            status: (e as { status?: number })?.status,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    return results;
  }

  async postJson<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await this.rawFetch(this.resourcesUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    return this.parseJson<T>(res);
  }

  async patchJson<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await this.rawFetch(this.resourcesUrl(path), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Effective-Of': 'RangeMode=POST',
      },
      body: JSON.stringify(body ?? {}),
    });
    return this.parseJson<T>(res);
  }

  async delete(path: string): Promise<{ deleted: boolean; status: number }> {
    const res = await this.rawFetch(this.resourcesUrl(path), { method: 'DELETE' });
    if (res.status === 204 || res.status === 200) return { deleted: true, status: res.status };
    if (!res.ok) await this.throwHttp(res);
    return { deleted: true, status: res.status };
  }

  async restGet(path: string, query?: Record<string, string | number | undefined>): Promise<unknown> {
    assertAllowlisted(path);
    return this.getJson(path, query);
  }

  async restMutate(
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    assertAllowlisted(path);
    if (method === 'DELETE') return this.delete(path);
    if (method === 'POST') return this.postJson(path, body);
    if (method === 'PATCH') return this.patchJson(path, body);
    const res = await this.rawFetch(this.resourcesUrl(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    return this.parseJson(res);
  }

  private async rawFetch(url: string, init: RequestInit): Promise<Response> {
    await this.limiter.take();
    return withBackoff(
      async () => {
        const headers = new Headers(init.headers);
        headers.set('Accept', 'application/json');
        const auth = await this.authorizationHeader();
        if (auth) headers.set('Authorization', auth);
        const agent = agentForUrl(url);
        const res = await fetch(url, {
          ...init,
          headers,
          // @ts-expect-error Node fetch undici / agent passthrough where supported
          agent,
        });
        if (res.status === 429) {
          const ra = res.headers.get('retry-after');
          this.lastRetryAfterSec = ra ? Number(ra) || 1 : 1;
          throw Object.assign(new Error(`HCM HTTP 429`), {
            status: 429,
            retryAfterSec: this.lastRetryAfterSec,
          });
        }
        if (res.status >= 500) {
          throw Object.assign(new Error(`HCM HTTP ${res.status}`), { status: res.status });
        }
        return res;
      },
      {
        getRetryAfterSec: (err) => (err as { retryAfterSec?: number })?.retryAfterSec ?? this.lastRetryAfterSec,
      },
    );
  }

  /** Like rawFetch but does not throw on 4xx — used by smoke probes. */
  private async rawFetchAllowError(url: string, init: RequestInit): Promise<Response> {
    await this.limiter.take();
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    const auth = await this.authorizationHeader();
    if (auth) headers.set('Authorization', auth);
    const agent = agentForUrl(url);
    return fetch(url, {
      ...init,
      headers,
      // @ts-expect-error Node agent
      agent,
    });
  }

  private async authorizationHeader(): Promise<string | undefined> {
    const { authMode } = this.cfg;
    if (authMode === 'none') return undefined;
    if (authMode === 'basic') {
      const u = this.cfg.username ?? '';
      const p = this.cfg.password ?? '';
      return `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`;
    }
    if (authMode === 'bearer') {
      if (!this.cfg.bearerToken) throw new Error('ORACLE_HCM_BEARER_TOKEN required for bearer auth');
      return `Bearer ${this.cfg.bearerToken}`;
    }
    if (authMode === 'oauth') {
      const token = await this.getOAuthToken();
      return `Bearer ${token}`;
    }
    return undefined;
  }

  private async getOAuthToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) {
      return this.cachedToken.value;
    }
    const { tokenUrl, clientId, clientSecret } = this.cfg;
    if (!tokenUrl || !clientId || !clientSecret) {
      throw new Error('OAuth requires ORACLE_HCM_TOKEN_URL, ORACLE_HCM_CLIENT_ID, ORACLE_HCM_CLIENT_SECRET');
    }
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      throw new HcmHttpError(`OAuth token request failed: ${res.status}`, res.status, await safeText(res));
    }
    const data = (await res.json()) as { access_token: string; expires_in?: number };
    this.cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return data.access_token;
  }

  private async parseJson<T>(res: Response): Promise<T> {
    if (res.status === 204) return {} as T;
    if (!res.ok) await this.throwHttp(res);
    const text = await res.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }

  private async throwHttp(res: Response): Promise<never> {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await safeText(res);
    }
    const ra = res.headers.get('retry-after');
    throw new HcmHttpError(
      `HCM HTTP ${res.status}`,
      res.status,
      body,
      ra ? Number(ra) || undefined : undefined,
    );
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}
