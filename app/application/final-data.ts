import energyAsset from './energy-final.json';
import productionAsset from './production-final.json';
import type { Inputs } from './model';
import { filterScope } from './scope';

export const FINAL_DATA_VERSION = '20260914-final';
export type Shift = 'A' | 'B';
type BusinessKey = {
  date: string;
  shift: string;
  process: string;
  sourceRow: number;
};
export type EnergyReadingFinal = BusinessKey & {
  meter: string;
  start: string;
  end: string;
  kwh: number;
};
export type EnergyShiftFinal = BusinessKey & {
  product: string;
  start: string;
  end: string;
  production: number;
};
type ProductionKey = BusinessKey & {
  machine: string;
  order: string;
  card: string;
  product: string;
};
export type ProductionFinal = ProductionKey & {
  planned: number;
  output: number;
  inspected: number;
  good: number;
  rejected: number;
};
export type DowntimeFinal = ProductionKey & {
  id: string;
  start: string;
  end: string;
  minutes: number;
  reason: string;
  action: string;
};
export type WipFinal = ProductionKey & { time: string; quantity: number };
export type TaktFinal = ProductionKey & {
  standardRate: number;
  standardQuantity: number;
  quantity: number;
  rate: number;
  calculationIssue: boolean;
  machineMismatch: boolean;
};
export const energyReadings = energyAsset.readings as EnergyReadingFinal[];
export const energyShifts = energyAsset.shifts as EnergyShiftFinal[];
export const productionRecords =
  productionAsset.production as ProductionFinal[];
export const downtimeRecords = productionAsset.downtime as DowntimeFinal[];
export const wipRecords = productionAsset.wip as WipFinal[];
export const taktRecords = productionAsset.takt as TaktFinal[];
export const productionKey = (r: ProductionKey) =>
  `${r.date}/${r.shift}/${r.process}/${r.order}/${r.card}/${r.product}`;
const productionByKey = new Map(
  productionRecords.map((r) => [productionKey(r), r]),
);
export const taktProductionMachine = (r: TaktFinal) =>
  productionByKey.get(productionKey(r))?.machine || r.machine;
export const energyProcess = energyShifts[0].process;
export const productModel = energyShifts[0].product;
export const processNames = [
  ...new Set(productionRecords.map((r) => r.process)),
].sort();
export const sumBy = <T>(rows: T[], value: (row: T) => number) =>
  rows.reduce((s, r) => s + value(r), 0);
export const formatFinal = (n: number | null, digits = 0) =>
  n === null
    ? '—'
    : n.toLocaleString('zh-CN', { maximumFractionDigits: digits });
export const ratio = (n: number, d: number) => (d > 0 ? (n / d) * 100 : null);
const batchKey = (r: BusinessKey) => `${r.date}/${r.shift}/${r.process}`;
const dates = (rows: BusinessKey[]) =>
  [...new Set(rows.map((r) => r.date))].sort();
