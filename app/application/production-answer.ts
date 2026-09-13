import type { Dataset, Inputs } from './model';
import { belowProductionThreshold as below } from './production-metrics';
import { productionRules, withFixedRules } from './fixed-rules';
import { datasetReference } from './data-files';
import {
  encodeScope,
  scopeValues,
  scopeLabel,
  validInputString,
} from './scope';

export const productionExamples = [
  {
    title: '查看产量与进度',
    question: '查看全部产线的计划、实际产量、完成率和缺口。',
  },
  { title: '检查产品质量', question: '检查当前产线的良率、不良率和质量异常。' },
  { title: '查看停机情况', question: '全部产线停机了多久，哪条产线停机最多？' },
  { title: '比较产线表现', question: '比较各条产线的表现，按计划完成率排名。' },
  {
    title: '检查综合异常',
    question: '检查全部产线的综合异常，并说明需要优先核查哪些产线。',
  },
];
export const productionDailyReportExample = {
  title: '生成生产日报',
  question:
    '生成当前产线范围的生产日报，汇总产量、质量、停机和异常，并给出跟进建议。',
};
const columns = [
  '产线',
  '计划产量(万只)',
  '实际产量(万只)',
  '检验数量',
  '不良数量',
  '停机时长(min)',
];
const format = (value: number, digits = 2) =>
  value.toLocaleString('zh-CN', { maximumFractionDigits: digits });
