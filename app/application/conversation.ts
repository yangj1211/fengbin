import { replyToFinalData, finalExamples } from './final-answer';
import { normalizeFinalInput } from './final-data';
import {
  modules,
  validateInputs,
  type ModuleId,
  type Inputs,
  type Dataset,
  type Analysis,
} from './model';
import { replyToCustomer, customerConditions } from './customer-engine';
import { customerExamples } from './customer-data';
import { energyAnswer } from './energy-answer';
import { replyToMaintenance } from './maintenance-engine';
import { maintenanceExamples } from './maintenance-data';
import { replyToProduction } from './production-answer';
import { replyToSupplier, supplierExamples } from './supplier-answer';
import type { SourceReference, CustomerDecision } from './customer-types';
import {
  encodeScope,
  scopeLabel,
  normalizeScopeName,
  mentionedScopeNames,
} from './scope';
export type ConversationTurn = {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
  inputs: Inputs;
  analysis?: Analysis;
  sourceName: string;
  sourceOrigin: 'sample' | 'local';
  savedRecordId?: string;
  sources?: SourceReference[];
  missing?: string[];
  customerDecision?: CustomerDecision;
  feedback?: 'like' | 'dislike' | null;
  /** Public processing summary, separate from the answer copied by the user. */
  processingSummary?: string;
  status?: 'complete' | 'stopped';
};
export type ConversationSession = {
  id: string;
  module: ModuleId;
  title: string;
  /** A manually edited name is retained when questions and drafts are saved. */
  titleEdited?: boolean;
  createdAt: string;
  updatedAt: string;
  turns: ConversationTurn[];
  draft: Inputs;
};
export const suggestions: Record<
  ModuleId,
  { title: string; question: string }[]
