import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createHandler as createStart, config as startConfig } from '../netlify/functions/start-lead.mjs';
import { createHandler as createFull } from '../netlify/functions/send-telegram.mjs';
import { createReceipt, readReceipt } from '../netlify/lib/lead-receipt.mjs';
import { createLimiter } from '../netlify/lib/rate-limit.mjs';

const origin = 'https://flamingoauto.eu';
const contact = { regNumber: '000 TEST', phone: '+3720000000' };
process.env.FLAMINGO_ALLOWED_ORIGINS = origin;
process.env.FLAMINGO_TELEGRAM_BOT_TOKEN = 'synthetic-lead-stages-key-' + randomBytes(16).toString('hex');
process.env.FLAMINGO_TELEGRAM_CHAT_ID = 'synthetic-test-destination';
process.env.FLAMINGO_TURNSTILE_SECRET_KEY = 'synthetic-test-turnstile-secret';
const originalFetch = globalThis.fetch;
test.after(() => { globalThis.fetch = originalFetch; });
let clock = Date.now();
const options = { limit: async () => null, now: () => clock };
const start = createStart(options);
const full = createFull(options);

function form(overrides = {}, details = false) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...contact, consent: 'contact',
    startedAt: String(clock - 10000), website: '', turnstileToken: 'synthetic-fresh-challenge',
    ...(details ? { name: '', email: '', city: '', note: 'Synthetic optional details' } : {}), ...overrides })) {
    if (value !== undefined) data.set(key, value);
  }
  return data;
}
function request(data, path = '/api/lead/start', requestOrigin = origin) {
  return new Request(origin + path, { method: 'POST', headers: { origin: requestOrigin }, body: data });
}
function mockServices({ challenge = true, action = 'flamingo-lead', hostname = 'flamingoauto.eu',
    bot = 'Flamingoauto_bot', photoFailure = false, editFailure = false, notModified = false } = {}) {
  const calls = [];
  globalThis.fetch = async (url, settings) => {
    const method = String(url).split('/').pop();
    calls.push({ method, body: settings.body });
    if (String(url) === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
      return Response.json({ success: challenge, hostname, action });
    }
    if (!String(url).startsWith('https://api.telegram.org/bot' + process.env.FLAMINGO_TELEGRAM_BOT_TOKEN + '/')) {
      throw new Error('Unexpected external request');
    }
    if (method === 'getMe') return Response.json({ ok: true, result: { is_bot: true, username: bot } });
    if (method === 'sendMessage') return Response.json({ ok: true, result: { message_id: 42 } });
    if (method === 'editMessageText') {
      if (notModified) return Response.json({ ok: false, error_code: 400, description: 'Bad Request: message is not modified' }, { status: 400 });
      return Response.json({ ok: !editFailure, result: { message_id: 42 } }, { status: editFailure ? 503 : 200 });
    }
    if (['sendPhoto', 'sendMediaGroup'].includes(method)) return Response.json({ ok: !photoFailure, result: [] });
    throw new Error('Unexpected external method');
  };
  return calls;
}
async function begin() {
  const response = await start(request(form()));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.success, true);
  assert.equal(typeof result.leadToken, 'string');
  return result.leadToken;
}

test('Contact step needs an explicit agreement and validates short fields before any service call', async () => {
  const calls = mockServices();
  for (const overrides of [
    { consent: undefined }, { consent: 'false' }, { consent: '' }, { regNumber: '' },
    { regNumber: 'x'.repeat(21) }, { regNumber: '000\nTEST' }, { phone: '' },
    { phone: '      ' }, { phone: '------' }, { phone: '123' }, { phone: 'phone-number' },
    { website: 'spam' }, { startedAt: '' }, { startedAt: String(clock) },
    { startedAt: String(clock - 3600001) }, { turnstileToken: '' }, { name: 'not-collected-at-first-step' }
  ]) assert.equal((await start(request(form(overrides)))).status, 400);
  for (const key of ['regNumber', 'phone', 'consent', 'turnstileToken', 'startedAt']) {
    const data = form();
    data.append(key, data.get(key));
    assert.equal((await start(request(data))).status, 400);
  }
  const data = form();
  data.append('photo0', new Blob(['synthetic-image'], { type: 'image/png' }), 'test.png');
  assert.equal((await start(request(data))).status, 400);
  assert.equal(calls.length, 0);
});

