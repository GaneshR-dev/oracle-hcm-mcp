/**
 * Lightweight HTTP keep-alive "pool" hints for Node fetch undici / agent.
 * Unofficial — improves throughput for batch GETs against Fusion.
 */

import http from 'node:http';
import https from 'node:https';

let httpAgent: http.Agent | undefined;
let httpsAgent: https.Agent | undefined;

export function getHttpAgent(): http.Agent {
  if (!httpAgent) {
    httpAgent = new http.Agent({
      keepAlive: true,
      maxSockets: Number(process.env.ORACLE_HCM_MAX_SOCKETS ?? 16),
      maxFreeSockets: 8,
      scheduling: 'lifo',
    });
  }
  return httpAgent;
}

export function getHttpsAgent(): https.Agent {
  if (!httpsAgent) {
    httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: Number(process.env.ORACLE_HCM_MAX_SOCKETS ?? 16),
      maxFreeSockets: 8,
      scheduling: 'lifo',
    });
  }
  return httpsAgent;
}

/** Pick agent for a URL (used when fetch supports dispatcher/agent). */
export function agentForUrl(url: string): http.Agent | https.Agent {
  return url.startsWith('https:') ? getHttpsAgent() : getHttpAgent();
}