> = {
  customer: customerExamples.map(({ title, question }) => ({
    title,
    question,
  })),
  maintenance: maintenanceExamples,
  energy: finalExamples.energy,
  production: finalExamples.production,
  supplier: [supplierExamples[0], supplierExamples[1], supplierExamples[4]],
};
export function conditionSummary(id: ModuleId, input: Inputs): string[] {
  if (id === 'customer') return customerConditions(input);
  if (id === 'maintenance')
    return [input.device, input.model, input.code, input.symptom].filter(
      Boolean,
    );
  if (id === 'energy' || id === 'production') {
    const value = normalizeFinalInput(id, input);
    return [
      value.dateFrom + '—' + value.dateTo,
      scopeLabel(value.process, '全部工序'),
      value.shift,
      ...(id === 'production'
        ? [
            scopeLabel(value.machine, '全部机台'),
            value.order,
            value.card ? '卡号 ' + value.card : '',
          ]
        : [
            value.plannedProduction !== ''
              ? '计划总产量 ' + value.plannedProduction + ' 件'
              : '',
          ]),
    ].filter(Boolean);
  }
  return [
    scopeLabel(input.supplier, '全部供应商'),
    '交付目标 ' + input.deliveryTarget + '%',
    '质量目标 ' + input.qualityTarget + '%',
    '交付 / 质量权重 ' + input.deliveryWeight + ' / ' + input.qualityWeight,
  ];
}
export function replyToQuestion(
  id: ModuleId,
  question: string,
  current: Inputs,
  dataset: Dataset,
): {
  answer: string;
  inputs: Inputs;
  analysis?: Analysis;
  sources?: SourceReference[];
  missing?: string[];
} {
  if (['energy', 'production'].includes(id))
    return replyToFinalData(id as 'energy' | 'production', question, current);
  if (id === 'customer') return replyToCustomer(question, current);
  if (id === 'maintenance') return replyToMaintenance(question, current);
  if (id === 'production') return replyToProduction(question, current, dataset);
  if (id === 'supplier') return replyToSupplier(question, current, dataset);
  const input: Inputs = { ...current, question };
  const q = question.replace(/％/g, '%');
  const m = modules.find((m) => m.id === id)!;
  if (/^(你好|您好|嗨|hello|hi|谢谢|感谢)[！!。\s]*$/i.test(q))
    return {
      inputs: input,
      answer: `您好，我是${m.name}。${m.description}您可以直接描述需求，或选择下方的推荐问题。`,
    };
  if (/(能做什么|怎么用|如何使用|什么功能)/.test(q))
    return {
      inputs: input,
      answer: `我可以${m.description}您可以参考“${suggestions[id][0].question}”来提问，${id === 'energy' ? '也可以直接在问题里说明工序、天数和产量变化。' : '也可以展开“分析条件”核对需求参数。'}`,
    };
  const compact = (value: string) => value.replace(/\s/g, '').toLowerCase();
  const scopeColumn = {
    customer: '应用',
    maintenance: '设备类型',
    energy: '工序',
    production: '产线',
    supplier: '供应商',
  }[id];
  const mentionsData = dataset.rows.some(
    (row) =>
      String(row[scopeColumn]).length >= 2 &&
      compact(q).includes(compact(String(row[scopeColumn]))),
  );
  const relevant: Record<ModuleId, RegExp> = {
    customer:
      /电容|产品|型号|选型|推荐|规格|容量|电压|温度|寿命|工业|消费|小时|[vVμu]F?/,
    maintenance: /维修|设备|故障|排查|卷绕|含浸|老化|温度|真空|张力|断箔/,
    energy:
      /用电|电量|能耗|能源|工序|产量|预测|增长|增加|提高|变化|减少|下降|降低|不变|持平|计划|汇总|趋势|按[日月年]|[日月年]度|班次|白班|夜班|产线|设备|夜间|用水|水耗|用气|气耗|空压|空调|计算|公式|怎么算|异常|偏高/,
    production: /生产|产线|产量|达成|完成率|不良|质量|预警/,
    supplier: /供应商|交付|来料|绩效|评分|权重|合格率/,
  };
  if (
    !relevant[id].test(q) &&
    !mentionsData &&
    !(id === 'energy' && /\d+\s*天/.test(q)) &&
    !/(按当前|重新分析|重新评估|继续分析|为什么|依据|详细)/.test(q)
  )
    return {
      inputs: input,
      answer: `这条问题暂时无法转换为${m.name}的分析条件。请描述具体的${id === 'energy' ? '工序、预测周期或产量变化' : '供应商、目标或评分权重'}${id === 'energy' ? '，例如：产量增长5%，预测下周用电。' : '；也可展开“分析条件”后按条件分析。'}`,
    };
  const capture = (key: string, pattern: RegExp) => {
    const hit = q.match(pattern);
    if (hit) input[key] = hit[1];
  };
  const choose = (key: string, column: string) => {
    const names = Array.from(
      new Set(dataset.rows.map((r) => String(r[column]))),
    ).sort((a, b) => b.length - a.length);
    const matches = mentionedScopeNames(q, names);
    if (matches.length) input[key] = encodeScope(matches, '全部工序', names);
    return matches.length > 0;
  };
  if (id === 'energy') {
    capture('period', /(\d+)\s*天/);
    if (/下周|未来一周/.test(q)) input.period = '7';
    const changes = Array.from(
      q.matchAll(
        /(增长|增加|提高|变化|减少|下降|降低)\s*(?:到|为)?\s*([+-]?\d+(?:\.\d+)?)\s*%/g,
      ),
      (hit) => ({
        index: hit.index,
        value: /减少|下降|降低/.test(hit[1])
          ? String(-Math.abs(Number(hit[2])))
          : hit[2],
      }),
    );
    for (const hit of q.matchAll(/产量(?:保持)?(?:不变|持平)/g))
      changes.push({ index: hit.index, value: '0' });
    if (/^(?:保持)?(?:不变|持平)[。！!\s]*$/.test(q.trim()))
      changes.push({ index: 0, value: '0' });
    const lastChange = changes.sort((a, b) => a.index - b.index).at(-1);
    if (lastChange) {
      input.change = lastChange.value;
      input.plannedProduction = '';
    }
    const plan = Array.from(
      q.matchAll(
        /(?:计划(?:总)?(?:产量|生产)|产量计划)\s*(?:为|是|约|共|达到)?\s*[:：]?\s*([+-]?\d+(?:\.\d+)?)\s*千只/g,
      ),
    ).at(-1);
    if (plan && (!lastChange || plan.index > lastChange.index))
      input.plannedProduction = plan[1];
    if (/按月|每月|月度/.test(q)) input.granularity = 'month';
    else if (/按年|每年|年度/.test(q)) input.granularity = 'year';
    else if (/按日|每日|每天|日度/.test(q)) input.granularity = 'day';
    choose('process', '工序');
    if (/全部工序|所有工序/.test(q)) input.process = '全部工序';
    const knownLines = [
      ...new Set(dataset.energyDetails?.map((row) => row.line) ?? []),
    ];
    const lines = [
      ...new Set([
        ...mentionedScopeNames(q, knownLines),
        ...(normalizeScopeName(q).match(/\d+号产线/g) ?? []),
      ]),
    ];
    if (lines.length) input.line = encodeScope(lines, '全部产线', knownLines);
    if (/未知产线|不存在的产线/.test(q)) input.line = '未知产线';
    if (/全部产线|所有产线|各产线|不同产线/.test(q)) input.line = '全部产线';
  }
  const error = validateInputs(id, input);
  if (error)
    return {
      inputs: input,
      answer: `还需要调整一个条件：${error}${id === 'energy' ? '请在问题里修改数值后再试。' : '修改问题中的数值，或在“分析条件”里调整后再试。'}`,
    };
  return { inputs: input, answer: energyAnswer(question, input, dataset) };
}