export const energyDates = dates(energyShifts);
export const productionDates = dates(productionRecords);
export const finalDefaults = {
  energy: {
    dataVersion: FINAL_DATA_VERSION,
    dateFrom: energyDates[0],
    dateTo: energyDates.at(-1)!,
    shift: '全部班次',
    process: energyProcess,
    granularity: 'day',
    plannedProduction: '',
    period: '7',
    meter: '全部电表',
    status: '全部',
    question: '',
  },
  production: {
    dataVersion: FINAL_DATA_VERSION,
    dateFrom: productionDates[0],
    dateTo: productionDates.at(-1)!,
    shift: '全部班次',
    process: processNames.find((p) => p.startsWith('3164'))!,
    machine: '全部机台',
    order: '',
    card: '',
    snapshot: '',
    status: '全部',
    detail: 'production',
    question: '',
    completion: '95',
    defect: '2',
  },
} satisfies Record<string, Inputs>;
export function normalizeFinalInput(
  id: 'energy' | 'production',
  input: Inputs,
): Inputs {
  const defaults = finalDefaults[id];
  return input.dataVersion === FINAL_DATA_VERSION
    ? {
        ...defaults,
        ...input,
        ...(id === 'production' ? { completion: '95', defect: '2' } : {}),
      }
    : { ...defaults, question: input.question || '' };
}
export function validFinalDates(input: Inputs) {
  const valid = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s;
  return (
    valid(input.dateFrom) &&
    valid(input.dateTo) &&
    input.dateFrom <= input.dateTo
  );
}
function inPeriod(r: BusinessKey, input: Inputs) {
  return (
    r.date >= input.dateFrom &&
    r.date <= input.dateTo &&
    (input.shift === '全部班次' || r.shift === input.shift)
  );
}
const energyByBatch = new Map<string, EnergyReadingFinal[]>();
energyReadings.forEach((r) =>
  energyByBatch.set(batchKey(r), [
    ...(energyByBatch.get(batchKey(r)) || []),
    r,
  ]),
);
export const energyBatches = energyShifts.map((r) => {
  const readings = energyByBatch.get(batchKey(r)) || [];
  const kwh = sumBy(readings, (x) => x.kwh);
  const meters = new Map<string, EnergyReadingFinal[]>();
  readings.forEach((x) =>
    meters.set(x.meter, [...(meters.get(x.meter) || []), x]),
  );
  const expectedStart = Date.parse(r.start.replace(' ', 'T'));
  const expectedEnd = Date.parse(r.end.replace(' ', 'T'));
  const complete =
    meters.size === new Set(energyReadings.map((x) => x.meter)).size &&
    [...meters.values()].every((group) => {
      const sorted = [...group].sort((a, b) => a.start.localeCompare(b.start));
      return (
        sorted.length === 12 &&
        sorted.every(
          (x, i) =>
            Date.parse(x.start.replace(' ', 'T')) ===
              expectedStart + i * 3600000 &&
            Date.parse(x.end.replace(' ', 'T')) ===
              expectedStart + (i + 1) * 3600000,
        ) &&
        expectedEnd - expectedStart === 12 * 3600000
      );
    });
  return {
    ...r,
    readings,
    kwh,
    complete,
    unit: r.production > 0 && complete ? (kwh / r.production) * 1000 : null,
  };
});
const producing = energyBatches.filter((r) => r.production > 0 && r.complete);
export const energyReference =
  (sumBy(producing, (r) => r.kwh) / sumBy(producing, (r) => r.production)) *
  1000;
export const energyStatus = (row: (typeof energyBatches)[number]) =>
  !row.complete
    ? '记录不完整'
    : row.production === 0
      ? '零产量用电'
      : row.unit! > energyReference * 1.2 + 1e-8
        ? '单耗偏高'
        : '参考范围内';
export function getFinalEnergy(raw: Inputs) {
  const input = normalizeFinalInput('energy', raw);
  const rows = energyBatches.filter((r) => inPeriod(r, input));
  const readings = rows.flatMap((r) => r.readings);
  const positive = rows.filter((r) => r.production > 0 && r.complete);
  const total = sumBy(rows, (r) => r.kwh),
    output = sumBy(rows, (r) => r.production);
  const productionEnergy = sumBy(positive, (r) => r.kwh),
    productionOutput = sumBy(positive, (r) => r.production);
  const unit = productionOutput
    ? (productionEnergy / productionOutput) * 1000
    : null;
  const referenceRows = producing.filter(
    (r) => input.shift === '全部班次' || r.shift === input.shift,
  );
  const estimateRate = referenceRows.length
    ? (sumBy(referenceRows, (r) => r.kwh) /
        sumBy(referenceRows, (r) => r.production)) *
      1000
    : null;
  const planText = input.plannedProduction?.trim() || '';
  const plan =
    planText !== '' &&
    Number.isFinite(Number(planText)) &&
    Number(planText) >= 0
      ? Number(planText)
      : null;
  const meters = [...new Set(energyReadings.map((r) => r.meter))];
  const plotted = readings.filter(
    (r) => input.meter === '全部电表' || r.meter === input.meter,
  );
  const grouped = new Map<string, number>();
  plotted.forEach((r) => {
    const name =
      input.granularity === 'hour'
        ? r.start
        : input.granularity === 'shift'
          ? `${r.date} ${r.shift}`
          : r.date;
    grouped.set(name, (grouped.get(name) || 0) + r.kwh);
  });
  return {
    input,
    rows,
    readings,
    total,
    output,
    unit,
    estimateRate,
    plan,
    estimate:
      plan !== null && estimateRate !== null
        ? (plan / 1000) * estimateRate
        : null,
    zeroEnergy: sumBy(
      rows.filter((r) => r.production === 0),
      (r) => r.kwh,
    ),
    issues: rows.filter((r) =>
      ['单耗偏高', '零产量用电', '记录不完整'].includes(energyStatus(r)),
    ),
    trend: [...grouped]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => ({ name, value })),
    meters: meters.map((name) => ({
      name,
      value: sumBy(
        readings.filter((r) => r.meter === name),
        (r) => r.kwh,
      ),
    })),
    shifts: ['A', 'B']
      .filter((s) => input.shift === '全部班次' || s === input.shift)
      .map((name) => {
        const group = positive.filter((r) => r.shift === name);
        const qty = sumBy(group, (r) => r.production);
        return {
          name: `${name}班`,
          value: qty ? (sumBy(group, (r) => r.kwh) / qty) * 1000 : null,
        };
      }),
  };
}
export const productionQualityGap = (r: ProductionFinal) =>
  r.inspected - r.good - r.rejected;
