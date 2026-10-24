import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { createHandler as createLead, config as leadConfig } from '../netlify/functions/send-telegram.mjs';
import { createHandler as createSession } from '../netlify/functions/admin-session.mjs';
import posts from '../netlify/functions/admin-posts.mjs';
import publicConfig from '../netlify/functions/form-config.mjs';
import { authenticated, sessionCookie } from '../netlify/lib/security.mjs';

const origin = 'https://flamingoauto.eu';
const lead = createLead({ limit: async () => null });
const session = createSession({ limit: async () => null });
const testPassword = 'local-test-password-never-used-in-production';
const salt = randomBytes(16);
process.env.FLAMINGO_ALLOWED_ORIGINS = origin;
process.env.FLAMINGO_ADMIN_PASSWORD_HASH = `scrypt$${salt.toString('hex')}$${scryptSync(testPassword, salt, 64).toString('hex')}`;
process.env.FLAMINGO_ADMIN_SESSION_SECRET = randomBytes(32).toString('hex');
process.env.FLAMINGO_TELEGRAM_BOT_TOKEN = 'local-test-token';
process.env.FLAMINGO_TELEGRAM_CHAT_ID = 'local-test-chat';
process.env.FLAMINGO_TURNSTILE_SECRET_KEY = 'local-test-challenge-secret';
process.env.FLAMINGO_GITHUB_TOKEN = 'local-test-repository-key';
const originalFetch = globalThis.fetch;
function request(path, method = 'GET', body, cookie, requestOrigin = origin) {
  return new Request(origin + ({'send-telegram':'/api/lead','admin-session':'/api/admin/session','admin-posts':'/api/admin/posts','form-config':'/api/form-config'}[path] || '/api/' + path), { method,
    headers: { origin: requestOrigin, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
}
function leadRequest(overrides = {}, photos = [], requestOrigin = origin) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ regNumber: '000 TEST', name: 'Local QA',
    email: 'qa@example.invalid', phone: '+3720000000', city: 'Test city', note: '<b>plain text</b>',
    startedAt: String(Date.now() - 10000), turnstileToken: 'local-test-challenge', ...overrides })) data.set(key, value);
  photos.forEach((photo, i) => data.append('photo' + i, photo, 'synthetic.png'));
  return new Request(origin + '/api/lead', { method: 'POST', headers: { origin: requestOrigin }, body: data });
}
function mockServices({ bot = 'Flamingoauto_bot', challenge = true, hostname = 'flamingoauto.eu', action = 'flamingo-lead', photoFailure = false, messageFailure = false } = {}) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ method: String(url).split('/').pop(), options });
    if (String(url).includes('siteverify')) return Response.json({ success: challenge, hostname, action });
    if (String(url).endsWith('/getMe')) return Response.json({ ok: true, result: { username: bot, is_bot: true } });
    if (String(url).endsWith('/sendMessage')) return Response.json({ ok: !messageFailure, result: { message_id: 1 } });
    if (/sendPhoto|sendMediaGroup/.test(String(url))) return Response.json({ ok: !photoFailure, result: [] });
    throw new Error('Unexpected external request');
  };
  return calls;
}
test.after(() => { globalThis.fetch = originalFetch; });

