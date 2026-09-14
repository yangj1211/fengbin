import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fengbin-d1-http-'));
const environmentNames = ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_D1_DATABASE_ID', 'CLOUDFLARE_D1_API_TOKEN', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'VERCEL'];
const originalEnvironment = Object.fromEntries(environmentNames.map(name => [name, process.env[name]]));
let sqlite;
try {
  for (const name of ['admin-auth', 'user-store', 'account-http', 'd1-http-database', 'libsql-database', 'account-runtime-node', 'admin-server']) {
    const source = fs.readFileSync(`lib/${name}.ts`, 'utf8')
      .replace("'./account-runtime'", "'./account-runtime-node'");
    fs.writeFileSync(path.join(temp, `${name}.js`), ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText);
  }
  fs.mkdirSync(path.join(temp, 'node_modules/next'), { recursive: true });
  fs.symlinkSync(path.resolve('node_modules/@libsql'), path.join(temp, 'node_modules/@libsql'), 'dir');
  fs.writeFileSync(path.join(temp, 'node_modules/next/headers.js'), 'exports.cookies = async () => ({ get: () => undefined });');
  const require = createRequire(path.join(temp, 'check.cjs'));
  const { createD1HttpDatabase } = require('./d1-http-database.js');
  const { AccountError, UserStore, DEFAULT_ADMIN_ID } = require('./user-store.js');
  const { hashPassword, createUserSession } = require('./admin-auth.js');
  const { accountError, authClientKey, authAttempt, authSucceeded } = require('./account-http.js');
  const runtime = require('./account-runtime-node.js');
  const server = require('./admin-server.js');
  const credentials = { accountId: 'test-account', databaseId: 'test-database', apiToken: 'test-only-api-token' };
  const success = (results = [], changes = 0) => Response.json({ success: true, result: [{ success: true, results, meta: { changes } }] });
  const isUnavailable = error => error instanceof AccountError && error.status === 503;

  // Missing credentials fail closed before any outbound request. An anonymous
  // page read remains possible so a misconfigured deployment can show login.
  for (const name of environmentNames) delete process.env[name];
  assert.throws(() => runtime.accountDatabase(), isUnavailable);
  assert.equal(await server.currentUser(), null);
  process.env.CLOUDFLARE_ACCOUNT_ID = credentials.accountId;
  process.env.CLOUDFLARE_D1_DATABASE_ID = credentials.databaseId;
  process.env.CLOUDFLARE_D1_API_TOKEN = credentials.apiToken;
  assert.equal(typeof runtime.accountDatabase().prepare, 'function');
  process.env.TURSO_DATABASE_URL = 'https://test-accounts.turso.io';
  assert.throws(() => runtime.accountDatabase(), isUnavailable, 'Partial Turso configuration must not silently use another database');
  process.env.TURSO_AUTH_TOKEN = 'test-only-turso-token';
  assert.equal(typeof runtime.accountDatabase().prepare, 'function');
  process.env.TURSO_DATABASE_URL = 'file:/tmp/not-a-remote-account-database';
  assert.throws(() => runtime.accountDatabase(), isUnavailable);
  for (const name of environmentNames) delete process.env[name];
  for (const missing of Object.keys(credentials)) {
    assert.throws(() => createD1HttpDatabase({ ...credentials, [missing]: '' }), isUnavailable);
  }
  assert.throws(() => createD1HttpDatabase({ ...credentials, apiToken: '  ' }), isUnavailable);

  const requests = [];
  const db = createD1HttpDatabase(credentials, async (url, init) => {
    requests.push({ url, init });
    return success([{ id: 'row-1' }], 3);
  });
  const sql = 'SELECT * FROM app_users WHERE email = ? AND session_version = ? AND last_login_at IS ?';
  const prepared = db.prepare(sql);
  const bound = prepared.bind("name'; DROP TABLE app_users; --", 7, null);
  assert.deepEqual(await bound.first(), { id: 'row-1' });
  assert.deepEqual(await bound.all(), { results: [{ id: 'row-1' }] });
  assert.equal((await bound.run()).meta.changes, 3);
  await prepared.run();
  assert.deepEqual(JSON.parse(requests[0].init.body), { sql, params: ["name'; DROP TABLE app_users; --", 7, null] });
  assert.deepEqual(JSON.parse(requests[3].init.body).params, [], 'Binding does not mutate the original statement');
  assert.equal(requests[0].url, 'https://api.cloudflare.com/client/v4/accounts/test-account/d1/database/test-database/query');
  assert.equal(requests[0].init.headers.Authorization, 'Bearer test-only-api-token');
  assert.equal(requests[0].init.cache, 'no-store');
  assert.equal(requests[0].init.redirect, 'error');
  assert.ok(requests[0].init.signal instanceof AbortSignal);
  assert.throws(() => prepared.bind(undefined), TypeError);
  assert.throws(() => prepared.bind(Number.NaN), TypeError);
  assert.equal(await createD1HttpDatabase(credentials, async () => success()).prepare('SELECT id FROM app_users').first(), null);

  // HTTP errors, successful envelopes containing failed SQL, malformed data,
  // and uncertain network failures must never be reported as successful writes.
  const failures = [
    () => Response.json({ success: false, errors: [{ message: 'Unauthorized test-only-api-token' }] }, { status: 401 }),
    () => Response.json({ success: false, errors: [{ message: 'database unavailable' }] }),
    () => Response.json({ success: true, result: [{ success: false, error: 'SQL failure with private values' }] }),
    () => Response.json({ success: true, result: [{ success: true, results: [], meta: {} }] }),
    () => Response.json({ success: true, result: [] }),
    () => new Response('not JSON'),
    () => { throw new Error('network error with test-only-api-token'); },
    () => { throw new DOMException('timed out', 'TimeoutError'); },
  ];
  for (const failure of failures) {
    let calls = 0;
    const failingDb = createD1HttpDatabase(credentials, async () => { calls++; return failure(); });
    await assert.rejects(failingDb.prepare('UPDATE app_users SET name = ?').bind('private name').run(), error => {
      assert.ok(isUnavailable(error));
      assert.doesNotMatch(error.message, /private|SQL|test-only-api-token/);
      return true;
    });
    assert.equal(calls, 1, 'Uncertain mutations must not be replayed automatically');
  }
  const duplicateDb = createD1HttpDatabase(credentials, async () => Response.json({ success: false, errors: [{
    message: 'UNIQUE constraint failed: app_users.email; SQL values: private password',
  }] }));
  await assert.rejects(duplicateDb.prepare('INSERT INTO app_users VALUES (?)').bind('secret').run(), {
    message: 'UNIQUE constraint failed: app_users.email',
  });
  const migrationDb = createD1HttpDatabase(credentials, async () => Response.json({ success: true, result: [{
    success: false, error: 'duplicate column name: role; private SQL',
  }] }));
  await assert.rejects(migrationDb.prepare('ALTER TABLE app_users ADD COLUMN role TEXT').run(), {
    message: 'duplicate column name: role',
  });
  assert.equal(accountError(new Error('private SQL')).status, 503);

  // Exercise account persistence and session revocation through the REST
  // envelope using an isolated SQLite database, never a real Cloudflare DB.
  sqlite = new DatabaseSync(':memory:');
  const storeDb = createD1HttpDatabase(credentials, async (_url, init) => {
    const { sql: query, params } = JSON.parse(init.body);
    try {
      const statement = sqlite.prepare(query);
      return /^(SELECT|PRAGMA)/i.test(query.trim())
        ? success(statement.all(...params))
        : success([], Number(statement.run(...params).changes));
    } catch (error) {
      return Response.json({ success: false, errors: [{ message: error.message }] });
    }
  });
  const config = { username: 'admin', passwordHash: await hashPassword('test-admin-password'), sessionSecret: 'test-only-session-secret-'.repeat(3) };
  const store = new UserStore(storeDb, config);
  await store.initialize();
  assert.equal((await store.get(DEFAULT_ADMIN_ID)).role, 'admin');
  const created = await store.add({ account: 'test-user', name: '测试用户', password: 'test-user-password' });
  assert.equal((await store.authenticate('test-user', 'test-user-password')).id, created.id);
  await assert.rejects(store.add({ account: 'test-user', password: 'another-password' }), error => error instanceof AccountError && error.status === 409);
  const previous = await store.get(created.id);
  const token = await createUserSession(previous, config);
  assert.equal((await store.sessionUser(token)).id, created.id);
  await store.update(created.id, { password: 'updated-test-password' }, DEFAULT_ADMIN_ID);
  assert.equal(await store.sessionUser(token), null);
  assert.equal((await store.authenticate('test-user', 'updated-test-password')).id, created.id);
  const secondStore = new UserStore(storeDb, config);
  await secondStore.initialize();
  assert.equal((await secondStore.list()).length, 2, 'Reinitialization preserves account records');
  await secondStore.remove(created.id, DEFAULT_ADMIN_ID);
  assert.equal(await store.get(created.id), null);

  const request = headers => new Request('https://test.example/api/auth/login', { headers });
  delete process.env.VERCEL;
  assert.equal(authClientKey(request({ 'cf-connecting-ip': '192.0.2.1', 'x-vercel-forwarded-for': '192.0.2.2' })), '192.0.2.1');
  assert.equal(authClientKey(request({ 'x-forwarded-for': '192.0.2.5' })), 'unknown');
  process.env.VERCEL = '1';
  assert.equal(authClientKey(request({ 'x-vercel-forwarded-for': '192.0.2.2', 'cf-connecting-ip': 'spoofed', 'x-forwarded-for': 'spoofed' })), '192.0.2.2');
  assert.equal(authClientKey(request({ 'x-vercel-forwarded-for': '2001:DB8::1' })), '2001:db8::1');
  assert.equal(authClientKey(request({ 'x-vercel-forwarded-for': 'spoofed, 192.0.2.2' })), 'unknown');
  assert.equal(authClientKey(request({ 'x-forwarded-for': '192.0.2.5', 'cf-connecting-ip': '192.0.2.6' })), 'unknown');
  for (let index = 0; index < 6; index++) authAttempt(request({ 'x-vercel-forwarded-for': '192.0.2.20' }));
  assert.throws(() => authAttempt(request({ 'x-vercel-forwarded-for': '192.0.2.20' })), error => error.status === 429);
  assert.equal(authAttempt(request({ 'x-vercel-forwarded-for': '192.0.2.21' })), '192.0.2.21', 'Different Vercel clients have separate backoff counters');
  authSucceeded('192.0.2.20');
  authSucceeded('192.0.2.21');
  console.log('D1 HTTP runtime checks passed: binding, failure handling, account lifecycle, missing configuration, platform IP trust.');
} finally {
  sqlite?.close();
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  fs.rmSync(temp, { recursive: true, force: true });
}
