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
  for (const file of ['customer-fixtures.json', 'maintenance-fixtures.json'])
    fs.copyFileSync(`app/application/${file}`, path.join(temp, file));
  const require = createRequire(path.join(temp, 'check.cjs'));
  const { replyToQuestion: reply } = require('./conversation.js');
  const { initialDatasets, defaultInputs } = require('./model.js');
  const { buildDashboard } = require('./dashboard-data.js');
  const data = initialDatasets.find((item) => item.id === 'energy');
  const defaults = defaultInputs.energy;
  const answer = reply('energy', '全部工序用电情况怎么样', defaults, data);
  assert.equal(answer.analysis, undefined);
  assert.match(answer.answer, /126 MWh/);
  assert.match(answer.answer, /132\.3 MWh/);
  assert.match(answer.answer, /老化.*12\.5%/);
  assert.match(answer.answer, /参考数据：工序用电与产量/);
  assert.ok(answer.answer.endsWith('工序汇总资料）。'));
  assert.equal(buildDashboard('energy', data, defaults).issues.length, 1);
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
  assert.match(scoped.answer, /没有超过基准 5%/);
  assert.doesNotMatch(scoped.answer, /老化：/);
  assert.equal(buildDashboard('energy', data, scoped.inputs).issues.length, 0);
  const unchanged = reply(
    'energy',
    '产量不变，预测7天全部工序用电',
    fewer.inputs,
    data,
  );
  assert.equal(unchanged.inputs.change, '0');
  assert.match(unchanged.answer, /约需 126 MWh/);
  for (const query of [
    '查看每日用电趋势',
    '比较不同班次的能耗',
    '非生产时段能耗是否异常',
    '分析用水量',
    '查看空压能耗',
  ]) {
    const result = reply('energy', query, defaults, data);
    assert.match(result.answer, /当前资料还不能判断/, query);
    assert.doesNotMatch(result.answer, /132\.3|可能原因已确认/, query);
    assert.equal(result.analysis, undefined);
  }
  const invalid = reply('energy', '未来11天用电量是多少', defaults, data);
  assert.match(invalid.answer, /调整一个条件/);
  assert.doesNotMatch(invalid.answer, /分析条件/);
  const help = reply('energy', '怎么用', defaults, data);
  assert.doesNotMatch(help.answer, /展开|分析条件/);
  const {
    applyEnergyDashboardConditions,
    startConversation,
    currentSession,
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
    period: '14',
    change: '-10',
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
  assert.equal(synced.turns[0].inputs.change, '5');
  assert.equal(synced.draft.change, '-10');
  assert.equal(synced.draft.process, '老化');
  assert.equal(state.moduleViews.energy, 'chat');
  assert.match(
    reply('energy', synced.draft.question, synced.draft, data).answer,
    /102\.1 MWh/,
  );
  const fresh = applyEnergyDashboardConditions(emptyState, selected);
  assert.equal(currentSession(fresh, 'energy').draft.period, '14');
  const production = initialDatasets.find((item) => item.id === 'production');
  assert.ok(
    reply(
      'production',
      '分析全部产线的生产情况',
      defaultInputs.production,
      production,
    ).analysis,
  );
  console.log(
    'Energy: aggregate calculations, scope, forecast inputs, missing-data boundaries and plain-text replies passed.',
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