test('Start path has no default-function alias and rejects cross-origin, JSON and oversize submissions', async () => {
  const calls = mockServices();
  for (const path of ['/.netlify/functions/start-lead', '/api/lead', '/api/lead/start/']) {
    assert.equal((await start(request(form(), path))).status, 404);
  }
  assert.equal((await full(request(form(), '/api/lead/start'))).status, 404);
  assert.equal((await start(request(form(), undefined, 'https://example.invalid'))).status, 403);
  assert.equal((await start(new Request(origin + '/api/lead/start', {
    method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: '{}'
  }))).status, 415);
  assert.equal((await start(new Request(origin + '/api/lead/start', {
    method: 'POST', headers: { origin, 'Content-Type': 'multipart/form-data; boundary=test' },
    body: 'x'.repeat(5 * 1024 * 1024 + 1)
  }))).status, 413);
  assert.equal(calls.length, 0);
});

test('Both contact and detail stages enforce a fresh challenge and the exact Flamingo bot', async () => {
  for (const settings of [{ challenge: false }, { action: 'wrong-action' },
    { hostname: 'example.invalid' }, { bot: 'UnrelatedFinancialBot' }]) {
    const calls = mockServices(settings);
    assert.equal((await start(request(form()))).status, settings.bot ? 503 : 400);
    assert(!calls.some(call => call.method === 'sendMessage'));
    const receipt = createReceipt(42, contact, origin, clock);
    assert.equal((await full(request(form({ leadToken: receipt }, true), '/api/lead'))).status, settings.bot ? 503 : 400);
    assert(!calls.some(call => call.method === 'editMessageText'));
  }
});

test('Contact is delivered only after consent and the response is an authenticated opaque receipt', async () => {
  const calls = mockServices();
  const receipt = await begin();
  assert.deepEqual(calls.map(call => call.method), ['siteverify', 'getMe', 'sendMessage']);
  const body = JSON.parse(calls[2].body);
  assert(body.text.includes(contact.regNumber));
  assert(body.text.includes(contact.phone));
  assert(body.text.includes('Согласие:'));
  assert(body.text.includes('Подробности можно добавить'));
  assert(!body.parse_mode);
  assert.deepEqual(readReceipt(receipt, contact, origin, clock), { messageId: 42 });
  const decoded = Buffer.from(receipt, 'base64url').toString('utf8');
  for (const privateValue of [contact.regNumber, contact.phone, process.env.FLAMINGO_TELEGRAM_CHAT_ID,
    process.env.FLAMINGO_TELEGRAM_BOT_TOKEN]) assert(!receipt.includes(privateValue) && !decoded.includes(privateValue));
});

test('Receipt binding rejects changed contact, changed site, key rotation, malformed values and tampering', async () => {
  const receipt = createReceipt(42, contact, origin, clock);
  assert.deepEqual(readReceipt(receipt, { regNumber: '000   test', phone: '+372 000-0000' }, origin, clock), { messageId: 42 });
  for (const changed of [{ ...contact, regNumber: '111 TEST' }, { ...contact, phone: '+3720000001' }]) {
    assert.equal(readReceipt(receipt, changed, origin, clock), null);
  }
  assert.equal(readReceipt(receipt, contact, 'https://different.invalid', clock), null);
  for (const malformed of ['', null, 'a'.repeat(601), receipt + '=', receipt.slice(1),
    (receipt[0] === 'a' ? 'b' : 'a') + receipt.slice(1)]) assert.equal(readReceipt(malformed, contact, origin, clock), null);
  const saved = process.env.FLAMINGO_TELEGRAM_BOT_TOKEN;
  process.env.FLAMINGO_TELEGRAM_BOT_TOKEN = 'rotated-synthetic-receipt-key';
  assert.equal(readReceipt(receipt, contact, origin, clock), null);
  process.env.FLAMINGO_TELEGRAM_BOT_TOKEN = saved;
  const chat = process.env.FLAMINGO_TELEGRAM_CHAT_ID;
  process.env.FLAMINGO_TELEGRAM_CHAT_ID = 'different-synthetic-chat';
  assert.equal(readReceipt(receipt, contact, origin, clock), null);
  process.env.FLAMINGO_TELEGRAM_CHAT_ID = chat;
});

