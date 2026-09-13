import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fengbin-accounts-test-'));
let sqlite;
const transpile = (source, target) => fs.writeFileSync(path.join(temp, `${target}.js`), ts.transpileModule(
  source.replaceAll("@/lib/", './'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } },
).outputText);
const adapter = db => ({ prepare(sql) {
  const statement = db.prepare(sql);
  const wrap = values => ({
    bind: (...args) => wrap(args),
    first: async () => statement.get(...values) ?? null,
    all: async () => ({ results: statement.all(...values) }),
    run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } }),
  });
  return wrap([]);
} });
try {
  for (const name of ['admin-auth', 'user-store', 'account-http'])
    transpile(fs.readFileSync(`lib/${name}.ts`, 'utf8'), name);
  for (const name of ['login', 'session', 'logout', 'password'])
    transpile(fs.readFileSync(`app/api/auth/${name}/route.ts`, 'utf8'), `${name}-route`);
  transpile(fs.readFileSync('app/api/users/route.ts', 'utf8'), 'users-route');
  transpile(fs.readFileSync('app/api/users/[id]/route.ts', 'utf8'), 'user-route');
  transpile(fs.readFileSync('app/[...path]/page.tsx', 'utf8')
    .replace("'../workspace'", "'./workspace'")
    .replace("'../application/workspace-path'", "'./workspace-path'"), 'protected-page');
  transpile(fs.readFileSync('app/application/workspace-path.ts', 'utf8'), 'workspace-path');
  fs.writeFileSync(path.join(temp, 'admin-server.js'), `
    let store, config, token;
    exports.configure = (s, c) => { store = s; config = c; };
    exports.setToken = (t) => { token = t; };
    exports.adminConfig = () => config;
    exports.userStore = async () => store;
    exports.currentUser = async () => store.sessionUser(token);
  `);
  fs.mkdirSync(path.join(temp, 'node_modules/react'), {recursive:true});
  fs.mkdirSync(path.join(temp, 'node_modules/next'), {recursive:true});
  fs.writeFileSync(path.join(temp, 'node_modules/react/jsx-runtime.js'), 'exports.jsx = (type, props) => ({type,props});');
  fs.writeFileSync(path.join(temp, 'node_modules/next/navigation.js'), "exports.redirect = path => {throw new Error('redirect:'+path)}; exports.notFound = () => {throw new Error('notFound')};");
  fs.writeFileSync(path.join(temp, 'workspace.js'), 'module.exports = function Workspace() {};');
  const require = createRequire(path.join(temp, 'check.cjs'));
  const auth = require('./admin-auth.js');
  const { UserStore, DEFAULT_ADMIN_ID, DEFAULT_ADMIN_ACCOUNT, publicUser } = require('./user-store.js');
  const server = require('./admin-server.js');
  const routes = Object.fromEntries(['login', 'session', 'logout', 'password', 'users', 'user'].map(name => [name, require(`./${name}-route.js`)]));
  const page = require('./protected-page.js');
  const { accountPayload } = require('./account-http.js');
  const databaseFile = path.join(temp, 'accounts.sqlite');
  const defaultPassword = 'default-test-password';
  const config = { username:'admin', passwordHash:await auth.hashPassword(defaultPassword), sessionSecret:'test-only-session-secret-'.repeat(3) };
  sqlite = new DatabaseSync(databaseFile);
  // Exercise migration from the existing pre-role schema without replacing any account.
  sqlite.exec(`CREATE TABLE app_users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL, is_default_admin INTEGER NOT NULL DEFAULT 0,
    session_version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, last_login_at TEXT
  )`);
  const legacyHash = await auth.hashPassword('legacy-password');
  sqlite.prepare('INSERT INTO app_users (id,name,email,password_hash,is_default_admin,created_at) VALUES (?,?,?,?,?,?)')
    .run(DEFAULT_ADMIN_ID,'管理员','admin@example.com',config.passwordHash,1,'2020-01-01T00:00:00.000Z');
  sqlite.prepare('INSERT INTO app_users (id,name,email,password_hash,created_at) VALUES (?,?,?,?,?)')
    .run('legacy-user','原有用户','legacy@example.com',legacyHash,'2021-01-01T00:00:00.000Z');
  let store = new UserStore(adapter(sqlite),config);
  await store.initialize();
  server.configure(store,config);
  const request = (url,payload,method='POST',origin='https://app.example') => new Request(`https://app.example${url}`,{
    method,headers:{origin,'content-type':'application/json'},...(payload===undefined?{}:{body:JSON.stringify(payload)}),
  });
  const context = id => ({params:Promise.resolve({id})});
  const read = async response => ({status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')});
  const tokenFrom = cookie => cookie.split(';')[0].split('=').slice(1).join('=');
  const loginAs = async (account,password) => {
    const response = await read(await routes.login.POST(request('/api/auth/login',{account,password})));
    assert.equal(response.status,200,response.body.error);
    const token = tokenFrom(response.cookie);server.setToken(token);
    return {token,...response};
  };
  const patch = (id,payload) => routes.user.PATCH(request(`/api/users/${id}`,payload,'PATCH'),context(id)).then(read);
  const remove = id => routes.user.DELETE(request(`/api/users/${id}`,undefined,'DELETE'),context(id)).then(read);
  const password = payload => routes.password.POST(request('/api/auth/password',payload)).then(read);
  const renderProtected = async pathname => {
    const element = page.default({params:Promise.resolve({path:pathname.slice(1).split('/')})});
    return element.type(element.props);
  };

  assert.equal((await store.list()).length,2);
  assert.equal((await store.get(DEFAULT_ADMIN_ID)).role,'admin');
  assert.equal((await store.get(DEFAULT_ADMIN_ID)).account,'admin');
  assert.equal((await store.get('legacy-user')).role,'user');
  assert.equal((await store.get('legacy-user')).account,'legacy');
  assert.equal((await store.get('legacy-user')).passwordHash,legacyHash,'Migration preserves existing credentials');
  assert.equal((await store.get(DEFAULT_ADMIN_ID)).createdAt,'2020-01-01T00:00:00.000Z');
  sqlite.prepare("UPDATE app_users SET role = 'user' WHERE id = ?").run(DEFAULT_ADMIN_ID);
  await store.initialize();
  assert.equal((await store.get(DEFAULT_ADMIN_ID)).role,'admin','Initialization completes an interrupted role migration');
  assert.equal((await store.list()).length,2,'Users can only be created by an administrator');
  assert.equal((await read(await routes.users.GET())).status,401);
  assert.equal((await password({oldPassword:'anything',newPassword:'12345678'})).status,401);
  assert.equal((await read(await routes.session.GET())).body.authenticated,false);
  await assert.rejects(renderProtected('/data'),/redirect:\/login/);
  assert.equal(await store.authenticate('missing-account',defaultPassword),null);

  const owner = await loginAs('admin',defaultPassword);
  assert.equal(owner.body.user.role,'admin');
  assert.match(owner.cookie,/HttpOnly; SameSite=Strict; Max-Age=28800; Secure/);
  assert.equal((await store.authenticate(DEFAULT_ADMIN_ACCOUNT,defaultPassword)).id,DEFAULT_ADMIN_ID);
  assert.ok(await renderProtected('/data'));
  assert.ok(await renderProtected('/users'));
  const created = await read(await routes.users.POST(request('/api/users',{account:' New.User ',password:' 12345678 '})));
  assert.equal(created.status,201);
  const userId=created.body.user.id;
  assert.equal(created.body.user.role,'user');
  assert.equal(created.body.user.name,'new.user');
  assert.equal(created.body.user.account,'new.user');
  assert.equal(created.body.user.lastLoginAt,null);
  assert.equal(created.body.user.passwordHash,undefined);
  assert.equal(created.body.user.sessionVersion,undefined);
  assert.equal((await store.list())[0].id,userId,'New accounts precede older records');
  assert.equal((await read(await routes.users.POST(request('/api/users',{account:'NEW.USER',password:'12345678'})))).status,409);
  assert.equal((await read(await routes.users.POST(request('/api/users',{account:'invalid-role',password:'12345678',role:'root'})))).status,400);
  const adminCreated=await read(await routes.users.POST(request('/api/users',{name:'另一管理员',account:'second-admin',password:'second-password',role:'admin'})));
  assert.equal(adminCreated.status,201);
  const secondId=adminCreated.body.user.id;
  assert.equal(adminCreated.body.user.role,'admin');
  assert.equal((await store.list())[0].id,secondId);

  assert.equal(await store.authenticate('new.user','12345678'),null,'Password whitespace is preserved');
  let ordinary=await loginAs('NEW.USER',' 12345678 ');
  assert.equal(ordinary.body.user.role,'user');
  assert.equal((await read(await routes.session.GET())).body.user.id,userId);
  assert.equal((await read(await routes.users.GET())).status,403);
  assert.equal((await read(await routes.users.POST(request('/api/users',{account:'escape',password:'12345678',role:'admin'})))).status,403);
  assert.equal((await patch(userId,{role:'admin'})).status,403);
  assert.equal((await patch(DEFAULT_ADMIN_ID,{password:'intruder-password'})).status,403);
  assert.equal((await remove(secondId)).status,403);
  for(const path of ['/data','/users']) await assert.rejects(renderProtected(path),/^Error: redirect:\/$/);
  for(const agent of ['customer','maintenance','energy','production','supplier']) assert.ok(await renderProtected(`/apps/${agent}`));
  const originalOwnHash=(await store.get(userId)).passwordHash;
  const originalOwnerHash=(await store.get(DEFAULT_ADMIN_ID)).passwordHash;
  assert.equal((await password({newPassword:'updated-password'})).status,400);
  assert.equal((await password({oldPassword:'wrong-password',newPassword:'updated-password'})).status,400);
  assert.equal((await password({oldPassword:' 12345678 '})).status,400);
  assert.equal((await password({oldPassword:' 12345678 ',newPassword:'short'})).status,400);
  assert.equal((await read(await routes.password.POST(request('/api/auth/password',{oldPassword:' 12345678 ',newPassword:'updated-password'},'POST','https://other.example')))).status,403);
  assert.equal((await store.get(userId)).passwordHash,originalOwnHash);
  assert.ok(await store.sessionUser(ordinary.token),'Rejected password changes preserve existing sessions');
  const changedOwnPassword=await password({id:DEFAULT_ADMIN_ID,oldPassword:' 12345678 ',newPassword:'updated-password'});
  assert.equal(changedOwnPassword.status,200);
  assert.equal(changedOwnPassword.body.requiresLogin,true);
  assert.match(changedOwnPassword.cookie,/Max-Age=0/);
  assert.equal(await store.sessionUser(ordinary.token),null);
  assert.equal((await store.get(DEFAULT_ADMIN_ID)).passwordHash,originalOwnerHash,'Personal password API cannot target someone else');
  assert.equal(await store.authenticate('new.user',' 12345678 '),null);
  ordinary=await loginAs('new.user','updated-password');

  server.setToken(owner.token);
  const promoted=await patch(userId,{role:'admin'});
  assert.equal(promoted.status,200);
  assert.equal(promoted.body.requiresLogin,false);
  assert.equal(await store.sessionUser(ordinary.token),null,'Promotion revokes old sessions');
  const promotedLogin=await loginAs('new.user','updated-password');
  assert.equal((await read(await routes.users.GET())).status,200);
  assert.equal((await patch(userId,{role:'user'})).status,403,'Administrators cannot demote themselves');
  assert.equal((await remove(userId)).status,403);
  server.setToken(owner.token);
  assert.equal((await patch(userId,{role:'user'})).status,200);
  assert.equal(await store.sessionUser(promotedLogin.token),null,'Demotion immediately revokes administrator sessions');
  server.setToken(promotedLogin.token);
  assert.equal((await read(await routes.users.GET())).status,401);
  ordinary=await loginAs('new.user','updated-password');
  assert.equal((await read(await routes.users.GET())).status,403);

  let secondary=await loginAs('second-admin','second-password');
  assert.equal((await patch(DEFAULT_ADMIN_ID,{role:'user'})).status,403);
  assert.equal((await remove(DEFAULT_ADMIN_ID)).status,403);
  assert.equal((await remove(secondId)).status,403);
  assert.equal((await patch(secondId,{role:'user'})).status,403);
  assert.equal((await patch(secondId,{name:'不应修改',password:'secondary-new'})).status,400);
  assert.equal((await patch(secondId,{name:'不应修改',password:'secondary-new',oldPassword:'wrong-password'})).status,400);
  assert.equal((await store.get(secondId)).name,'另一管理员');
  assert.ok(await store.sessionUser(secondary.token));
  assert.equal((await patch(userId,{password:'admin-reset-password'})).status,200,'Administrator reset of another account does not need its old password');
  assert.equal(await store.sessionUser(ordinary.token),null);
  assert.equal(await store.authenticate('new.user','updated-password'),null);
  assert.ok(await store.authenticate('new.user','admin-reset-password'));
  const secondaryChanged=await patch(secondId,{password:'secondary-new',oldPassword:'second-password'});
  assert.equal(secondaryChanged.status,200);
  assert.equal(secondaryChanged.body.requiresLogin,true);
  assert.equal(await store.sessionUser(secondary.token),null);
  secondary=await loginAs('second-admin','secondary-new');
  assert.equal((await patch(secondId,{name:'新名称',password:''})).body.requiresLogin,false);
  assert.equal((await store.sessionUser(secondary.token)).name,'新名称');
  const unchangedAccount=await patch(secondId,{account:'renamed-admin'});
  assert.equal(unchangedAccount.status,200);
  assert.equal(unchangedAccount.body.user.account,'second-admin');
  assert.equal(unchangedAccount.body.requiresLogin,false);
  assert.ok(await store.sessionUser(secondary.token));
  assert.equal(await store.authenticate('renamed-admin','secondary-new'),null);
  assert.equal((await patch('missing',{name:'新名称'})).status,404);
  assert.equal((await remove('missing')).status,404);
  assert.equal((await read(await routes.user.PATCH(request(`/api/users/${secondId}`,{name:'跨站'},'PATCH','https://other.example'),context(secondId)))).status,403);
  assert.equal((await store.get(secondId)).name,'新名称');
  const toDelete=await auth.createUserSession(await store.get(userId),config);
  assert.equal((await remove(userId)).status,200);
  assert.equal(await store.sessionUser(toDelete),null);

  server.setToken(owner.token);
  const editedDefault=await patch(DEFAULT_ADMIN_ID,{account:'owner',password:'owner-password-123',oldPassword:defaultPassword});
  assert.equal(editedDefault.status,200);
  assert.equal(editedDefault.body.requiresLogin,true);
  assert.equal(await store.sessionUser(owner.token),null);
  const claimsUser=await store.get('legacy-user');
  const datedToken=await auth.createUserSession(claimsUser,config,1000);
  assert.ok(await store.sessionUser(datedToken,1001));
  assert.equal(await store.sessionUser(datedToken,1000+auth.SESSION_TTL),null);
  assert.equal(await store.sessionUser(datedToken,999),null);
  const [datedPayload,datedSignature]=datedToken.split('.');
  const changedSignature=`${datedSignature[0]==='A'?'B':'A'}${datedSignature.slice(1)}`;
  assert.equal(await store.sessionUser(`${datedPayload}.${changedSignature}`,1001),null);
  assert.equal(await auth.readUserSession(datedToken,{...config,sessionSecret:'different-session-secret-'.repeat(3)},1001),null);
  assert.deepEqual(Object.keys(publicUser(claimsUser)).sort(),['account','createdAt','id','isDefaultAdmin','lastLoginAt','name','role'].sort());
  assert.notEqual(await auth.hashPassword('same-password'),await auth.hashPassword('same-password'));
  assert.equal((await read(await routes.logout.POST(request('/api/auth/logout',undefined,'POST','https://other.example')))).status,403);
  const logout=await read(await routes.logout.POST(request('/api/auth/logout')));
  assert.equal(logout.status,200);
  assert.match(logout.cookie,/HttpOnly; SameSite=Strict; Max-Age=0; Secure/);
  assert.ok(!auth.sessionCookie('test',false).includes('Secure'));
  for(const body of ['null','[]','"value"','{invalid'])
    await assert.rejects(accountPayload(new Request('https://app.example/api/users',{method:'POST',headers:{'content-type':'application/json'},body})),/请求格式/);
  await assert.rejects(accountPayload(new Request('https://app.example/api/users',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:'x'.repeat(4096)})})),error=>error.status===413);
  for(const password of ['short','x'.repeat(65)]) await assert.rejects(store.add({account:'valid-account',password}),/8–64/);
  await assert.rejects(store.add({account:'x@bad',password:'12345678'}),/账号名/);
  await assert.rejects(store.add({name:'字'.repeat(41),account:'valid-name',password:'12345678'}),/40/);

  sqlite.close();sqlite=new DatabaseSync(databaseFile);store=new UserStore(adapter(sqlite),config);
  await store.initialize();await store.initialize();
  assert.equal((await store.get('legacy-user')).passwordHash,legacyHash);
  assert.equal((await store.authenticate('admin','owner-password-123')).account,'admin');
  assert.equal(await store.authenticate('owner','owner-password-123'),null);
  assert.equal(await store.authenticate('admin',defaultPassword),null);
  assert.equal((await store.get(secondId)).role,'admin','Repeated initialization preserves administrator-assigned roles');
  assert.equal((await store.get('legacy-user')).role,'user');
  assert.equal((await store.list()).length,3);
  const fresh=new DatabaseSync(':memory:');
  try {const freshStore=new UserStore(adapter(fresh),config);await freshStore.initialize();assert.equal((await freshStore.get(DEFAULT_ADMIN_ID)).role,'admin');}
  finally {fresh.close();}
  console.log('Accounts passed: in-place role migration, registration disabled, administrator-only CRUD/pages, role revocation/protection, personal old-password checks, administrator resets, persistence, sessions, and input validation.');
} finally {
  sqlite?.close();fs.rmSync(temp,{recursive:true,force:true});
}
