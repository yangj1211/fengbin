import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fengbin-energy-test-'));
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
    'energy-fixtures.json',
  ])
    fs.copyFileSync(`app/application/${file}`, path.join(temp, file));
  const require = createRequire(path.join(temp, 'check.cjs'));
  const { replyToQuestion: reply } = require('./conversation.js');
  const {
    initialDatasets,
    defaultInputs,
    validateInputs,
  } = require('./model.js');
  const { energyDetailAnalysis } = require('./energy-data.js');
  const data = initialDatasets.find((item) => item.id === 'energy');
  const defaults = { ...defaultInputs.energy, change: '0' };
  const answer = reply('energy', '全部工序用电情况怎么样', defaults, data);
  assert.equal(answer.analysis, undefined);
  assert.match(answer.answer, /126 MWh/);
  assert.doesNotMatch(answer.answer, /132\.3 MWh/);
  assert.match(answer.answer, /3 个需核查的异常点/);
  assert.match(answer.answer, /综合单位电耗 30 kWh/);
  assert.match(answer.answer, /参考数据：\[用电明细.csv\]/);
  assert.ok(answer.answer.endsWith('2026-09-01—2026-09-07）。'));
  const details = energyDetailAnalysis(data, defaults);
  assert.equal(details.rows.length, 84);
  assert.equal(details.daily.length, 7);
  assert.equal(details.lines.length, 2);
  assert.equal(details.shifts.length, 2);
  assert.equal(details.issues.length, 3);
  assert.equal(Math.round(details.total), 126000);
  assert.ok(
    Math.abs(details.production - 4200) < 1e-6,
    'Do not count the same batch three times',
  );
  assert.ok(Math.abs(details.unit - 30) < 1e-6);
  assert.ok(Math.abs(details.baseline - 28.3) < 1e-6);
  assert.equal(details.calendarDays, 7);
  assert.equal(details.availableStart, '2026-09-01');
  assert.equal(details.availableEnd, '2026-09-07');
  assert.equal(details.rangeStart, '2026-09-01');
  assert.equal(details.rangeEnd, '2026-09-07');
  assert.equal(details.trendGranularity, 'day');
  assert.deepEqual(details.trend, details.daily);
  assert.equal(details.referenceProduction, 4200);
  assert.equal(details.plannedProduction, 4200);
  assert.equal(details.productionChange, 0);
  assert.equal(details.forecastSource, 'history');
  assert.equal(details.projected, 126000);
  assert.equal(details.unchanged, 126000);
  assert.equal(details.forecastStart, '2026-09-08');
  assert.equal(details.forecastEnd, '2026-09-14');
  assert.equal(details.forecast[0].date, '2026-09-07');
  assert.equal(details.forecast[0].projected, 0);
  assert.equal(details.forecast.at(-1).date, details.forecastEnd);
  for (const groups of [details.daily, details.lines, details.shifts]) {
    assert.ok(
      Math.abs(groups.reduce((sum, r) => sum + r.total, 0) - details.total) <
        1e-6,
    );
    assert.equal(
      groups.reduce((sum, r) => sum + r.records, 0),
      84,
    );
  }
  for (const row of data.rows) {
    const scoped = energyDetailAnalysis(data, {
      ...defaults,
      process: row['工序'],
    });
    assert.ok(Math.abs(scoped.total - row['用电量(kWh)']) < 1e-6);
    assert.ok(Math.abs(scoped.production - row['产量(千只)']) < 1e-6);
  }
  assert.equal(
    new Set(
      details.rows.map((r) => [r.date, r.line, r.shift, r.process].join('/')),
    ).size,
    84,
  );
  const line1 = reply('energy', '比较1号产线白班和夜班用电', defaults, data);
  assert.equal(line1.inputs.line, '1号产线');
  assert.match(line1.answer, /白班/);
  assert.match(line1.answer, /夜班/);
  assert.doesNotMatch(line1.answer, /2号产线/);
  assert.equal(energyDetailAnalysis(data, line1.inputs).rows.length, 42);
  const reset = reply('energy', '对比不同产线能耗', line1.inputs, data);
  assert.equal(reset.inputs.line, '全部产线');
  assert.match(reset.answer, /2号产线/);
  const both = reply(
    'energy',
    '比较1号产线和2号产线的用电',
    line1.inputs,
    data,
  );
  assert.equal(both.inputs.line, '全部产线');
  assert.match(both.answer, /1号产线/);
  assert.match(both.answer, /2号产线/);
  const night = reply('energy', '夜班有哪些能耗异常点', defaults, data);
  assert.match(night.answer, /2 个需核查的异常点/);
  assert.doesNotMatch(night.answer, /白班/);
  const oneDay = reply('energy', '9月3日的用电量是多少', defaults, data);
  assert.match(oneDay.answer, /2026-09-03—2026-09-03/);
  assert.match(oneDay.answer, /17\.1 MWh/);
  assert.doesNotMatch(oneDay.answer, /126 MWh|132\.3 MWh/);
  assert.match(
    reply('energy', '9月30日用电量是多少', defaults, data).answer,
    /没有/,
  );
  assert.match(
    reply('energy', '查看9号产线用电', defaults, data).answer,
    /没有/,
  );
  const point = {
    ...data.energyDetails[0],
    kwh: 1200,
    production: 100,
    baseline: 10,
  };
  const boundary = { ...data, energyDetails: [point] };
  assert.equal(energyDetailAnalysis(boundary, defaults).issues.length, 0);
  point.kwh = 1200.01;
  assert.equal(energyDetailAnalysis(boundary, defaults).issues.length, 1);
  assert.equal(
    energyDetailAnalysis(data, { ...defaults, process: '无此工序' }).rows
      .length,
    0,
  );
  const fewer = reply(
    'energy',
    '产量减少10%，未来14天全部工序预计用多少电',
    defaults,
    data,
  );
  assert.equal(fewer.inputs.change, '-10');
  assert.equal(fewer.inputs.period, '14');
  assert.match(fewer.answer, /226\.8 MWh/);
  const scoped = reply('energy', '分析含浸工序能耗', defaults, data);
  assert.match(scoped.answer, /37\.8 MWh/);
  assert.match(scoped.answer, /1 个需核查的异常点/);
  assert.doesNotMatch(scoped.answer, /老化：/);
  assert.equal(energyDetailAnalysis(data, scoped.inputs).issues.length, 1);
  const unchanged = reply(
    'energy',
    '产量不变，预测7天全部工序用电',
    fewer.inputs,
    data,
  );
  assert.equal(unchanged.inputs.change, '0');
  assert.match(unchanged.answer, /约需 126 MWh/);
  for (const query of [
    '非生产时段能耗是否异常',
    '分析用水量',
    '查看空压能耗',
  ]) {
    const result = reply('energy', query, defaults, data);
    assert.match(result.answer, /当前资料还不能判断/, query);
    assert.doesNotMatch(result.answer, /132\.3|可能原因已确认/, query);
    assert.equal(result.analysis, undefined);
  }
  for (const query of [
    '查看每日用电趋势',
    '比较不同班次的能耗',
    '对比不同产线能耗',
  ]) {
    const result = reply('energy', query, defaults, data);
    assert.doesNotMatch(result.answer, /当前资料还不能判断/);
    assert.match(result.answer, /MWh/);
    assert.equal(result.analysis, undefined);
  }
  const aggregate = { ...data, origin: 'local', energyDetails: undefined };
  assert.equal(energyDetailAnalysis(aggregate, defaults), null);
  for (const shift of ['白班', '夜班'])
    assert.match(
      reply('energy', `${shift}用电量是多少`, defaults, aggregate).answer,
      /当前资料还不能判断/,
    );
  assert.match(
    reply('energy', '查看每日用电趋势', defaults, aggregate).answer,
    /当前资料还不能判断/,
  );
  assert.match(
    reply('energy', '预测下周用电', defaults, aggregate).answer,
    /126 MWh/,
  );
  const partial = energyDetailAnalysis(data, {
    ...defaults,
    dateFrom: '2026-09-03',
    dateTo: '2026-09-05',
  });
  assert.equal(partial.rows.length, 36);
  assert.equal(partial.days, 3);
  assert.equal(partial.calendarDays, 3);
  assert.equal(partial.start, '2026-09-03');
  assert.equal(partial.end, '2026-09-05');
  assert.equal(partial.availableStart, '2026-09-01');
  assert.equal(partial.availableEnd, '2026-09-07');
  assert.equal(partial.issues.length, 2);
  assert.equal(partial.forecastStart, '2026-09-06');
  assert.equal(partial.forecastEnd, '2026-09-12');
  assert.ok(
    Math.abs(partial.referenceProduction - (partial.production / 3) * 7) < 1e-6,
  );
  const month = energyDetailAnalysis(data, {
    ...defaults,
    dateFrom: '2026-09-01',
    dateTo: '2026-09-30',
    granularity: 'month',
  });
  assert.equal(month.calendarDays, 30);
  assert.equal(month.days, 7, 'Unobserved days are not zero-consumption days');
  assert.equal(month.start, '2026-09-01');
  assert.equal(month.end, '2026-09-07');
  assert.equal(month.rangeEnd, '2026-09-30');
  assert.equal(month.trendGranularity, 'month');
  assert.deepEqual(
    month.trend.map((r) => r.name),
    ['2026-09'],
  );
  assert.equal(month.trend[0].total, 126000);
  assert.equal(month.trend[0].production, 4200);
  assert.equal(month.trend[0].records, 84);
  assert.equal(month.average, 18000);
  assert.equal(month.forecastStart, '2026-09-08');
  assert.equal(month.projected, 126000);
  const year = energyDetailAnalysis(data, {
    ...defaults,
    dateFrom: '2026-01-01',
    dateTo: '2026-12-31',
    granularity: 'year',
  });
  assert.equal(year.calendarDays, 365);
  assert.equal(year.days, 7);
  assert.deepEqual(
    year.trend.map((r) => r.name),
    ['2026'],
  );
  assert.equal(year.trend[0].total, 126000);
  assert.equal(year.trend[0].unit, 30);
  assert.equal(year.trend[0].baseline, 28.3);
  const focused = energyDetailAnalysis(
    data,
    { ...defaults, dateFrom: '2026-09-01', dateTo: '2026-09-02' },
    { date: '2026-09-06', shift: '白班' },
  );
  assert.equal(focused.rangeStart, '2026-09-06');
  assert.equal(focused.rangeEnd, '2026-09-06');
  assert.equal(focused.rows.length, 6);
  assert.equal(focused.days, 1);
  assert.equal(focused.calendarDays, 1);
  assert.equal(focused.issues.length, 1);
  assert.deepEqual(
    focused.shifts.map((r) => r.name),
    ['白班'],
  );
  assert.ok(focused.rows.every((r) => r.date === '2026-09-06'));
  const empty = energyDetailAnalysis(data, {
    ...defaults,
    dateFrom: '2026-10-01',
    dateTo: '2026-10-31',
    granularity: 'month',
  });
  assert.equal(empty.rows.length, 0);
  assert.equal(empty.days, 0);
  assert.equal(empty.calendarDays, 31);
  assert.equal(empty.start, '2026-10-01');
  assert.equal(empty.end, '2026-10-31');
  assert.equal(empty.referenceProduction, 0);
  assert.equal(empty.projected, 0);
  assert.deepEqual(empty.daily, []);
  assert.deepEqual(empty.trend, []);
  assert.doesNotThrow(() =>
    energyDetailAnalysis(data, defaults, { date: '2026-09-99' }),
  );
  const sparse = {
    ...data,
    energyDetails: [
      { ...point, date: '2025-12-31', kwh: 100, production: 10 },
      { ...point, date: '2026-01-02', kwh: 300, production: 20 },
      { ...point, date: '2026-03-01', kwh: 600, production: 30 },
    ],
  };
  const sparseMonths = energyDetailAnalysis(sparse, {
    ...defaults,
    dateFrom: '',
    dateTo: '',
    granularity: 'month',
  });
  assert.equal(sparseMonths.days, 3);
  assert.equal(sparseMonths.calendarDays, 61);
  assert.deepEqual(
    sparseMonths.trend.map((r) => r.name),
    ['2025-12', '2026-01', '2026-03'],
  );
  assert.equal(sparseMonths.total, 1000);
  assert.ok(Math.abs(sparseMonths.average - 1000 / 3) < 1e-6);
  const sparseYears = energyDetailAnalysis(sparse, {
    ...defaults,
    dateFrom: '',
    dateTo: '',
    granularity: 'year',
  });
  assert.deepEqual(
    sparseYears.trend.map((r) => [r.name, r.total, r.records]),
    [
      ['2025', 100, 1],
      ['2026', 900, 2],
    ],
  );
  assert.equal(sparseYears.trend[1].unit, 18);
  const manualPlan = energyDetailAnalysis(data, {
    ...defaults,
    period: '14',
    plannedProduction: '9000',
    change: '200',
  });
  assert.equal(manualPlan.forecastSource, 'plan');
  assert.equal(manualPlan.referenceProduction, 8400);
  assert.equal(manualPlan.plannedProduction, 9000);
  assert.equal(manualPlan.projected, 270000);
  assert.equal(manualPlan.unchanged, 252000);
  assert.ok(Math.abs(manualPlan.productionChange - 50 / 7) < 1e-6);
  assert.equal(manualPlan.forecastEnd, '2026-09-21');
  assert.equal(manualPlan.forecast.at(-1).projected, 270);
  const zeroPlan = energyDetailAnalysis(data, {
    ...defaults,
    plannedProduction: '0',
    change: '5',
  });
  assert.equal(zeroPlan.forecastSource, 'plan');
  assert.equal(zeroPlan.plannedProduction, 0);
  assert.equal(zeroPlan.projected, 0);
  assert.equal(zeroPlan.productionChange, -100);
  const oldChange = energyDetailAnalysis(data, {
    ...defaults,
    plannedProduction: ' ',
    change: '5',
  });
  assert.equal(oldChange.forecastSource, 'change');
  assert.equal(oldChange.plannedProduction, 4410);
  assert.equal(oldChange.projected, 132300);
  const noPlan = energyDetailAnalysis(data, {
    ...defaults,
    plannedProduction: '',
    change: '',
  });
  assert.equal(noPlan.forecastSource, 'history');
  assert.equal(noPlan.projected, 126000);
  for (const plannedProduction of ['not-a-number', 'Infinity', '-1']) {
    const invalidPlan = energyDetailAnalysis(data, {
      ...defaults,
      plannedProduction,
    });
    assert.equal(invalidPlan.forecastSource, 'history');
    assert.equal(invalidPlan.projected, 126000);
    assert.ok(validateInputs('energy', { ...defaults, plannedProduction }));
  }
  assert.equal(
    validateInputs('energy', { ...defaults, plannedProduction: '0' }),
    null,
  );
  for (const dateFrom of ['2026-02-30', '2026-13-01', '2026-9-1'])
    assert.ok(validateInputs('energy', { ...defaults, dateFrom }));
  assert.ok(
    validateInputs('energy', {
      ...defaults,
      dateFrom: '2026-09-08',
      dateTo: '2026-09-01',
    }),
  );
  assert.equal(
    validateInputs('energy', {
      ...defaults,
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      granularity: 'month',
    }),
    null,
  );
  const planReply = reply(
    'energy',
    '未来7天计划产量4200千只，预测用电',
    { ...defaults, change: '5' },
    data,
  );
  assert.equal(planReply.inputs.plannedProduction, '4200');
  assert.match(planReply.answer, /2026-09-08—2026-09-14/);
  assert.match(planReply.answer, /126 MWh/);
  assert.match(planReply.answer, /计划总产量 4,200 千只/);
  const decreaseReply = reply('energy', '下降10%', planReply.inputs, data);
  assert.equal(decreaseReply.inputs.plannedProduction, '');
  assert.equal(decreaseReply.inputs.change, '-10');
  assert.match(decreaseReply.answer, /113\.4 MWh/);
  const unchangedReply = reply('energy', '不变', planReply.inputs, data);
  assert.equal(unchangedReply.inputs.plannedProduction, '');
  assert.equal(unchangedReply.inputs.change, '0');
  const monthReply = reply(
    'energy',
    '按月看能耗趋势',
    { ...defaults, dateFrom: '2026-09-01', dateTo: '2026-09-30' },
    data,
  );
  assert.equal(monthReply.inputs.granularity, 'month');
  assert.match(monthReply.answer, /30 个自然日，其中 7 天有记录/);
  assert.match(monthReply.answer, /2026-09：126 MWh/);
  for (const period of ['7', '14', '30'])
    for (const change of ['-90', '-10', '0', '5', '200']) {
      const view = energyDetailAnalysis(data, { ...defaults, period, change });
      assert.ok(
        Math.abs(view.forecast.at(-1).projected * 1000 - view.projected) < 1e-6,
      );
      assert.ok(
        Math.abs(
          view.projected - 18000 * Number(period) * (1 + Number(change) / 100),
        ) < 1e-6,
      );
    }
  const invalid = reply('energy', '未来11天用电量是多少', defaults, data);
  assert.match(invalid.answer, /调整一个条件/);
  assert.doesNotMatch(invalid.answer, /分析条件/);
  const help = reply('energy', '怎么用', defaults, data);
  assert.doesNotMatch(help.answer, /展开|分析条件/);
  const {
    applyEnergyDashboardConditions,
    applyDashboardConditions,
    startConversation,
    currentSession,
    energyConditions,
  } = require('./sessions.js');
  const emptyState = {
    version: 1,
    datasets: initialDatasets,
    drafts: {},
    records: [],
    sessions: [],
    activeSessionIds: {},
  };
  const selected = {
    ...defaults,
    process: '老化',
    line: '1号产线',
    period: '14',
    change: '-10',
    dateFrom: '2026-09-03',
    dateTo: '2026-09-06',
    granularity: 'month',
    plannedProduction: '1000',
  };
  let state = startConversation(emptyState, 'energy');
  const session = currentSession(state, 'energy');
  session.draft.question = '按当前条件分析';
  session.turns.push({
    id: 'historical',
    question: '历史问题',
    answer: '历史回答',
    inputs: defaults,
  });
  state = applyEnergyDashboardConditions(state, selected);
  const synced = currentSession(state, 'energy');
  assert.equal(synced.draft.question, '按当前条件分析');
  assert.equal(synced.turns[0].answer, '历史回答');
  assert.equal(synced.turns[0].inputs.change, '0');
  assert.equal(synced.draft.change, '-10');
  assert.equal(synced.draft.process, '老化');
  assert.equal(synced.draft.line, '1号产线');
  for (const key of ['dateFrom', 'dateTo', 'granularity', 'plannedProduction'])
    assert.equal(synced.draft[key], selected[key]);
  assert.ok(
    Object.values(energyConditions({})).every(
      (value) => typeof value === 'string',
    ),
  );
  assert.equal(state.moduleViews.energy, 'chat');
  assert.match(
    reply('energy', synced.draft.question, synced.draft, data).answer,
    /1号产线/,
  );
  const fresh = applyEnergyDashboardConditions(emptyState, selected);
  assert.equal(currentSession(fresh, 'energy').draft.period, '14');
  for (const module of ['production', 'supplier']) {
    const before = startConversation(emptyState, module);
    const original = currentSession(before, module);
    original.draft.question = '继续分析刚才的问题';
    original.draft.notes = '保留已有补充说明';
    original.turns.push({
      id: 'previous',
      question: '历史问题',
      answer: '历史回答',
    });
    const scope =
      module === 'production'
        ? { line: '3号产线', completion: '92' }
        : { supplier: '供应商A', deliveryTarget: '96' };
    const after = applyDashboardConditions(before, module, {
      ...defaultInputs[module],
      ...scope,
      question: '不能替换用户草稿',
    });
    const reopened = currentSession(after, module);
    assert.equal(reopened.id, original.id);
    assert.equal(after.sessions.length, 1);
    assert.equal(reopened.draft.question, '继续分析刚才的问题');
    assert.equal(reopened.draft.notes, '保留已有补充说明');
    assert.deepEqual(reopened.turns, original.turns);
    for (const [key, value] of Object.entries(scope))
      assert.equal(
        reopened.draft[key],
        ['line', 'supplier'].includes(key) ? value : defaultInputs[module][key],
      );
    const legacyDraft = startConversation(emptyState, module, {
      ...defaultInputs[module],
      ...scope,
    });
    for (const [key, value] of Object.entries(scope))
      assert.equal(
        currentSession(legacyDraft, module).draft[key],
        ['line', 'supplier'].includes(key) ? value : defaultInputs[module][key],
      );
    assert.equal(after.moduleViews[module], 'chat');
  }
  const production = initialDatasets.find((item) => item.id === 'production');
  assert.equal(
    reply(
      'production',
      '分析全部产线的生产情况',
      defaultInputs.production,
      production,
    ).analysis,
    undefined,
  );
  console.log(
    'Energy: date coverage, day/month/year trends, weighted comparisons, plan/history forecasts, anomaly thresholds, scope sync and legacy-data boundaries passed.',
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