test('Receipts expire after one hour and invalid tokens never fall back to duplicate lead delivery', async () => {
  const calls = mockServices();
  const receipt = createReceipt(42, contact, origin, clock);
  assert.equal(readReceipt(receipt, contact, origin, clock + 3600000), null);
  assert.equal(readReceipt(receipt, contact, origin, clock - 1), null);
  assert.deepEqual(readReceipt(receipt, contact, origin, clock + 3599999), { messageId: 42 });
  const expired = createReceipt(42, contact, origin, clock - 3600000);
  for (const overrides of [{ leadToken: '' }, { leadToken: 'invalid' }, { leadToken: expired },
    { leadToken: expired, startedAt: String(clock - 3600001) },
    { leadToken: receipt, regNumber: '111 TEST' }, { leadToken: receipt, phone: '+3720000001' }]) {
    const response = await full(request(form(overrides, true), '/api/lead'));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'lead_receipt_invalid');
  }
  assert.equal(calls.length, 0);
});

test('Contact failures expose only fixed log categories and fail closed on incomplete setup', async () => {
  const originalWarn = console.warn;
  const records = [];
  const saved = process.env.FLAMINGO_TELEGRAM_BOT_TOKEN;
  console.warn = (...values) => records.push(values.join(' '));
  try {
    const calls = mockServices();
    delete process.env.FLAMINGO_TELEGRAM_BOT_TOKEN;
    assert.equal((await start(request(form()))).status, 503);
    assert.equal(calls.length, 0);
    process.env.FLAMINGO_TELEGRAM_BOT_TOKEN = saved;
    globalThis.fetch = async () => { throw new Error('sensitive-service-marker/' + saved); };
    const response = await start(request(form()));
    assert.equal(response.status, 503);
    const output = records.join('\n') + await response.text();
    for (const privateValue of [contact.phone, contact.regNumber, saved,
      process.env.FLAMINGO_TELEGRAM_CHAT_ID, 'sensitive-service-marker']) assert(!output.includes(privateValue));
    assert.deepEqual(records, ['FLAMINGO_LEAD_REJECTED configuration_incomplete', 'FLAMINGO_LEAD_REJECTED service_upstream']);
  } finally {
    process.env.FLAMINGO_TELEGRAM_BOT_TOKEN = saved;
    console.warn = originalWarn;
  }
});

test('Optional details update the original Telegram text without a second text lead or mandatory personal fields', async () => {
  const calls = mockServices();
  const receipt = await begin();
  const response = await full(request(form({ leadToken: receipt, note: '<b>plain text</b>' }, true), '/api/lead'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, photosSent: true });
  assert.deepEqual(calls.map(call => call.method), ['siteverify', 'getMe', 'sendMessage', 'siteverify', 'getMe', 'editMessageText']);
  const edit = JSON.parse(calls.at(-1).body);
  assert.equal(edit.message_id, 42);
  assert.equal(edit.chat_id, process.env.FLAMINGO_TELEGRAM_CHAT_ID);
  assert(edit.text.includes('<b>plain text</b>'));
  assert(!edit.parse_mode);
});

test('Receipt details still reject invalid provided fields, missing agreement and invalid photos', async () => {
  const calls = mockServices();
  const leadToken = createReceipt(42, contact, origin, clock);
  for (const overrides of [{ email: 'invalid' }, { note: 'x'.repeat(1201) }, { city: 'x'.repeat(101) },
    { consent: undefined }, { consent: 'false' }]) {
    assert.equal((await full(request(form({ leadToken, ...overrides }, true), '/api/lead'))).status, 400);
  }
  const data = form({ leadToken }, true);
  data.set('photo0', new Blob(['not an image'], { type: 'image/png' }), 'invalid.png');
  assert.equal((await full(request(data, '/api/lead'))).status, 400);
  assert.equal(calls.length, 0);
});