test('Lead rejects cross-site, JSON bypass, missing fields and honeypot without contacting services', async () => {
  const calls = mockServices();
  assert.equal((await lead(leadRequest({}, [], 'https://example.invalid'))).status, 403);
  assert.equal((await lead(request('send-telegram', 'POST', {}))).status, 415);
  for (const overrides of [{ email: 'invalid' }, { name: '' }, { website: 'spam' }, { note: 'x'.repeat(1201) }, { startedAt: '' }, { startedAt: String(Date.now() + 10000) }, { turnstileToken: '' }]) {
    assert.equal((await lead(leadRequest(overrides))).status, 400);
  }
  assert.equal(calls.length, 0);
});
test('File count, signature and total request size are enforced server-side', async () => {
  const calls = mockServices();
  const fake = new Blob(['not an image'], { type: 'image/png' });
  assert.equal((await lead(leadRequest({}, [fake]))).status, 400);
  const png = new Blob([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0])], { type: 'image/png' });
  assert.equal((await lead(leadRequest({}, Array(7).fill(png)))).status, 400);
  const oversized = new Request(origin + '/api/lead', { method: 'POST', headers: { origin, 'Content-Type': 'multipart/form-data; boundary=test' }, body: 'x'.repeat(6 * 1024 * 1024) });
  assert.equal((await lead(oversized)).status, 413);
  assert.equal(calls.length, 0);
});
test('Challenge failure, wrong hostname or action never sends Telegram messages', async () => {
  for (const settings of [{ challenge: false }, { hostname: 'example.invalid' }, { action: 'wrong' }]) {
    const calls = mockServices(settings);
    assert.equal((await lead(leadRequest())).status, 400);
    assert.equal(calls.length, 1);
  }
});
test('Only the confirmed Flamingo bot can send, never another bot', async () => {
  const calls = mockServices({ bot: 'UnrelatedFinancialBot' });
  assert.equal((await lead(leadRequest())).status, 503);
  assert.deepEqual(calls.map(call => call.method), ['siteverify', 'getMe']);
});
test('Valid leads use plain text, six image attachments are supported, partial failures are visible', async () => {
  let calls = mockServices();
  let response = await lead(leadRequest());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, photosSent: true });
  const payload = JSON.parse(calls.find(call => call.method === 'sendMessage').options.body);
  assert(!payload.parse_mode);
  assert(payload.text.includes('<b>plain text</b>'));
  const png = new Blob([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0])], { type: 'image/png' });
  calls = mockServices();
  assert.equal((await lead(leadRequest({}, Array(6).fill(png)))).status, 200);
  assert(calls.some(call => call.method === 'sendMediaGroup'));
  calls = mockServices({ photoFailure: true });
  response = await lead(leadRequest({}, [png]));
  assert.deepEqual(await response.json(), { success: true, photosSent: false });
  assert.equal(calls.filter(call => call.method === 'sendMessage').length, 1);
});
test('Upstream failures and missing configuration fail closed without returning secrets', async () => {
  mockServices({ messageFailure: true });
  let response = await lead(leadRequest());
  assert.equal(response.status, 503);
  let text = await response.text();
  assert(!text.includes(process.env.FLAMINGO_TELEGRAM_BOT_TOKEN));
  globalThis.fetch = async () => { throw new Error('token-bearing-upstream-error'); };
  response = await lead(leadRequest());
  assert(!(await response.text()).includes('token-bearing-upstream-error'));
  const saved = process.env.FLAMINGO_TELEGRAM_BOT_TOKEN;
  delete process.env.FLAMINGO_TELEGRAM_BOT_TOKEN;
  assert.equal((await lead(leadRequest())).status, 503);
  process.env.FLAMINGO_TELEGRAM_BOT_TOKEN = saved;
});
test('Login checks server hash, issues secure short sessions, rejects tampering and rotation', async () => {
  assert.equal((await session(request('admin-session', 'POST', { password: 'wrong' }))).status, 401);
  assert.equal((await session(request('admin-session', 'POST', { password: testPassword }, null, 'https://example.invalid'))).status, 403);
  const response = await session(request('admin-session', 'POST', { password: testPassword }));
  assert.equal(response.status, 200);
  const cookieHeader = response.headers.get('set-cookie');
  for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Max-Age=1800']) assert(cookieHeader.includes(attribute));
  const cookie = cookieHeader.split(';')[0];
  assert(authenticated(request('admin-posts', 'GET', null, cookie)));
  assert(!authenticated(request('admin-posts', 'GET', null, cookie + 'tampered')));
  const savedHash = process.env.FLAMINGO_ADMIN_PASSWORD_HASH;
  process.env.FLAMINGO_ADMIN_PASSWORD_HASH = savedHash.slice(0, -1) + (savedHash.endsWith('0') ? '1' : '0');
  assert(!authenticated(request('admin-posts', 'GET', null, cookie)));
  process.env.FLAMINGO_ADMIN_PASSWORD_HASH = savedHash;
  assert((await session(request('admin-session', 'DELETE'))).headers.get('set-cookie').includes('Max-Age=0'));
});
test('Forged old bearer token and cross-site admin mutations are denied before any API request', async () => {
  const calls = mockServices();
  const fakeAuth = new Request(origin + '/api/admin/posts', { headers: { Authorization: 'Bearer arbitrary-client-string' } });
  assert.equal((await posts(fakeAuth)).status, 401);
  const cookie = sessionCookie().split(';')[0];
  assert.equal((await posts(request('admin-posts', 'POST', {}, cookie, 'https://example.invalid'))).status, 403);
  assert.equal((await posts(new Request(origin + '/api/admin/posts?id=../other-repo', { headers: { cookie } }))).status, 400);
  assert.equal(calls.length, 0);
});
test('Article edits preserve original photos, dates and metadata and fix repository scope', async () => {
  const oldPost = { id: 1758002610393, title: 'Old', content: 'Old content', locale: 'ru', created: '2025-01-01', photos: ['preserved-photo'], author: 'Original author' };
  let written;
  globalThis.fetch = async (url, options) => {
    assert(String(url).startsWith('https://api.github.com/repos/Vladislav9111/flamingoauto-site/contents/content/posts/'));
    if (options.method === 'PUT') { written = JSON.parse(options.body); return Response.json({ content: { sha: 'new-sha' } }); }
    return Response.json({ sha: 'current-sha', content: Buffer.from(JSON.stringify(oldPost)).toString('base64') });
  };
  const response = await posts(request('admin-posts', 'PUT', { id: '1758002610393', sha: 'current-sha', title: 'Updated', content: 'New content', excerpt: '', locale: 'ru' }, sessionCookie().split(';')[0]));
  assert.equal(response.status, 200);
  const saved = JSON.parse(Buffer.from(written.content, 'base64').toString('utf8'));
  assert.deepEqual(saved.photos, oldPost.photos);
  assert.equal(saved.created, oldPost.created);
  assert.equal(saved.author, oldPost.author);
});
test('All retired endpoints return 410 without side effects, including password reset', async () => {
  const calls = mockServices();
  const files = (await readdir(new URL('../netlify/functions/', import.meta.url))).filter(name => name.endsWith('.js'));
  assert(files.length > 10);
  for (const file of files) {
    const { handler } = await import('../netlify/functions/' + file);
    for (const httpMethod of ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']) assert.equal((await handler({ httpMethod, body: '{}' })).statusCode, 410);
    const source = await readFile(new URL('../netlify/functions/' + file, import.meta.url), 'utf8');
    assert(!source.includes('process.env') && !source.includes('fetch('));
  }
  assert.equal(calls.length, 0);
});
test('Distributed platform rate-limit declarations cover lead and login endpoints', async () => {
  assert.equal(leadConfig.path, '/api/lead');
  assert(leadConfig.rateLimit.windowLimit <= 5);
  const { config } = await import('../netlify/functions/admin-session.mjs');
  assert(config.rateLimit.aggregateBy.includes('ip'));
});
test('Public form settings expose only the public challenge key', async () => {
  const destination = process.env.FLAMINGO_TELEGRAM_CHAT_ID;
  process.env.FLAMINGO_TELEGRAM_CHAT_ID = '0000000';
  process.env.FLAMINGO_TURNSTILE_SITE_KEY = 'local-public-widget-key';
  const response = publicConfig(request('form-config'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { turnstileSiteKey: 'local-public-widget-key' });
  delete process.env.FLAMINGO_TURNSTILE_SITE_KEY;
  assert.equal(publicConfig(request('form-config')).status, 503);
  process.env.FLAMINGO_TELEGRAM_CHAT_ID = destination;
});
test('Masked or malformed setup values never enable the form or echo private values', async () => {
  const names = ['FLAMINGO_TURNSTILE_SITE_KEY', 'FLAMINGO_TURNSTILE_SECRET_KEY', 'FLAMINGO_TELEGRAM_BOT_TOKEN', 'FLAMINGO_TELEGRAM_CHAT_ID'];
  const original = names.map(name => process.env[name]);
  const synthetic = ['synthetic-public-key', 'synthetic-private-widget-secret', 'synthetic-private-bot-token', '0000000'];
  try {
    names.forEach((name, i) => { process.env[name] = synthetic[i]; });
    assert.equal(publicConfig(request('form-config')).status, 200);
    for (let i = 0; i < names.length; i++) {
      process.env[names[i]] = '**';
      const response = publicConfig(new Request('https://deploy-preview-1--mellifluous-moxie-db6fec.netlify.app/api/form-config'));
      assert.equal(response.status, 503);
      assert.match(response.headers.get('X-Flamingo-Setup-Valid'), /^[01]{4}$/);
      const text = await response.text();
      for (const privateValue of synthetic.slice(1)) assert(!text.includes(privateValue));
      process.env[names[i]] = synthetic[i];
    }
  } finally {
    names.forEach((name, i) => { if (original[i] === undefined) delete process.env[name]; else process.env[name] = original[i]; });
  }
});
test('Signed sessions expire and an unconfigured admin never accepts a legacy password', async () => {
  const realNow = Date.now;
  let expired;
  try { Date.now = () => realNow() - 31 * 60 * 1000; expired = sessionCookie().split(';')[0]; }
  finally { Date.now = realNow; }
  assert(!authenticated(request('admin-posts', 'GET', null, expired)));
  const saved = process.env.FLAMINGO_ADMIN_PASSWORD_HASH;
  delete process.env.FLAMINGO_ADMIN_PASSWORD_HASH;
  assert.equal((await session(request('admin-session', 'POST', { password: testPassword }))).status, 503);
  process.env.FLAMINGO_ADMIN_PASSWORD_HASH = saved;
});
test('Preview setup diagnostics disclose only presence bits and stay absent on other hosts', async () => {
  const response = publicConfig(new Request('https://deploy-preview-1--mellifluous-moxie-db6fec.netlify.app/api/form-config'));
  assert.equal(response.status, 503);
  assert.match(response.headers.get('X-Flamingo-Setup'), /^[01]{4}$/);
  const serialized = JSON.stringify([...response.headers]) + await response.text();
  for (const name of ['FLAMINGO_TURNSTILE_SECRET_KEY', 'FLAMINGO_TELEGRAM_BOT_TOKEN', 'FLAMINGO_TELEGRAM_CHAT_ID']) {
    assert(!serialized.includes(process.env[name]));
  }
  for (const host of ['flamingoauto.eu', 'deploy-preview-1--mellifluous-moxie-db6fec.netlify.app.evil.invalid']) {
    assert.equal(publicConfig(new Request(`https://${host}/api/form-config`)).headers.get('X-Flamingo-Setup'), null);
    assert.equal(publicConfig(new Request(`https://${host}/api/form-config`)).headers.get('X-Flamingo-Setup-Valid'), null);
  }
  assert.equal(response.headers.get('Cross-Origin-Resource-Policy'), 'same-origin');
});
test('Default function aliases cannot bypass the protected custom API routes', async () => {
  const calls = mockServices();
  for (const [name, handler] of [['send-telegram', lead], ['admin-session', session], ['admin-posts', posts], ['form-config', publicConfig]]) {
    const response = await handler(new Request(origin + '/.netlify/functions/' + name));
    assert.equal(response.status, 404);
  }
  assert.equal(calls.length, 0);
});
