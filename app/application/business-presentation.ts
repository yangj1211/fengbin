import replacements from './legacy-business-copy.json';
import type { ConversationTurn } from './conversation';

/** Present earlier assistant copy consistently without rewriting saved records. */
export function businessText(text: string): string {
  // Keep Markdown URL targets intact so old source links remain valid.
  return text
    .split(/(\]\([^)]*\))/g)
    .map((part) => {
      if (part.startsWith('](')) return part;
      let value = part;
      for (const [before, after] of replacements)
        value = value.split(before).join(after);
      return value
        .replace(
          /样例交期 (\d+) 天，仅用于演示交期比较。/g,
          '目录参考交期 $1 天，供货时间需由销售确认。',
        )
        .replace(/示例交期/g, '参考交期')
        .replace(/合成示例；/g, '')
        .replace(/示例中各工序/g, '各工序')
        .replace(/（(?:示例数据|本地导入数据)，/g, '（')
        .replace(/当前固定的示例规则/g, '当前固定评估规则')
        .replace(/示例值不代表行业标准。/g, '规则适用于当前看板。');
    })
    .join('');
}

function presentValue<T>(value: T): T {
  if (typeof value === 'string') return businessText(value) as T;
  if (Array.isArray(value)) return value.map(presentValue) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, presentValue(item)]),
    ) as T;
  return value;
}

export function presentAnswer(turn: ConversationTurn): ConversationTurn {
  return {
    ...turn,
    answer: businessText(turn.answer),
    sourceName: businessText(turn.sourceName),
    analysis: turn.analysis ? presentValue(turn.analysis) : undefined,
  };
}
