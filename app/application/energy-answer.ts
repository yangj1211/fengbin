import type { Dataset, Inputs } from './model';
import { filterScope, scopeLabel } from './scope';
import {
  energyDetailAnalysis,
  energyPointThreshold,
  energySource,
} from './energy-data';

const format = (value: number, digits = 1) =>
  value.toLocaleString('zh-CN', { maximumFractionDigits: digits });

/** Dashboard and chat share the same detail calculations; aggregate-only data keeps its limits. */
export function energyAnswer(
  question: string,
  input: Inputs,
  dataset: Dataset,
) {
  const dateMatch = question.match(
    /(?<!\d)(?:(\d{4})[-/年])?(0?[1-9]|1[0-2])[-/月](0?[1-9]|[12]\d|3[01])(?:日|号)?(?!\d)/,
  );
  const requestedDate = dateMatch
    ? `${dateMatch[1] || input.dateFrom?.slice(0, 4) || dataset.energyDetails?.[0]?.date.slice(0, 4) || '2026'}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
    : undefined;
  const requestedShift =
    /夜班/.test(question) && !/白班/.test(question)
      ? '夜班'
      : /白班/.test(question) && !/夜班/.test(question)
        ? '白班'
        : undefined;
  const detail = energyDetailAnalysis(dataset, input, {
    date: requestedDate,
    shift: requestedShift,
  });
  if (detail) {
    const source = `参考数据：[${energySource.name}](${encodeURI(energySource.url)})（资料覆盖 ${detail.availableStart}—${detail.availableEnd}）。`;
    if (!detail.rows.length)
      return `当前资料中没有“${scopeLabel(input.process, '全部工序')} / ${scopeLabel(input.line, '全部产线')}${requestedShift ? ` / ${requestedShift}` : ''}”在 ${detail.rangeStart}—${detail.rangeEnd} 的数据，请调整范围。\n\n${source}`;
    const scope = `${scopeLabel(input.process, '全部工序')} / ${scopeLabel(input.line, '全部产线')}${requestedShift ? ` / ${requestedShift}` : ''}`;
    const period = `${detail.start}—${detail.end}`;
    const requestedRange =
      detail.rangeStart !== detail.start || detail.rangeEnd !== detail.end
        ? `所选日期区间 ${detail.rangeStart}—${detail.rangeEnd}；`
        : '';
    const coverage =
      detail.calendarDays > detail.days
        ? `区间共 ${detail.calendarDays} 个自然日，其中 ${detail.days} 天有记录；日均仅按有记录日期计算，缺失日期不按零用电处理。`
        : `日均按 ${detail.days} 个有记录日期计算。`;
    const summary = `${requestedRange}实际统计 ${period}，${scope}共用电 ${format(detail.total / 1000)} MWh，日均 ${format(detail.average / 1000, 2)} MWh。${coverage}`;
    if (
      /同比|环比|昨日|昨天|小时|设备|非生产|用水|水耗|用气|气耗|天然气|空压|空调/.test(
        question,
      )
    )
      return `${summary}\n\n当前资料覆盖每日、白班/夜班与产线用电，但没有你问到的其他能源、设备状态、非生产时段或对应对比周期明细，当前资料还不能判断这部分情况。夜班记录不等于非生产时段。\n\n${source}`;
    const comparison = (groups: typeof detail.lines) =>
      groups
        .map(
          (row) =>
            `- ${row.name}：用电 ${format(row.total / 1000, 2)} MWh，单位电耗 ${format(row.unit, 2)} kWh/千只，基准 ${format(row.baseline, 2)} kWh/千只。`,
        )
        .join('\n');
    const trend = detail.trend
      .map((row) => `- ${row.name}：${format(row.total / 1000, 2)} MWh。`)
      .join('\n');
    const anomalies = detail.issues.length
      ? `发现 ${detail.issues.length} 个需核查的异常点：\n\n${detail.issues.map((row) => `- ${row.date}，${row.line} ${row.shift}，${row.process}：单耗 ${format(row.unit, 2)} kWh/千只，基准 ${format(row.baseline, 2)}，高出 ${format(row.deviation)}%。`).join('\n')}\n\n建议先核对对应班次的产量与用电记录，再检查装载率、空载时长和设备运行记录；这些偏差不能单独确定故障原因。`
      : '当前范围没有单条单耗超过基准 20% 的异常点。';
    const forecastBasis =
      detail.forecastSource === 'plan'
        ? `采用手动输入的计划总产量 ${format(detail.plannedProduction, 2)} 千只；该数值覆盖未来 ${input.period} 天，并非每日产量。本次不再叠加产量变化百分比。`
        : detail.forecastSource === 'change'
          ? `采用产量变化 ${format(detail.productionChange, 2)}% 的情景设定：历史日均产量 × ${input.period} 天 = ${format(detail.referenceProduction, 2)} 千只，再乘（1 + ${format(detail.productionChange, 2)}%），得到估算产量 ${format(detail.plannedProduction, 2)} 千只。`
          : `未输入手动计划，采用历史产量延续：历史日均产量 × ${input.period} 天 = ${format(detail.referenceProduction, 2)} 千只，产量不变。`;
    const forecast = `预测区间 ${detail.forecastStart}—${detail.forecastEnd}（未来 ${input.period} 天），约需 ${format(detail.projected / 1000)} MWh。${forecastBasis}\n\n计算方式：${period} 的综合单位电耗 ${format(detail.unit, 2)} kWh/千只 × 计划或估算总产量 ${format(detail.plannedProduction, 2)} 千只 ÷ 1000 = ${format(detail.projected / 1000)} MWh。历史日均产量按 ${detail.days} 个有记录日期计算；延续历史产量时约需 ${format(detail.unchanged / 1000)} MWh。预测从本次实际覆盖末日的下一天起算，仅作基础情景估算。`;
    if (/怎么算|计算|公式|依据/.test(question))
      return [
        summary,
        forecast,
        `单位电耗 = 所选范围用电总量 ÷ 同批产量；各工序流转同一批产品，产量按日期、产线、班次去重。基准电量按各工序产量 × 对应基准单耗相加。单条记录的单耗高于基准 ${energyPointThreshold}% 时计为一个异常点。`,
        source,
      ].join('\n\n');
    const parts: string[] = [summary];
    if (/趋势|每日|每天|按日|每月|按月|月度|每年|按年|年度/.test(question)) {
      const granularity =
        detail.trendGranularity === 'month'
          ? '月'
          : detail.trendGranularity === 'year'
            ? '年'
            : '日';
      parts.push(
        `按${granularity}汇总用电（${period}，仅含当前范围内记录${granularity === '日' ? '' : '，不代表完整日历周期'}）：\n\n${trend}`,
      );
    }
    if (/班次|白班|夜班|夜间/.test(question))
      parts.push(
        `班次对比（${period}，${scope}的当期汇总）：\n\n${comparison(detail.shifts)}`,
      );
    if (/产线/.test(question))
      parts.push(
        `产线对比（${period}，${scope}的当期汇总）：\n\n${comparison(detail.lines)}`,
      );
    if (/异常|偏高|问题|关注|优化|建议/.test(question))
      parts.push(
        anomalies,
        `异常规则：单条记录单耗高于基准 ${energyPointThreshold}%。`,
      );
    if (/预测|估算|未来|下周|产量/.test(question)) parts.push(forecast);
    if (parts.length === 1) {
      parts.push(
        `综合单位电耗 ${format(detail.unit, 2)} kWh/千只，基准 ${format(detail.baseline, 2)} kWh/千只。`,
      );
      if (!requestedDate && !requestedShift) parts.push(anomalies, forecast);
    }
    if (/对比|班次|产线/.test(question))
      parts.push(
        '总用电量也受产量影响，应结合单位电耗比较。综合单耗的产量按日期、产线、班次去重，同批流转不重复累计。',
      );
    return [...parts, source].join('\n\n');
  }
  const source = `参考数据：${dataset.fileName || dataset.name}（工序汇总资料）。`;
  if (
    requestedDate ||
    /趋势|同比|环比|昨日|昨天|小时|班次|白班|夜班|产线|设备|非生产|夜间|用水|水耗|用气|气耗|天然气|空压|空调/.test(
      question,
    )
  )
    return `目前只有按工序汇总的 7 天用电与产量数据，能做工序对比、单位电耗分析和简单用电估算。\n\n你问到的具体趋势、时段或其他能源情况，需要相应的日期、班次、设备和计量明细，当前资料还不能判断。\n\n${source}`;
  const rows = filterScope(dataset.rows, input.process, '全部工序', (row) =>
    String(row['工序']),
  );
  if (!rows.length)
    return `当前资料中没有“${scopeLabel(input.process, '全部工序')}”的数据，请换一个工序。\n\n${source}`;
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
  const aggregateLimit = [
    input.dateFrom || input.dateTo
      ? '当前工序汇总资料没有日期明细，所选日期区间未用于筛选。'
      : '',
    input.plannedProduction?.trim()
      ? '当前工序汇总资料缺少同批产量去重明细，手动计划总产量未用于估算，仍沿用历史用电与产量变化口径。'
      : '',
  ]
    .filter(Boolean)
    .join('');
  const lines = [
    `${aggregateLimit}${scopeLabel(input.process, '全部工序')}按 7 天口径统计，用电共 ${format(total / 1000)} MWh。按产量变化 ${input.change}% 估算，未来 ${input.period} 天约需 ${format(projected / 1000)} MWh。`,
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
