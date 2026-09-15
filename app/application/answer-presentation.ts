import type { Analysis, ModuleId } from './model';
import type { ConversationTurn } from './conversation';
import type { SourceReference } from './customer-types';
import { customerConditions } from './customer-engine';
import { customerParameterComparison } from './customer-comparison';
import { legacyAnalysisText, productionTurnText } from './legacy-answer';
import { businessText, presentAnswer } from './business-presentation';
import { scopeLabel } from './scope';

// CustomerResult previously rendered these strings as literal text, not Markdown.
const literal = (value: string) =>
  value.replace(/[\\`*_{}[\]()<>~|#!]/g, '\\$&');
const paragraphs = (parts: string[]) => parts.filter(Boolean).join('\n\n');
const stopped = (turn: ConversationTurn) =>
  'status' in turn && turn.status === 'stopped';

function customerAnalysisText(
  analysis: Analysis,
  turn: ConversationTurn,
): string {
  const lookup = analysis.title === '产品规格查询';
  const parts = [literal(analysis.summary)];
  if (!analysis.customerCandidates) {
    for (const [index, row] of analysis.rows.entries()) {
      parts.push(`**${index + 1}. ${literal(String(row[0]))}**`);
      parts.push(
        literal(
          analysis.columns
            .slice(1)
            .map((label, column) => `${label}：${row[column + 1] ?? '未记录'}`)
            .join('，') + '。',
        ),
      );
    }
  }
  for (const [index, candidate] of (
    analysis.customerCandidates ?? []
  ).entries()) {
    const product = candidate.product;
    const comparison = lookup
      ? []
      : customerParameterComparison(turn.inputs, product);
    parts.push(`**${index + 1}. ${literal(product.model)}**`);
    parts.push(
      literal(
        comparison.length
          ? comparison.join('')
          : `这款产品适用于${product.application}，额定电压 ${product.voltage} V，容量 ${product.capacity} μF，目录温度 ${product.temperature}℃，寿命 ${product.life.toLocaleString('zh-CN')} h，外形尺寸 Φ${product.diameter} × ${product.height} mm，参考交期 ${product.leadDays} 天。`,
      ),
    );
    parts.push(...candidate.reasons.slice(lookup ? 0 : 2).map(literal));
  }
  if (analysis.customerExclusions?.length) {
    parts.push('**未入选原因**');
    parts.push(
      ...analysis.customerExclusions.map(
        (item) => `**${literal(item.model)}：**${literal(item.reason)}。`,
      ),
    );
  }
  parts.push(literal(analysis.recommendation));
  return paragraphs(parts);
}

/** The visible answer body only; file-reference controls are returned separately. */
export function answerText(id: ModuleId, original: ConversationTurn): string {
  if (stopped(original)) return original.answer;
  const turn = presentAnswer(original);
  if (id === 'production' || id === 'supplier') return productionTurnText(turn);
  if (id === 'maintenance' || id === 'energy') {
    return paragraphs([
      turn.answer,
      turn.analysis ? legacyAnalysisText(turn.analysis) : '',
      id === 'energy' && turn.analysis
        ? `参考数据：${literal(turn.sourceName)}（历史汇总记录，按当时条件作线性估算）。`
        : '',
    ]);
  }
  const parts = [literal(turn.answer)];
  if (!turn.analysis) {
    const conditions = customerConditions(turn.inputs);
    if (conditions.length)
      parts.push(`已识别的条件：${literal(conditions.join('，'))}。`);
  }
  if (turn.missing?.length)
    parts.push(`待补充：${literal(turn.missing.join('、'))}`);
  if (turn.analysis) parts.push(customerAnalysisText(turn.analysis, turn));
  return paragraphs(parts);
}

export function answerSources(
  id: ModuleId,
  turn: ConversationTurn,
): SourceReference[] | undefined {
  if (stopped(turn)) return undefined;
  if (id === 'customer') return turn.analysis?.sources ?? turn.sources;
  if (id === 'maintenance') return turn.sources;
  return undefined;
}

function brief(value: string, fallback: string): string {
  const clean = businessText(value).replace(/\s+/g, ' ').trim();
  if (!clean || /样例|示例|演示|虚构|@scope:/.test(clean)) return fallback;
  const characters = Array.from(clean);
  return characters.length > 100
    ? characters.slice(0, 100).join('') + '…'
    : clean;
}

/** Public handling summary for a newly generated turn; never reconstruct historical thinking. */
export function processingSummary(
  id: ModuleId,
  turn: ConversationTurn,
): string {
  const input = turn.inputs;
  if (id === 'customer') {
    const conditions = brief(
      customerConditions(input).join('，'),
      '待补充的产品需求',
    );
    return [
      `核对需求条件：${conditions}。`,
      turn.analysis
        ? turn.analysis.title === '产品规格查询'
          ? '整理目录中的型号参数，并保留选型核对说明。'
          : '整理条件匹配、未入选原因及需人工确认的事项。'
        : turn.sources?.some((source) => source.documentId.startsWith('spec-'))
          ? '按规格书核对已明确的参数及测试条件，并关联原文页码。'
          : '整理已知条件和需要继续补充的信息。',
    ].join('\n');
  }
  if (id === 'maintenance') {
    const equipment = brief(
      [input.symptom, input.code, input.standardIds, input.partIds]
        .filter(Boolean)
        .join('，'),
      '本次维修资料问题',
    );
    return [
      `查询相关资料：${equipment}。`,
      turn.sources?.length
        ? '整理匹配的原表内容，并关联记录依据和相关图片。'
        : '核对问题中的名称、编号和查询条件。',
    ].join('\n');
  }
  if (id === 'energy' || id === 'production') {
    return [
      `核对生产日 ${input.dateFrom} 至 ${input.dateTo}，${input.shift}，${scopeLabel(input.process, '全部工序')}。`,
      id === 'energy'
        ? '按班次关联用电与产量；零产量用电单列，计划用电按件数估算。'
        : '分别核对生产、停线及同一时点在制记录，保留原始数量与核查标记。',
    ].join('\n');
  }
  const scope = scopeLabel(input.supplier, '全部供应商');
  return [
    `核对供应商范围：${brief(scope, '当前选择范围')}。`,
    '结合供应商汇总与固定评分、风险规则整理回答，不反推订单或检验数量。',
  ].join('\n');
}
