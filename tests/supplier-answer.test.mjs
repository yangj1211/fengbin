import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

// Run from the project root; this tests the integrated implementation.
const projectRequire = createRequire(path.resolve('package.json'));
const ts = projectRequire('typescript');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fengbin-supplier-test-'));
try {
  const files = new Set(
    fs.readdirSync('app/application').filter((file) => file.endsWith('.ts')),
  );
  files.add('supplier-answer.ts');
  for (const file of files) {
    const source = `app/application/${file}`;
    fs.writeFileSync(
      path.join(temp, file.replace(/\.ts$/, '.js')),
      ts.transpileModule(fs.readFileSync(source, 'utf8'), {
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
  const { initialDatasets, defaultInputs, analyze } = require('./model.js');
  const { supplierScore, supplierRisk } = require('./supplier-metrics.js');
  const { replyToSupplier, supplierExamples } = require('./supplier-answer.js');
  const { replyToQuestion, suggestions } = require('./conversation.js');
  const { productionTurnText } = require('./legacy-answer.js');
  const { buildDashboard } = require('./dashboard-data.js');
  const data = initialDatasets.find((item) => item.id === 'suppliers');
  const defaults = defaultInputs.supplier;
  assert.equal(suggestions.supplier.length, 3);
  const routed = replyToQuestion(
    'supplier',
    '供应商C的评分怎么算？',
    defaults,
    data,
  );
  assert.equal(routed.analysis, undefined);
  assert.match(routed.answer, /32\.8 \+ 38 \+ 14\.4 = 85\.2/);
  const board = buildDashboard('supplier', data, defaults);
  assert.equal(
    board.metrics.find((item) => item.label === '交付风险').value,
    '2',
  );
  assert.equal(
    board.metrics.find((item) => item.label === '质量风险').value,
    '1',
  );
  assert.equal(board.issues.length, 2);
  assert.equal(
    board.issues.some((item) => item.row === data.rows[0]),
    false,
  );
  const historical = {
    answer: '我已根据「供应商资料」完成本次分析。下方列出了采用的条件。',
    analysis: analyze('supplier', defaults, data),
    sourceName: data.name,
  };
  const original = JSON.stringify(historical);
  const historicalText = productionTurnText(historical);
  assert.match(historicalText, /98\.0|94\.7|85\.2/);
  assert.doesNotMatch(historicalText, /下方列出了采用的条件/);
  assert.ok(
    historicalText.lastIndexOf('参考数据：') >
      historicalText.indexOf('综合评分'),
  );
  assert.equal(JSON.stringify(historical), original);
  const reply = (q, input = defaults, dataset = data) =>
    replyToSupplier(q, input, dataset);
  assert.ok(supplierExamples.length >= 5);
  for (const example of supplierExamples) {
    const result = reply(example.question);
    assert.equal(result.analysis, undefined);
    assert.ok(result.answer.length > 60);
    assert.equal(result.answer.match(/参考数据：/g)?.length, 1);
    assert.match(result.answer, /参考数据：\[供应商交付与质量.csv\]/);
    assert.doesNotMatch(result.answer, /采用建议|下方卡片|分析条件|保存分析/);
  }
  assert.match(
    reply('你能做什么').answer,
    /评分排名|交付风险|质量风险|比较供应商|评分与规则/,
  );
  const scores = data.rows.map((row) =>
    Number(supplierScore(row, defaults).toFixed(2)),
  );
  assert.deepEqual(scores, [98.04, 94.72, 85.2]);
  const ranked = reply('全部供应商评分排名').answer;
  for (const score of scores) assert.ok(ranked.includes(String(score)));
  assert.ok(ranked.indexOf('供应商 A') < ranked.indexOf('供应商 B'));
  assert.ok(ranked.indexOf('供应商 B') < ranked.indexOf('供应商 C'));
  assert.deepEqual(
    data.rows.map((row) => supplierRisk(row, defaults)),
    [
      { delivery: false, quality: false },
      { delivery: true, quality: false },
      { delivery: true, quality: true },
    ],
  );
  assert.doesNotThrow(() => analyze('supplier', defaults, data));
  const deliveryAnswer = reply('哪些供应商有交付风险').answer;
  assert.match(deliveryAnswer, /2家未达标/);
  assert.match(deliveryAnswer, /供应商 B：交付及时率94%/);
  assert.match(deliveryAnswer, /供应商 C：交付及时率82%/);
  assert.doesNotMatch(deliveryAnswer, /来料合格率|综合评分/);
  const qualityAnswer = reply('哪些供应商有质量风险').answer;
  assert.match(qualityAnswer, /1家未达标/);
  assert.match(qualityAnswer, /供应商 C：来料合格率95%/);
  assert.doesNotMatch(qualityAnswer, /交付及时率|综合评分/);
  assert.match(reply('全部供应商有哪些风险').answer, /2家供应商存在/);
  const comparison = reply('对比供应商 a 和 c 的表现');
  assert.match(comparison.answer, /供应商 A/);
  assert.match(comparison.answer, /供应商 C/);
  assert.doesNotMatch(comparison.answer, /供应商 B/);
  assert.deepEqual(
    require('./scope.js').scopeValues(comparison.inputs.supplier, '全部供应商'),
    ['供应商 A', '供应商 C'],
  );
  const followup = reply('质量风险呢', comparison.inputs);
  assert.equal(followup.inputs.supplier, comparison.inputs.supplier);
  assert.doesNotMatch(followup.answer, /供应商 B/);
  assert.equal(
    reply('再看所有供应商评分', followup.inputs).inputs.supplier,
    '全部供应商',
  );
  for (const q of [
    '供应商 Z 的评分',
    '供应商 AA 的评分',
    '未知供应商表现如何',
  ]) {
    const result = reply(q);
    assert.match(result.answer, /未找到/);
    assert.doesNotMatch(result.answer, /98\.04|94\.72|85\.2/);
  }
  const partial = reply('A 和 Z 对比').answer;
  assert.match(partial, /未找到/);
  assert.match(partial, /供应商 A/);
  assert.doesNotMatch(partial, /供应商 B|供应商 C/);
  const changed = reply('交付权重改为30%，质量权重改为50%，重新排名');
  assert.equal(changed.inputs.deliveryWeight, '40');
  assert.equal(changed.inputs.qualityWeight, '40');
  assert.match(changed.answer, /固定规则|不支持修改/);
  for (const score of scores) assert.ok(changed.answer.includes(String(score)));
  const thirtySixty = reply(
    '交付权重改为30%，质量权重改为60%，响应权重改为10%，重新排名',
  );
  assert.equal(thirtySixty.inputs.deliveryWeight, '40');
  assert.equal(thirtySixty.inputs.qualityWeight, '40');
  for (const score of scores)
    assert.ok(thirtySixty.answer.includes(String(score)));
  const targets = reply('把交付目标调整到94%，来料合格率目标设为95%，检查风险');
  assert.equal(targets.inputs.deliveryTarget, '95');
  assert.equal(targets.inputs.qualityTarget, '98');
  assert.match(targets.answer, /2家供应商存在/);
  const boundaryRow = {
    ...data.rows[0],
    '交付及时率(%)': 95,
    '来料合格率(%)': 98,
  };
  assert.deepEqual(supplierRisk(boundaryRow, defaults), {
    delivery: false,
    quality: false,
  });
  // Old custom and invalid settings cannot leak into any current calculation.
  const oldRules = {
    ...defaults,
    deliveryWeight: '80',
    qualityWeight: '80',
    deliveryTarget: '101',
    qualityTarget: '0',
  };
  assert.deepEqual(
    buildDashboard('supplier', data, oldRules).metrics,
    board.metrics,
  );
  assert.deepEqual(
    analyze('supplier', oldRules, data),
    analyze('supplier', defaults, data),
  );
  for (const row of data.rows) {
    assert.equal(supplierScore(row, oldRules), supplierScore(row, defaults));
    assert.deepEqual(supplierRisk(row, oldRules), supplierRisk(row, defaults));
  }
  assert.match(reply('供应商评分排名', oldRules).answer, /98\.04/);
  for (const q of [
    '供应商 A 交付及时率98%、来料合格率99.6%，为什么评分高？',
    '当前交付权重是50%，为什么这样设定？',
    '如果交付权重改为50%，会怎样？',
    '如果交付权重改为50%，质量权重改为30%，会怎样？',
    '之前交付目标设为99%，为什么风险高？',
    '不要把交付目标改为99%',
  ]) {
    const result = reply(q);
    for (const field of [
      'deliveryWeight',
      'qualityWeight',
      'deliveryTarget',
      'qualityTarget',
    ])
      assert.equal(
        result.inputs[field],
        defaults[field],
        `${q}: ${field} must remain unchanged`,
      );
  }
  for (const q of [
    '交付权重改为80%，质量权重改为40%',
    '交付目标改为101%',
    '交付权重改为30%，质量权重改为50%，响应权重改为30%',
  ]) {
    const result = reply(q);
    assert.match(result.answer, /固定规则|不支持修改/);
    assert.equal(result.inputs.deliveryWeight, defaults.deliveryWeight);
    assert.equal(result.inputs.qualityWeight, defaults.qualityWeight);
  }
  const explanation = reply('综合评分怎么算，评分高就没有风险吗？').answer;
  assert.match(explanation, /综合评分 =/);
  assert.match(explanation, /风险独立判断/);
  assert.match(explanation, /刚好等于目标视为达标/);
  const highScore = { ...defaults, deliveryWeight: '0', qualityWeight: '100' };
  assert.match(
    reply('供应商 B 评分高就没有风险吗', highScore).answer,
    /94\.72分.*交付及时率94%低于95%/,
  );
  for (const q of [
    '9月1日的供应商评分',
    '9-1交付如何',
    '9/1质量如何',
    '供应商表现同比如何',
    '供应商整体交付及时率多少',
    '供应商来料合格率加权平均是多少',
    '有多少订单延期',
    '哪批来料不合格',
    '供应商 C 质量问题原因是什么',
  ])
    assert.match(reply(q).answer, /没有|无法|不能/);
  const duplicate = {
    ...data,
    rows: [...data.rows, { ...data.rows[0], 供应商: '供 应 商 a' }],
  };
  assert.match(
    reply('全部供应商评分排名', defaults, duplicate).answer,
    /重复.*汇总记录/,
  );
  const invalid = {
    ...data,
    rows: [{ ...data.rows[0], '交付及时率(%)': 101 }],
  };
  assert.match(reply('评分', defaults, invalid).answer, /无法计算/);
  const empty = { ...data, rows: [] };
  assert.match(reply('评分', defaults, empty).answer, /无法计算/);
  const local = {
    ...data,
    origin: 'local',
    fileName: '[来料](evil).csv',
    rows: [{ ...data.rows[0], 供应商: '甲[测试]' }],
  };
  const escaped = reply('全部供应商排名', defaults, local).answer;
  assert.ok(escaped.includes('甲\\[测试\\]'));
  assert.ok(escaped.includes('\\[来料\\]\\(evil\\).csv'));
  assert.match(escaped, /按供应商汇总/);
  assert.doesNotMatch(escaped, /\/data\/supplier\//);
  assert.doesNotMatch(escaped, /https?:\/\//);
  console.log(
    'Supplier answer tests passed: five categories, shared scores/risks, scope, fixed rules, validation and data limits.',
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
