import { json } from '../lib/security.mjs';
export default function handler(request) {
  if (new URL(request.url).pathname !== '/api/form-config') return json(404, { error: 'Not found' });
  if (request.method !== 'GET') return json(405, { error: 'Method not allowed' });
  // Only the public widget key goes to the browser. No token, password or chat ID.
  const values = [process.env.FLAMINGO_TURNSTILE_SITE_KEY, process.env.FLAMINGO_TURNSTILE_SECRET_KEY,
    process.env.FLAMINGO_TELEGRAM_BOT_TOKEN, process.env.FLAMINGO_TELEGRAM_CHAT_ID];
  const configured = values.map(Boolean);
  // Netlify secret values are write-only. Copying a masked UI field can save a
  // placeholder instead of a usable value; do not enable a broken form.
  const valid = [
    /^[A-Za-z0-9_-]{10,255}$/.test(values[0] || ''),
    typeof values[1] === 'string' && values[1].length >= 10 && !/^\*+$/.test(values[1]),
    typeof values[2] === 'string' && values[2].length >= 10 && !/^\*+$/.test(values[2]),
    /^-?\d{1,20}$|^@[A-Za-z0-9_]{5,32}$/.test(values[3] || '')
  ];
  const ready = valid.every(Boolean);
  // Preview-only presence bits, never values. This distinguishes deployment
  // configuration failures without exposing credentials or dumping environment.
  const preview = /^deploy-preview-\d+--mellifluous-moxie-db6fec\.netlify\.app$/.test(new URL(request.url).hostname);
  const headers = preview ? { 'X-Flamingo-Setup': configured.map(Number).join(''),
    'X-Flamingo-Setup-Valid': valid.map(Number).join('') } : {};
  return json(ready ? 200 : 503, ready ? { turnstileSiteKey: process.env.FLAMINGO_TURNSTILE_SITE_KEY } : { error: 'Form temporarily unavailable' }, headers);
}
export const config = { path: '/api/form-config', rateLimit: {
  windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain']
} };
