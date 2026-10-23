import { createHmac, createHash, timingSafeEqual, scrypt as derive, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(derive);
export const COOKIE = '__Host-flamingo_admin';
const lifetime = 30 * 60;
export function json(status, value, extra = {}) {
  return new Response(JSON.stringify(value), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow', ...extra
  } });
}
export function allowedOrigins() {
  return (process.env.FLAMINGO_ALLOWED_ORIGINS || 'https://flamingoauto.eu')
    .split(',').map(value => value.trim()).filter(Boolean);
}
export function sameOrigin(request) {
  return allowedOrigins().includes(request.headers.get('origin')) &&
    request.headers.get('sec-fetch-site') !== 'cross-site';
}
export async function limitedBody(request, maximum) {
  if (Number(request.headers.get('content-length')) > maximum) throw new Error('BODY_LIMIT');
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maximum) { await reader.cancel(); throw new Error('BODY_LIMIT'); }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}
export function adminConfigured() {
  return /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(process.env.FLAMINGO_ADMIN_PASSWORD_HASH || '') &&
    (process.env.FLAMINGO_ADMIN_SESSION_SECRET || '').length >= 64;
}
export async function verifyPassword(password) {
  if (!adminConfigured() || typeof password !== 'string' || password.length < 16 || password.length > 256) return false;
  const [, salt, expected] = process.env.FLAMINGO_ADMIN_PASSWORD_HASH.split('$');
  const actual = await scrypt(password, Buffer.from(salt, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
function sign(payload) {
  return createHmac('sha256', process.env.FLAMINGO_ADMIN_SESSION_SECRET).update(payload).digest('base64url');
}
function passwordVersion() {
  return createHash('sha256').update(process.env.FLAMINGO_ADMIN_PASSWORD_HASH).digest('hex');
}
export function sessionCookie(clear = false) {
  let value = '';
  if (!clear) {
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + lifetime,
      version: passwordVersion(), nonce: randomBytes(16).toString('hex') })).toString('base64url');
    value = payload + '.' + sign(payload);
  }
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${clear ? 0 : lifetime}`;
}
export function authenticated(request) {
  if (!adminConfigured()) return false;
  try {
    const cookie = (request.headers.get('cookie') || '').split(';').map(value => value.trim())
      .find(value => value.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
    if (!cookie || cookie.length > 1500) return false;
    const parts = cookie.split('.');
    if (parts.length !== 2) return false;
    const [payload, signature] = parts;
    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(signature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    return session.version === passwordVersion() && Number.isInteger(session.exp) &&
      session.exp > now && session.exp <= now + lifetime;
  } catch { return false; }
}
export function adminGuard(request) {
  if (!authenticated(request)) return json(401, { error: 'Authentication required' });
  if (request.method !== 'GET' && !sameOrigin(request)) return json(403, { error: 'Origin rejected' });
  return null;
}
