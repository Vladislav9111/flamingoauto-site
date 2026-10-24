import { json } from '../lib/security.mjs';
export default function handler(request) {
  if (new URL(request.url).pathname !== '/api/form-config') return json(404, { error: 'Not found' });
  if (request.method !== 'GET') return json(405, { error: 'Method not allowed' });
  // Only the public widget key goes to the browser. No token, password or chat ID.
  const configured = [process.env.FLAMINGO_TURNSTILE_SITE_KEY, process.env.FLAMINGO_TURNSTILE_SECRET_KEY,
    process.env.FLAMINGO_TELEGRAM_BOT_TOKEN, process.env.FLAMINGO_TELEGRAM_CHAT_ID].map(Boolean);
  const ready = configured.every(Boolean);
  // Preview-only presence bits, never values. This distinguishes deployment
  // configuration failures without exposing credentials or dumping environment.
  const preview = /^deploy-preview-\d+--mellifluous-moxie-db6fec\.netlify\.app$/.test(new URL(request.url).hostname);
  const headers = preview ? { 'X-Flamingo-Setup': configured.map(Number).join('') } : {};
  return json(ready ? 200 : 503, ready ? { turnstileSiteKey: process.env.FLAMINGO_TURNSTILE_SITE_KEY } : { error: 'Form temporarily unavailable' }, headers);
}
export const config = { path: '/api/form-config', rateLimit: {
  windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain']
} };
