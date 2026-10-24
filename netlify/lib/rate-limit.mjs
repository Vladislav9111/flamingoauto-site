import { createHash } from 'node:crypto';
import { getDeployStore } from '@netlify/blobs';
import { json } from './security.mjs';

// One bounded ledger per endpoint in this deploy only. No application records,
// credentials or raw IP addresses are stored. Strong reads + conditional writes
// make the quota shared across concurrent function instances.
export function createLimiter(openStore = () => getDeployStore('flamingo-abuse-guard-v1', { region: 'eu-central-1' }), now = Date.now) {
  return async function limit(request, context, group) {
    if (!['lead', 'login'].includes(group) || typeof context?.ip !== 'string' || !context.ip || context.ip.length > 128) {
      return json(503, { error: 'Request protection unavailable' });
    }
    const fingerprint = createHash('sha256').update(`${context.deploy?.id || 'flamingo'}:${context.ip}`).digest('hex');
    try {
      const store = openStore();
      for (let attempt = 0; attempt < 8; attempt++) {
        const entry = await store.getWithMetadata(group, { type: 'json', consistency: 'strong' });
        const clock = now();
        if (entry && (entry.data?.version !== 1 || typeof entry.data.clients !== 'object' || !entry.data.clients || Array.isArray(entry.data.clients))) throw new Error('INVALID_LEDGER');
        const clients = Object.fromEntries(Object.entries(entry?.data.clients || {})
          .filter(([, client]) => Number.isInteger(client?.count) && client.count > 0 && Number.isInteger(client.resetAt) && client.resetAt > clock));
        const client = clients[fingerprint];
        if (client?.count >= 5) return json(429, { error: 'Too many requests; please wait' }, {
          'Retry-After': String(Math.max(1, Math.ceil((client.resetAt - clock) / 1000)))
        });
        if (!client && Object.keys(clients).length >= 1024) return json(429, { error: 'Please try again shortly' }, { 'Retry-After': '60' });
        clients[fingerprint] = { count: (client?.count || 0) + 1, resetAt: client?.resetAt || clock + 60000 };
        const options = entry ? { onlyIfMatch: entry.etag } : { onlyIfNew: true };
        const result = await store.setJSON(group, { version: 1, clients }, options);
        if (result.modified) return null;
      }
    } catch { /* A storage error cannot silently disable request protection. */ }
    return json(503, { error: 'Request protection unavailable' });
  };
}
export const enforceRateLimit = createLimiter();
