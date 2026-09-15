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
  const { initialDatasets, defaultInputs, STORAGE_KEY, validateDataset } = require('./model.js');
  const { maintenanceTables } = require('./maintenance-data.js');
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
  const finalFaults = initialDatasets.find(dataset => dataset.id === 'maintenance');
  assert.equal(validateDataset(finalFaults), null, 'Actual blank fault symptoms must not prevent workspace hydration');
  assert.deepEqual(
    maintenanceTables[0].rows.filter(row => row[2] === null).map(row => row[0]),
    ['CJGZ00001', 'DJGZ00024', 'RJGZ00001'],
    'The final source preserves its three original null symptoms',
  );
  assert.deepEqual(
    finalFaults.rows.filter(row => row['现象描述'] === '').map(row => row['故障ID']),
    ['CJGZ00001', 'DJGZ00024', 'RJGZ00001'],
    'The dataset display keeps the same symptoms blank without inventing content',
  );
  for (const blank of [null, '']) {
    const localFaults = { ...clone(finalFaults), origin: 'local', fileName: '故障表.csv' };
    localFaults.rows[0]['现象描述'] = blank;
    assert.equal(validateDataset(localFaults), null, 'The real optional symptom accepts source null or display blank');
    for (const column of localFaults.columns.filter(column => column !== '现象描述')) {
      const invalid = clone(localFaults);
      invalid.rows[0][column] = blank;
      assert.ok(validateDataset(invalid), `${column} remains required`);
    }
  }
  const missingSymptom = clone(finalFaults);
  delete missingSymptom.rows[0]['现象描述'];
  assert.ok(validateDataset(missingSymptom), 'A missing field is not an intentional source blank');
  const overlongSymptom = clone(finalFaults);
  overlongSymptom.rows[0]['现象描述'] = '字'.repeat(1001);
  assert.ok(validateDataset(overlongSymptom), 'Optional symptoms still obey content-length validation');
  // An earlier browser stores the six-column catalog, before specification fields were introduced.
  const oldCatalog = {
    id: 'products', name: '电容器产品目录', module: 'customer', origin: 'sample',
    columns: ['产品型号', '额定电压(V)', '容量(μF)', '温度(℃)', '寿命(h)', '应用'],
    rows: [{ '产品型号': 'FB-LH470', '额定电压(V)': 450, '容量(μF)': 470, '温度(℃)': 105, '寿命(h)': 5000, '应用': '工业电源' }],
  };
  const oldMaintenance = {
    id: 'maintenance', name: '设备维修知识', module: 'maintenance', origin: 'sample',
    columns: ['案例编号', '设备类型', '故障现象', '排查方向', '处理建议'],
    rows: [{ '案例编号': '旧案例', '设备类型': '卷绕机', '故障现象': '张力波动', '排查方向': '检查张力', '处理建议': '调整张力' }],
  };
  const oldWorkspace = clone(legacy);
  oldWorkspace.datasets = oldWorkspace.datasets.map(dataset => dataset.id === 'products'
    ? oldCatalog
    : dataset.id === 'maintenance' ? oldMaintenance
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
    assert.deepEqual(state.datasets.find(dataset => dataset.id === 'maintenance'), finalFaults, 'Old sample maintenance data refreshes to the final fault table with real blanks');
    assert.deepEqual(state.datasets.find(dataset => dataset.id === 'production'), oldWorkspace.datasets.find(dataset => dataset.id === 'production'), 'Imported business data is preserved');
    assert.deepEqual(state.deletedDataResourceIds, oldWorkspace.deletedDataResourceIds);
    assert.equal(load(historicalStorage).setWorkspaceUser('admin-id', true), true, 'Reload stays recoverable');
  }
  // Old energy plans were in thousands of pieces; migration must inspect
  // the original version before adding current defaults. Historical answers stay intact.
  for (const oldConversationFormat of [false, true]) {
    const old = clone(legacy);
    const oldInput = { process: '老化', line: '1号产线', plannedProduction: '1000', dateFrom: '2026-09-01', dateTo: '2026-09-07', question: '旧草稿' };
    const oldSession = { ...session('old-energy', '旧能耗结果'), module: 'energy', draft: oldInput };
    oldSession.turns[0].inputs = { ...oldInput };
    old.drafts.energy = { ...oldInput };
    old.sessions = [oldSession];
    if (oldConversationFormat) { delete old.sessions; old.conversations = { energy: oldSession.turns }; }
    const saved = load(memoryStorage([[STORAGE_KEY, JSON.stringify(old)]]));
    assert.equal(saved.setWorkspaceUser('admin-id', true), true);
    const migrated = saved.read().sessions.find(s => s.module === 'energy');
    assert.equal(migrated.draft.plannedProduction, '');
    assert.equal(migrated.draft.dataVersion, defaultInputs.energy.dataVersion);
    assert.equal(migrated.draft.process, defaultInputs.energy.process);
    assert.equal(migrated.draft.question, '旧草稿');
    assert.deepEqual(migrated.turns, oldSession.turns);
  }
  for (const id of ['energy', 'production', 'maintenance']) {
    const old = clone(legacy);
    const columns = id === 'energy' ? ['工序', '用电量(kWh)', '产量(千只)', '基准单耗(kWh/千只)'] : id === 'production' ? ['产线', '计划产量(万只)', '实际产量(万只)', '检验数量', '不良数量', '停机时长(min)'] : ['案例编号', '设备类型', '故障现象', '排查方向', '处理建议'];
    const values = id === 'energy' ? ['老化', 100, 10, 9] : id === 'production' ? ['一号线', 10, 9.8, 10000, 120, 18] : ['历史案例一', '钉卷机', '毛刷不转', '检查启动电容', '更换启动电容'];
    const imported = { id, module: id, origin: 'local', name: '历史导入', fileName: '历史导入.csv', columns, rows: [Object.fromEntries(columns.map((c,i) => [c,values[i]]))] };
    old.datasets = old.datasets.map(d => d.id === id ? imported : d);
    for (const split of [false, true]) {
      const { datasets, deletedDataResourceIds, ...personal } = old;
      const entries = split
        ? [[STORAGE_KEY, JSON.stringify({ version: 1, datasets, deletedDataResourceIds })], [adminKey, JSON.stringify(personal)]]
        : [[STORAGE_KEY, JSON.stringify(old)]];
      const saved = memoryStorage(entries);
      const migrated = load(saved);
      assert.equal(migrated.setWorkspaceUser('admin-id', true), true, 'Historical imported tables must not block login');
      assert.deepEqual(migrated.read().datasets.find(d => d.id === id), imported, 'Historical imports are retained verbatim');
      assert.equal(load(saved).setWorkspaceUser('admin-id', true), true, 'Historical imports also survive the next reload');
    }
    if (id === 'maintenance') {
      assert.equal(validateDataset(imported), null, 'All five legacy maintenance fields are text');
      const invalid = clone(imported);
      invalid.rows[0]['故障现象'] = '';
      assert.ok(validateDataset(invalid), 'Legacy fault descriptions do not inherit optional final-table symptoms');
      const raw = JSON.stringify({ ...old, datasets: old.datasets.map(d => d.id === id ? invalid : d) });
      const saved = memoryStorage([[STORAGE_KEY, raw]]);
      assert.equal(load(saved).setWorkspaceUser('admin-id', true), false, 'Invalid maintenance imports are still rejected');
      assert.equal(saved.getItem(STORAGE_KEY), raw, 'Failed migration preserves the original import');
    }
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
      ? { ...dataset, origin: 'local', name: '共同生产资料' } : dataset),
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
