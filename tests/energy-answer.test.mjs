import assert from 'node:assert/strict';
import { withApplication } from './application-test-runtime.mjs';
withApplication((require) => {
  const { initialDatasets, defaultInputs } = require('./model.js');
  const {
    getFinalEnergy,
    energyReference,
    energyStatus,
    energyReadings,
    energyShifts,
    normalizeFinalInput,
  } = require('./final-data.js');
  const { replyToQuestion } = require('./conversation.js');
  const input = defaultInputs.energy,
    dataset = initialDatasets.find((d) => d.id === 'energy');
  const reply = (q, i = input) => replyToQuestion('energy', q, i, dataset);
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
  const d = getFinalEnergy(input);
  assert.equal(energyReadings.length, 672);
  assert.equal(energyShifts.length, 28);
  close(d.total, 18331.084);
  assert.equal(d.output, 389023);
  close(d.unit, 47.028283674744166);
  close(energyReference, d.unit);
  close(d.zeroEnergy, 36);
  assert.equal(d.issues.length, 3);
  assert.equal(
    d.issues.filter((r) => energyStatus(r) === '单耗偏高').length,
    2,
  );
  assert.equal(
    d.rows.every((r) => r.complete && r.readings.length === 24),
    true,
  );
  const idle = getFinalEnergy({
    ...input,
    dateFrom: '2026-08-30',
    dateTo: '2026-08-30',
    shift: 'B',
  });
  assert.equal(idle.unit, null);
  assert.equal(idle.output, 0);
  close(idle.total, 36);
  assert.equal(d.estimate, null);
  assert.equal(
    getFinalEnergy({ ...input, plannedProduction: '0' }).estimate,
    0,
  );
  assert.equal(
    getFinalEnergy({ ...input, plannedProduction: '-1' }).estimate,
    null,
  );
  close(
    getFinalEnergy({ ...input, plannedProduction: '100000' }).estimate,
    4702.828367474417,
  );
  close(getFinalEnergy({ ...input, shift: 'A' }).unit, 45.523608573568964);
  close(getFinalEnergy({ ...input, shift: 'B' }).unit, 48.40037645717432);
  assert.equal(
    getFinalEnergy({ ...input, granularity: 'hour' }).trend.length,
    336,
  );
  const noData = getFinalEnergy({
    ...input,
    dateFrom: '2026-10-01',
    dateTo: '2026-10-02',
  });
  assert.equal(noData.rows.length, 0);
  assert.equal(noData.unit, null);
  assert.match(reply('8月30日B班的零产量用电').answer, /36 kWh.*0件/);
  assert.match(reply('计划生产0件，估算用电').answer, /估算生产用电0 kWh/);
  assert.match(reply('计划生产100000件，估算用电').answer, /4,702\.828 kWh/);
  assert.match(reply('计划生产-100件，估算用电').answer, /大于或等于0/);
  assert.match(reply('计划生产100,000件，估算用电').answer, /4,702\.828 kWh/);
  assert.equal(reply('9月2日B班按小时用电趋势').inputs.granularity, 'hour');
  assert.match(reply('查看异常').answer, /第17行/);
  assert.match(reply('10月1日用电').answer, /没有匹配/);
  assert.match(reply('比较A班和B班单耗').answer, /45\.5236/);
  assert.match(reply('比较A班和B班单耗').answer, /48\.4004/);
  assert.equal(
    normalizeFinalInput('energy', {
      process: '旧工序',
      plannedProduction: '1000',
    }).plannedProduction,
    '',
  );
  console.log(
    'Energy final data: joins, weighted intensity, zero-output, plans, dates, hourly readings and answers passed.',
  );
});
