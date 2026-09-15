import assert from 'node:assert/strict';
import { withApplication } from './application-test-runtime.mjs';
withApplication((require) => {
  const { initialDatasets, defaultInputs } = require('./model.js');
  const {
    getFinalProduction,
    productionRecords,
    downtimeRecords,
    wipRecords,
    taktRecords,
    processNames,
    productionQualityGap,
  } = require('./final-data.js');
  const { replyToQuestion } = require('./conversation.js');
  const { scopeValues } = require('./scope.js');
  const input = defaultInputs.production,
    dataset = initialDatasets.find((d) => d.id === 'production');
  const reply = (q, i = input) => replyToQuestion('production', q, i, dataset);
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
  assert.deepEqual(
    [
      productionRecords.length,
      downtimeRecords.length,
      wipRecords.length,
      taktRecords.length,
    ],
    [898, 54, 1796, 898],
  );
  const d = getFinalProduction(input);
  assert.equal(d.summary.output, 368234);
  assert.equal(d.summary.planned, 370824);
  assert.equal(d.summary.good, 367769);
  assert.equal(d.summary.rejected, 3047);
  close(d.summary.yield, (367769 / 370824) * 100);
  assert.equal(d.summary.qualityIssues.length, 2);
  assert.equal(
    d.summary.qualityIssues.reduce((n, r) => n + productionQualityGap(r), 0),
    8,
  );
  assert.equal(d.wipQuantity, 360);
  assert.equal(d.snapshot, '2026-09-08T05:00:00');
  const all = getFinalProduction({ ...input, process: '全部工序' });
  assert.equal(all.singleProcess, false);
  assert.deepEqual(
    all.perProcess.map((p) => p.output),
    [367527, 375685, 368234],
  );
  assert.equal(all.totalMinutes, 2301);
  assert.deepEqual(
    all.perProcess.map((p) => p.wip),
    [null, null, 360],
  );
  assert.equal(all.takt.filter((r) => r.calculationIssue).length, 57);
  const day = getFinalProduction({
    ...input,
    dateFrom: '2026-09-01',
    dateTo: '2026-09-01',
  });
  assert.equal(day.summary.output, 27590);
  assert.equal(day.totalMinutes, 60);
  assert.equal(day.wipQuantity, 6430);
  assert.equal(
    getFinalProduction({ ...day.input, shift: 'A' }).wipQuantity,
    6956,
  );
  const mismatch = getFinalProduction({
    ...input,
    process: processNames[0],
    machine: '6D0117',
    dateFrom: '2026-08-21',
    dateTo: '2026-08-21',
    shift: 'A',
  });
  assert.equal(mismatch.takt.length, 1);
  assert.equal(mismatch.takt[0].sourceRow, 3);
  assert.equal(mismatch.takt[0].machine, '6DD117');
  assert.match(reply('9月2日05:00老化在制').answer, /6,430件/);
  assert.match(
    reply('生成最新生产日日报', { ...input, snapshot: '2026-09-01T17:00:00' })
      .answer,
    /360件在制/,
  );
  const two = reply('比较钉卷和组立的生产情况');
  assert.equal(scopeValues(two.inputs.process, '全部工序').length, 2);
  assert.doesNotMatch(two.answer, /老化|@scope:/);
  assert.match(
    reply('追溯工单SF313-2608000384卡号16').answer,
    /SF313-2608000384/,
  );
  assert.doesNotMatch(
    reply('追溯工单SF313-2608000384卡号16').answer,
    /日期范围无效/,
  );
  assert.match(reply('9月2日老化数量核查').answer, /差额6件/);
  assert.match(reply('10月1日生产报告').answer, /没有匹配记录/);
  console.log(
    'Production final data: stage scopes, quality reconciliation, overnight snapshots, downtime, takt joins, date/order parsing and answers passed.',
  );
});