const text = (value: string) =>
  value.replace(/\s+/g, ' ').replace(/[\\`*_{}\[\]()<>~|#!]/g, '\\$&');
const chinese: Record<string, string> = {
  一: '1',
  二: '2',
  两: '2',
  三: '3',
  四: '4',
  五: '5',
  六: '6',
  七: '7',
  八: '8',
  九: '9',
  十: '10',
};
function lineNumber(value: string): string {
  if (/^\d+$/.test(value)) return String(Number(value));
  if (chinese[value]) return chinese[value];
  const tens = value.match(
    /^([一二两三四五六七八九])?十([一二三四五六七八九])?$/,
  );
  return tens
    ? String(Number(chinese[tens[1]] ?? 1) * 10 + Number(chinese[tens[2]] ?? 0))
    : value;
}
const normalize = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/\s/g, '')
    .replace(
      /第?([零〇一二两三四五六七八九十百]+|\d+)(?:号|条)?产线/g,
      (_, n: string) => `${lineNumber(n)}号产线`,
    );

type Line = {
  name: string;
  planned: number;
  actual: number;
  checked: number;
  rejected: number;
  stopped: number;
};
const completion = (line: Line) => (line.actual / line.planned) * 100;
const defect = (line: Line) => (line.rejected / line.checked) * 100;
function dataError(dataset: Dataset): string | null {
  if (
    !dataset ||
    dataset.module !== 'production' ||
    !Array.isArray(dataset.rows) ||
    !Array.isArray(dataset.columns)
  )
    return '当前资料不是有效的生产汇总数据。';
  if (!dataset.rows.length) return '当前资料没有生产记录，暂时无法计算。';
  if (
    dataset.rows.length > 10000 ||
    dataset.columns.length !== columns.length ||
    columns.some((column) => !dataset.columns.includes(column))
  )
    return '生产资料应包含完整的计划、实际、检验、不良和停机字段，且不超过10000条记录。';
  for (const row of dataset.rows) {
    if (
      !row ||
      columns.some(
        (column) =>
          row[column] === undefined ||
          String(row[column]).trim() === '' ||
          String(row[column]).length > 1000,
      )
    )
      return '生产资料存在空字段或无效字段，暂时无法计算。';
    if (
      columns
        .slice(1)
        .some(
          (column) =>
            !Number.isFinite(Number(row[column])) ||
            Number(row[column]) < 0 ||
            Number(row[column]) > 1e12,
        )
    )
      return '产量、检验、不良和停机字段需要是有效的非负数值。';
    if (
      Number(row[columns[1]]) <= 0 ||
      Number(row[columns[3]]) <= 0 ||
      Number(row[columns[4]]) > Number(row[columns[3]])
    )
      return '计划产量和检验数量须大于0，不良数量不能超过检验数量。';
  }
  return null;
}

/** Produce text from line aggregates; dates, shifts and machine causes are not present. */
export function replyToProduction(
  question: string,
  current: Inputs,
  dataset: Dataset,
): { answer: string; inputs: Inputs } {
  const inputs = withFixedRules('production', {
    line: '全部产线',
    notes: '',
    ...current,
    question,
  });
  const q = question.normalize('NFKC').replace(/％/g, '%');
  const dailyReport = /日报/.test(q);
  const qualityLimit = q.match(
    /不良率(?:(?:阈值|上限|目标|要求)[^\d+\-]{0,12}|(?:调整|调|改|设|控制|超过|高于|低于|小于|大于|不超过)[^\d+\-]{0,12})([+\-]?\d+(?:\.\d+)?)\s*%/,
  );
  const completionLimit = q.match(
    /完成率(?:(?:目标|阈值|要求|下限)[^\d+\-]{0,12}|(?:调整|调|改|设|至少|不低于|低于|小于|达到)[^\d+\-]{0,12})([+\-]?\d+(?:\.\d+)?)\s*%/,
  );
  const yieldLimit = q.match(
    /(?<!不)良率(?:(?:目标|下限|要求)[^\d+\-]{0,12}|(?:调整|调|改|设|至少|不低于)[^\d+\-]{0,12})([+\-]?\d+(?:\.\d+)?)\s*%/,
  );
  const ruleRequest =
    (/规则|目标|阈值|上限|下限|质量要求|完成率|良率/.test(q) &&
      /修改|调整|设置|设定|改为|改成|改到|调到|设为|设成|提高|降低|收紧|放宽|更严格|更高/.test(
        q,
      )) ||
    Boolean(
      qualityLimit &&
      Number(qualityLimit[1]) !== Number(productionRules.defect),
    ) ||
    Boolean(
      completionLimit &&
      Number(completionLimit[1]) !== Number(productionRules.completion),
    ) ||
    Boolean(
      yieldLimit &&
      Number(yieldLimit[1]) !== 100 - Number(productionRules.defect),
    );
  const fixedRuleSummary = `当前采用固定规则：完成率低于 ${productionRules.completion}% 或不良率高于 ${productionRules.defect}% 时提醒，等于边界不触发；不支持修改目标、阈值或异常判定规则。`;
  const source = `参考数据：${datasetReference(dataset, '生产汇总资料')}（按产线汇总）。`;
  const finish = (...parts: string[]) => ({
    answer: [ruleRequest ? fixedRuleSummary : '', ...parts, source]
      .filter(Boolean)
      .join('\n\n'),
    inputs,
  });
  if (/^(你好|您好|嗨|hello|hi|谢谢|感谢)[！!。\s]*$/i.test(q))
    return finish(
      '你好，我可以帮你查看产量进度、质量、停机、产线排名和异常。异常判定使用固定规则，不支持修改。',
    );
  if (/能做什么|怎么用|如何使用|什么功能/.test(q))
    return finish(
      '可以围绕下面五类问题继续提问。未明确变更的产线范围会沿用当前选择；完成率目标固定95%，不良率上限固定2%，不支持修改规则。',
      productionExamples
        .map((example, i) => `${i + 1}. ${example.title}：${example.question}`)
        .join('\n'),
      `也可以生成生产日报：${productionDailyReportExample.question}`,
    );

  const ranking =
    /对比|比较|排名|排行|排序|哪条.*(?:最好|最差|最高|最低)|哪条产线表现/.test(
      q,
    );
  const named = new Set<string>();
  for (const hit of q.matchAll(
    /第?(\d+|[零〇一二两三四五六七八九十百]+)\s*(?:号|条)?\s*产线/g,
  ))
    named.add(normalize(hit[0]));
  for (const hit of q.matchAll(
    /((?:\d+|[零〇一二两三四五六七八九十百]+)\s*(?:号|条)?(?:\s*[、,，和及与]\s*(?:\d+|[零〇一二两三四五六七八九十百]+)\s*(?:号|条)?)+)\s*产线/g,
  )) {
    for (const number of hit[1].match(/\d+|[零〇一二两三四五六七八九十百]+/g) ??
      [])
      named.add(normalize(`${number}号产线`));
  }
  for (const row of Array.isArray(dataset?.rows) ? dataset.rows : []) {
    const name = String(row?.['产线'] ?? '').trim();
    if (
      name &&
      !/^\d+号产线$/.test(normalize(name)) &&
      normalize(q).includes(normalize(name))
    )
      named.add(normalize(name));
  }
  if (named.size)
    inputs.line = encodeScope(
      [...named].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true })),
      '全部产线',
      dataset.rows.map((row) => normalize(String(row['产线']))),
    );
  else if (/未知产线|不存在的产线/.test(q)) inputs.line = '未知产线';
  else if (/全部产线|所有产线|各条?产线|不同产线/.test(q))
    inputs.line = '全部产线';

  if (
    Object.entries(inputs).some(([key, value]) => !validInputString(key, value))
  )
    return finish('当前条件格式不正确，请用文字说明需要查看的产线范围。');
  const invalid = dataError(dataset);
  if (invalid) return finish(invalid);

  if (
    !dailyReport &&
    /规则.*(?:定|判断|是什么)|怎么算|计算方式|计算口径|公式|依据|阈值.*(?:来|定|含义)|怎么.*(?:判断|预警)/.test(
      q,
    )
  )
    return finish(
      '当前使用固定业务规则：完成率目标95%，不良率上限2%。不支持修改配置，规则适用于当前生产看板。',
      `计划完成率 = 实际产量 ÷ 计划产量 × 100%，低于当前目标 ${inputs.completion}% 时提醒；不良率 = 不良数量 ÷ 检验数量 × 100%，高于当前上限 ${inputs.defect}% 时提醒。刚好等于边界不触发。`,
      '同一条产线同时触发两项只计一次。检验良率 = 1 − 不良率；汇总时先加总检验数和不良数，再计算比例。停机时长只做统计和排序，目前没有停机预警阈值。',
      '所有所选产线统一使用固定阈值。可以改变产线范围继续查询；异常表示需要核查，不代表已确认故障原因。',
    );

  // Merge duplicate line entries before calculating weighted rates and unique alerts.
  const grouped = new Map<string, Line>();
  for (const row of dataset.rows) {
    const name = String(row['产线']).trim();
    const key = normalize(name);
    const line = grouped.get(key) ?? {
      name,
      planned: 0,
      actual: 0,
      checked: 0,
      rejected: 0,
      stopped: 0,
    };
    line.planned += Number(row[columns[1]]);
    line.actual += Number(row[columns[2]]);
    line.checked += Number(row[columns[3]]);
    line.rejected += Number(row[columns[4]]);
    line.stopped += Number(row[columns[5]]);
    grouped.set(key, line);
  }
  const selectedValues = scopeValues(
    inputs.line,
    '全部产线',
    [...grouped.values()].map((line) => line.name),
  ).map(normalize);
  const selected = selectedValues.length ? selectedValues : null;
  const lines = selected
    ? [...grouped]
        .filter(([name]) => selected.includes(name))
        .map(([, line]) => line)
    : [...grouped.values()];
  if (!lines.length)
    return finish(
      `没有找到“${text(scopeLabel(inputs.line, '全部产线'))}”的生产记录，当前范围没有可计算的数据。`,
    );
  const missing = selected?.filter((name) => !grouped.has(name)) ?? [];
  const scope = selected
    ? lines.map((line) => text(line.name)).join('、')
    : `全部${lines.length}条产线`;
  const totals = lines.reduce(
    (sum, line) => ({
      name: scope,
      planned: sum.planned + line.planned,
      actual: sum.actual + line.actual,
      checked: sum.checked + line.checked,
      rejected: sum.rejected + line.rejected,
      stopped: sum.stopped + line.stopped,
    }),
    { name: scope, planned: 0, actual: 0, checked: 0, rejected: 0, stopped: 0 },
  );
  const lowProduction = (line: Line) =>
    below(line.actual * 100, line.planned * Number(inputs.completion));
  const highDefect = (line: Line) =>
    below(line.checked * Number(inputs.defect), line.rejected * 100);
  const badQuality = lines.filter(highDefect);
  const alerts = lines.filter(
    (line) => lowProduction(line) || highDefect(line),
  );
  const gap = totals.planned - totals.actual;
  const progress = `${scope}计划产量 ${format(totals.planned)} 万只，实际完成 ${format(totals.actual)} 万只，计划完成率 ${format(completion(totals))}%；${gap > 1e-9 ? `距计划还差 ${format(gap)} 万只` : gap < -1e-9 ? `超出计划 ${format(-gap)} 万只` : '实际产量与计划持平'}。`;
  const quality = `共检验 ${format(totals.checked)} 只，不良 ${format(totals.rejected)} 只，加权不良率 ${format(defect(totals))}%，良率 ${format(100 - defect(totals))}%。按检验总数计算，不把各产线百分比直接取平均。`;
  const maxStopped = Math.max(...lines.map((line) => line.stopped));
  const longest = lines
    .filter((line) => line.stopped === maxStopped)
    .map((line) => text(line.name))
    .join('、');
  const downtime = `${scope}累计停机 ${format(totals.stopped)} 分钟。${totals.stopped ? `${longest}${lines.filter((line) => line.stopped === maxStopped).length > 1 ? '并列' : ''}停机最多，为 ${format(maxStopped)} 分钟${totals.stopped ? `，占总停机时长的 ${format((maxStopped / totals.stopped) * 100)}%` : ''}。` : '各产线停机记录均为0分钟。'}现有资料没有停机原因、计划开机时长或允许停机阈值，不能据此确认设备故障或判定停机超标。`;
  const alertText = alerts.length
    ? `按完成率低于 ${inputs.completion}% 或不良率高于 ${inputs.defect}% 判定，共 ${alerts.length} 条产线需要关注，同一产线同时触发两项也只计一次。\n\n${alerts.map((line) => `- ${text(line.name)}：${[lowProduction(line) ? `完成率 ${format(completion(line))}%，低于 ${inputs.completion}% 目标` : '', highDefect(line) ? `不良率 ${format(defect(line))}%，高于 ${inputs.defect}% 上限` : ''].filter(Boolean).join('；')}。`).join('\n')}`
    : `按完成率低于 ${inputs.completion}% 或不良率高于 ${inputs.defect}% 判定，当前没有异常产线；等于阈值不触发提醒。`;
  const parts: string[] = [];
  if (missing.length)
    parts.push(
      `未找到${missing.map(text).join('、')}的记录，以下仅统计${scope}，未涵盖全部指定产线。`,
    );
  const unavailable: string[] = [];
  if (
    !dailyReport &&
    /同比|环比|趋势|走势|昨天|昨日|今天|今日|明天|下周|上周|本周|本月|上月|按[日月年]|每天|每月|每年|\d{4}[-/年]\d|(?<!\d)(?:\d{4}[-/年])?\d{1,2}[-/月]\d{1,2}(?:日|号)?(?!\d)/.test(
      q,
    )
  )
    unavailable.push(
      '资料没有日期和历史周期，无法确认指定日期的表现，也不能计算同比、环比或时间趋势',
    );
  if (/班次|白班|夜班|班组|小时/.test(q))
    unavailable.push('资料没有班次和时段明细，无法比较各班次');
  if (/OEE|设备综合效率/i.test(q))
    unavailable.push('缺少计划开机时长、运行时间和理论节拍，不能计算OEE');
  if (/具体.*原因|设备.*原因|故障原因|为什么|为何/.test(q))
    unavailable.push(
      '汇总指标不能确定具体设备故障或偏差原因，需要对应停机事件和检验批次记录',
    );
  if (unavailable.length)
    parts.push(`${unavailable.join('；')}。以下仅说明当前产线汇总记录。`);
  if (dailyReport) {
    const followUp: string[] = [];
    if (lines.some(lowProduction))
      followUp.push(
        `核对${lines
          .filter(lowProduction)
          .map((line) => text(line.name))
          .join('、')}的计划、报工与停机记录，确认产量缺口并评估补产安排。`,
      );
    if (badQuality.length)
      followUp.push(
        `复核${badQuality.map((line) => text(line.name)).join('、')}的检验批次、缺陷类型与处置记录，进一步排查质量偏差。`,
      );
    if (totals.stopped > 0)
      followUp.push(`核对${longest}的停机事件，确认停机时段和原因。`);
    if (!followUp.length)
      followUp.push('当前未触发产量或质量异常，继续跟踪计划执行与检验记录。');
    return finish(
      '生产日报',
      `统计范围：${scope}。统计日期待确认：当前资料没有日期，以下仅汇总现有记录，不能认定为今天或指定日期的生产结果，也无法计算时间趋势或同比、环比。`,
      ...parts,
      `1. 产量与进度\n\n${progress}`,
      `2. 检验质量\n\n${quality}`,
      `3. 停机情况\n\n${downtime}`,
      `4. 异常情况\n\n${alertText}`,
      `5. 跟进建议\n\n${followUp.map((item) => `- ${item}`).join('\n')}`,
    );
  }
  const qualityRequest = /质量|良率|不良|合格|检验/.test(q);
  const stopRequest = /停机|停线|停产/.test(q);
  const progressRequest = /产量|产出|产能|计划|进度|完成率|缺口|达成/.test(q);
  const general =
    /综合异常|综合分析|整体|总体|全面|生产情况|生产表现|生产异常/.test(q) ||
    Boolean(completionLimit && (qualityLimit || yieldLimit)) ||
    (!qualityRequest &&
      !stopRequest &&
      !progressRequest &&
      /综合|异常|预警|风险|关注|问题|按当前|重新分析/.test(q));
  if (ranking) {
    const byStop =
      /按.*停机|停机.*(?:排名|排序)/.test(q) ||
      (stopRequest && !progressRequest && !qualityRequest);
    const byQuality =
      !byStop &&
      (/按.*(?:不良率|良率)|(?:不良率|良率).*(?:排名|排序)/.test(q) ||
        (qualityRequest && !progressRequest));
    const ranked = [...lines].sort(
      (a, b) =>
        (byStop
          ? b.stopped - a.stopped
          : byQuality
            ? defect(a) - defect(b)
            : completion(b) - completion(a)) ||
        a.name.localeCompare(b.name, 'zh-CN', { numeric: true }),
    );
    parts.push(
      `${scope}按${byStop ? '停机时长从多到少' : byQuality ? '不良率从低到高' : '计划完成率从高到低'}排列；不使用额外的综合评分。${lines.length === 1 ? '当前仅有一条可用产线，无法做跨产线比较。' : ''}`,
      ranked
        .map(
          (line, i) =>
            `${i + 1}. ${text(line.name)}：${[
              progressRequest || (!qualityRequest && !stopRequest)
                ? `完成率 ${format(completion(line))}%，实际 ${format(line.actual)} / 计划 ${format(line.planned)} 万只`
                : '',
              qualityRequest
                ? `不良率 ${format(defect(line))}%，良率 ${format(100 - defect(line))}%`
                : '',
              stopRequest ? `停机 ${format(line.stopped)} 分钟` : '',
            ]
              .filter(Boolean)
              .join('；')}。`,
        )
        .join('\n'),
    );
    if (general) parts.push(alertText);
  } else if (general || (!qualityRequest && !stopRequest && !progressRequest)) {
    if (
      !general &&
      !unavailable.length &&
      !/生产|产线|分析|看一下|怎么样|详细|继续/.test(q)
    )
      return finish(
        '可以帮你查看当前产线的产量进度、质量、停机、排名和异常。请说明想了解的生产问题。',
      );
    parts.push(progress, quality, downtime, alertText);
  } else {
    if (progressRequest)
      parts.push(
        progress,
        lines
          .map(
            (line) =>
              `- ${text(line.name)}：计划 ${format(line.planned)} 万只、实际 ${format(line.actual)} 万只，完成率 ${format(completion(line))}%，${line.actual < line.planned ? `缺口 ${format(line.planned - line.actual)} 万只` : line.actual > line.planned ? `超计划 ${format(line.actual - line.planned)} 万只` : '与计划持平'}。`,
          )
          .join('\n'),
        lines.some(lowProduction)
          ? `完成率低于 ${inputs.completion}% 目标的有${lines
              .filter(lowProduction)
              .map(
                (line) => `${text(line.name)}（${format(completion(line))}%）`,
              )
              .join('、')}。`
          : `各产线完成率均达到 ${inputs.completion}% 目标，等于目标不触发提醒。`,
      );
    if (qualityRequest)
      parts.push(
        `${scope}的质量汇总：${quality}`,
        badQuality.length
          ? `不良率超过 ${inputs.defect}% 上限的有${badQuality.map((line) => `${text(line.name)}（${format(defect(line))}%）`).join('、')}。等于上限不触发提醒。`
          : `各产线不良率均未超过 ${inputs.defect}% 上限。`,
      );
    if (stopRequest)
      parts.push(
        downtime,
        lines
          .map(
            (line) =>
              `- ${text(line.name)}：停机 ${format(line.stopped)} 分钟。`,
          )
          .join('\n'),
      );
  }
  return finish(...parts);
}
