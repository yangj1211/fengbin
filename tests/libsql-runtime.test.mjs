import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fengbin-libsql-'));
const originalFetch = globalThis.fetch;
const originalTimeout = AbortSignal.timeout.bind(AbortSignal);
let sqlite;
try {
  for (const name of ['admin-auth', 'user-store', 'libsql-database']) {
    fs.writeFileSync(path.join(temp, `${name}.js`), ts.transpileModule(fs.readFileSync(`lib/${name}.ts`, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText);
  }
  fs.mkdirSync(path.join(temp, 'node_modules'), { recursive: true });
  fs.symlinkSync(path.resolve('node_modules/@libsql'), path.join(temp, 'node_modules/@libsql'), 'dir');
  const require = createRequire(path.join(temp, 'check.cjs'));
  const { createLibSqlDatabase } = require('./libsql-database.js');
  const { AccountError, UserStore, DEFAULT_ADMIN_ID } = require('./user-store.js');
  const { hashPassword, createUserSession, SESSION_TTL } = require('./admin-auth.js');
  const credentials = { databaseUrl: 'libsql://test-accounts.turso.io', authToken: 'test-only-turso-token' };
  const result = (rows = [], rowsAffected = 0) => ({ rows, rowsAffected });
  const isUnavailable = error => {
    assert.ok(error instanceof AccountError);
    assert.equal(error.status, 503);
    assert.equal(error.message, '账号服务暂时不可用，请稍后重试。');
    assert.equal(error.cause, undefined);
    assert.doesNotMatch(JSON.stringify(error) + error.message, /test-only|private|SELECT|UPDATE|INSERT|DELETE/);
    assert.doesNotMatch(error.stack, /test-only|private response|private name|private SQL/);
    return true;
  };

  // Configuration is checked before client construction, including libsql URL
  // overrides that could disable TLS or replace the server-side token.
  let factoryCalls = 0;
  const emptyFactory = () => { factoryCalls++; return { execute: async () => result() }; };
  for (const config of [undefined, null, {}, { ...credentials, databaseUrl: 7 }, { ...credentials, authToken: 7 }])
    assert.throws(() => createLibSqlDatabase(config, emptyFactory), isUnavailable);
  for (const databaseUrl of [
    '', '  ', 'not-a-url', 'file:/tmp/accounts.db', 'file::memory:', ':memory:',
    'http://test.example', 'ws://test.example', 'wss://test.example', 'ftp://test.example',
    'https:', 'https:test.example', 'libsql:test.example', 'libsql://', 'https://', 'https:///test.example',
    'https://private:password@test.example', 'https://test.example/#private',
    'libsql://test.example:8080?tls=0', 'libsql://test.example?authToken=private',
    'https://test.example?authToken=private', 'https://test.exa mple', 'https://test.example?', 'https://test.example#',
    'https://test.example\\@another.example', 'https://test.\nexample',
  ]) assert.throws(() => createLibSqlDatabase({ ...credentials, databaseUrl }, emptyFactory), isUnavailable);
  for (const authToken of ['', '  ', 'test-only\nprivate', 'test-only private'])
    assert.throws(() => createLibSqlDatabase({ ...credentials, authToken }, emptyFactory), isUnavailable);
  assert.equal(factoryCalls, 0, 'Invalid configuration must not construct a client');
  for (const databaseUrl of ['https://test-accounts.turso.io', credentials.databaseUrl]) {
    let received;
    createLibSqlDatabase({ databaseUrl: ` ${databaseUrl} `, authToken: ` ${credentials.authToken} ` }, config => {
      received = config;
      return { execute: async () => result() };
    });
    const { fetch: fetcher, ...clientConfig } = received;
    assert.deepEqual(clientConfig, { url: databaseUrl, authToken: credentials.authToken, intMode: 'number' });
    assert.equal(typeof fetcher, 'function');
  }
  for (const factory of [
    () => { throw new Error('test-only token private constructor response'); },
    () => null, () => ({}), () => ({ execute: 1 }),
  ]) assert.throws(() => createLibSqlDatabase(credentials, factory), isUnavailable);
  // Merely constructing the actual web client performs no network request.
  assert.equal(typeof createLibSqlDatabase(credentials).prepare, 'function');
  assert.ok(Object.keys(require.cache).every(file => !/[/\\]node_modules[/\\]libsql[/\\]|[/\\]@libsql[/\\]client[/\\]lib-cjs[/\\](?:node|sqlite3)\.js$/.test(file)),
    'The adapter must not load the native SQLite client');

  // The real HTTP deadline lives on fetch; libSQL's Config.timeout applies
  // only to local SQLite locks. No request in this test reaches a network.
  let outbound;
  let timedFetch;
  let timeoutController;
  AbortSignal.timeout = milliseconds => {
    assert.equal(milliseconds, 10_000);
    timeoutController = new AbortController();
    return timeoutController.signal;
  };
  globalThis.fetch = async (input, init) => { outbound = { input, init }; return new Response('{}'); };
  createLibSqlDatabase(credentials, config => {
    timedFetch = config.fetch;
    return { execute: async () => result() };
  });
  for (const abortSource of ['request', 'init', 'timeout']) {
    const requestController = new AbortController();
    const initController = new AbortController();
    const request = new Request('https://test-accounts.turso.io/v2/pipeline', {
      method: 'POST', body: 'test-only body', signal: requestController.signal,
    });
    await timedFetch(request, { signal: initController.signal, cache: 'force-cache', redirect: 'follow' });
    assert.equal(outbound.input, request);
    assert.equal(outbound.init.cache, 'no-store');
    assert.equal(outbound.init.redirect, 'error');
    assert.equal(outbound.init.signal.aborted, false);
    ({ request: requestController, init: initController, timeout: timeoutController })[abortSource].abort();
    assert.equal(outbound.init.signal.aborted, true, `${abortSource} cancellation reaches the HTTP request`);
  }
  globalThis.fetch = async () => { throw new Error('private HTTP response with test-only-turso-token'); };
  const transportFailureDb = createLibSqlDatabase(credentials, config => ({ execute: async () => {
    await config.fetch('https://test-accounts.turso.io/v2/pipeline');
    return result();
  } }));
  await assert.rejects(transportFailureDb.prepare('SELECT id FROM app_users').all(), isUnavailable);
  globalThis.fetch = originalFetch;
  AbortSignal.timeout = originalTimeout;

  const requests = [];
  const db = createLibSqlDatabase(credentials, () => ({ execute: async request => {
    requests.push(structuredClone(request));
    // A client must not be able to mutate the values of a reusable statement.
    request.args.length = 0;
    return result([{ id: 'row-1' }], 3);
  } }));
  const sql = 'SELECT * FROM app_users WHERE email = ? AND session_version = ? AND last_login_at IS ?';
  const injection = "name'; DROP TABLE app_users; --";
  const prepared = db.prepare(sql);
  const bound = prepared.bind(injection, 7, null);
  assert.deepEqual(await bound.first(), { id: 'row-1' });
  assert.deepEqual(await bound.all(), { results: [{ id: 'row-1' }] });
  assert.deepEqual(await bound.run(), { meta: { changes: 3 } });
  await prepared.run();
  await bound.bind('another-account', 9, null).run();
  assert.deepEqual(requests.slice(0, 3), Array.from({ length: 3 }, () => ({ sql, args: [injection, 7, null] })));
  assert.deepEqual(requests[3], { sql, args: [] }, 'Binding leaves the original statement unchanged');
  assert.deepEqual(requests[4], { sql, args: ['another-account', 9, null] });
  for (const value of [undefined, true, {}, [], 1n, Number.NaN, Infinity, -Infinity])
    assert.throws(() => prepared.bind(value), isUnavailable);
  for (const invalidSql of [undefined, null, 1, '', '  '])
    assert.throws(() => db.prepare(invalidSql), isUnavailable);
  assert.equal(await createLibSqlDatabase(credentials, emptyFactory).prepare('SELECT id FROM app_users').first(), null);

  // Provider, transport, malformed response, and uncertain write errors are
  // sanitized; a failed mutation is never retried by the adapter.
  const failures = [
    () => { throw new Error('Unauthorized test-only-turso-token; UPDATE private'); },
    () => { throw new DOMException('test-only private timeout', 'TimeoutError'); },
    () => { throw { message: 'private raw provider response', body: credentials.authToken }; },
    () => { throw 'private response'; },
    () => null, () => ({}), () => ({ rows: [], rowsAffected: '1' }),
    () => ({ rows: [], rowsAffected: Number.NaN }), () => ({ rows: [], rowsAffected: Infinity }),
    () => ({ rows: [], rowsAffected: -1 }), () => ({ rows: [], rowsAffected: 1.5 }),
    () => ({ rows: {}, rowsAffected: 1 }), () => ({ rows: [null], rowsAffected: 1 }),
    () => ({ rows: ['private response'], rowsAffected: 1 }),
    () => { throw new Error('UNIQUE constraint failed: app_users.email_backup; private'); },
    () => { throw new Error('duplicate column name: role_backup; private'); },
  ];
  for (const failure of failures) {
    let calls = 0;
    const failingDb = createLibSqlDatabase(credentials, () => ({ execute: async () => { calls++; return failure(); } }));
    await assert.rejects(failingDb.prepare('UPDATE app_users SET name = ?').bind('private name').run(), isUnavailable);
    assert.equal(calls, 1, 'Uncertain mutations must not be replayed automatically');
  }
  for (const message of ['UNIQUE constraint failed: app_users.email', 'duplicate column name: role']) {
    const failingDb = createLibSqlDatabase(credentials, () => ({ execute: async () => {
      throw new Error(`SQLITE_ERROR: ${message}; private SQL and test-only-turso-token`);
    } }));
    await assert.rejects(failingDb.prepare('INSERT INTO app_users VALUES (?)').bind('private password').run(), error => {
      assert.equal(error.message, message);
      assert.equal(error.cause, undefined);
      assert.doesNotMatch(error.stack, /private SQL|test-only-turso-token/);
      return true;
    });
  }

  // All account operations use the same adapter against an isolated SQLite
  // file. Closing and reopening it proves persistence across client lifetimes.
  const databasePath = path.join(temp, 'accounts.sqlite');
  sqlite = new DatabaseSync(databasePath);
  const sqliteFactory = () => ({ execute: async ({ sql: query, args }) => {
    const statement = sqlite.prepare(query);
    return /^(SELECT|PRAGMA)/i.test(query.trim())
      ? result(statement.all(...args))
      : result([], Number(statement.run(...args).changes));
  } });
  const storeDb = createLibSqlDatabase(credentials, sqliteFactory);
  const config = { username: 'test-admin-alias', passwordHash: await hashPassword('test-admin-password'), sessionSecret: 'test-only-session-secret-'.repeat(3) };
  const store = new UserStore(storeDb, config);
  await store.initialize();
  assert.equal((await store.get(DEFAULT_ADMIN_ID)).role, 'admin');
  assert.equal((await store.authenticate('test-admin-alias', 'test-admin-password')).id, DEFAULT_ADMIN_ID);
  const created = await store.add({ account: ' TEST-USER ', name: injection, password: 'test-user-password' });
  assert.equal(created.account, 'test-user');
  assert.equal(created.name, injection);
  assert.equal(created.role, 'user');
  assert.equal(created.passwordHash, undefined);
  assert.equal((await store.authenticate(' TEST-USER ', 'test-user-password')).id, created.id);
  assert.equal(await store.authenticate('test-user', 'wrong-password'), null);
  assert.equal(await store.authenticate('unknown-user', 'test-user-password'), null);
  await assert.rejects(store.add({ account: 'TEST-USER', password: 'another-password' }), error => error instanceof AccountError && error.status === 409);
  const previous = await store.get(created.id);
  assert.notEqual(previous.passwordHash, 'test-user-password');
  const token = await createUserSession(previous, config);
  assert.equal((await store.sessionUser(token)).id, created.id);
  const renamed = await store.update(created.id, { name: '新名称' }, DEFAULT_ADMIN_ID);
  assert.equal(renamed.credentialsChanged, false);
  assert.equal(renamed.roleChanged, false);
  assert.equal((await store.sessionUser(token)).name, '新名称');
  await assert.rejects(store.changePassword(created.id, 'wrong-password', 'updated-test-password'), error => error instanceof AccountError && error.status === 400);
  assert.equal((await store.sessionUser(token)).id, created.id);
  await store.changePassword(created.id, 'test-user-password', 'updated-test-password');
  assert.equal(await store.sessionUser(token), null, 'Password changes revoke previous sessions');
  assert.equal(await store.authenticate('test-user', 'test-user-password'), null);
  assert.equal((await store.authenticate('test-user', 'updated-test-password')).id, created.id);
  const passwordToken = await createUserSession(await store.get(created.id), config);
  const promoted = await store.update(created.id, { role: 'admin' }, DEFAULT_ADMIN_ID);
  assert.equal(promoted.roleChanged, true);
  assert.equal(promoted.credentialsChanged, false);
  assert.equal(await store.sessionUser(passwordToken), null, 'Role changes revoke previous sessions');
  await assert.rejects(store.update(created.id, { role: 'user' }, created.id), error => error.status === 403);
  await assert.rejects(store.update(DEFAULT_ADMIN_ID, { role: 'user' }, created.id), error => error.status === 403);
  const savedUser = await store.get(created.id);
  const savedAdmin = await store.get(DEFAULT_ADMIN_ID);
  const persistedToken = await createUserSession(savedUser, config);
  sqlite.close();
  sqlite = new DatabaseSync(databasePath);
  const secondStore = new UserStore(createLibSqlDatabase(credentials, sqliteFactory), config);
  await secondStore.initialize();
  assert.deepEqual(await secondStore.get(created.id), savedUser);
  assert.deepEqual(await secondStore.get(DEFAULT_ADMIN_ID), savedAdmin);
  assert.equal((await secondStore.list()).length, 2);
  assert.equal((await secondStore.sessionUser(persistedToken)).id, created.id);
  assert.equal(await secondStore.sessionUser(persistedToken, Math.floor(Date.now() / 1000) + SESSION_TTL), null);
  assert.equal(await secondStore.sessionUser(`${persistedToken}x`), null);
  await secondStore.update(created.id, { role: 'user' }, DEFAULT_ADMIN_ID);
  assert.equal(await secondStore.sessionUser(persistedToken), null);
  const removedToken = await createUserSession(await secondStore.get(created.id), config);
  await secondStore.remove(created.id, DEFAULT_ADMIN_ID);
  assert.equal(await secondStore.sessionUser(removedToken), null);
  assert.equal(await store.get(created.id), null);
  await assert.rejects(secondStore.remove(DEFAULT_ADMIN_ID, 'another-admin'), error => error.status === 403);

  // Verify an older table is upgraded in place, preserving its password and
  // session version while normalizing legacy email-style account names.
  sqlite.close();
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE app_users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL, is_default_admin INTEGER NOT NULL DEFAULT 0,
    session_version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, last_login_at TEXT
  )`);
  sqlite.prepare('INSERT INTO app_users (id, name, email, password_hash, session_version, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run('legacy-id', '旧用户', 'legacy@example.test', previous.passwordHash, 4, '2026-01-01T00:00:00.000Z');
  const legacyStore = new UserStore(createLibSqlDatabase(credentials, sqliteFactory), config);
  await legacyStore.initialize();
  const legacyUser = await legacyStore.get('legacy-id');
  assert.equal(legacyUser.role, 'user');
  assert.equal(legacyUser.account, 'legacy');
  assert.equal(legacyUser.passwordHash, previous.passwordHash);
  assert.equal(legacyUser.sessionVersion, 4);
  assert.equal((await legacyStore.authenticate('legacy', 'test-user-password')).id, 'legacy-id');
  await legacyStore.initialize();
  assert.equal((await legacyStore.list()).length, 2);
  console.log('libSQL runtime checks passed: remote configuration, bound parameters, sanitized failures, account and role lifecycle, session revocation, persistence, legacy migration.');
} finally {
  globalThis.fetch = originalFetch;
  AbortSignal.timeout = originalTimeout;
  sqlite?.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
