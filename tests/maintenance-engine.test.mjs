import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const temp = fs.mkdtempSync(
  path.join(os.tmpdir(), 'fengbin-maintenance-test-'),
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
    'energy-fixtures.json',
  ])
    fs.copyFileSync(`app/application/${file}`, path.join(temp, file));
  fs.symlinkSync(path.resolve('node_modules'), path.join(temp, 'node_modules'));
  const require = createRequire(path.join(temp, 'check.cjs'));
  const {
    replyToMaintenance: reply,
    maintenanceDefaults: defaults,
    normalizeMaintenanceInputs,
  } = require('./maintenance-engine.js');
  const {
    maintenanceCases: cases,
    maintenanceFixtures: fixtures,
  } = require('./maintenance-data.js');
  const { resolveSource } = require('./knowledge-sources.js');
  const { replyToQuestion, suggestions } = require('./conversation.js');
  const { initialDatasets, STORAGE_KEY } = require('./model.js');
  const dataset = initialDatasets.find((item) => item.id === 'maintenance');
  assert.equal(cases.length, 5);
  assert.equal(suggestions.maintenance.length, 3);
  for (const example of cases) {
    const result = replyToQuestion(
      'maintenance',
      `${example.device} ${example.model} 出现 ${example.code}，${example.symptom}，请给出排查步骤。`,
      defaults,
      dataset,
    );
    assert.equal(result.inputs.caseId, example.id);
    assert.equal(result.inputs.model, example.model);
    assert.match(result.answer, /1\. /);
    assert.match(result.answer, /备件/);
    assert.match(result.answer, /工单/);
    assert.match(result.answer, /修后验证/);
    assert.match(result.answer, /清理|清洁|重新穿料|修复连接/);
    assert.match(result.answer, /确认.*时/);
    assert.match(result.answer, /手册|工艺既定/);
    assert.match(result.answer, /停止验证|维持.*停机/);
    const guide = resolveSource(
      result.sources.find(
        (source) => source.documentId === 'maintenance-guide',
      ),
    );
    for (const instruction of [...example.repair, ...example.verification])
      assert.ok(
        guide.section.text.includes(instruction),
        'Plan and verification must be grounded in the cited original page',
      );
    assert.equal(result.analysis, undefined);
    assert.equal(result.sources.length, 3);
    for (const source of result.sources) assert.ok(resolveSource(source));
  }
  for (const query of [
    '卷绕机',
    'WND-100',
    '卷绕机的温度是多少',
    '卷绕机电机异响',
    '型号 UNKNOWN-900 故障',
    '代码999',
    '老化柜 AGE-300 告警 W-T01',
  ]) {
    const result = reply(query, defaults);
    assert.equal(result.inputs.caseId, '', query);
    assert.doesNotMatch(result.answer, /具体维修方案/, query);
  }
  const winding = reply('卷绕机 WND-100 张力波动并断箔', defaults);
  assert.equal(winding.inputs.caseId, cases[0].id);
  for (const query of [
    '需要哪些备件',
    '卷绕机有哪些备件可以先核对',
    '原因和备件都说一下',
  ]) {
    const result = reply(query, winding.inputs);
    assert.equal(result.inputs.caseId, cases[0].id);
    assert.match(result.answer, /备件/);
    assert.doesNotMatch(result.answer, /请补充具体故障/);
    if (query.includes('原因')) assert.match(result.answer, /可能的原因/);
  }
  const combined = reply(suggestions.maintenance[1].question, defaults);
  assert.match(combined.answer, /具体维修方案/);
  assert.match(combined.answer, /检查时请注意/);
  for (const query of [
    '含浸机',
    '含浸机真空度不足',
    '换台设备，还是卷绕机，现在无法启动',
    '没有断箔，只是温度偏高',
    '现在仍然无法启动',
  ]) {
    const result = reply(query, winding.inputs);
    assert.notEqual(result.inputs.caseId, cases[0].id, query);
    assert.doesNotMatch(result.answer, /张力检测组件/, query);
  }
  for (const query of [
    '给我具体维修方案',
    '怎么修，给出步骤、备件和验证方法',
    '请给出方案和引用来源',
    '已检查穿料路径，请给出维修方案和备件',
  ]) {
    const result = reply(query, winding.inputs);
    assert.equal(result.inputs.caseId, cases[0].id, query);
    assert.match(result.answer, /具体维修方案/, query);
    assert.match(result.answer, /修后验证/, query);
    assert.match(result.answer, /备件/, query);
  }
  for (const query of [
    '修完怎么验证',
    '设备已恢复正常，如何验收',
    '现在已经不再断箔，怎么验证维修好了',
    '怎么确认修好了？',
  ]) {
    const result = reply(query, winding.inputs);
    assert.equal(result.inputs.caseId, cases[0].id);
    assert.match(result.answer, /修后验证/);
    assert.doesNotMatch(result.answer, /具体维修方案/);
    assert.match(result.answer, /张力读数趋势/);
  }
  const restoredSymptom = reply(
    'WND-100',
    reply('张力波动并断箔', defaults).inputs,
  );
  assert.equal(restoredSymptom.inputs.caseId, cases[0].id);
  const codeOnly = reply('W-T01', defaults);
  assert.equal(codeOnly.inputs.device, '');
  assert.match(codeOnly.answer, /请确认现场设备型号/);
  assert.equal(reply('WND-100', codeOnly.inputs).inputs.caseId, cases[0].id);
  assert.equal(reply('IMP-200', codeOnly.inputs).inputs.caseId, '');
  const checked = reply('已检查穿料路径，还是有异常', winding.inputs);
  assert.match(checked.answer, /已收到新的排查情况/);
  assert.ok(checked.inputs.observations.includes('已检查'));
  const feedback = reply('处理后已恢复正常', winding.inputs);
  assert.match(feedback.answer, /未创建或关闭维修工单/);
  const legacyDraft = {
    device: '卷绕机 W-03',
    symptom: '张力波动 / 断箔',
    question: '旧草稿',
  };
  assert.equal(normalizeMaintenanceInputs(legacyDraft).device, '');
  assert.equal(normalizeMaintenanceInputs(legacyDraft).question, '旧草稿');
  const base = {
    version: 1,
    datasets: initialDatasets,
    drafts: {},
    records: [],
    sessions: [],
    activeSessionIds: {},
  };
  const { startConversation } = require('./sessions.js');
  assert.equal(
    startConversation(base, 'maintenance', legacyDraft).sessions[0].draft
      .device,
    '',
  );
  const oldSession = {
    id: 'old',
    module: 'maintenance',
    title: '旧对话',
    createdAt: '2026-09-09T00:00:00Z',
    updatedAt: '2026-09-09T00:00:00Z',
    turns: [],
    draft: legacyDraft,
  };
  const stored = new Map([[STORAGE_KEY, JSON.stringify({ ...base, sessions: [oldSession] })]]);
  global.window = {};
  global.localStorage = {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: (key) => stored.delete(key),
  };
  const { setWorkspaceUser, updateWorkspace } = require('./store.js');
  assert.ok(setWorkspaceUser('default-admin', true));
  assert.ok(
    updateWorkspace((state) => {
      assert.equal(state.sessions[0].draft.device, '');
      assert.equal(state.sessions[0].draft.question, '旧草稿');
      return state;
    }),
  );
  for (const document of fixtures.documents) {
    assert.ok(
      fs
        .readFileSync(`public${document.url}`)
        .subarray(0, 5)
        .equals(Buffer.from('%PDF-')),
    );
    for (const page of document.pages) {
      const png = fs.readFileSync(`public${page.image}`);
      assert.equal(png.readUInt32BE(16), page.width);
      assert.equal(png.readUInt32BE(20), page.height);
      assert.ok(
        document.sections.some((section) => section.page === page.page),
      );
    }
  }
  console.log(
    'Maintenance: five concrete repair plans and verification, followups, conflicts, legacy drafts, source grounding and original pages passed.',
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
