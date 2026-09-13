import type { Analysis, Inputs } from './model';
import type {
  SourceReference,
  CustomerProduct,
  CustomerCandidate,
} from './customer-types';
import {
  customerFixtures,
  customerProducts,
  sourceReference,
  uniqueSources,
} from './customer-data';

export const customerDefaults: Inputs = {
  customer: '',
  application: '',
  voltage: '',
  capacity: '',
  temperature: '',
  life: '',
  diameter: '',
  height: '',
  leadDays: '',
  replacement: '',
  priority: '综合匹配',
  notes: '',
  customerVersion: '2',
  needsConfirmation: '',
};
const required = [
  ['application', '应用领域'],
  ['voltage', '电压'],
  ['capacity', '容量'],
  ['temperature', '工作温度'],
  ['life', '最低寿命'],
] as const;
export function normalizeCustomerInputs(current: Inputs): Inputs {
  return {
    ...customerDefaults,
    ...current,
    customerVersion: '2',
    needsConfirmation:
      current.customerVersion === '2'
        ? (current.needsConfirmation ?? '')
        : required.some(([key]) => current[key]?.trim())
          ? '1'
          : '',
  };
}
const rule = (id: string) => sourceReference('rules', 'rules-' + id);
const faq = (id: string) => sourceReference('faq', 'faq-' + id);
export type CustomerReply = {
  answer: string;
  inputs: Inputs;
  analysis?: Analysis;
  sources: SourceReference[];
  missing?: string[];
};

export function customerConditions(input: Inputs) {
  return [
    input.application,
    input.voltage && `${input.voltage} V`,
    input.capacity && `${input.capacity} μF`,
    input.temperature && `${input.temperature}℃`,
    input.life && `寿命 ≥ ${input.life} h`,
    input.diameter && `直径 ≤ ${input.diameter} mm`,
    input.height && `高度 ≤ ${input.height} mm`,
    input.leadDays && `交期要求 ≤ ${input.leadDays} 天`,
    input.replacement && `替代 ${input.replacement}`,
    input.priority !== '综合匹配' ? input.priority : '',
  ].filter(Boolean);
}

