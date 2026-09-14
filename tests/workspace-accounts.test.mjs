import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fengbin-workspace-users-'));
try {
  for (const file of fs.readdirSync('app/application')) {
    if (file.endsWith('.json'))
      fs.copyFileSync(`app/application/${file}`, path.join(temp, file));
    if (file.endsWith('.ts'))
      fs.writeFileSync(
        path.join(temp, file.replace(/\.ts$/, '.js')),
        ts.transpileModule(fs.readFileSync(`app/application/${file}`, 'utf8'), {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true,
          },
        }).outputText,
      );
  }
  fs.symlinkSync(path.resolve('node_modules'), path.join(temp, 'node_modules'));
  const require = createRequire(path.join(temp, 'check.cjs'));
  const { initialDatasets, defaultInputs, STORAGE_KEY } = require('./model.js');
  const source = fs.readFileSync(path.join(temp, 'store.js'), 'utf8');
  const adminKey = `${STORAGE_KEY}.user.default-admin`;
  const accountKey = (id) => `${STORAGE_KEY}.user.account.${encodeURIComponent(id)}`;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  function memoryStorage(entries = []) {
    const data = new Map(entries);
    return {
      data,
      fail: null,
      getItem(key) { return data.get(key) ?? null; },
      setItem(key, value) {
        if (this.fail?.(key, value)) throw new Error('storage unavailable');
        data.set(key, value);
      },
      removeItem(key) { data.delete(key); },
    };
  }
  function load(storage) {
    const context = {
      exports: {},
      localStorage: storage,
      window: { addEventListener() {}, removeEventListener() {} },
      queueMicrotask,
      require: (name) => name === 'react'
        ? { useSyncExternalStore: (_subscribe, read) => read() }
        : require(name),
    };
    vm.runInNewContext(source, context);
    return { ...context.exports, read: () => clone(context.exports.useWorkspace()) };
  }
  const session = (id, question, feedback = null) => ({
    id,
    module: 'production',
    title: question,
    titleEdited: true,
    createdAt: '2026-09-13T00:00:00Z',
    updatedAt: '2026-09-13T00:00:00Z',
    draft: { ...defaultInputs.production, question: `${question}的草稿` },
    turns: [{
      id: `${id}-turn`,
      question,
      answer: `${question}的回答`,
      createdAt: '2026-09-13T00:00:00Z',
      inputs: { ...defaultInputs.production },
      sourceName: '产线生产日报',
      sourceOrigin: 'sample',
      feedback,
    }],
  });
  const legacy = {
    version: 1,
    datasets: clone(initialDatasets),
    records: [],
    drafts: {},
    sessions: [session('old-admin', '旧管理员问题', 'like')],
    activeSessionIds: { production: 'old-admin' },
    moduleViews: { production: 'chat' },
    deletedDataResourceIds: ['file:legacy-deleted'],
  };
  // An earlier browser stores the six-column catalog, before specification fields were introduced.
  const oldCatalog = {
    id: 'products', name: '电容器产品目录', module: 'customer', origin: 'sample',
    columns: ['产品型号', '额定电压(V)', '容量(μF)', '温度(℃)', '寿命(h)', '应用'],
    rows: [{ '产品型号': 'FB-LH470', '额定电压(V)': 450, '容量(μF)': 470, '温度(℃)': 105, '寿命(h)': 5000, '应用': '工业电源' }],
  };
  const oldWorkspace = clone(legacy);
  oldWorkspace.datasets = oldWorkspace.datasets.map(dataset => dataset.id === 'products'
    ? oldCatalog
    : dataset.id === 'production' ? { ...dataset, origin: 'local', fileName: '工厂报表.csv' } : dataset);
  for (const split of [false, true]) {
    const { datasets, deletedDataResourceIds, ...personal } = oldWorkspace;
    const entries = split
      ? [[STORAGE_KEY, JSON.stringify({ version: 1, datasets, deletedDataResourceIds })], [adminKey, JSON.stringify(personal)]]
      : [[STORAGE_KEY, JSON.stringify(oldWorkspace)]];
    const historicalStorage = memoryStorage(entries);
    const restored = load(historicalStorage);
    assert.equal(restored.setWorkspaceUser('admin-id', true), true, `${split ? 'Account-isolated' : 'Legacy shared'} history survives catalog schema upgrades`);
    const state = restored.read();
    assert.deepEqual(state.sessions, oldWorkspace.sessions, 'Answers, drafts and feedback survive the sample-data refresh');
    assert.deepEqual(state.activeSessionIds, oldWorkspace.activeSessionIds);
    assert.deepEqual(state.datasets.find(dataset => dataset.id === 'products'), initialDatasets.find(dataset => dataset.id === 'products'));
    assert.deepEqual(state.datasets.find(dataset => dataset.id === 'production'), oldWorkspace.datasets.find(dataset => dataset.id === 'production'), 'Imported business data is preserved');
    assert.deepEqual(state.deletedDataResourceIds, oldWorkspace.deletedDataResourceIds);
    assert.equal(load(historicalStorage).setWorkspaceUser('admin-id', true), true, 'Reload stays recoverable');
  }
  const importedOldCatalog = { ...oldWorkspace, datasets: oldWorkspace.datasets.map(dataset => dataset.id === 'products' ? { ...dataset, origin: 'local', fileName: '旧产品目录.csv' } : dataset) };
  const importedRaw = JSON.stringify(importedOldCatalog);
  const importedStorage = memoryStorage([[STORAGE_KEY, importedRaw]]);
  assert.equal(load(importedStorage).setWorkspaceUser('admin-id', true), false, 'An incompatible imported catalog is not silently replaced with samples');
  assert.equal(importedStorage.getItem(STORAGE_KEY), importedRaw);
  assert.equal(importedStorage.getItem(adminKey), null);
  const storage = memoryStorage([[STORAGE_KEY, JSON.stringify(legacy)]]);
  let store = load(storage);
  assert.equal(store.read().sessions.length, 0, 'Unbound first render is empty');
  assert.equal(store.updateWorkspace(() => { throw new Error('must not run'); }), false);
  assert.equal(store.setWorkspaceUser('user-a', false), true);
  assert.equal(store.read().sessions.length, 0, 'First registered user never sees legacy admin chats');
  assert.equal(JSON.parse(storage.getItem(adminKey)).sessions[0].id, 'old-admin');
  assert.equal(Object.hasOwn(JSON.parse(storage.getItem(STORAGE_KEY)), 'sessions'), false);
  assert.equal(store.updateWorkspace((state) => ({
    ...state,
    sessions: [session('a-chat', '账号 A 问题', 'dislike')],
    activeSessionIds: { production: 'a-chat' },
    moduleViews: { production: 'chat' },
    deletedDataResourceIds: ['file:shared-deleted'],
    datasets: state.datasets.map((dataset) => dataset.id === 'production'
      ? { ...dataset, name: '共同生产资料' } : dataset),
  })), true);
  const beforeSameUser = store.read();
  assert.equal(store.setWorkspaceUser('user-a', false), true);
  assert.deepEqual(store.read(), beforeSameUser, 'Repeated identity binding leaves active state unchanged');
  assert.equal(store.setWorkspaceUser('user-b', false), true);
  assert.equal(store.read().sessions.length, 0);
  assert.deepEqual(store.read().activeSessionIds, {});
  assert.deepEqual(store.read().moduleViews, {});
  assert.equal(store.read().datasets.find((item) => item.id === 'production').name, '共同生产资料');
  assert.deepEqual(store.read().deletedDataResourceIds, ['file:shared-deleted']);
  assert.equal(store.updateWorkspace((state) => ({
    ...state,
    sessions: [session('b-chat', '账号 B 问题', 'like')],
    activeSessionIds: { production: 'b-chat' },
  })), true);
  assert.equal(store.setWorkspaceUser('user-a', false), true);
  assert.equal(store.read().sessions[0].title, '账号 A 问题');
  assert.equal(store.read().sessions[0].draft.question, '账号 A 问题的草稿');
  assert.equal(store.read().sessions[0].turns[0].feedback, 'dislike');
  assert.equal(store.read().activeSessionIds.production, 'a-chat');
  assert.equal(store.setWorkspaceUser('server-default-admin-id', true), true);
  assert.equal(store.read().sessions[0].id, 'old-admin');
  assert.equal(store.read().sessions[0].turns[0].feedback, 'like');
  assert.equal(store.read().datasets.find((item) => item.id === 'production').name, '共同生产资料');
  store = load(storage);
  assert.equal(store.read().sessions.length, 0, 'Reload also waits for identity');
  assert.equal(store.setWorkspaceUser('user-b', false), true);
  assert.equal(store.read().sessions[0].id, 'b-chat', 'Reload restores only bound user');

  // A failed two-key save restores the personal write before reporting failure.
  const previousAccount = storage.getItem(accountKey('user-b'));
  const previousShared = storage.getItem(STORAGE_KEY);
  const previousState = store.read();
  storage.fail = (key) => key === STORAGE_KEY;
  assert.equal(store.updateWorkspace((state) => ({
    ...state,
    sessions: [session('not-saved', '未成功保存的问题')],
    deletedDataResourceIds: ['file:not-saved'],
  })), false);
  assert.equal(storage.getItem(accountKey('user-b')), previousAccount);
  assert.equal(storage.getItem(STORAGE_KEY), previousShared);
  assert.deepEqual(store.read(), previousState);
  assert.match(store.storageMessage(), /保存失败/);
  storage.fail = null;

  // Invalid account data cannot be overwritten with an empty default workspace.
  storage.data.set(accountKey('broken-user'), '{broken');
  assert.equal(store.setWorkspaceUser('broken-user', false), false);
  assert.equal(store.read().sessions.length, 0);
  assert.equal(store.updateWorkspace(() => { throw new Error('must not run'); }), false);
  assert.equal(storage.getItem(accountKey('broken-user')), '{broken');
  assert.match(store.storageMessage(), /读取或迁移失败/);

  // Migration writes the admin backup first, and is retryable after either failure.
  for (const failedKey of [adminKey, STORAGE_KEY]) {
    const raw = JSON.stringify(legacy);
    const failingStorage = memoryStorage([[STORAGE_KEY, raw]]);
    const migrating = load(failingStorage);
    failingStorage.fail = (key) => key === failedKey;
    assert.equal(migrating.setWorkspaceUser('new-user', false), false);
    assert.equal(failingStorage.getItem(STORAGE_KEY), raw);
    assert.equal(migrating.read().sessions.length, 0);
    failingStorage.fail = null;
    assert.equal(migrating.setWorkspaceUser('new-user', false), true);
    assert.equal(migrating.read().sessions.length, 0);
    assert.equal(migrating.setWorkspaceUser('admin-id', true), true);
    assert.equal(migrating.read().sessions[0].id, 'old-admin');
  }
  console.log('Workspace accounts: first-render isolation, A/B switching, shared business data, legacy admin migration, reload and failed-save recovery passed.');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
