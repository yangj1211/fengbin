import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const temp = fs.mkdtempSync(
  path.join(os.tmpdir(), 'fengbin-multi-scope-test-'),
);
try {
  for (const file of fs
    .readdirSync('app/application')
    .filter((name) => name.endsWith('.ts'))) {
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
  for (const file of [
    'customer-fixtures.json',
    'maintenance-fixtures.json',
    'maintenance-final.json',
    'energy-fixtures.json',
    'energy-final.json',
    'production-final.json',
    'historical-tables.json',
  ])
    fs.copyFileSync(`app/application/${file}`, path.join(temp, file));
  const require = createRequire(path.join(temp, 'check.cjs'));
  const sourceRequire = createRequire(path.resolve('package.json'));
  const {
    initialDatasets,
    defaultInputs,
    analyze,
    validateInputs,
  } = require('./model.js');
  const { buildDashboard } = require('./dashboard-data.js');
  const { energyDetailAnalysis } = require('./energy-data.js');
  const { replyToQuestion, conditionSummary } = require('./conversation.js');
  const {
    applyDashboardConditions,
    currentSession,
    energyConditions,
  } = require('./sessions.js');
  const {
    encodeScope,
    scopeValues,
    scopeLabel,
    scopeButtonLabel,
    filterScope,
    nextScopeSelection,
    mentionedScopeNames,
  } = require('./scope.js');
  const prod = initialDatasets.find((d) => d.module === 'production');
  const supplier = initialDatasets.find((d) => d.module === 'supplier');
  const energy = initialDatasets.find((d) => d.module === 'energy');
  const all = '全部产线';
  const names = ['1号产线', '2号产线', '3号产线', '4号产线'];
  const two = encodeScope(['1号产线', '3号产线'], all, names);
  assert.equal(encodeScope([], all, names), all);
  assert.equal(encodeScope(names, all, names), all);
  assert.equal(encodeScope(['1号产线'], all, names), '1号产线');
  assert.deepEqual(scopeValues(two, all), ['1号产线', '3号产线']);
  assert.deepEqual(scopeValues('1号产线、3号产线', all), [
    '1号产线',
    '3号产线',
  ]);
  assert.equal(scopeLabel(two, all), '1号产线、3号产线');
  assert.equal(scopeButtonLabel(two, all, names), '已选 2 项');
  assert.equal(nextScopeSelection([], ['1号产线'], all, names), all);
  assert.equal(nextScopeSelection([all], ['1号产线'], all, names), all);
  assert.equal(
    nextScopeSelection([all, '1号产线'], [all], all, names),
    '1号产线',
  );
  assert.deepEqual(
    scopeValues(
      nextScopeSelection(['1号产线', '3号产线'], ['1号产线'], all, names),
      all,
    ),
    ['1号产线', '3号产线'],
  );
  assert.equal(nextScopeSelection(names, names.slice(0, -1), all, names), all);
  assert.equal(filterScope(names, '@scope:bad', all, (row) => row).length, 0);
  assert.equal(filterScope(names, ',,,', all, (row) => row).length, 0);
  assert.equal(scopeLabel('@scope:bad', all), '未识别的范围');
  const punctuation = [{ name: '精密线,东区' }, { name: '其他线' }];
  assert.deepEqual(
    filterScope(punctuation, '精密线,东区', all, (row) => row.name),
    [punctuation[0]],
  );
  assert.deepEqual(
    scopeValues(encodeScope(['精密线,东区', '其他线'], all), all),
    ['精密线,东区', '其他线'],
  );
  assert.deepEqual(
    mentionedScopeNames('查看11号产线', ['1号产线', '2号产线']),
    [],
  );

  const { processNames, getFinalProduction } = require('./final-data.js');
  const prodInput = {
    ...defaultInputs.production,
    process: encodeScope(processNames.slice(0, 2), '全部工序'),
  };
  assert.equal(getFinalProduction(prodInput).perProcess.length, 2);
  assert.equal(getFinalProduction(prodInput).singleProcess, false);
  const productionReply = replyToQuestion(
    'production',
    '比较当前范围的生产',
    prodInput,
    prod,
  );
  assert.doesNotMatch(productionReply.answer, /老化|@scope:/);
  assert.equal(productionReply.inputs.process, prodInput.process);
  const supplierScope = encodeScope(
    ['供应商 A', '供应商 C'],
    '全部供应商',
    supplier.rows.map((row) => row['供应商']),
  );
  const supplierInput = { ...defaultInputs.supplier, supplier: supplierScope };
  for (const value of [supplierScope, '供应商 A、供应商 C']) {
    const board = buildDashboard('supplier', supplier, {
      ...supplierInput,
      supplier: value,
    });
    assert.equal(board.rows.length, 2);
    assert.equal(
      board.metrics.find((m) => m.label === '平均综合评分').value,
      '91.6',
    );
    assert.deepEqual(
      board.analysis.bars.map((row) => row.label),
      ['供应商 A', '供应商 C'],
    );
    const reply = replyToQuestion(
      'supplier',
      '比较当前范围的评分',
      { ...supplierInput, supplier: value },
      supplier,
    );
    assert.match(reply.answer, /供应商 A/);
    assert.match(reply.answer, /供应商 C/);
    assert.doesNotMatch(reply.answer, /供应商 B|@scope:|\["/);
    assert.equal(reply.inputs.supplier, value);
  }
  const named = replyToQuestion(
    'supplier',
    '比较供应商 a 和 c',
    defaultInputs.supplier,
    supplier,
  );
  assert.deepEqual(scopeValues(named.inputs.supplier, '全部供应商'), [
    '供应商 A',
    '供应商 C',
  ]);
  assert.equal(
    buildDashboard('supplier', supplier, { ...supplierInput, supplier: ' a ' })
      .rows.length,
    1,
  );

  const energyInput = {
    ...defaultInputs.energy,
    shift: 'B',
    plannedProduction: '100000',
  };
  const state = {
    datasets: initialDatasets,
    records: [],
    drafts: {},
    sessions: [],
    activeSessionIds: {},
    moduleViews: {},
  };
  for (const [id, input] of [
    ['production', prodInput],
    ['supplier', supplierInput],
    ['energy', energyInput],
  ]) {
    const seeded = applyDashboardConditions(state, id, input);
    const restored = JSON.parse(JSON.stringify(seeded));
    const saved = currentSession(restored, id);
    assert.ok(saved);
    const key = id === 'supplier' ? 'supplier' : 'process';
    assert.equal(saved.draft[key], input[key]);
    assert.ok(
      conditionSummary(id, saved.draft).every(
        (value) => !value.includes('@scope:') && !value.includes('["'),
      ),
    );
    const answered = replyToQuestion(
      id,
      id === 'energy' ? '按当前范围预测用电' : '按当前范围继续分析',
      saved.draft,
      initialDatasets.find((d) => d.module === id),
    );
    assert.equal(answered.inputs[key], input[key]);
    if (id === 'energy')
      assert.deepEqual(
        energyConditions(answered.inputs),
        energyConditions(input),
      );
  }

  // Exercise selection/search/open handlers through a lightweight SSR component harness.
  let combo;
  const exportsSeen = [];
  const tablesSeen = [];
  const simple =
    (tag) =>
    ({ children }) =>
      React.createElement(
        tag,
        null,
        typeof children === 'function' ? null : children,
      );
  const comboComponents = {
    Combobox: (props) => {
      combo = props;
      return React.createElement(React.Fragment, null, props.children);
    },
    ComboboxTrigger: ({ children, title }) =>
      React.createElement('button', { title }, children),
    ComboboxContent: simple('section'),
    ComboboxEmpty: simple('p'),
    ComboboxInput: simple('div'),
    ComboboxList: ({ children }) =>
      React.createElement('div', null, combo.items.map(children)),
    ComboboxItem: simple('div'),
  };
  const stubs = new Map([
    ['@/components/ui/combobox', comboComponents],
    ['@/components/ui/button', { Button: simple('button') }],
    [
      '@/components/ui/input-group',
      { InputGroupAddon: simple('span'), InputGroupButton: simple('button') },
    ],
    [
      './ui',
      {
        Choice: simple('div'),
        Field: simple('div'),
        EmptyState: simple('div'),
        DataTable: (props) => {
          tablesSeen.push(props);
          return null;
        },
      },
    ],
    [
      './detail-export',
      {
        default: (props) => {
          exportsSeen.push(props);
          return null;
        },
      },
    ],
    [
      './list-pagination',
      {
        default: () => null,
        getPageRange: (total, page, size) => ({
          currentPage: Math.min(page, Math.max(1, Math.ceil(total / size))),
          offset: (page - 1) * size,
        }),
      },
    ],
    ['./dashboard-metric', { default: () => null }],
    ['./final-dashboard', { default: () => null }],
    ['./dashboard-chat-entry', { default: simple('button') }],
    ['./back-button', { default: simple('button') }],
    ['./identity', { AgentIdentity: () => null }],
    [
      './dashboard-charts',
      {
        ProductionChart: () => null,
        SupplierRanking: () => null,
        DowntimeChart: () => null,
        SupplierRiskDistribution: () => null,
        ComparisonChart: () => null,
      },
    ],
    ['./dashboard-dialogs', { DashboardRules: () => null }],
    ['./energy-series-chart', { default: () => null }],
    ['./energy-comparison-chart', { default: () => null }],
  ]);
  const cache = new Map();
  function loadUi(file) {
    if (cache.has(file)) return cache.get(file);
    const code = ts.transpileModule(
      fs.readFileSync(`app/application/${file}.tsx`, 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      },
    ).outputText;
    const mod = { exports: {} };
    cache.set(file, mod.exports);
    const localRequire = (id) => {
      if (stubs.has(id)) return { ...stubs.get(id), __esModule: true };
      if (id === './energy-dashboard')
        return { ...loadUi('energy-dashboard'), __esModule: true };
      if (id.startsWith('@/components/ui/'))
        return new Proxy(
          { __esModule: true },
          { get: (obj, key) => (key === '__esModule' ? true : simple('div')) },
        );
      if (id.startsWith('./')) return require(id + '.js');
      return sourceRequire(id);
    };
    vm.runInNewContext(
      code,
      { module: mod, exports: mod.exports, require: localRequire, console },
      { filename: file + '.tsx' },
    );
    cache.set(file, mod.exports);
    return mod.exports;
  }
  const Multi = loadUi('multi-scope-choice').default;
  let changed;
  const props = {
    name: 'scope',
    label: '产线范围',
    value: two,
    options: [all, ...names],
    allLabel: all,
    onChange: (value) => {
      changed = value;
    },
  };
  let html = renderToStaticMarkup(React.createElement(Multi, props));
  assert.equal(combo.multiple, true);
  assert.ok(html.includes('已选 2 项'));
  assert.ok(html.includes('清空'));
  assert.ok(!html.includes('@scope:'));
  assert.equal(combo.filter('生产东区线', '东区'), true);
  assert.equal(combo.filter('Line A', 'line a'), true);
  assert.equal(combo.filter('1号产线', '没有的名称'), false);
  assert.equal(changed, undefined, 'search does not update scope');
  let cancelled = false;
  combo.onOpenChange(false, {
    reason: 'item-press',
    cancel() {
      cancelled = true;
    },
  });
  assert.equal(cancelled, true, 'selection must not close popup');
  combo.onValueChange(['1号产线', '3号产线', '4号产线']);
  assert.deepEqual(scopeValues(changed, all), [
    '1号产线',
    '3号产线',
    '4号产线',
  ]);
  renderToStaticMarkup(
    React.createElement(Multi, { ...props, value: '1号产线' }),
  );
  combo.onValueChange([]);
  assert.equal(changed, all);
  renderToStaticMarkup(React.createElement(Multi, { ...props, value: all }));
  combo.onValueChange([all, '3号产线']);
  assert.equal(changed, '3号产线');

  // Opening the overview preserves conversation scope and exposes no detail/export controls.
  const Dashboard = loadUi('dashboard').default;
  for (const [id, input, scopeKey] of [
    ['supplier', supplierInput, 'supplier'],
  ]) {
    exportsSeen.length = 0;
    tablesSeen.length = 0;
    const savedState = applyDashboardConditions(state, id, input);
    const savedSnapshot = JSON.stringify(savedState);
    const originalError = console.error;
    console.error = () => {};
    try {
      renderToStaticMarkup(
        React.createElement(Dashboard, {
          id,
          state: savedState,
          onOpenChat: () => true,
          navigate: () => true,
        }),
      );
    } finally {
      console.error = originalError;
    }
    assert.equal(exportsSeen.length, 0);
    assert.equal(tablesSeen.length, 0);
    assert.equal(
      currentSession(savedState, id).draft[scopeKey],
      input[scopeKey],
    );
    assert.equal(JSON.stringify(savedState), savedSnapshot);
  }
  console.log(
    'PASS multiscope: single/legacy/multiple/all/unknown; KPI/chart agreement; search and persistent popup; scope resets; session persistence; overview without details/export; no encoded display; energy plan scope.',
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
