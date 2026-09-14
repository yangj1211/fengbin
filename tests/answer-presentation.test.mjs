import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const sourceRequire = createRequire(path.resolve('package.json'));
const ts = sourceRequire('typescript');
const temp = fs.mkdtempSync(
  path.join(os.tmpdir(), 'fengbin-answer-presentation-'),
);
try {
  for (const file of fs.readdirSync('app/application')) {
    if (file.endsWith('.json')) {
      fs.copyFileSync(`app/application/${file}`, path.join(temp, file));
    } else if (file.endsWith('.ts')) {
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
  }
  if (process.env.FENGBIN_ANSWER_CANDIDATE) {
    fs.writeFileSync(
      path.join(temp, 'answer-presentation.js'),
      ts.transpileModule(
        fs.readFileSync(process.env.FENGBIN_ANSWER_CANDIDATE, 'utf8'),
        {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true,
          },
        },
      ).outputText,
    );
  }
  const require = createRequire(path.join(temp, 'check.cjs'));
  const {
    answerText,
    answerSources,
    processingSummary,
  } = require('./answer-presentation.js');
  const { defaultInputs, initialDatasets } = require('./model.js');
  const { replyToQuestion } = require('./conversation.js');
  const { customerExamples, customerProducts } = require('./customer-data.js');
  const {
    legacyAnalysisText,
    productionTurnText,
  } = require('./legacy-answer.js');
  const { presentAnswer } = require('./business-presentation.js');
  const { encodeScope } = require('./scope.js');
  const literal = (value) => value.replace(/[\\`*_{}\[\]()<>~|#!]/g, '\\$&');
  const makeTurn = (id, reply = {}) => ({
    id: 'test',
    question: '按当前条件分析',
    answer: '',
    createdAt: '2026-09-13T00:00:00Z',
    inputs: { ...defaultInputs[id] },
    sourceName: '业务资料.csv',
    sourceOrigin: 'sample',
    ...reply,
  });
  const dataset = (id) => initialDatasets.find((item) => item.module === id);

  // Current real-spec replies stay plain text; historical product analyses remain readable.
  for (const example of customerExamples) {
    const reply = replyToQuestion(
      'customer',
      example.question,
      defaultInputs.customer,
      dataset('customer'),
    );
    const turn = makeTurn('customer', { ...reply, question: example.question });
    const body = answerText('customer', turn);
    assert.ok(body.startsWith(literal(presentAnswer(turn).answer)));
    assert.equal(reply.analysis, undefined);
    assert.deepEqual(answerSources('customer', turn), reply.sources);
    assert.ok(reply.sources.length > 0);
    assert.ok(!body.includes('documentId'));
  }
  const product = customerProducts[0];
  const oldCandidate = {
    product,
    reasons: ['原有推荐理由', '原有校核'],
    sources: [product.source],
  };
  const lookup = makeTurn('customer', {
    analysis: {
      title: '产品规格查询',
      summary: '历史规格',
      recommendation: '历史结论',
      metrics: [],
      columns: [],
      rows: [],
      bars: [],
      chartTitle: '',
      steps: [],
      basis: [],
      customerCandidates: [oldCandidate],
      sources: [product.source],
    },
  });
  const lookupBody = answerText('customer', lookup);
  assert.ok(lookupBody.includes(product.model));
  for (const reason of oldCandidate.reasons)
    assert.ok(lookupBody.includes(reason));
  assert.ok(lookupBody.includes(`参考交期 ${product.leadDays} 天`));

  const baseAnalysis = {
    title: '历史分析',
    summary: '历史概况',
    metrics: [{ label: '指标', value: '10', detail: '说明' }],
    columns: ['型号', '参数', '备注'],
    rows: [['OLD[1]', 220]],
    bars: [],
    chartTitle: '',
    steps: [{ title: '核查', body: '具体内容' }],
    recommendation: '需人工确认',
    basis: ['来源：旧资料', '历史口径'],
  };
  const legacyCustomer = makeTurn('customer', { analysis: baseAnalysis });
  const legacyBody = answerText('customer', legacyCustomer);
  assert.ok(legacyBody.includes('OLD\\[1\\]'));
  assert.ok(legacyBody.includes('参数：220，备注：未记录。'));
  assert.ok(legacyBody.includes('需人工确认'));
  const pending = makeTurn('customer', {
    answer: '已记录',
    inputs: { ...defaultInputs.customer, application: '工业' },
    missing: ['寿命', '温度'],
  });
  assert.ok(answerText('customer', pending).includes('待补充：寿命、温度'));
  assert.ok(answerText('customer', pending).includes('已识别的条件：'));

  const reference = { documentId: 'catalog', sectionId: 'p1', page: 1 };
  const oldReference = { documentId: 'rules', sectionId: 'r1', page: 2 };
  for (const id of ['production', 'supplier', 'energy', 'maintenance']) {
    const plain = makeTurn(id, {
      answer: '参考数据：[业务资料.csv](/data/示例.csv)',
      sources: [oldReference],
    });
    assert.equal(answerText(id, plain), plain.answer); // Markdown URL targets must not be rewritten.
    assert.deepEqual(
      answerSources(id, plain),
      id === 'maintenance' ? [oldReference] : undefined,
    );
    const historical = makeTurn(id, {
      answer: '此前回答',
      analysis: baseAnalysis,
    });
    const shown = presentAnswer(historical);
    const expected =
      id === 'production' || id === 'supplier'
        ? productionTurnText(shown)
        : `${shown.answer}\n\n${legacyAnalysisText(shown.analysis)}${id === 'energy' ? '\n\n参考数据：业务资料.csv（历史汇总记录，按当时条件作线性估算）。' : ''}`;
    assert.equal(answerText(id, historical), expected);
  }
  const sourceTurn = makeTurn('customer', {
    sources: [oldReference],
    analysis: { ...baseAnalysis, sources: [reference] },
  });
  assert.deepEqual(answerSources('customer', sourceTurn), [reference]);
  assert.deepEqual(
    answerSources('customer', {
      ...sourceTurn,
      analysis: { ...baseAnalysis, sources: [] },
    }),
    [],
  );
  assert.deepEqual(
    answerSources('customer', { ...sourceTurn, analysis: baseAnalysis }),
    [oldReference],
  );
  for (const id of [
    'customer',
    'maintenance',
    'energy',
    'production',
    'supplier',
  ]) {
    const stopped = {
      ...sourceTurn,
      status: 'stopped',
      answer: '**已输出的部',
    };
    assert.equal(answerText(id, stopped), stopped.answer);
    assert.equal(answerSources(id, stopped), undefined);
    const turn = makeTurn(id);
    const before = JSON.stringify(turn);
    const summary = processingSummary(id, turn);
    assert.ok(summary.length > 0 && summary.split('\n').length <= 3);
    assert.doesNotMatch(
      summary,
      /样例|示例|演示|虚构|documentId|sectionId|@scope:|工具调用/,
    );
    assert.equal(JSON.stringify(turn), before);
    assert.equal(turn.processingSummary, undefined); // No historical summary is written by this helper.
  }
  const encoded = encodeScope(['1号产线', '3号产线'], '全部产线', [
    '1号产线',
    '2号产线',
    '3号产线',
  ]);
  const summary = processingSummary(
    'production',
    makeTurn('production', {
      inputs: { ...defaultInputs.production, line: encoded },
    }),
  );
  assert.ok(summary.includes('1号产线、3号产线'));
  assert.doesNotMatch(summary, /@scope:|\["/);
  const energy = makeTurn('energy', {
    question: '9月1日的用电量',
    inputs: {
      ...defaultInputs.energy,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      plannedProduction: '0',
    },
  });
  const energySummary = processingSummary('energy', energy);
  assert.ok(energySummary.includes('问题指定日期 9月1日'));
  assert.ok(energySummary.includes('计划总产量 0 千只'));
  assert.ok(!energySummary.includes('2026-08-01'));
  console.log(
    'answer-presentation: customer content, five modules, legacy replies, citations, stopped output, Markdown links, and summaries passed',
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
