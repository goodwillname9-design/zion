// Builds the WebRTC ICE server list. STUN alone fails on many mobile/carrier networks,
// so a TURN relay (configured by the owner in Vercel env) is added when available.
export type IceServer = { urls: string | string[]; username?: string; credential?: string };

export const DEFAULT_STUN: IceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
];

function validServer(value: unknown): value is IceServer {
  if (!value || typeof value !== 'object') return false;
  const urls = (value as IceServer).urls;
  const list = Array.isArray(urls) ? urls : [urls];
  return list.length > 0 && list.every(u => typeof u === 'string' && /^(stun|stuns|turn|turns):/i.test(u));
}

export function buildIceServers(env: Record<string, string | undefined>): IceServer[] {
  const servers: IceServer[] = [...DEFAULT_STUN];
  const json = (env.ICE_SERVERS_JSON ?? '').trim();
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) for (const item of parsed) if (validServer(item)) servers.push(item);
    } catch { /* ignore malformed JSON: STUN fallback still works */ }
  }
  const urls = (env.TURN_URLS ?? '').split(',').map(u => u.trim()).filter(u => /^(turn|turns):/i.test(u));
  if (urls.length && env.TURN_USERNAME && env.TURN_CREDENTIAL)
    servers.push({ urls, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL });
  return servers;
}

export function hasTurn(servers: IceServer[]): boolean {
  return servers.some(s => (Array.isArray(s.urls) ? s.urls : [s.urls]).some(u => /^turns?:/i.test(u)));
}
