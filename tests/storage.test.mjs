import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionStore, memoryBackend } from '../dist/storage.mjs';
import { CURRENT_KEY, SEQ_KEY, seedRecords, sessionKey } from '../dist/schema.mjs';
import { applyNavEvent, createSession } from '../dist/model.mjs';

function demoSession(t0 = 1_000_000) {
  const s = createSession(t0);
  applyNavEvent(s, { url: 'https://a.com/', sourceUrl: null, time: t0, transition: 'typed' });
  applyNavEvent(s, { url: 'https://b.com/', sourceUrl: 'https://a.com/', time: t0 + 100, transition: 'link' });
  return s;
}

const flush = () => new Promise((r) => setImmediate(r));

test('saveSession maintains the index: insert once, update in place', async () => {
  const store = createSessionStore(memoryBackend());
  const s = demoSession();
  await store.saveSession(s);
  assert.deepEqual(await store.loadIndex(), [{ id: s.id, start: s.start, end: s.end, pages: 2 }]);

  applyNavEvent(s, { url: 'https://c.com/', sourceUrl: 'https://b.com/', time: s.end + 50, transition: 'link' });
  await store.saveSession(s);
  const index = await store.loadIndex();
  assert.equal(index.length, 1);
  assert.equal(index[0].pages, 3);
  assert.deepEqual(await store.loadSession(s.id), s);
});

test('every saveSession bumps the storage-visible write sequence (the drain signal)', async () => {
  const backend = memoryBackend();
  const store = createSessionStore(backend);
  const s = demoSession();
  await store.saveSession(s);
  await store.saveSession(s);
  const st = await backend.local.get(SEQ_KEY);
  assert.equal(st[SEQ_KEY], 2);
});

test('currentSessionId round-trips and defaults to null', async () => {
  const store = createSessionStore(memoryBackend());
  assert.equal(await store.currentSessionId(), null);
  await store.setCurrentSessionId('42');
  assert.equal(await store.currentSessionId(), '42');
});

test('tab state lives in the session area and round-trips', async () => {
  const store = createSessionStore(memoryBackend());
  assert.deepEqual(await store.loadTabState(), { urls: {}, openers: {} });
  await store.saveTabState({ urls: { 7: 'https://a.com/' }, openers: { 9: 'https://a.com/' } });
  assert.deepEqual(await store.loadTabState(), { urls: { 7: 'https://a.com/' }, openers: { 9: 'https://a.com/' } });
});

test('clearAllData wipes both areas', async () => {
  const backend = memoryBackend();
  const store = createSessionStore(backend);
  await store.saveSession(demoSession());
  await store.saveTabState({ urls: { 1: 'https://a.com/' }, openers: {} });
  await store.clearAllData();
  assert.deepEqual(await backend.local.get(null), {});
  assert.deepEqual(await store.loadTabState(), { urls: {}, openers: {} });
});

// The background writes currentSessionId BEFORE the session data. That
// ordering fact lives inside the store: onCurrentSession must hold delivery
// until the session is actually loadable, and deliver exactly once.
test('onCurrentSession waits out the current-before-data write order', async () => {
  const backend = memoryBackend();
  const store = createSessionStore(backend);
  const s = demoSession();
  const delivered = [];
  store.onSessionsChanged({ onCurrentSession: (x) => delivered.push(x) });

  await backend.local.set({ [CURRENT_KEY]: s.id }); // step 1: pointer, no data yet
  await flush();
  assert.equal(delivered.length, 0, 'not delivered while the data is missing');

  await store.saveSession(s); // step 2: data lands
  await flush();
  assert.equal(delivered.length, 1);
  assert.deepEqual(delivered[0], s);

  await store.saveSession(s); // later writes are content updates, not adoptions
  await flush();
  assert.equal(delivered.length, 1);
});

test('onCurrentSession fires immediately when the session is already loadable', async () => {
  const backend = memoryBackend();
  const store = createSessionStore(backend);
  const s = demoSession();
  await store.saveSession(s);
  const delivered = [];
  store.onSessionsChanged({ onCurrentSession: (x) => delivered.push(x) });
  await store.setCurrentSessionId(s.id);
  await flush();
  assert.equal(delivered.length, 1);
  assert.deepEqual(delivered[0], s);
});

test('onSession streams content updates; onIndex streams the index', async () => {
  const backend = memoryBackend();
  const store = createSessionStore(backend);
  const s = demoSession();
  const sessions = [];
  const indexes = [];
  store.onSessionsChanged({ onSession: (x) => sessions.push(x), onIndex: (x) => indexes.push(x) });
  await store.saveSession(s);
  await flush();
  assert.equal(sessions.length, 1);
  assert.deepEqual(sessions[0], s);
  assert.equal(indexes.length, 1);
  assert.equal(indexes[0][0].id, s.id);
});

// Seeding goes through the same door: what seedRecords writes, the store reads.
test('seedRecords produces state the store loads as its own', async () => {
  const backend = memoryBackend();
  const store = createSessionStore(backend);
  const s = demoSession();
  await backend.local.set(seedRecords(s));
  assert.equal(await store.currentSessionId(), s.id);
  assert.deepEqual(await store.loadSession(s.id), s);
  assert.deepEqual(await store.loadIndex(), [{ id: s.id, start: s.start, end: s.end, pages: 2 }]);
  assert.ok(seedRecords(s)[sessionKey(s.id)], 'seed uses the schema key');
});