export const productionAbnormal = (r: ProductionFinal) =>
  (ratio(r.output, r.planned) ?? 100) < 95 - 1e-8 ||
  (ratio(r.rejected, r.inspected) ?? 0) > 2 + 1e-8;
export function productionSummary(rows: ProductionFinal[]) {
  const planned = sumBy(rows, (r) => r.planned),
    output = sumBy(rows, (r) => r.output),
    inspected = sumBy(rows, (r) => r.inspected),
    good = sumBy(rows, (r) => r.good),
    rejected = sumBy(rows, (r) => r.rejected);
  return {
    planned,
    output,
    inspected,
    good,
    rejected,
    completion: ratio(output, planned),
    yield: ratio(good, inspected),
    defect: ratio(rejected, inspected),
    qualityIssues: rows.filter((r) => productionQualityGap(r) !== 0),
    abnormal: rows.filter(productionAbnormal),
  };
}
export function getFinalProduction(raw: Inputs) {
  const input = normalizeFinalInput('production', raw);
  const filter = <T extends ProductionKey>(
    data: T[],
    ignoreMachine = false,
  ) => {
    const processRows = filterScope(
      data,
      input.process,
      '全部工序',
      (r) => r.process,
    );
    const machineRows = ignoreMachine
      ? processRows
      : filterScope(processRows, input.machine, '全部机台', (r) =>
          'standardRate' in r
            ? taktProductionMachine(r as unknown as TaktFinal)
            : r.machine,
        );
    return machineRows.filter(
      (r) =>
        inPeriod(r, input) &&
        (!input.order ||
          r.order.toLowerCase().includes(input.order.toLowerCase().trim())) &&
        (!input.card || r.card === input.card.trim()),
    );
  };
  const rows = filter(productionRecords),
    downtime = filter(downtimeRecords),
    wip = filter(wipRecords),
    takt = filter(taktRecords);
  const times = [...new Set(wip.map((r) => r.time))].sort();
  const snapshot = input.snapshot || times.at(-1) || '';
  const snapshotRows = wip.filter((r) => r.time === snapshot);
  const group = <T>(data: T[], key: (r: T) => string) => {
    const map = new Map<string, T[]>();
    data.forEach((r) => map.set(key(r), [...(map.get(key(r)) || []), r]));
    return [...map];
  };
  const machines = [
    ...new Set(filter(productionRecords, true).map((r) => r.machine)),
  ].sort();
  const perProcess = processNames
    .filter(
      (name) =>
        input.process === '全部工序' ||
        filterScope(
          [{ process: name }],
          input.process,
          '全部工序',
          (r) => r.process,
        ).length,
    )
    .map((name) => ({
      name,
      ...productionSummary(rows.filter((r) => r.process === name)),
      records: rows.filter((r) => r.process === name).length,
      downtime: sumBy(
        downtime.filter((r) => r.process === name),
        (r) => r.minutes,
      ),
      wip: snapshotRows.some((r) => r.process === name)
        ? sumBy(
            snapshotRows.filter((r) => r.process === name),
            (r) => r.quantity,
          )
        : null,
    }));
  return {
    input,
    rows,
    downtime,
    wip,
    takt,
    times,
    snapshot,
    snapshotRows,
    machines,
    summary: productionSummary(rows),
    perProcess,
    totalMinutes: sumBy(downtime, (r) => r.minutes),
    singleProcess: perProcess.length === 1,
    wipQuantity: snapshotRows.length
      ? sumBy(snapshotRows, (r) => r.quantity)
      : null,
    machineGroups: group(rows, (r) => r.machine).map(([name, group]) => ({
      name,
      ...productionSummary(group),
    })),
    trend: group(rows, (r) => r.date)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, group]) => ({ name, value: sumBy(group, (r) => r.output) })),
    stopReasons: group(downtime, (r) => r.reason)
      .map(([name, group]) => ({ name, value: sumBy(group, (r) => r.minutes) }))
      .sort((a, b) => b.value - a.value),
    stopMachines: group(
      downtime,
      (r) => `${r.process.slice(0, 4)} / ${r.machine}`,
    )
      .map(([name, group]) => ({ name, value: sumBy(group, (r) => r.minutes) }))
      .sort((a, b) => b.value - a.value),
    wipMachines: group(snapshotRows, (r) => r.machine).map(([name, group]) => ({
      name,
      value: sumBy(group, (r) => r.quantity),
    })),
  };
}

