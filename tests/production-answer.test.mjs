import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fengbin-production-test-'));
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
  const { initialDatasets, defaultInputs, analyze } = require('./model.js');
  const { buildDashboard } = require('./dashboard-data.js');
  const { replyToQuestion, suggestions } = require('./conversation.js');
  const {
    productionExamples,
    productionDailyReportExample,
  } = require('./production-answer.js');
  const { productionTurnText } = require('./legacy-answer.js');
  const data = initialDatasets.find((item) => item.id === 'production');
  const defaults = defaultInputs.production;
  const reply = (question, input = defaults, dataset = data) =>
    replyToQuestion('production', question, input, dataset);

  // Dashboard totals must agree with the answers, including weighted quality and deduplicated alerts.
  const board = buildDashboard('production', data, defaults);
  assert.equal(board.metrics.length, 5);
  const metrics = Object.fromEntries(
    board.metrics.map((item) => [item.label, item.value]),
  );
  assert.deepEqual(metrics, {
    实际产量: '37.3',
    计划完成率: '93.25',
    检验良率: '98.35',
    累计停机: '140',
    异常产线: '1',
  });
  assert.equal(productionExamples.length, 5);
  assert.equal(
    suggestions.production.length,
    3,
    'Five supported categories do not require five welcome cards',
  );
  for (const example of productionExamples) {
    const result = reply(example.question);
    assert.equal(result.analysis, undefined);
    assert.ok(result.answer.length > 50);
    assert.doesNotMatch(result.answer, /下方列出|分析条件|保存分析|采用建议/);
    assert.match(result.answer, /参考数据[：:]/);
    assert.ok(
      result.answer
        .slice(result.answer.lastIndexOf('参考数据'))
        .includes(data.name),
    );
  }
  assert.equal(suggestions.production[0].title, '生成生产日报');
  for (const question of [
    productionDailyReportExample.question,
    '生成日报',
    '生成今天的生产日报',
    '生成2026年9月12日的生产日报',
    '生成生产日报，并说明异常判定依据',
  ]) {
    const report = reply(question);
    assert.equal(report.analysis, undefined);
    assert.match(report.answer, /生产日报/);
    assert.match(report.answer, /统计日期待确认/);
    assert.match(
      report.answer,
      /计划产量 40 万只.*实际完成 37\.3 万只.*93\.25%/,
    );
    assert.match(report.answer, /还差 2\.7 万只/);
    assert.match(report.answer, /检验 40,000 只.*不良 660 只.*1\.65%.*98\.35%/);
    assert.match(report.answer, /累计停机 140 分钟/);
    assert.match(report.answer, /共 1 条产线需要关注/);
    assert.match(report.answer, /3号产线：完成率 82%.*不良率 2\.8%/);
    assert.match(report.answer, /跟进建议/);
    assert.equal((report.answer.match(/参考数据：/g) ?? []).length, 1);
    assert.ok(report.answer.split('\n\n').at(-1).startsWith('参考数据：'));
    assert.doesNotMatch(report.answer, /保存分析|采用建议|导出报告|示例|样例/);
  }
  const scopedReport = reply('生成日报', { ...defaults, line: '3号产线' });
  assert.match(scopedReport.answer, /统计范围：3号产线/);
  assert.match(scopedReport.answer, /实际完成 8\.2 万只/);
  assert.match(scopedReport.answer, /累计停机 76 分钟/);
  assert.doesNotMatch(scopedReport.answer, /1号产线|2号产线|4号产线|37\.3/);
  const multiReport = reply('生成1号产线和3号产线的生产日报');
  assert.match(multiReport.answer, /实际完成 18 万只/);
  assert.match(multiReport.answer, /累计停机 94 分钟/);
  assert.doesNotMatch(multiReport.answer, /2号产线|4号产线/);
  const missingReport = reply('生成1号产线和9号产线的日报');
  assert.match(missingReport.answer, /未找到9号产线.*未涵盖全部指定产线/);
  assert.match(missingReport.answer, /实际完成 9\.8 万只/);
  assert.match(reply('生成9号产线的日报').answer, /没有找到/);
  assert.match(
    reply('生成日报', defaults, { ...data, rows: [] }).answer,
    /没有生产记录/,
  );
  const progress = reply(
    '全部产线计划多少、实际生产多少，完成率多少，还差多少？',
  );
  assert.match(progress.answer, /40/);
  assert.match(progress.answer, /37\.3/);
  assert.match(progress.answer, /93\.25/);
  assert.match(progress.answer, /2\.7/);
  const quality = reply('全部产线检验良率和不良率是多少，哪些不良率超过2%？');
  assert.match(quality.answer, /98\.35/);
  assert.match(quality.answer, /1\.65/);
  assert.match(quality.answer, /660/);
  assert.match(quality.answer, /3号产线/);
  assert.match(quality.answer, /2\.8/);
  const downtime = reply('全部产线累计停机多久，哪条停机最多？');
  assert.match(downtime.answer, /140/);
  assert.match(downtime.answer, /3号产线/);
  assert.match(downtime.answer, /76/);
  const comparison = reply('对比1号产线和3号产线的完成率和质量');
  assert.match(comparison.answer, /1号产线/);
  assert.match(comparison.answer, /3号产线/);
  assert.doesNotMatch(comparison.answer, /2号产线|4号产线/);
  assert.match(comparison.answer, /98/);
  assert.match(comparison.answer, /82/);
  assert.match(comparison.answer, /2\.8/);
  const aliases = reply('分析三号产线的生产异常');
  assert.equal(aliases.inputs.line, '3号产线');
  assert.match(aliases.answer, /82/);
  assert.match(aliases.answer, /2\.8/);
  const threshold = reply(
    '完成率目标改为98%，不良率上限改为1.5%，检查全部产线异常',
  );
  assert.equal(threshold.inputs.completion, '95');
  assert.equal(threshold.inputs.defect, '2');
  assert.match(threshold.answer, /固定规则|不支持修改/);
  const thresholdBoard = buildDashboard('production', data, threshold.inputs);
  assert.deepEqual(
    thresholdBoard.issues.map((row) => row.name),
    ['3号产线'],
  );
  const atBoundary = {
    ...data,
    rows: [{ ...data.rows[0], '实际产量(万只)': 9.5, 不良数量: 200 }],
  };
  assert.equal(
    buildDashboard('production', atBoundary, defaults).issues.length,
    0,
  );
  assert.match(
    reply('生成日报', defaults, atBoundary).answer,
    /当前没有异常产线/,
  );
  const boundary = reply('1号产线质量是否异常', defaults, atBoundary);
  assert.doesNotMatch(boundary.answer, /不良率\s*2%[，,]?\s*(?:超过|高于)\s*2/);
  const unknown = reply('查看9号产线生产情况');
  assert.match(unknown.answer, /没有|未找到|不存在/);
  assert.doesNotMatch(unknown.answer, /37\.3/);
  const unknownChinese = reply('查看十二号产线生产情况');
  assert.match(unknownChinese.answer, /没有|未找到|不存在/);
  assert.doesNotMatch(unknownChinese.answer, /2号产线计划产量/);
  const factQuestion = reply('3号产线完成率82%、不良率2.8%，为什么异常？');
  assert.equal(factQuestion.inputs.completion, '95');
  assert.equal(factQuestion.inputs.defect, '2');
  const at97 = { ...defaults, completion: '97', defect: '1.5' };
  assert.deepEqual(
    buildDashboard('production', data, at97).issues.map((item) => item.name),
    ['3号产线'],
  );
  assert.match(reply('全部产线有哪些异常', at97).answer, /1 条产线/);
  assert.equal(analyze('production', at97, data).title, '1 条产线需要关注');
  const rules = reply('规则是怎么定的', at97).answer;
  assert.match(rules, /固定|不支持修改/);
  assert.match(rules, /规则适用于当前生产看板/);
  assert.match(rules, /95%/);
  assert.match(rules, /2%/);
  assert.match(rules, /刚好等于/);
  const invalid = reply('完成率目标改为110%，重新检查');
  assert.match(invalid.answer, /固定规则|不支持修改/);
  assert.equal(invalid.inputs.completion, '95');
  const legacyInvalid = { ...defaults, completion: '110', defect: '-1' };
  assert.equal(
    analyze('production', legacyInvalid, data).title,
    board.analysis.title,
  );
  assert.deepEqual(
    buildDashboard('production', data, legacyInvalid).metrics,
    board.metrics,
  );
  assert.doesNotMatch(invalid.answer, /NaN|Infinity/);
  for (const question of [
    '看昨天各班次产量',
    '生产OEE是多少',
    '最近一周产量趋势如何',
    '9月1日产量是多少',
    '9/1产量是多少',
  ]) {
    const answer = reply(question).answer;
    assert.match(answer, /未提供|没有|缺少|不包含|无法|不能/);
    assert.doesNotMatch(answer, /NaN|Infinity/);
  }
  // Unequal inspection totals must produce weighted quality, not a mean of per-line percentages.
  const unequal = {
    ...data,
    origin: 'local',
    fileName: '核对用生产数据.csv',
    rows: [
      { ...data.rows[0], 检验数量: 1000, 不良数量: 10 },
      { ...data.rows[1], 检验数量: 9000, 不良数量: 450 },
    ],
  };
  const weighted = reply(
    '全部产线综合不良率和检验良率是多少',
    defaults,
    unequal,
  );
  assert.match(weighted.answer, /4\.6/);
  assert.match(weighted.answer, /95\.4/);
  assert.match(weighted.answer, /核对用生产数据/);
  assert.doesNotMatch(weighted.answer, /示例资料|合成示例/);
  const weightedReport = reply('生成日报', defaults, unequal);
  assert.match(weightedReport.answer, /加权不良率 4\.6%，良率 95\.4%/);
  const empty = reply('产量多少', defaults, { ...data, rows: [] });
  assert.match(empty.answer, /没有|暂无|为空|未提供|无可用/);
  assert.doesNotMatch(empty.answer, /NaN|Infinity/);

  const old = {
    answer:
      '我已根据「产线生产日报」完成本次分析。下方列出了采用的条件；未提及的参数沿用当前设置，您可以继续提问调整。',
    analysis: analyze('production', defaults, data),
    sourceName: data.name,
  };
  const before = JSON.stringify(old);
  const text = productionTurnText(old);
  assert.doesNotMatch(text, /下方列出了/);
  assert.match(text, /完成率/);
  assert.match(text, /检验数量/);
  assert.match(text, /参考数据：产线生产日报/);
  assert.equal(
    JSON.stringify(old),
    before,
    'Rendering history must not rewrite saved results',
  );
  assert.equal(
    productionTurnText({ answer: progress.answer, sourceName: data.name }),
    progress.answer,
  );
  const help = reply('你能做什么').answer;
  for (const example of productionExamples)
    assert.ok(help.includes(example.question));
  assert.ok(help.includes(productionDailyReportExample.question));
  console.log(
    'Production: five dashboard metrics, five plain-language query categories, weighted quality, thresholds, scope, source boundaries and history compatibility passed.',
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