function parseQuestion(q: string, current: Inputs): Inputs {
  const fresh = /换个需求|重新开始选型|新的需求/.test(q);
  const input: Inputs = {
    ...(fresh ? customerDefaults : normalizeCustomerInputs(current)),
    question: q,
  };
  const explicit = new Set<string>();
  const replacementMatch = /替代|替换|代替/.test(q)
    ? q.match(/\b[A-Z][A-Z0-9/-]*\d[A-Z0-9/-]*\b/i)
    : null;
  if (replacementMatch) {
    input.replacement = replacementMatch[0].toUpperCase();
    const mapping = customerFixtures.replacements.find(
      (r) => r.from === input.replacement,
    );
    const product = customerProducts.find((p) => p.model === input.replacement);
    const baseline = mapping?.requirements ?? product;
    if (baseline)
      for (const [key] of required)
        if (!input[key]) input[key] = String(baseline[key]);
  }
  const capture = (key: string, pattern: RegExp) => {
    const hit = q.match(pattern);
    if (hit) {
      input[key] = hit[1];
      explicit.add(key);
    }
  };
  capture('voltage', /(-?\d+(?:\.\d+)?)\s*(?:V\b|伏)/i);
  capture('capacity', /(-?\d+(?:\.\d+)?)\s*(?:[μµu]F\b|微法)/i);
  capture('temperature', /(-?\d+(?:\.\d+)?)\s*(?:℃|°C|摄氏度)/i);
  capture('life', /(-?\d+(?:\.\d+)?)\s*(?:小时|h\b)/i);
  capture(
    'diameter',
    /(?:直径|外径|Φ|φ)\s*(?:不超过|不大于|最多|最大|小于等于|小于|≤|<=|为|:|：)?\s*(-?\d+(?:\.\d+)?)\s*(?:mm|毫米)?/i,
  );
  capture(
    'height',
    /(?:高度|长度)\s*(?:不超过|不大于|最多|最大|小于等于|小于|≤|<=|为|:|：)?\s*(-?\d+(?:\.\d+)?)\s*(?:mm|毫米)?/i,
  );
  capture(
    'leadDays',
    /(?:交期|交货|到货)\s*(?:不超过|不大于|最多|以内|≤|<=|为|:|：)?\s*(-?\d+)\s*天/i,
  );
  const dimensions = q.match(
    /(?:尺寸|外形)\s*(?:不超过|≤|<=)?\s*(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*(?:mm|毫米)/,
  );
  if (dimensions)
    [input.diameter, input.height] = [dimensions[1], dimensions[2]];
  if (/汽车电子|车载/.test(q)) input.application = '汽车电子';
  else if (/消费电子/.test(q)) input.application = '消费电子';
  else if (/工业电源|工控|电源模块/.test(q)) input.application = '工业电源';
  if (/汽车电子|车载|消费电子|工业电源|工控|电源模块/.test(q))
    explicit.add('application');
  capture(
    'customer',
    /(?:客户名称|客户是|客户为)\s*[:：]?\s*([^，,。；;\s]{2,30})/,
  );
  if (/小型化优先|尺寸优先|尺寸再小|尽量小|更小/.test(q))
    input.priority = '小型化优先';
  if (/交期优先|尽快交货|最快到货|交期从短到长|最短交期/.test(q))
    input.priority = '交期优先';
  if (/寿命优先|尽量长寿命/.test(q)) input.priority = '寿命优先';
  if (/综合匹配|默认排序/.test(q)) input.priority = '综合匹配';
  if (/不限尺寸|取消尺寸|不限制尺寸/.test(q)) {
    input.diameter = '';
    input.height = '';
  }
  if (/不限交期|取消交期/.test(q)) input.leadDays = '';
  if (/不再替代|取消替代/.test(q)) input.replacement = '';
  if (
    /按当前分析条件|按这些条件|确认这些条件|就按这些/.test(q) ||
    required.every(([key]) => explicit.has(key))
  )
    input.needsConfirmation = '';
  return input;
}

function sortProducts(products: CustomerProduct[], input: Inputs) {
  return [...products].sort((a, b) => {
    if (input.priority === '小型化优先')
      return (
        a.diameter * a.diameter * a.height -
          b.diameter * b.diameter * b.height || b.life - a.life
      );
    if (input.priority === '交期优先')
      return a.leadDays - b.leadDays || b.life - a.life;
    return (
      b.life - a.life ||
      a.leadDays - b.leadDays ||
      a.model.localeCompare(b.model)
    );
  });
}

export function buildCustomerAnalysis(
  input: Inputs,
  lookup?: CustomerProduct[],
): Analysis {
  const mapping = customerFixtures.replacements.find(
    (r) => r.from === input.replacement,
  );
  const candidates = sortProducts(
    lookup ??
      customerProducts.filter(
        (p) =>
          p.application === input.application &&
          p.voltage >= Number(input.voltage) &&
          p.capacity === Number(input.capacity) &&
          p.temperature >= Number(input.temperature) &&
          p.life >= Number(input.life) &&
          (!input.diameter || p.diameter <= Number(input.diameter)) &&
          (!input.height || p.height <= Number(input.height)) &&
          (!input.leadDays || p.leadDays <= Number(input.leadDays)) &&
          (!input.replacement ||
            (mapping
              ? mapping.to.includes(p.model)
              : p.model !== input.replacement)),
      ),
    input,
  ).slice(0, 3);
  const sourceList = uniqueSources([
    ...candidates.map((p) => p.source),
    rule('core-match'),
    rule('manual-check'),
    ...(input.diameter ||
    input.height ||
    input.leadDays ||
    input.priority !== '综合匹配'
      ? [rule('optional-constraints')]
      : []),
    ...(mapping ? [mapping.source] : []),
    ...(!candidates.length
      ? [...customerProducts.map((p) => p.source), rule('no-result')]
      : []),
  ]);
  const history = customerFixtures.cases.find(
    (c) =>
      c.question.replace(/\s/g, '') ===
      (input.question ?? '').replace(/^换个需求[：:]?/, '').replace(/\s/g, ''),
  );
  if (history) sourceList.push(history.source);
  const reasons = (p: CustomerProduct): string[] =>
    lookup
      ? ['此处展示目录原始规格，尚未按完整客户需求完成选型。']
      : [
          `用于${p.application}，电压、容量、温度与最低寿命均满足本次条件。`,
          `额定寿命 ${p.life.toLocaleString('zh-CN')} h，外形 Φ${p.diameter} × ${p.height} mm。`,
          ...(input.priority === '小型化优先'
            ? ['在满足硬性条件的候选中，按较小体积优先排列。']
            : []),
          ...(input.leadDays || input.priority === '交期优先'
            ? [`目录参考交期 ${p.leadDays} 天，供货时间需由销售确认。`]
            : []),
          ...(input.replacement
            ? [
                `作为 ${input.replacement} 的替代候选，仍需核对安装方式与完整规格。`,
              ]
            : []),
        ];
  const resultCandidates: CustomerCandidate[] = candidates.map((p) => ({
    product: p,
    reasons: reasons(p),
    sources: [p.source, ...(mapping ? [mapping.source] : [])],
  }));
  const customerExclusions = candidates.length
    ? []
    : customerProducts
        .map((p) => {
          const conflicts = [
            p.application !== input.application ? `应用为${p.application}` : '',
            p.voltage < Number(input.voltage)
              ? `电压 ${p.voltage} V 低于要求`
              : '',
            p.capacity !== Number(input.capacity)
              ? `容量 ${p.capacity} μF 不符`
              : '',
            p.temperature < Number(input.temperature)
              ? `温度 ${p.temperature}℃ 低于要求`
              : '',
            p.life < Number(input.life) ? `寿命 ${p.life} h 低于要求` : '',
            input.diameter && p.diameter > Number(input.diameter)
              ? `直径 ${p.diameter} mm 超限`
              : '',
            input.height && p.height > Number(input.height)
              ? `高度 ${p.height} mm 超限`
              : '',
            input.leadDays && p.leadDays > Number(input.leadDays)
              ? `参考交期 ${p.leadDays} 天超限`
              : '',
            mapping && !mapping.to.includes(p.model)
              ? '未列入该型号的替代说明'
              : '',
            input.replacement === p.model ? '与原型号相同' : '',
          ].filter(Boolean);
          return {
            model: p.model,
            reason: conflicts.join('；'),
            source: p.source,
            count: conflicts.length,
          };
        })
        .sort((a, b) => a.count - b.count)
        .slice(0, 3)
        .map(({ model, reason, source }) => ({ model, reason, source }));
  return {
    title: lookup
      ? '产品规格查询'
      : candidates.length
        ? `推荐 ${candidates.length} 款候选产品`
        : '暂无满足全部条件的候选产品',
    summary: lookup
      ? '以下参数来自当前产品目录。'
      : candidates.length
        ? `已按${input.application}需求筛选。${input.priority === '综合匹配' ? '满足硬性条件后，优先比较寿命，再比较参考交期。' : `当前排序：${input.priority}。`}`
        : '没有放宽电压、容量或其他约束来凑出推荐。可以补充资料，或明确调整某项条件后再试。',
    metrics: [],
    columns: [
      '型号',
      '电压',
      '容量',
      '温度',
      '寿命',
      '尺寸（直径×高度）',
      '参考交期',
    ],
    rows: candidates.map((p) => [
      p.model,
      `${p.voltage} V`,
      `${p.capacity} μF`,
      `${p.temperature}℃`,
      `${p.life} h`,
      `${p.diameter} × ${p.height} mm`,
      `${p.leadDays} 天`,
    ]),
    bars: [],
    chartTitle: '',
    steps: [],
    empty: !candidates.length,
    recommendation:
      '选型前请人工核对纹波电流的测试条件、安装方式与引脚、有效规格书和认证要求。供货安排需另行确认。',
    basis: [
      '本次按当前产品目录、选型规则及相关资料核对。',
      '电压、温度、寿命采用最低要求，容量与应用须匹配；已填写的尺寸与交期作为额外约束。',
      '最多展示 3 款候选，最终适用性需结合项目要求确认。',
    ],
    sources: uniqueSources(sourceList),
    customerCandidates: resultCandidates,
    customerExclusions,
  };
}

export function replyToCustomer(
  question: string,
  current: Inputs,
): CustomerReply {
  const q = question.replace(/％/g, '%').trim();
  const input = parseQuestion(q, current);
  const respond = (
    answer: string,
    sources: SourceReference[],
    missing?: string[],
  ): CustomerReply => ({ answer, inputs: input, sources, missing });
  if (
    /^(你好|您好|嗨|hello|hi|谢谢|感谢)[！!。\s]*$/i.test(q) ||
    /能做什么|怎么用|如何使用|什么功能/.test(q)
  )
    return respond(
      '我可以根据应用场景和关键参数，帮你筛选电容器、比较候选型号或查找替代方案。可以直接描述需求；回答末尾可查看对应的原始资料。',
      [faq('how-to-use')],
    );
  if (/价格|报价|多少钱|库存|有货|多少钱/.test(q))
    return respond(
      '当前资料未提供有效报价和库存信息，不能据此承诺价格或到货时间。目录参考交期仅用于候选比较，报价与供货安排需由销售确认。',
      [faq('price-stock'), rule('data-scope')],
    );
  if (/资料来源|原文件|来源是什么|引用是什么|数据哪里|数据从哪/.test(q))
    return respond(
      '当前依据产品目录、选型规则、替代说明、需求案例和销售 FAQ 回答。文末引用标明文件名和页码，点击可核对原文。',
      [faq('source-meaning'), rule('data-scope')],
    );
  if (
    /纹波|ESR|AEC|认证|频率/i.test(q) &&
    !/不要求认证|无需认证|取消认证要求/.test(q)
  )
    return respond(
      '当前资料不足以确认这些附加要求。请补充纹波频率与温度条件、完整规格书或认证文件；不能把基础参数匹配当作已经通过这些要求。',
      [rule('manual-check'), rule('data-scope')],
    );
  const model = q.match(/\bFB-[A-Z0-9-]+\b/i)?.[0].toUpperCase();
  if (
    model &&
    !/替代|推荐|符合|满足|换成|代替/.test(q) &&
    /参数|规格|介绍|查看|查询|是什么/.test(q)
  ) {
    const product = customerProducts.find((p) => p.model === model);
    if (!product)
      return respond(`当前产品目录中未找到 ${model}，请核对型号。`, [
        rule('no-result'),
        faq('missing-data'),
      ]);
    const analysis = buildCustomerAnalysis(input, [product]);
    return {
      answer: `已找到 ${model} 的原始规格。`,
      inputs: input,
      analysis,
      sources: analysis.sources!,
    };
  }
  if (
    input.replacement &&
    !customerFixtures.replacements.some((r) => r.from === input.replacement) &&
    !customerProducts.some((p) => p.model === input.replacement)
  )
    return respond(
      `资料中没有 ${input.replacement} 的原型号规格或替代说明。请提供应用、电压、容量、温度和寿命要求；不会把未知型号自动视为可替代。`,
      [faq('missing-data'), rule('manual-check')],
    );
  if (
    /替代|替换|代替/.test(q) &&
    !/不再替代|取消替代/.test(q) &&
    !input.replacement
  )
    return respond(
      '请补充需要替代的原型号，才能核对原始规格与替代说明。当前选型条件会保留。',
      [faq('missing-data'), rule('manual-check')],
      ['原型号'],
    );
  if (
    !/电容|产品|型号|选型|推荐|参数|规格|容量|电压|温度|寿命|工业|消费|汽车|工控|小时|尺寸|直径|高度|交期|替代|V\b|[μµu]F\b|℃|为什么|依据|详细|按当前|按这些条件|确认这些条件|就按这些|重新分析|\d+\s*(?:h|天)/i.test(
      q,
    )
  )
    return respond(
      '我目前帮助处理产品选型需求。请描述应用和关键参数，或从页面中的选型问题开始。',
      [faq('how-to-use')],
    );
  if (input.needsConfirmation)
    return respond(
      '旧对话的客户信息、参数和备注已保留。请在“分析条件”中核对，再点击“按这些条件分析”；也可以重新描述完整需求，确认后再推荐。',
      [rule('required-fields'), faq('missing-data')],
      ['确认历史条件'],
    );
  const missing = required
    .filter(([key]) => !input[key]?.trim())
    .map(([, label]) => label);
  if (missing.length)
    return respond(
      `还需要补充${missing.join('、')}，才能给出有依据的候选型号。已识别的条件会保留，你可以直接补充，也可以展开“分析条件”填写。`,
      [rule('required-fields'), faq('missing-data')],
      missing,
    );
  const invalid = [
    'voltage',
    'capacity',
    'temperature',
    'life',
    'diameter',
    'height',
    'leadDays',
  ].find(
    (k) =>
      input[k] &&
      (!Number.isFinite(Number(input[k])) ||
        Number(input[k]) > 1e6 ||
        (k === 'temperature'
          ? Number(input[k]) < -55 || Number(input[k]) > 200
          : Number(input[k]) <= 0)),
  );
  if (invalid)
    return respond(
      '有一项参数无效，请检查电压、容量、温度、寿命或尺寸数值后再试。',
      [rule('core-match')],
    );
  const analysis = buildCustomerAnalysis(input);
  return {
    answer: analysis.empty
      ? '已核对当前产品目录，暂时没有满足全部条件的型号。'
      : `根据本次需求，整理了 ${analysis.rows.length} 款候选，并列出了各自的推荐理由和原始资料。`,
    inputs: input,
    analysis,
    sources: analysis.sources!,
  };
}
