import type { Analysis } from './model';

// Keep old content readable without pretending old records have file citations.
export function legacyAnalysisText(analysis: Analysis) {
  return [
    analysis.summary,
    analysis.metrics
      .map((item) => `${item.label}：${item.value}。${item.detail}`)
      .join('\n\n'),
    analysis.steps
      .map((item, index) => `${index + 1}. ${item.title}：${item.body}`)
      .join('\n'),
    analysis.rows
      .map((row) =>
        row
          .map((value, index) => `${analysis.columns[index]}：${value}`)
          .join('；'),
      )
      .join('\n\n'),
    analysis.recommendation,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function productionTurnText(turn: {
  answer: string;
  analysis?: Analysis;
  sourceName: string;
}) {
  if (!turn.analysis) return turn.answer;
  const introductoryText =
    turn.answer.startsWith('我已根据「') &&
    turn.answer.includes('下方列出了采用的条件')
      ? ''
      : turn.answer;
  const basis = turn.analysis.basis.filter((text) => !/^来源[：:]/.test(text));
  const source = turn.sourceName.replace(/[\\`*_{}\[\]()#+.!<>|]/g, '\\$&');
  return [
    introductoryText,
    legacyAnalysisText(turn.analysis),
    basis.length ? `计算依据：${basis.join('；')}` : '',
    `参考数据：${source}（历史汇总记录，保留当时的分析结果）。`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
