import {
  analyze,
  modules,
  validateInputs,
  type ModuleId,
  type Inputs,
  type Dataset,
  type Analysis,
} from './model';
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
};
export const suggestions: Record<
  ModuleId,
  { title: string; question: string }[]
> = {
  customer: [
    {
      title: '推荐合适的产品',
      question: '帮我推荐工业电源用电容，450V、470μF、105℃，寿命至少3000小时。',
    },
    {
      title: '提高寿命要求',
      question: '如果寿命要求提高到5000小时，还有哪些产品可选？',
    },
    {
      title: '查看高温产品',
      question:
        '工业电源需要450V、330μF、125℃、10000小时的电容，有合适的型号吗？',
    },
  ],
  maintenance: [
    {
      title: '卷绕机异常排查',
      question: '卷绕机出现张力波动和断箔，应该从哪里开始排查？',
    },
    {
      title: '含浸机真空不足',
      question: '含浸机真空度不足，请帮我整理排查方案。',
    },
    { title: '老化柜温度偏高', question: '老化柜温度偏高，需要检查哪些部位？' },
  ],
  energy: [
    {
      title: '预测下周用电',
      question: '预计产量增长5%，预测未来7天全部工序的用电量。',
    },
    {
      title: '查看重点工序',
      question: '分析老化工序的能耗，哪些地方需要关注？',
    },
    {
      title: '调整生产计划',
      question: '产量减少10%，未来14天全部工序预计用多少电？',
    },
  ],
  production: [
    {
      title: '查看产线异常',
      question: '帮我检查全部产线的生产表现，找出需要关注的产线。',
    },
    {
      title: '分析第三条产线',
      question: '分析3号产线的产量达成情况和质量问题。',
    },
    {
      title: '提高质量要求',
      question: '把不良率阈值调整到1.5%，重新检查全部产线。',
    },
  ],
  supplier: [
    {
      title: '评估全部供应商',
      question: '评估全部供应商的交付与质量，哪些需要重点关注？',
    },
    {
      title: '查看供应商 C',
      question: '分析供应商C的绩效，给出后续跟进建议。',
    },
    {
      title: '提高质量权重',
      question: '交付权重30%，质量权重60%，重新评估全部供应商。',
    },
  ],
};
export function conditionSummary(id: ModuleId, input: Inputs): string[] {
  if (id === 'customer')
    return [
      input.application,
      input.voltage + ' V',
      input.capacity + ' μF',
      input.temperature + '℃',
      input.life + ' h',
    ];
  if (id === 'maintenance')
    return [input.device, input.symptom, input.priority + '处理'];
  if (id === 'energy')
    return [
      input.process,
      '未来' + input.period + '天',
      '产量变化 ' + input.change + '%',
    ];
  if (id === 'production')
    return [
      input.line,
      '完成率目标 ' + input.completion + '%',
      '不良率阈值 ' + input.defect + '%',
    ];
  return [
    input.supplier,
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
): { answer: string; inputs: Inputs; analysis?: Analysis } {
  const input: Inputs = { ...current, question };
  const q = question.replace(/％/g, '%');
  const m = modules.find((m) => m.id === id)!;
  if (/^(你好|您好|嗨|hello|hi|谢谢|感谢)[！!。\s]*$/i.test(q))
    return {
      inputs: input,
      answer: `您好，我是${m.name}。${m.description}您可以直接描述需求，或选择下方的示例问题。`,
    };
  if (/(能做什么|怎么用|如何使用|什么功能)/.test(q))
    return {
      inputs: input,
      answer: `我可以${m.description}您可以参考“${suggestions[id][0].question}”来提问，也可以展开“分析条件”精确设置参数。当前根据本地资料与规则回答。`,
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
    energy: /用电|电量|能耗|能源|工序|产量|预测|增长|减少/,
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
      answer: `这条问题暂时无法转换为${m.name}的分析条件。请描述具体的${id === 'customer' ? '应用、电压、容量或寿命' : id === 'maintenance' ? '设备和故障现象' : id === 'energy' ? '工序、预测周期或产量变化' : id === 'production' ? '产线、完成率或不良率阈值' : '供应商、目标或评分权重'}；也可展开“分析条件”后按条件分析。`,
    };
  const capture = (key: string, pattern: RegExp) => {
    const hit = q.match(pattern);
    if (hit) input[key] = hit[1];
  };
  const choose = (key: string, column: string) => {
    const names = Array.from(
      new Set(dataset.rows.map((r) => String(r[column]))),
    ).sort((a, b) => b.length - a.length);
    const match = names.find((v) => compact(q).includes(compact(v)));
    if (match) input[key] = match;
    return Boolean(match);
  };
  if (id === 'customer') {
    capture('voltage', /(-?\d+(?:\.\d+)?)\s*(?:V|伏)/i);
    capture('capacity', /(-?\d+(?:\.\d+)?)\s*(?:μF|µF|uF|微法)/i);
    capture('temperature', /(-?\d+(?:\.\d+)?)\s*(?:℃|°C|摄氏度|度)/i);
    capture('life', /(-?\d+(?:\.\d+)?)\s*(?:小时|[hH]\b)/);
    choose('application', '应用');
  } else if (id === 'maintenance') {
    const knownDevice = choose('device', '设备类型');
    const rows = dataset.rows.filter(
      (r) => !knownDevice || r['设备类型'] === input.device,
    );
    const symptom = rows.find((r) =>
      String(r['故障现象'])
        .split(/\s*[/、]\s*/)
        .some((s) => q.includes(s)),
    );
    if (symptom) input.symptom = String(symptom['故障现象']);
    else if (knownDevice && rows.length)
      input.symptom = String(rows[0]['故障现象']);
    input.device =
      (
        {
          卷绕机: '卷绕机 W-03',
          含浸机: '含浸机 I-02',
          老化柜: '老化柜 A-06',
        } as Record<string, string>
      )[input.device] ?? input.device;
    if (/紧急/.test(q)) input.priority = '紧急';
    if (/优先/.test(q)) input.priority = '优先';
  } else if (id === 'energy') {
    capture('period', /(\d+)\s*天/);
    if (/下周|未来一周/.test(q)) input.period = '7';
    capture(
      'change',
      /(?:增长|增加|提高|变化|减少|下降|降低)\s*(?:到|为)?\s*([+-]?\d+(?:\.\d+)?)\s*%/,
    );
    if (/(?:减少|下降|降低)\s*(?:到|为)?\s*\d+(?:\.\d+)?\s*%/.test(q))
      input.change = String(-Math.abs(Number(input.change)));
    choose('process', '工序');
    if (/全部工序|所有工序/.test(q)) input.process = '全部工序';
  } else if (id === 'production') {
    choose('line', '产线');
    if (/全部产线|所有产线/.test(q)) input.line = '全部产线';
    capture(
      'completion',
      /完成率(?:目标)?[^\d+-]{0,8}?([+-]?\d+(?:\.\d+)?)\s*%/,
    );
    capture('defect', /不良率(?:阈值)?[^\d+-]{0,8}?([+-]?\d+(?:\.\d+)?)\s*%/);
  } else {
    choose('supplier', '供应商');
    if (/全部供应商|所有供应商/.test(q)) input.supplier = '全部供应商';
    capture(
      'deliveryTarget',
      /交付(?:及时率)?目标[^\d+-]{0,5}?([+-]?\d+(?:\.\d+)?)\s*%/,
    );
    capture(
      'qualityTarget',
      /质量(?:合格率)?目标[^\d+-]{0,5}?([+-]?\d+(?:\.\d+)?)\s*%/,
    );
    capture('deliveryWeight', /交付权重[^\d+-]{0,5}?([+-]?\d+(?:\.\d+)?)\s*%/);
    capture('qualityWeight', /质量权重[^\d+-]{0,5}?([+-]?\d+(?:\.\d+)?)\s*%/);
  }
  const error = validateInputs(id, input);
  if (error)
    return {
      inputs: input,
      answer: `还需要调整一个条件：${error}修改问题中的数值，或在“分析条件”里调整后再试。`,
    };
  const analysis = analyze(id, input, dataset);
  return {
    inputs: input,
    analysis,
    answer: `我已根据「${dataset.name}」完成本次分析。下方列出了采用的条件；未提及的参数沿用当前设置，您可以继续提问调整。`,
  };
}
