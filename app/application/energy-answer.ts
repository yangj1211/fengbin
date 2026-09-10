import type { Dataset, Inputs } from './model';

const format = (value: number, digits = 1) =>
  value.toLocaleString('zh-CN', { maximumFractionDigits: digits });

/** Text for the current aggregate-data preview; never invent a time series. */
export function energyAnswer(
  question: string,
  input: Inputs,
  dataset: Dataset,
) {
  const source = `参考数据：${dataset.fileName || dataset.name}（${dataset.origin === 'sample' ? '示例' : '本地'}工序汇总资料）。`;
  if (
    /趋势|同比|环比|昨日|昨天|小时|班次|产线|设备|非生产|夜间|用水|水耗|用气|气耗|天然气|空压|空调/.test(
      question,
    )
  )
    return `目前只有按工序汇总的 7 天用电与产量数据，能做工序对比、单位电耗分析和简单用电估算。\n\n你问到的具体趋势、时段或其他能源情况，需要相应的日期、班次、设备和计量明细，当前资料还不能判断。\n\n${source}`;
  const rows = dataset.rows.filter(
    (row) => input.process === '全部工序' || row['工序'] === input.process,
  );
  if (!rows.length)
    return `当前资料中没有“${input.process}”的数据，请换一个工序。\n\n${source}`;
  const total = rows.reduce((sum, row) => sum + Number(row['用电量(kWh)']), 0);
  const projected =
    ((total * Number(input.period)) / 7) * (1 + Number(input.change) / 100);
  const details = rows.map((row) => {
    const actual = Number(row['用电量(kWh)']) / Number(row['产量(千只)']);
    const baseline = Number(row['基准单耗(kWh/千只)']);
    return {
      name: String(row['工序']),
      actual,
      baseline,
      deviation: (actual / baseline - 1) * 100,
      warning: actual > baseline * 1.05,
    };
  });
  const issues = details.filter((item) => item.warning);
  const lines = [
    `${input.process}按 7 天口径统计，用电共 ${format(total / 1000)} MWh。按产量变化 ${input.change}% 估算，未来 ${input.period} 天约需 ${format(projected / 1000)} MWh。`,
    issues.length
      ? `需要关注${issues.map((item) => item.name).join('、')}：${issues.map((item) => `单位电耗比基准高 ${format(item.deviation)}%`).join('；')}，超过当前 5% 的提示阈值。`
      : '当前所选工序的单位电耗没有超过基准 5%。',
    details
      .map(
        (item) =>
          `- ${item.name}：单位电耗 ${format(item.actual, 2)} kWh/千只，基准 ${format(item.baseline, 2)} kWh/千只。`,
      )
      .join('\n'),
    issues.length
      ? '建议先核对这些工序的产量记录，再检查空载运行时长、批次装载率与设备运行记录，确认偏高原因后安排优化。当前汇总数据只能提示偏差，不能确认现场原因或节能收益。'
      : '可以继续结合生产计划观察用电变化；仅凭当前汇总数据，还不能判断具体时段是否异常。',
    `估算方法：7 天用电量 × ${input.period} / 7 ×（1 + ${input.change}%）。当前为线性情景估算。`,
    source,
  ];
  if (/怎么算|计算|公式|依据/.test(question))
    return [
      lines[0],
      lines[4],
      '单位电耗 = 用电量 ÷ 产量；单位电耗高于基准 5% 时提示关注。',
      source,
    ].join('\n\n');
  return lines.join('\n\n');
}