export const finalSourceDefinitions = [
  {
    id: 'final-energy-readings',
    module: 'energy',
    name: '用电记录表',
    sheet: '用电记录表',
    columns: [
      '日期',
      '班次',
      '工序',
      '电表名称',
      '开始时间',
      '结束时间',
      '用电量（kWh）',
    ],
    rows: energyReadings.map((r) => [
      r.date,
      r.shift,
      r.process,
      r.meter,
      r.start,
      r.end,
      r.kwh,
    ]),
  },
  {
    id: 'final-energy-production',
    module: 'energy',
    name: '班次生产表',
    sheet: '班次生产表',
    columns: [
      '日期',
      '班次',
      '工序',
      '产品型号',
      '开始时间',
      '结束时间',
      '产量（件）',
    ],
    rows: energyShifts.map((r) => [
      r.date,
      r.shift,
      r.process,
      r.product,
      r.start,
      r.end,
      r.production,
    ]),
  },
  {
    id: 'final-production',
    module: 'production',
    name: '生产表',
    sheet: '生产报表',
    columns: [
      '日期',
      '班次',
      '工序',
      '产线设备',
      '工单号',
      '卡号',
      '料号',
      '计划数',
      '产量',
      '检验数',
      '合格数',
      '不良数',
    ],
    rows: productionRecords.map((r) => [
      r.date,
      r.shift,
      r.process,
      r.machine,
      r.order,
      r.card,
      r.product,
      r.planned,
      r.output,
      r.inspected,
      r.good,
      r.rejected,
    ]),
  },
  {
    id: 'final-downtime',
    module: 'production',
    name: '停线记录表',
    sheet: '停线记录表（模拟）',
    columns: [
      '停线单号',
      '日期',
      '班次',
      '工序',
      '产线设备',
      '工单号',
      '卡号',
      '料号',
      '停线开始时间',
      '停线结束时间',
      '停线时长（分钟）',
      '停线原因',
      '处理措施',
    ],
    rows: downtimeRecords.map((r) => [
      r.id,
      r.date,
      r.shift,
      r.process,
      r.machine,
      r.order,
      r.card,
      r.product,
      r.start,
      r.end,
      r.minutes,
      r.reason,
      r.action,
    ]),
  },
  {
    id: 'final-wip',
    module: 'production',
    name: '在制数量表',
    sheet: '在制数量表（模拟）',
    columns: [
      '日期',
      '班次',
      '统计时间',
      '工序',
      '产线设备',
      '工单号',
      '卡号',
      '料号',
      '在制数量（件）',
    ],
    rows: wipRecords.map((r) => [
      r.date,
      r.shift,
      r.time,
      r.process,
      r.machine,
      r.order,
      r.card,
      r.product,
      r.quantity,
    ]),
  },
  {
    id: 'final-takt',
    module: 'production',
    name: '节拍表',
    sheet: '生产节拍表',
    columns: [
      '日期',
      '班次',
      '工序',
      '机台',
      '工单号',
      '卡号',
      '料号',
      '标准节拍',
      '标准产量',
      '实际产量',
      '实际节拍',
    ],
    rows: taktRecords.map((r) => [
      r.date,
      r.shift,
      r.process,
      r.machine,
      r.order,
      r.card,
      r.product,
      r.standardRate,
      r.standardQuantity,
      r.quantity,
      r.rate,
    ]),
  },
] as const;
export function finalSourceLink(id: string, row?: number) {
  const source = finalSourceDefinitions.find((s) => s.id === id)!;
  return `[${source.name}${row ? ` · 第${row}行` : ''}](${encodeURI(`/data/final/${source.name}.csv`)}${row ? `?row=${row}` : ''})`;
}
