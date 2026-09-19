/**
 * Thin fetch wrapper for Oracle Fusion Cloud HCM REST.
 * Supports Basic, Bearer, and OAuth client-credentials.
 * Unofficial — HCM RBAC still applies on the real server.
 */

import type { Config } from '../config.js';
import { resourcesBase } from '../config.js';
import { assertAllowlisted, normalizeResourcePath } from '../policy/allowlist.js';
import { RateLimiter, withBackoff } from '../platform/rateLimit.js';

export class HcmHttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
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

export class HcmClient {
  private cachedToken?: { value: string; expiresAt: number };
  private limiter = new RateLimiter();

  constructor(private cfg: Config) {}

  get config(): Config {
    return this.cfg;
  }

  resourcesUrl(path: string): string {
    const p = normalizeResourcePath(path);
    return `${resourcesBase(this.cfg)}/${p}`;
  }

  async health(): Promise<{ ok: boolean; baseUrl: string; writeMode: boolean; authMode: string }> {
    try {
      // Prefer a cheap workers probe; dummy returns 200
      const url = this.resourcesUrl('workers?limit=1');
      const res = await this.rawFetch(url, { method: 'GET' });
      return {
        ok: res.status < 500,
        baseUrl: this.cfg.baseUrl,
        writeMode: this.cfg.writeMode,
        authMode: this.cfg.authMode,
      };
    } catch {
      return {
        ok: false,
        baseUrl: this.cfg.baseUrl,
        writeMode: this.cfg.writeMode,
        authMode: this.cfg.authMode,
      };
    }
  }

  async whoami(): Promise<Record<string, unknown>> {
    // Real HCM has no single whoami; return configured identity hints (no secrets)
    return {
      authMode: this.cfg.authMode,
      username: this.cfg.username ?? null,
      clientId: this.cfg.clientId ?? null,
      baseUrl: this.cfg.baseUrl,
      apiVersion: this.cfg.apiVersion,
      writeMode: this.cfg.writeMode,
      note: 'Unofficial MCP — identity reflects local config; HCM RBAC applies on server.',
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

  /** Generic allowlisted GET */
  async restGet(path: string, query?: Record<string, string | number | undefined>): Promise<unknown> {
    assertAllowlisted(path);
    return this.getJson(path, query);
  }

  /** Generic allowlisted mutate */
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
    return withBackoff(async () => {
      const headers = new Headers(init.headers);
      headers.set('Accept', 'application/json');
      const auth = await this.authorizationHeader();
      if (auth) headers.set('Authorization', auth);
      const res = await fetch(url, { ...init, headers });
      if (res.status === 429 || res.status >= 500) {
        throw Object.assign(new Error(`HCM HTTP ${res.status}`), { status: res.status });
      }
      return res;
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
    throw new HcmHttpError(`HCM HTTP ${res.status}`, res.status, body);
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}
