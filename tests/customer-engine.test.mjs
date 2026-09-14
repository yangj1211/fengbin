import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fengbin-customer-test-'));
try {
  for (const name of [
    'customer-engine',
    'customer-data',
    'customer-types',
    'customer-comparison',
  ]) {
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
  const {
    customerParameterComparison: compare,
  } = require('./customer-comparison.js');
  const sample = fixtures.products.find(
    (product) => product.model === 'FB-LH470',
  );
  const textComparison = compare(
    {
      application: '工业电源',
      voltage: '450',
      capacity: '470',
      temperature: '105',
      life: '3000',
    },
    sample,
  );
  assert.equal(textComparison.length, 5);
  assert.ok(textComparison.every((line) => line.endsWith('，符合。')));
  assert.match(textComparison.at(-1), /3,000 h.*5,000 h/);
  const conflictComparison = compare(
    {
      voltage: '500',
      capacity: '330',
      temperature: '125',
      life: '10000',
      diameter: '30',
      height: '40',
      leadDays: '7',
    },
    sample,
  );
  assert.equal(conflictComparison.length, 7);
  assert.ok(conflictComparison.every((line) => line.endsWith('，不符合。')));
  assert.match(
    conflictComparison.at(-1),
    /交期要求不超过 7 天，产品参考交期为 14 天/,
  );
  assert.equal(
    compare({ voltage: '450', capacity: '', life: '' }, sample).length,
    1,
    'Do not invent unstated requirements',
  );
  const checkReferences = (result) => {
    for (const ref of result.sources) {
      assert.ok(ref.documentId.startsWith('spec-'));
      assert.ok(resolveSource(ref), JSON.stringify(ref));
    }
    assert.doesNotMatch(result.answer, /参考交期|历史需求案例/);
    return result;
  };
  const ask = (q, inputs = defaults) => checkReferences(reply(q, inputs));
  const selected = (result) => result.answer.split('未匹配原因：')[0];
  assert.equal(fixtures.specifications.length, 15);
  for (const example of fixtures.cases) {
    const result = ask(example.question);
    assert.doesNotMatch(result.answer, /FB-/);
    assert.ok(result.sources.length > 0, example.id);
    for (const model of example.recommendedModels)
      assert.ok(selected(result).includes(model), example.id);
  }
  const first = ask(fixtures.cases[0].question);
  assert.match(first.answer, /有 2 款/);
  assert.deepEqual(
    first.missing,
    undefined,
    'Do not require unstated temperature or life',
  );
  const hotter = ask('还要能在105℃工作。', first.inputs);
  assert.match(hotter.answer, /有 1 款/);
  assert.match(selected(hotter), /DV101M050G105ETRU/);
  assert.doesNotMatch(selected(hotter), /GS101M035E110ETC/);
  const tht = ask('同时必须是THT插件式。', hotter.inputs);
  assert.match(tht.answer, /没有可确认满足全部条件/);
  assert.match(tht.answer, /SMD/);
  assert.match(tht.answer, /85℃/);
  assert.equal(tht.inputs.capacity, '100');
  const industrial = ask(fixtures.cases[3].question);
  assert.match(industrial.answer, /有 2 款/);
  assert.match(industrial.answer, /8000 h/);
  assert.match(industrial.answer, /10000 h/);
  const shorter = ask(
    '其他条件不变，本体长度含公差不能超过18mm，不算引脚。',
    industrial.inputs,
  );
  assert.match(shorter.answer, /有 1 款/);
  assert.match(selected(shorter), /FK100M160G160ETA/);
  assert.doesNotMatch(selected(shorter), /KH100M400G200ETA/);
  assert.match(shorter.answer, /17.5/);
  assert.match(shorter.answer, /21.5/);
  assert.ok(shorter.sources.some((ref) => ref.page === 2));
  const comparison = ask(fixtures.cases[1].question);
  assert.match(comparison.answer, /不能.*直接替换/);
  const board = ask('我原来的板子就是插件焊孔，不能改板。', comparison.inputs);
  assert.match(board.answer, /SMD 型号不满足安装条件/);
  const ripple = ask('UK821M200O300AP4的纹波电流至少要3A，它符合吗？');
  assert.deepEqual(ripple.missing, ['纹波频率', '温度']);
  const highFrequency = ask('100kHz、105℃。', ripple.inputs);
  assert.match(highFrequency.answer, /有 1 款/);
  assert.match(highFrequency.answer, /3.51 A/);
  const lowFrequency = ask('改成120Hz，其他不变。', highFrequency.inputs);
  assert.match(lowFrequency.answer, /没有可确认满足全部条件/);
  assert.match(lowFrequency.answer, /2.34 A/);
  assert.equal(lowFrequency.inputs.ripple, '3');
  assert.equal(lowFrequency.inputs.temperature, '105');
  assert.match(
    ask('改成1kHz，其他不变。', highFrequency.inputs).answer,
    /无法确认/,
  );
  const ambiguousLife = ask(fixtures.cases[4].question);
  assert.deepEqual(ambiguousLife.missing, ['寿命测试类型']);
  const useful = ask(
    '按Useful Life，采用规格书的额定电压和额定纹波测试条件。',
    ambiguousLife.inputs,
  );
  assert.match(useful.answer, /有 1 款/);
  assert.match(useful.answer, /8000 h/);
  const endurance = ask('改成Endurance，其他不变。', useful.inputs);
  assert.match(endurance.answer, /没有可确认满足全部条件/);
  assert.match(endurance.answer, /3000 h/);
  assert.equal(endurance.inputs.life, '5000');
  const diameter = ask(fixtures.cases[5].question);
  assert.match(diameter.answer, /没有可确认满足全部条件/);
  assert.match(diameter.answer, /31 mm/);
  assert.ok(diameter.sources.some((ref) => ref.page === 2));
  const relaxed = ask('那外径上限放宽到31mm。', diameter.inputs);
  assert.match(relaxed.answer, /有 1 款/);
  assert.equal(relaxed.inputs.diameter, '31');
  const fresh = ask(fixtures.cases[0].question, relaxed.inputs);
  assert.match(fresh.answer, /有 2 款/);
  assert.equal(fresh.inputs.focusModels, '');
  assert.equal(fresh.inputs.diameter, '');
  assert.match(ask('查一下FB-LH470的参数').answer, /未找到/);
  assert.match(ask('需要-10μF、35V').answer, /参数无效/);
  assert.match(
    ask('UK821M200O300AP4有没有库存？').answer,
    /没有报价、库存或交期/,
  );
  const legacy = normalizeCustomerInputs({
    customer: '客户甲',
    voltage: '450',
    notes: '保留备注',
    customerVersion: '2',
  });
  assert.equal(legacy.needsConfirmation, '1');
  assert.equal(legacy.notes, '保留备注');
  assert.deepEqual(ask('继续选型', legacy).missing, ['确认历史条件']);
  const confirmed = ask('按这些条件分析', legacy);
  assert.equal(confirmed.inputs.needsConfirmation, '');
  const resolved = resolveSource({
    documentId: 'catalog',
    sectionId: 'catalog-fb-lh470',
    page: 1,
  });
  assert.ok(resolved, 'Historical references still resolve');
  console.log(
    'Customer tests passed: six real-spec scenarios, multi-turn constraints, ambiguity, dimensions, sources and legacy inputs.',
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
