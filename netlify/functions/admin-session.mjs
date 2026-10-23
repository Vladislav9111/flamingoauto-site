import { adminConfigured, authenticated, json, limitedBody, sameOrigin, sessionCookie, verifyPassword } from '../lib/security.mjs';

export default async function handler(request) {
  if (request.method === 'GET') return json(authenticated(request) ? 200 : 401, { authenticated: authenticated(request) });
  if (!['POST', 'DELETE'].includes(request.method)) return json(405, { error: 'Method not allowed' }, { Allow: 'GET, POST, DELETE' });
  if (!sameOrigin(request)) return json(403, { error: 'Origin rejected' });
  if (request.method === 'DELETE') return json(200, { success: true }, { 'Set-Cookie': sessionCookie(true) });
  if (!adminConfigured()) return json(503, { error: 'Administration is not configured' });
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) return json(415, { error: 'JSON required' });
  try {
    const { password } = JSON.parse(Buffer.from(await limitedBody(request, 2048)).toString('utf8'));
    if (!await verifyPassword(password)) return json(401, { error: 'Authentication failed' });
    return json(200, { authenticated: true }, { 'Set-Cookie': sessionCookie() });
  } catch { return json(400, { error: 'Invalid request' }); }
}
export const config = { path: '/.netlify/functions/admin-session', rateLimit: {
  windowLimit: 5, windowSize: 60, aggregateBy: ['ip', 'domain']
} };
