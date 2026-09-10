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
