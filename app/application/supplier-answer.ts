import type { Dataset, Inputs, Row } from './model';
import { validateDataset, validateInputs } from './model';
import { supplierRisk, supplierScore } from './supplier-metrics';
import { supplierRules, withFixedRules } from './fixed-rules';
import { datasetReference } from './data-files';
import { encodeScope, scopeValues, scopeLabel } from './scope';

export const supplierExamples = [
  {
    title: '查看评分排名',
    question: '全部供应商的综合评分是多少，按分数排名。',
  },
  { title: '检查交付风险', question: '哪些供应商的交付及时率没有达到目标？' },
  { title: '检查质量风险', question: '哪些供应商的来料合格率没有达到目标？' },
  {
    title: '比较供应商',
    question: '对比供应商 A 和 C 的交付、质量与综合评分。',
  },
  { title: '了解评分与规则', question: '综合评分怎么算，评分高就没有风险吗？' },
];

const format = (value: number) =>
  value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
const text = (value: string) =>
  value.replace(/\s+/g, ' ').replace(/[\\`*_{}\[\]()<>~|#!]/g, '\\$&');
const key = (value: string) =>
  value.normalize('NFKC').replace(/\s/g, '').toUpperCase();
const name = (row: Row) => String(row['供应商']).trim();
const delivery = (row: Row) => Number(row['交付及时率(%)']);
const quality = (row: Row) => Number(row['来料合格率(%)']);
function requestedSuppliers(question: string, rows: Row[]): string[] {
  const found = new Map<string, string>();
  const aliases = new Map<string, string>();
  for (const row of rows) {
    aliases.set(key(name(row)), name(row));
    aliases.set(key(name(row)).replace(/^供应商/, ''), name(row));
  }
  const add = (value: string) => {
    const canonical = key(value);
    const original =
      aliases.get(canonical) || aliases.get(canonical.replace(/^供应商/, ''));
    found.set(
      original ? key(original) : canonical,
      original || `供应商 ${value.replace(/^供应商\s*/, '')}`,
    );
  };
  const normalized = key(question);
  for (const row of rows) {
    const full = key(name(row));
    const alias = full.replace(/^供应商/, '');
    if (/^[A-Z0-9_-]+$/.test(alias)) {
      const safe = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (
        new RegExp(`(?<![A-Z0-9_-])(?:供应商)?${safe}(?![A-Z0-9_-])`).test(
          normalized,
        )
      )
        add(name(row));
    } else if (normalized.includes(full)) {
      // Prefer the longest actual name when imported names contain one another.
      if (
        !rows.some(
          (other) =>
            key(name(other)).length > full.length &&
            key(name(other)).includes(full) &&
            normalized.includes(key(name(other))),
        )
      )
        add(name(row));
    }
  }
  for (const hit of question.matchAll(/供应商\s*([A-Za-z0-9_-]+)/g))
    add(hit[1]);
  // Bare A / C are common follow-ups; matching whole tokens avoids treating AA as A.
  for (const hit of question.matchAll(
    /(?<![A-Za-z0-9_-])([A-Za-z])(?![A-Za-z0-9_-])/g,
  ))
    add(hit[1]);
  for (const hit of question.matchAll(/供应商\s*[“「"]([^”」"]+)[”」"]/g))
    add(hit[1]);
  if (!found.size) {
    const unknown = question.match(
      /供应商\s*([^\s，,。！？?、和与的]{1,30})(?:的(?:评分|交付|质量|表现)|怎么样|如何)/,
    );
    if (unknown) add(unknown[1]);
  }
  return [...found.values()];
}

/** Answer only from supplier-level ratios; there are no order or inspection denominators. */
export function replyToSupplier(
  question: string,
  current: Inputs,
  dataset: Dataset,
): { answer: string; inputs: Inputs } {
  const inputs = withFixedRules('supplier', {
    supplier: '全部供应商',
    notes: '',
    ...current,
    question,
  });
  const q = question.normalize('NFKC').replace(/％/g, '%');
  const ruleRequest =
    /规则|权重|目标|阈值|下限|要求/.test(q) &&
    /改|调整|设置|设定|设为|设成|提高|降低|收紧|放宽|更高|更严格|\d+(?:\.\d+)?\s*%/.test(
      q,
    );
  const fixedRuleSummary = `当前采用固定规则：交付、质量、响应权重为 ${supplierRules.deliveryWeight}%、${supplierRules.qualityWeight}%、${format(100 - Number(supplierRules.deliveryWeight) - Number(supplierRules.qualityWeight))}%；交付及时率目标 ${supplierRules.deliveryTarget}%，来料合格率目标 ${supplierRules.qualityTarget}%。不支持修改权重、目标或风险判定规则，本次继续按固定规则计算。`;
  const source = `参考数据：${datasetReference(dataset, '供应商汇总资料')}（按供应商汇总）。`;
  const finish = (...parts: string[]) => ({
    answer: [ruleRequest ? fixedRuleSummary : '', ...parts, source]
      .filter(Boolean)
      .join('\n\n'),
    inputs,
  });
  if (/^(你好|您好|嗨|hello|hi|谢谢|感谢)[！!。\s]*$/i.test(q))
    return finish(
      '你好，可以查看供应商评分、交付风险、质量风险、供应商对比，也可以解释固定的评分与风险规则；不支持修改规则。',
    );
  if (/能做什么|怎么用|如何使用|什么功能/.test(q))
    return finish(
      '可以问下面五类问题。未明确变更的供应商范围会沿用当前选择；评分权重固定为40%/40%/20%，交付与质量目标固定为95%/98%，不支持修改规则。',
      supplierExamples
        .map((example, i) => `${i + 1}. ${example.title}：${example.question}`)
        .join('\n'),
    );

  const inputError = validateInputs('supplier', inputs);
  if (inputError) return finish(`当前条件格式不正确：${inputError}`);

  if (!dataset || dataset.module !== 'supplier' || dataset.id !== 'suppliers')
    return finish('当前资料不是有效的供应商汇总数据。');
  const invalid = validateDataset(dataset);
  if (invalid) return finish(`当前供应商资料无法计算：${invalid}`);
  const duplicate = dataset.rows.find(
    (row, index, rows) =>
      rows.findIndex((other) => key(name(other)) === key(name(row))) !== index,
  );
  if (duplicate)
    return finish(
      `${text(name(duplicate))}有重复的供应商汇总记录。缺少订单、检验数量或分期依据，不能直接相加或平均这些比例；请先提供每家供应商唯一的汇总记录。`,
    );

  const named = requestedSuppliers(q, dataset.rows);
  if (/全部供应商|所有供应商|各(?:家)?供应商/.test(q))
    inputs.supplier = '全部供应商';
  else if (named.length)
    inputs.supplier = encodeScope(named, '全部供应商', dataset.rows.map(name));
  else if (/未知供应商|不存在的供应商/.test(q)) inputs.supplier = '未知供应商';
  const wanted = scopeValues(
    inputs.supplier,
    '全部供应商',
    dataset.rows.map(name),
  ).map(key);
  const rows = wanted.length
    ? dataset.rows.filter(
        (row) =>
          wanted.includes(key(name(row))) ||
          wanted.includes(key(name(row)).replace(/^供应商/, '')),
      )
    : dataset.rows;
  const missing = wanted.filter(
    (value) =>
      !rows.some(
        (row) =>
          key(name(row)) === value ||
          key(name(row)).replace(/^供应商/, '') === value,
      ),
  );
  if (!rows.length)
    return finish(
      `当前资料未找到${text(scopeLabel(inputs.supplier, '全部供应商'))}，没有可用于回答的记录。`,
    );
  const scope =
    rows.length === dataset.rows.length && inputs.supplier === '全部供应商'
      ? `当前全部${rows.length}家供应商`
      : `当前范围：${rows.map((row) => text(name(row))).join('、')}`;
  const partial = missing.length
    ? `未找到${missing.map(text).join('、')}；以下只列出已找到的供应商，不能完成缺失对象的对比。`
    : '';
  const finishScoped = (...parts: string[]) => finish(partial, ...parts);

  if (
    /同比|环比|趋势|预测|去年|前年|今年|明年|昨天|今天|明天|上周|本周|上月|本月|去年|每天|每月|季度|\d{4}年|\d{1,2}月|\d{1,2}[/-]\d{1,2}|日期|某天/.test(
      q,
    )
  )
    return finishScoped(
      '当前资料只有供应商汇总比例，没有日期或历史序列，无法回答指定日期、同比环比、趋势或预测。',
    );
  if (
    /(?:整体|总体|全局|加权|平均).{0,10}(?:及时率|合格率)|(?:及时率|合格率).{0,10}(?:整体|总体|全局|加权|平均)/.test(
      q,
    )
  )
    return finishScoped(
      '当前资料没有各供应商的订单总数、及时交付订单数、检验总数和合格数量，无法计算整体交付及时率或加权来料合格率。可以比较每家供应商的现有比例，或统计未达到目标的供应商数量。',
    );
  if (
    /订单|批次|多少单|几单|几批|哪批|批号|检验数量|合格数量|不合格数量|延期天数|晚了几天/.test(
      q,
    )
  )
    return finishScoped(
      '当前资料没有订单、批次、数量或交期明细，无法定位具体记录，也不能从汇总比例反推订单数、检验数量或延期天数。',
    );
  if (/价格|采购金额|采购额|报价|成本/.test(q))
    return finishScoped(
      '当前资料没有价格或采购金额，无法比较报价、成本或价格稳定性；可以比较现有的交付、质量与响应表现。',
    );
  if (
    /(?:延期|延迟|交付|质量|不合格|来料).{0,8}(?:原因|根因)|(?:原因|根因).{0,8}(?:延期|延迟|交付|质量|不合格|来料)/.test(
      q,
    ) &&
    !/分数|评分|风险/.test(q)
  )
    return finishScoped(
      '这些比例只能说明供应商当前汇总表现，不能确认延期或质量问题的具体原因；需要订单、交期或检验记录才能进一步核查。',
    );

  const deliveryTarget = Number(inputs.deliveryTarget);
  const qualityTarget = Number(inputs.qualityTarget);
  const riskText = (row: Row) => {
    const risk = supplierRisk(row, inputs);
    return (
      [
        risk.delivery
          ? `交付及时率${format(delivery(row))}%低于${format(deliveryTarget)}%`
          : '',
        risk.quality
          ? `来料合格率${format(quality(row))}%低于${format(qualityTarget)}%`
          : '',
      ]
        .filter(Boolean)
        .join('；') || '交付和质量均达到当前目标'
    );
  };
  const explain =
    /怎么算|如何计算|计算公式|评分公式|评分规则|规则解释|评分与规则|权重.*(?:意思|含义|依据|为什么)|(?:规则|目标|阈值).*(?:怎么|如何|依据)|分高|评分高|评分与风险|评分和风险|(?:为什么|为何).*(?:评分|分数|分|风险|异常)|(?:评分|分数|风险|异常).*(?:为什么|为何)/.test(
      q,
    );
  if (explain)
    return finishScoped(
      `综合评分 = 交付及时率×${inputs.deliveryWeight}% + 来料合格率×${inputs.qualityWeight}% + 响应评分×${format(100 - Number(inputs.deliveryWeight) - Number(inputs.qualityWeight))}%。比例按0–100的数值参与计算，结果满分100分。`,
      `风险独立判断：交付及时率低于${format(deliveryTarget)}%，或来料合格率低于${format(qualityTarget)}%，就需要关注；刚好等于目标视为达标。评分高也可能有单项未达标。权重和目标为当前固定评估规则。`,
      `${scope}：`,
      rows
        .map((row) => {
          const deliveryPart =
            (delivery(row) * Number(inputs.deliveryWeight)) / 100;
          const qualityPart =
            (quality(row) * Number(inputs.qualityWeight)) / 100;
          const responseWeight =
            100 - Number(inputs.deliveryWeight) - Number(inputs.qualityWeight);
          const responsePart = (Number(row['响应评分']) * responseWeight) / 100;
          return `- ${text(name(row))}：${format(delivery(row))}×${inputs.deliveryWeight}% + ${format(quality(row))}×${inputs.qualityWeight}% + ${format(Number(row['响应评分']))}×${format(responseWeight)}% = ${format(deliveryPart)} + ${format(qualityPart)} + ${format(responsePart)} = ${format(supplierScore(row, inputs))}分。${riskText(row)}。`;
        })
        .join('\n'),
    );

  const compare = /对比|比较/.test(q);
  const asksDelivery = /交付|交期|及时|延期/.test(q);
  const asksQuality = /质量|来料|合格/.test(q);
  const asksScore = /评分|分数|排名|排行|排序|谁最好|表现最好/.test(q);
  const sorted = [...rows].sort(
    (a, b) => supplierScore(b, inputs) - supplierScore(a, inputs),
  );
  if (compare || (asksScore && (asksDelivery || asksQuality) && !ruleRequest))
    return finishScoped(
      `${scope}，按当前综合评分从高到低列出：`,
      sorted
        .map(
          (row, i) =>
            `${i + 1}. ${text(name(row))}：交付及时率${format(delivery(row))}%，来料合格率${format(quality(row))}%，响应评分${format(Number(row['响应评分']))}分，综合评分${format(supplierScore(row, inputs))}分；${riskText(row)}。`,
        )
        .join('\n'),
      '综合评分反映当前权重下的相对表现，交付和质量风险仍按各自目标判断。',
    );
  if (asksDelivery && !asksQuality && !asksScore) {
    const risky = rows.filter((row) => supplierRisk(row, inputs).delivery);
    return finishScoped(
      `${scope}，交付及时率目标${format(deliveryTarget)}%，${risky.length}家未达标。`,
      rows
        .map(
          (row) =>
            `- ${text(name(row))}：交付及时率${format(delivery(row))}%，${supplierRisk(row, inputs).delivery ? `低于目标${format(deliveryTarget - delivery(row))}个百分点` : '达到目标'}。`,
        )
        .join('\n'),
    );
  }
  if (asksQuality && !asksDelivery && !asksScore) {
    const risky = rows.filter((row) => supplierRisk(row, inputs).quality);
    return finishScoped(
      `${scope}，来料合格率目标${format(qualityTarget)}%，${risky.length}家未达标。`,
      rows
        .map(
          (row) =>
            `- ${text(name(row))}：来料合格率${format(quality(row))}%，${supplierRisk(row, inputs).quality ? `低于目标${format(qualityTarget - quality(row))}个百分点` : '达到目标'}。`,
        )
        .join('\n'),
    );
  }
  if (asksScore || /权重/.test(q))
    return finishScoped(
      `${scope}，按综合评分从高到低排名。交付、质量、响应权重分别为${inputs.deliveryWeight}%、${inputs.qualityWeight}%、${format(100 - Number(inputs.deliveryWeight) - Number(inputs.qualityWeight))}%。`,
      sorted
        .map(
          (row, i) =>
            `${i + 1}. ${text(name(row))}：${format(supplierScore(row, inputs))}分。`,
        )
        .join('\n'),
      '排名只反映当前权重下的评分；是否异常需要单独检查交付和质量目标。',
    );
  const risks = rows.filter((row) => {
    const risk = supplierRisk(row, inputs);
    return risk.delivery || risk.quality;
  });
  return finishScoped(
    `${scope}，${risks.length}家供应商存在交付或质量未达标，同一家供应商只计一次。交付目标${format(deliveryTarget)}%，来料合格率目标${format(qualityTarget)}%。`,
    rows.map((row) => `- ${text(name(row))}：${riskText(row)}。`).join('\n'),
    '汇总比例能帮助确定需要核查的供应商，无法据此确认具体订单或问题原因。',
  );
}