test('Detail photo failure preserves the updated text; unchanged edits are safe to retry', async () => {
  let calls = mockServices({ photoFailure: true });
  const leadToken = createReceipt(42, contact, origin, clock);
  const data = form({ leadToken }, true);
  data.set('photo0', new Blob([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0])], { type: 'image/png' }), 'synthetic.png');
  const response = await full(request(data, '/api/lead'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, photosSent: false });
  assert.equal(calls.filter(call => call.method === 'editMessageText').length, 1);
  assert.equal(calls.filter(call => call.method === 'sendMessage').length, 0);
  calls = mockServices({ notModified: true });
  assert.equal((await full(request(form({ leadToken }, true), '/api/lead'))).status, 200);
  assert(!calls.some(call => call.method === 'sendMessage'));
});

test('Failed edits return a safe failure and cannot create a duplicate or send photos', async () => {
  const calls = mockServices({ editFailure: true });
  const leadToken = createReceipt(42, contact, origin, clock);
  const response = await full(request(form({ leadToken }, true), '/api/lead'));
  assert.equal(response.status, 503);
  const responseText = await response.text();
  assert(!responseText.includes(leadToken));
  assert(!responseText.includes(process.env.FLAMINGO_TELEGRAM_BOT_TOKEN));
  assert.deepEqual(calls.map(call => call.method), ['siteverify', 'getMe', 'editMessageText']);
});

test('Cached standalone forms keep their old required fields and delivery contract', async () => {
  const calls = mockServices();
  assert.equal((await full(request(form({ consent: undefined }, true), '/api/lead'))).status, 400);
  const response = await full(request(form({ consent: undefined, name: 'Synthetic QA', email: 'qa@example.invalid', city: 'Tallinn' }, true), '/api/lead'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, photosSent: true });
  assert.equal(calls.filter(call => call.method === 'sendMessage').length, 1);
  assert(!calls.some(call => call.method === 'editMessageText'));
});

test('Both routes consume one shared five-per-minute quota and neither function alias bypasses it', async () => {
  const entries = new Map();
  let sequence = 0;
  const store = {
    async getWithMetadata(key) { return structuredClone(entries.get(key) || null); },
    async setJSON(key, data, condition) {
      const prior = entries.get(key);
      if ((condition.onlyIfNew && prior) || (condition.onlyIfMatch && prior?.etag !== condition.onlyIfMatch)) return { modified: false };
      entries.set(key, { data: structuredClone(data), etag: String(++sequence) });
      return { modified: true };
    }
  };
  const limit = createLimiter(() => store, () => clock);
  const handlers = [createStart({ limit }), createFull({ limit })];
  const context = { ip: '192.0.2.15', deploy: { id: 'synthetic-stages' } };
  assert.equal((await handlers[0](new Request(origin + '/.netlify/functions/start-lead'), context)).status, 404);
  assert.equal((await handlers[1](new Request(origin + '/.netlify/functions/send-telegram'), context)).status, 404);
  assert.equal(entries.size, 0);
  for (let i = 0; i < 5; i++) {
    assert.equal((await handlers[i % 2](new Request(origin + (i % 2 ? '/api/lead' : '/api/lead/start')), context)).status, 405);
  }
  assert.equal((await handlers[0](new Request(origin + '/api/lead/start'), context)).status, 429);
  assert.equal((await handlers[1](new Request(origin + '/api/lead'), context)).status, 429);
  assert.equal(entries.size, 1);
  assert(!JSON.stringify([...entries]).includes(context.ip));
  assert.equal(startConfig.path, '/api/lead/start');
  assert.equal(startConfig.rateLimit.windowLimit, 5);
  assert(startConfig.rateLimit.aggregateBy.includes('ip'));
});
