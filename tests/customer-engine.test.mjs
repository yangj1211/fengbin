import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fengbin-customer-test-'));
try {
  for (const name of ['customer-engine', 'customer-data', 'customer-types']) {
    const source = fs.readFileSync(`app/application/${name}.ts`, 'utf8');
    fs.writeFileSync(
      path.join(temp, `${name}.js`),
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      }).outputText,
    );
  }
  fs.copyFileSync(
    'app/application/customer-fixtures.json',
    path.join(temp, 'customer-fixtures.json'),
  );
  const require = createRequire(path.join(temp, 'check.cjs'));
  const {
    replyToCustomer: reply,
    customerDefaults: defaults,
    normalizeCustomerInputs,
  } = require('./customer-engine.js');
  const {
    customerFixtures: fixtures,
    resolveSource,
  } = require('./customer-data.js');
  const checkReferences = (result) => {
    assert.ok(result.sources.length > 0, 'Every reply needs a real source');
    for (const ref of result.sources)
      assert.ok(resolveSource(ref), JSON.stringify(ref));
    for (const candidate of result.analysis?.customerCandidates ?? []) {
      assert.ok(candidate.reasons.length > 0);
      for (const ref of candidate.sources) assert.ok(resolveSource(ref));
    }
    return result;
  };
  for (const example of fixtures.cases) {
    const result = checkReferences(reply(example.question, defaults));
    assert.ok(result.analysis, example.id);
    assert.deepEqual(
      result.analysis.rows.map((r) => r[0]).sort((a, b) => a.localeCompare(b)),
      [...example.recommendedModels].sort((a, b) => a.localeCompare(b)),
      example.id,
    );
    assert.ok(
      result.sources.some((s) => s.sectionId === example.id),
      'Exact example includes its historical case',
    );
  }
  const first = checkReferences(reply(fixtures.cases[0].question, defaults));
  assert.deepEqual(
    first.analysis.rows.map((r) => r[0]),
    ['FB-LS470', 'FB-LH470'],
  );
  const partial = checkReferences(reply('工业电源，450V、470μF', defaults));
  assert.equal(partial.analysis, undefined);
  assert.deepEqual(partial.missing, ['工作温度', '最低寿命']);
  const completed = checkReferences(reply('105℃，3000小时', partial.inputs));
  assert.equal(completed.analysis.rows.length, 2);
  const longer = checkReferences(reply('寿命提高到5000小时', completed.inputs));
  assert.deepEqual(
    longer.analysis.rows.map((r) => r[0]),
    ['FB-LH470'],
  );
  assert.equal(longer.inputs.voltage, '450');
  const compact = checkReferences(reply(fixtures.cases[1].question, defaults));
  assert.ok(
    compact.analysis.customerCandidates.every(
      (c) => c.product.diameter <= 22 && c.product.height <= 40,
    ),
  );
  const mini = checkReferences(
    reply('尺寸再小一点，有哪些候选？', compact.inputs),
  );
  assert.equal(mini.analysis.rows[0][0], 'FB-SM220');
  const delivery = checkReferences(
    reply('交期7天以内，有哪些候选？', completed.inputs),
  );
  assert.deepEqual(
    delivery.analysis.rows.map((r) => r[0]),
    ['FB-LS470'],
  );
  const impossible = checkReferences(
    reply('寿命至少100000小时', completed.inputs),
  );
  assert.ok(impossible.analysis.empty);
  assert.equal(impossible.analysis.rows.length, 0);
  assert.ok(
    impossible.analysis.customerExclusions.every(
      (c) => c.reason && resolveSource(c.source),
    ),
  );
  assert.ok(impossible.sources.some((s) => s.documentId === 'catalog'));
  const replacement = checkReferences(reply('替代 OLD-450-220', defaults));
  assert.equal(replacement.analysis.rows.length, 3);
  assert.ok(replacement.sources.some((s) => s.documentId === 'replacements'));
  const strongerReplacement = checkReferences(
    reply('125℃，10000小时', replacement.inputs),
  );
  const repeatedReplacement = checkReferences(
    reply('作为 OLD-450-220 的替代型号呢？', strongerReplacement.inputs),
  );
  assert.equal(repeatedReplacement.inputs.temperature, '125');
  assert.equal(repeatedReplacement.inputs.life, '10000');
  assert.deepEqual(
    repeatedReplacement.analysis.rows.map((r) => r[0]),
    ['FB-HT220'],
  );
  const highRequirements = reply(
    '工业电源，450V、220μF、125℃、10000小时',
    defaults,
  );
  assert.equal(
    reply('作为 OLD-450-220 的替代型号呢？', highRequirements.inputs).inputs
      .life,
    '10000',
  );
  const unknown = checkReferences(reply('替代 OLD-999-999', defaults));
  assert.equal(unknown.analysis, undefined);
  assert.match(unknown.answer, /没有/);
  for (const model of ['ABC-123', 'UPM1H471MPD']) {
    const result = checkReferences(reply(`替代 ${model}`, completed.inputs));
    assert.equal(result.analysis, undefined);
    assert.match(result.answer, new RegExp(model));
  }
  const noOriginal = checkReferences(reply('查找替代型号', completed.inputs));
  assert.equal(noOriginal.analysis, undefined);
  assert.deepEqual(noOriginal.missing, ['原型号']);
  const lookup = checkReferences(reply('查看 FB-LH470 规格', defaults));
  assert.equal(lookup.analysis.rows[0][0], 'FB-LH470');
  const oldInputs = {
    application: '工业电源',
    voltage: '450',
    capacity: '470',
    temperature: '105',
    life: '3000',
    customer: '样例客户甲',
    notes: '需确认安装空间',
    question: '之前的问题',
  };
  const restored = normalizeCustomerInputs(oldInputs);
  for (const [key, value] of Object.entries(oldInputs))
    assert.equal(restored[key], value);
  assert.equal(restored.needsConfirmation, '1');
  const legacy = checkReferences(reply('帮我推荐电容', oldInputs));
  assert.equal(
    legacy.analysis,
    undefined,
    'Old implicit defaults must not silently become confirmed requirements',
  );
  assert.equal(legacy.inputs.customer, oldInputs.customer);
  assert.equal(legacy.inputs.notes, oldInputs.notes);
  const confirmed = checkReferences(
    reply('请按当前分析条件完成分析。', legacy.inputs),
  );
  assert.equal(confirmed.analysis.rows.length, 2);
  assert.equal(confirmed.inputs.needsConfirmation, '');
  const certification = checkReferences(
    reply(
      '工业电源，450V、470μF、105℃、3000小时，AEC-Q200认证，推荐型号',
      defaults,
    ),
  );
  assert.equal(
    certification.analysis,
    undefined,
    'Listed certification constraints cannot be silently ignored',
  );
  for (const question of [
    '你好',
    '怎么用',
    '资料来源是什么',
    '价格是多少',
    '今天天气如何',
    '要求AEC认证',
    '电压-50V',
  ]) {
    checkReferences(reply(question, completed.inputs));
  }
  const reset = checkReferences(
    reply('换个需求：消费电子，50V、470μF、105℃、2000小时', replacement.inputs),
  );
  assert.equal(reset.inputs.replacement, '');
  assert.deepEqual(
    reset.analysis.rows.map((r) => r[0]),
    ['FB-LV470'],
  );
  for (const document of fixtures.documents) {
    assert.ok(fs.existsSync('public' + document.url), document.fileName);
    assert.ok(document.sections.length);
    assert.deepEqual(
      document.pages.map((page) => page.page),
      Array.from({ length: document.pages.length }, (_, index) => index + 1),
    );
    for (const page of document.pages) {
      assert.ok(fs.existsSync('public' + page.image), page.image);
      assert.ok(page.width > 0 && page.height > 0);
      assert.ok(
        document.sections.some((section) => section.page === page.page),
      );
    }
    for (const section of document.sections)
      assert.ok(
        document.pages.some((page) => page.page === section.page),
        section.id,
      );
  }
  console.log(
    'Customer flow checks passed: five examples, follow-ups, constraints, missing inputs, substitutions, no-match explanations, and original-file citations.',
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
