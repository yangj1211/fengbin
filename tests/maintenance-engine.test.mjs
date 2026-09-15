import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';

// Use the same Markdown renderer as answers, then inspect visible text.
const renderedText = (answer) => renderToStaticMarkup(
  createElement(Markdown, { skipHtml: true }, answer),
).replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const whitespace = (text) => text.replace(/\s+/g, ' ').trim();

const temp = fs.mkdtempSync(
  path.join(os.tmpdir(), 'fengbin-maintenance-test-'),
);
try {
  for (const file of fs.readdirSync('app/application')) {
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
    else if (file.endsWith('.json'))
      fs.copyFileSync(`app/application/${file}`, path.join(temp, file));
  }
  fs.symlinkSync(path.resolve('node_modules'), path.join(temp, 'node_modules'));
  const require = createRequire(path.join(temp, 'check.cjs'));
  const {
    replyToMaintenance: reply,
    maintenanceDefaults: defaults,
    normalizeMaintenanceInputs,
  } = require('./maintenance-engine.js');
  const {
    maintenanceFaults: faults,
    maintenancePlans: plans,
    maintenanceStandards: standards,
    maintenanceParts: parts,
    maintenanceImages: images,
    maintenanceExamples: examples,
  } = require('./maintenance-data.js');
  const { resolveSource } = require('./knowledge-sources.js');
  const { replyToQuestion, suggestions } = require('./conversation.js');
  const { initialDatasets, STORAGE_KEY } = require('./model.js');
  const dataset = initialDatasets.find((item) => item.id === 'maintenance');
  const sectionIds = (result, documentId) =>
    result.sources
      .filter((item) => item.documentId === documentId)
      .map((item) => item.sectionId);
  const checkSources = (result) => {
    for (const reference of result.sources) {
      const resolved = resolveSource(reference);
      assert.ok(resolved, `Missing source: ${JSON.stringify(reference)}`);
      assert.equal(resolved.section.id, reference.sectionId);
      assert.ok(
        !/示例|设备维修手册|维修工单|维修FAQ/.test(resolved.document.fileName),
        resolved.document.fileName,
      );
    }
  };

  assert.equal(faults.length, 10);
  assert.equal(plans.length, 24);
  assert.equal(standards.length, 58);
  assert.equal(parts.length, 10);
  assert.equal(images.length, 10);
  assert.equal(defaults.maintenanceVersion, '2');
  assert.deepEqual(suggestions.maintenance, examples);
  const cards = examples.map((example) =>
    replyToQuestion('maintenance', example.question, defaults, dataset),
  );
  const brush = cards[0];
  assert.equal(brush.inputs.caseId, 'DJGZ00026');
  assert.match(
    brush.answer,
    /1\. 可能原因：\*\*启动电容坏\*\*；维修参考：更换启动电容/,
  );
  assert.match(
    brush.answer,
    /2\. 可能原因：\*\*马达卡死或烧坏\*\*；维修参考：更换马达轴承或马达/,
  );
  assert.match(
    brush.answer,
    /!\[.*\]\(\/data\/maintenance\/final\/DJGZ00026\.jpeg\)/,
  );
  assert.deepEqual(sectionIds(brush, 'maintenance-plans'), [
    'DJGZ00026-01',
    'DJGZ00026-02',
  ]);
  assert.deepEqual(sectionIds(brush, 'maintenance-image-DJGZ00026'), [
    'DJGZ00026',
  ]);
  assert.doesNotMatch(
    brush.answer,
    /修后验证|维修工单|库存|工时|第1步|缺失|无法/,
  );
  assert.match(renderedText(cards[1].answer), /外径6mm\*内径4mm/);
  assert.match(cards[1].answer, /2排机\/4排机\/8排机\/12排机直径：3\.0mm/);
  assert.match(cards[1].answer, /6排机：3\.5mm/);
  assert.match(cards[1].answer, /更换前使用卡尺测量确认尺寸/);
  assert.deepEqual(sectionIds(cards[1], 'maintenance-standards'), [
    'CXS-GQ-0090-003',
  ]);
  assert.deepEqual(sectionIds(cards[2], 'maintenance-parts-final'), [
    '4DJE31H0G0003-1',
    '4DJE31H0G0003',
  ]);
  assert.match(cards[2].answer, /齿距：1\.5mm/);
  assert.match(cards[2].answer, /齿距：1\.2mm/);
  assert.equal((renderedText(cards[2].answer).match(/15\*55\*1mm/g) ?? []).length, 2);
  assert.doesNotMatch(renderedText(cards[2].answer), /15551mm/);
  for (const card of cards) {
    assert.equal(card.analysis, undefined);
    checkSources(card);
  }

  // Every final fault is reachable by its ID, name and available symptom.
  for (const fault of faults) {
    for (const phrase of [fault.id, fault.name, fault.symptom].filter(
      Boolean,
    )) {
      const result = reply(`${phrase}，怎么处理？`, defaults);
      assert.equal(result.inputs.caseId, fault.id, phrase);
      const expected = plans.filter((plan) => plan.faultId === fault.id);
      assert.deepEqual(
        sectionIds(result, 'maintenance-plans'),
        expected.map((plan) => plan.id),
      );
      for (const plan of expected)
        assert.ok(
          renderedText(result.answer).includes(
            `可能原因：${plan.cause}；维修参考：${plan.repair}`,
          ),
          plan.id,
        );
      checkSources(result);
    }
    const image = reply(`${fault.id}的图片`, defaults);
    assert.equal(
      sectionIds(image, 'maintenance-plans').length,
      0,
      'Image-only questions should not add a repair plan',
    );
    assert.match(image.answer, new RegExp(`${fault.id}\\.jpeg`));
    checkSources(image);
  }
  for (const faultId of ['DJGZ00027', 'DJGZ00028'])
    assert.equal(
      sectionIds(reply(faultId, defaults), 'maintenance-plans').length,
      1,
      'Partial source coverage must not be filled with invented groups',
    );
  for (const plan of plans) {
    const result = reply(plan.id, defaults);
    assert.deepEqual(
      sectionIds(result, 'maintenance-plans'),
      [plan.id],
      'A plan ID must not expand to unrelated plans',
    );
    checkSources(result);
  }
  for (const standard of standards) {
    const result = reply(standard.id, defaults);
    assert.ok(whitespace(renderedText(result.answer)).includes(whitespace(standard.text)), standard.id);
    assert.deepEqual(sectionIds(result, 'maintenance-standards'), [
      standard.id,
    ]);
    checkSources(result);
  }
  for (const part of parts) {
    const result = reply(part.id, defaults);
    assert.ok(renderedText(result.answer).includes(part.spec), part.id);
    assert.deepEqual(
      sectionIds(result, 'maintenance-parts-final'),
      [part.id],
      'An exact part number must not return a longer prefix variant',
    );
    checkSources(result);
  }

  for (const query of [
    '那毛刷调到什么状态？',
    '调到什么状态？',
    '操作标准是什么？',
  ]) {
    const result = reply(query, brush.inputs);
    assert.deepEqual(
      sectionIds(result, 'maintenance-standards'),
      ['CXS-GQ-0089-021'],
      query,
    );
    assert.match(
      result.answer,
      /毛刷正常转动，上下毛刷接触箔两面,过导针时无划伤铝箔与导针/,
    );
    assert.doesNotMatch(result.answer, /启动电容坏|维修工单/);
    checkSources(result);
  }
  const cause = reply('只看原因', brush.inputs);
  assert.match(cause.answer, /启动电容坏/);
  assert.doesNotMatch(cause.answer, /更换启动电容|!\[/);
  const imageFollowup = reply('有图片吗？', brush.inputs);
  assert.match(imageFollowup.answer, /DJGZ00026\.jpeg/);
  assert.equal(sectionIds(imageFollowup, 'maintenance-plans').length, 0);
  const combined = reply(
    '毛刷马达不转，怎么处理？操作标准是什么？有图片吗？',
    defaults,
  );
  assert.deepEqual(sectionIds(combined, 'maintenance-standards'), [
    'CXS-GQ-0089-021',
  ]);
  assert.equal(sectionIds(combined, 'maintenance-plans').length, 2);
  checkSources(combined);
  const mainMotor = reply('换个故障，主马达不转怎么办？', brush.inputs);
  assert.equal(mainMotor.inputs.caseId, 'CJGZ00002');
  assert.doesNotMatch(mainMotor.answer, /启动电容|毛刷/);
  const silicone = reply('含浸机硅胶条用什么尺寸？', brush.inputs);
  assert.equal(silicone.inputs.caseId, '');
  assert.doesNotMatch(silicone.answer, /毛刷|启动电容/);
  assert.equal(reply(examples[2].question, brush.inputs).inputs.caseId, '');
  const ambiguous = reply('马达不转，怎么办？', brush.inputs);
  assert.equal(ambiguous.inputs.caseId, '');
  assert.match(ambiguous.answer, /主马达不转/);
  assert.match(ambiguous.answer, /毛刷故障/);
  assert.match(ambiguous.answer, /请确认/);
  assert.equal(reply('是毛刷', ambiguous.inputs).inputs.caseId, 'DJGZ00026');
  const bulb = reply('报警灯泡的规格和料号是什么？', defaults);
  assert.match(bulb.answer, /SDL0240110902A/);
  assert.match(bulb.answer, /卡口  24V 8W/);
  assert.deepEqual(sectionIds(bulb, 'maintenance-parts-final'), [
    'SDL0240110902A',
  ]);
  for (const query of ['卷针有哪些规格？', '卷針有哪些规格？']) {
    const result = reply(query, defaults);
    assert.deepEqual(sectionIds(result, 'maintenance-parts-final'), [
      '4DJF0600C0001-5',
      '4DJF0600C0001-8',
    ]);
  }
  assert.deepEqual(
    sectionIds(reply('电磁阀怎么保养？', defaults), 'maintenance-standards'),
    ['CXS-GQ-0090-007'],
  );
  assert.deepEqual(
    sectionIds(
      reply('电磁阀料号和规格是什么？', defaults),
      'maintenance-parts-final',
    ),
    ['5108031166-1'],
  );
  assert.deepEqual(
    sectionIds(reply('选孔针座的标准', defaults), 'maintenance-standards'),
    ['CXS-GQ-0090-018'],
  );
  assert.deepEqual(
    sectionIds(reply('导针平送的标准', defaults), 'maintenance-standards'),
    ['CXS-GQ-0089-005'],
  );

  for (const query of [
    '卷绕机 WND-100 张力波动并断箔',
    '老化柜 AGE-300 出现 A-T03 告警',
    '含浸机 IMP-200 真空度不足',
    '代码 UNKNOWN-900',
    'DJGZ99999',
    'CXS-GQ-0089-999',
    '现在漏油怎么处理',
    '现在无法启动，怎么修？',
    '没有毛刷故障，只有设备异响',
    '空压机压力不足',
  ]) {
    const result = reply(query, brush.inputs);
    assert.equal(result.inputs.caseId, '', query);
    assert.match(result.answer, /未查到/, query);
    assert.doesNotMatch(result.answer, /更换启动电容|更换直线轴承/, query);
    assert.equal(result.sources.length, 0, query);
  }
  assert.equal(reply('切纸刀库存多少？', defaults).answer, '未查到库存数据。');
  assert.equal(
    reply('这次维修工时是多少？', brush.inputs).answer,
    '未查到维修工时数据。',
  );

  const legacyDraft = {
    device: '卷绕机',
    model: 'WND-100',
    code: 'W-T01',
    symptom: '断箔',
    caseId: 'winding',
    maintenanceVersion: '1',
    question: '旧草稿',
  };
  const normalizedDraft = normalizeMaintenanceInputs(legacyDraft);
  assert.equal(normalizedDraft.device, '');
  assert.equal(normalizedDraft.caseId, '');
  assert.equal(normalizedDraft.question, '旧草稿');
  assert.equal(normalizedDraft.maintenanceVersion, '2');
  assert.equal(normalizeMaintenanceInputs(brush.inputs).caseId, 'DJGZ00026');
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
  const stored = new Map([
    [STORAGE_KEY, JSON.stringify({ ...base, sessions: [oldSession] })],
  ]);
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
      assert.equal(state.sessions[0].draft.maintenanceVersion, '2');
      return state;
    }),
  );
  console.log(
    'Maintenance: final workbook records, three cards, images, exact IDs, paired references, context changes, aliases and legacy draft migration passed.',
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
