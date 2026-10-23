import test from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter } from '../netlify/lib/rate-limit.mjs';
import { createHandler as createLead } from '../netlify/functions/send-telegram.mjs';
import { createHandler as createSession } from '../netlify/functions/admin-session.mjs';

const request = new Request('https://flamingoauto.eu/api/lead');
const context = { ip: '192.0.2.1', deploy: { id: 'synthetic-deploy' } };
function memoryStore() {
  const entries = new Map();
  let sequence = 0;
  return {
    entries,
    async getWithMetadata(key, options) {
      assert.equal(options.consistency, 'strong');
      return structuredClone(entries.get(key) || null);
    },
    async setJSON(key, data, options) {
      const existing = entries.get(key);
      if ((options.onlyIfNew && existing) || (options.onlyIfMatch && existing?.etag !== options.onlyIfMatch)) return { modified: false };
      entries.set(key, { data: structuredClone(data), etag: String(++sequence) });
      return { modified: true };
    }
  };
}

test('concurrent function instances share exactly five accepted requests', async () => {
  const store = memoryStore();
  const instances = [createLimiter(() => store), createLimiter(() => store)];
  const responses = await Promise.all(Array.from({ length: 20 }, (_, i) => instances[i % 2](request, context, 'lead')));
  assert.equal(responses.filter(value => value === null).length, 5);
  assert.equal(responses.filter(value => value?.status === 429).length, 15);
  assert.ok(responses.find(value => value)?.headers.get('Retry-After'));
  assert.ok(!JSON.stringify([...store.entries]).includes(context.ip));
});

test('quota expires, prunes old counters and keeps endpoint groups independent', async () => {
  const store = memoryStore();
  let clock = 1000;
  const limit = createLimiter(() => store, () => clock);
  for (let i = 0; i < 5; i++) assert.equal(await limit(request, context, 'lead'), null);
  assert.equal((await limit(request, context, 'lead')).status, 429);
  assert.equal(await limit(request, context, 'login'), null);
  assert.equal(await limit(request, { ...context, ip: '192.0.2.2' }, 'lead'), null);
  clock += 60001;
  assert.equal(await limit(request, context, 'lead'), null);
  assert.equal(Object.keys(store.entries.get('lead').data.clients).length, 1);
});

test('request headers cannot forge the platform IP and missing context fails closed', async () => {
  const store = memoryStore();
  const limit = createLimiter(() => store);
  for (let i = 0; i < 5; i++) assert.equal(await limit(new Request(request, { headers: { 'x-forwarded-for': `198.51.100.${i}` } }), context, 'lead'), null);
  assert.equal((await limit(request, context, 'lead')).status, 429);
  assert.equal((await limit(request, {}, 'lead')).status, 503);
  assert.equal((await limit(request, context, 'unrecognized')).status, 503);
});

test('storage failures, corrupt data and exhausted write conflicts fail closed without leaking errors', async () => {
  for (const store of [
    { async getWithMetadata() { throw new Error('PRIVATE_STORAGE_ERROR'); } },
    { async getWithMetadata() { return { data: { version: 1, clients: [] } }; } },
    { async getWithMetadata() { return null; }, async setJSON() { return { modified: false }; } }
  ]) {
    const response = await createLimiter(() => store)(request, context, 'lead');
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes('PRIVATE_STORAGE_ERROR'));
  }
});

test('ledger capacity is bounded during traffic from distinct clients', async () => {
  const store = memoryStore();
  const limit = createLimiter(() => store, () => 1000);
  for (let i = 0; i < 1024; i++) assert.equal(await limit(request, { ...context, ip: `synthetic-${i}` }, 'lead'), null);
  assert.equal((await limit(request, context, 'lead')).status, 429);
  assert.equal(Object.keys(store.entries.get('lead').data.clients).length, 1024);
});

test('lead route invokes the shared limiter and aliases cannot consume it', async () => {
  const store = memoryStore();
  const handler = createLead({ limit: createLimiter(() => store) });
  assert.equal((await handler(new Request('https://flamingoauto.eu/.netlify/functions/send-telegram'), context)).status, 404);
  assert.equal(store.entries.size, 0);
  for (let i = 0; i < 5; i++) assert.equal((await handler(request, context)).status, 405);
  assert.equal((await handler(request, context)).status, 429);
});

test('login attempts are limited while session reads and logout remain available', async () => {
  const store = memoryStore();
  const handler = createSession({ limit: createLimiter(() => store) });
  const url = 'https://flamingoauto.eu/api/admin/session';
  for (let i = 0; i < 5; i++) await handler(new Request(url, { method: 'POST' }), context);
  assert.equal((await handler(new Request(url, { method: 'POST' }), context)).status, 429);
  assert.equal((await handler(new Request(url), context)).status, 401);
  assert.equal((await handler(new Request(url, { method: 'DELETE', headers: { origin: 'https://flamingoauto.eu' } }), context)).status, 200);
});
