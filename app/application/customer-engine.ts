import type { Analysis, Inputs } from './model';
import type { SourceReference, SpecificationProduct } from './customer-types';
import {
  customerExamples,
  specificationProducts as products,
  uniqueSources,
} from './customer-data';

export const customerDefaults: Inputs = {
  customer: '',
  application: '',
  voltage: '',
  capacity: '',
  temperature: '',
  life: '',
  lifeType: '',
  diameter: '',
  height: '',
  leadDays: '',
  replacement: '',
  mounting: '',
  frequency: '',
  ripple: '',
  rippleApplied: '',
  focusModels: '',
  priority: '综合匹配',
  notes: '',
  customerVersion: '3',
  needsConfirmation: '',
};
export type CustomerReply = {
  answer: string;
  inputs: Inputs;
  analysis?: Analysis;
  sources: SourceReference[];
  missing?: string[];
};
export function normalizeCustomerInputs(current: Inputs): Inputs {
  return {
    ...customerDefaults,
    ...current,
    customerVersion: '3',
    needsConfirmation:
      current.customerVersion === '3'
        ? (current.needsConfirmation ?? '')
        : ['voltage', 'capacity', 'temperature', 'life'].some((k) =>
              current[k]?.trim(),
            )
          ? '1'
          : '',
  };
}
const mountName = (mount: string) =>
  ({ THT: 'THT 插件式', SMD: 'SMD 贴片式', 'Snap-In': 'Snap-In 牛角式' })[
    mount
  ] ?? mount;
export function customerConditions(input: Inputs) {
  return [
    input.focusModels && `型号：${input.focusModels.split(',').join('、')}`,
    input.application && `应用背景：${input.application}`,
    input.voltage && `额定电压 ≥ ${input.voltage} V`,
    input.capacity && `标称容量 ${input.capacity} μF`,
    input.temperature && `温度 ${input.temperature}℃`,
    input.mounting && mountName(input.mounting),
    input.life &&
      `${input.lifeType || '寿命（测试类型待确认）'} ≥ ${input.life} h`,
    input.rippleApplied && '寿命测试施加额定纹波',
    input.frequency &&
      `纹波频率 ${Number(input.frequency) >= 1000 ? Number(input.frequency) / 1000 + ' kHz' : input.frequency + ' Hz'}`,
    input.ripple && `允许纹波电流 ≥ ${input.ripple} A`,
    input.diameter && `本体最大直径 ≤ ${input.diameter} mm`,
    input.height && `本体最大长度 ≤ ${input.height} mm（不含引脚）`,
    input.leadDays && `交期要求 ≤ ${input.leadDays} 天（资料未提供）`,
    input.replacement && `需替代：${input.replacement}`,
  ].filter(Boolean);
}
function parseQuestion(q: string, current: Inputs): Inputs {
  const mentioned = products.filter((p) => q.toUpperCase().includes(p.model));
  const fresh =
    /换个需求|重新开始|新的需求/.test(q) ||
    customerExamples.some((c) => c.question === q);
  const changedModels =
    mentioned.length > 0 &&
    mentioned.map((p) => p.model).join(',') !== current.focusModels;
  const input: Inputs = {
    ...(fresh || changedModels
      ? customerDefaults
      : normalizeCustomerInputs(current)),
    question: q,
  };
  if (mentioned.length)
    input.focusModels = mentioned.map((p) => p.model).join(',');
  // Remove identifiers before extracting numbers: their codes are not query values.
  const text = mentioned.reduce(
    (s, p) => s.replaceAll(p.model, ''),
    q.toUpperCase(),
  );
  const capture = (key: string, pattern: RegExp) => {
    const hit = text.match(pattern);
    if (hit) input[key] = hit[1];
  };
  capture('voltage', /(-?\d+(?:\.\d+)?)\s*(?:V\b|伏)/i);
  capture('capacity', /(-?\d+(?:\.\d+)?)\s*(?:[μµu]F\b|微法)/i);
  capture('temperature', /(-?\d+(?:\.\d+)?)\s*(?:℃|°C|摄氏度)/i);
  capture('life', /(-?\d+(?:\.\d+)?)\s*(?:小时|H\b)/i);
  capture('ripple', /(-?\d+(?:\.\d+)?)\s*(?:A\b|安培)/i);
  const freq = text.match(/(\d+(?:\.\d+)?)\s*(K?HZ)\b/);
  if (freq)
    input.frequency = String(Number(freq[1]) * (freq[2] === 'KHZ' ? 1000 : 1));
  const limit = '(?:[^。；，,0-9]{0,20})?(-?\\d+(?:\\.\\d+)?)\\s*(?:MM|毫米)';
  capture('diameter', new RegExp('(?:直径|外径)' + limit));
  capture('height', new RegExp('(?:本体长度|长度|高度)' + limit));
  if (/THT|插件|焊孔/.test(text)) input.mounting = 'THT';
  if (/SMD|贴片/.test(text)) input.mounting = 'SMD';
  if (/SNAP[ -]?IN|牛角/.test(text)) input.mounting = 'Snap-In';
  if (/USEFUL\s*LIFE/.test(text)) input.lifeType = 'Useful Life';
  else if (/ENDURANCE|耐久/.test(text)) input.lifeType = 'Endurance';
  else if (/寿命/.test(q) && /改成|按|要求/.test(q)) input.lifeType = '';
  if (/额定纹波|VR\s*\+?\s*IR|施加.*纹波/.test(text)) input.rippleApplied = '1';
  if (/不限尺寸|取消尺寸/.test(q)) {
    input.diameter = '';
    input.height = '';
  }
  if (/不限温度|取消温度/.test(q)) input.temperature = '';
  if (/不限安装|取消安装/.test(q)) input.mounting = '';
  if (/不限寿命|取消寿命/.test(q)) {
    input.life = '';
    input.lifeType = '';
    input.rippleApplied = '';
  }
  if (/不限纹波|取消纹波/.test(q)) {
    input.ripple = '';
    input.frequency = '';
  }
  if (/按当前分析条件|按这些条件|确认这些条件|就按这些/.test(q))
    input.needsConfirmation = '';
  return input;
}
const pageSource = (p: SpecificationProduct, page = 1): SourceReference => ({
  documentId: p.source.documentId,
  sectionId: `${p.source.documentId}-page-${page}`,
  page,
});
const lifetime = (p: SpecificationProduct, input: Inputs) =>
  input.lifeType === 'Useful Life'
    ? p.usefulLife
    : input.lifeType === 'Endurance'
      ? p.endurance
      : null;
function conflicts(p: SpecificationProduct, input: Inputs): string[] {
  const failures: string[] = [];
  if (input.capacity && p.capacitanceUf !== Number(input.capacity))
    failures.push(`容量为 ${p.capacitanceUf} μF`);
  if (input.voltage && p.ratedVoltageV < Number(input.voltage))
    failures.push(`额定电压只有 ${p.ratedVoltageV} V`);
  if (
    input.temperature &&
    (Number(input.temperature) < p.temperatureMinC ||
      Number(input.temperature) > p.temperatureMaxC)
  )
    failures.push(`温区为 ${p.temperatureMinC}～${p.temperatureMaxC}℃`);
  if (input.mounting && p.mountingType !== input.mounting)
    failures.push(`安装方式为 ${mountName(p.mountingType)}`);
  if (
    input.diameter &&
    (p.diameterMaxMm === null || p.diameterMaxMm > Number(input.diameter))
  )
    failures.push(`本体最大直径为 ${p.diameterMaxMm ?? '未给出'} mm`);
  if (
    input.height &&
    (p.heightMaxMm === null || p.heightMaxMm > Number(input.height))
  )
    failures.push(`本体最大长度为 ${p.heightMaxMm ?? '未给出'} mm`);
  if (input.life) {
    const test = lifetime(p, input);
    if (!test)
      failures.push(`未取得 ${input.lifeType || '指定寿命测试'} 的规格值`);
    else {
      if (test.hours < Number(input.life))
        failures.push(`${input.lifeType} 为 ${test.hours} h`);
      if (!input.temperature || test.temperatureC !== Number(input.temperature))
        failures.push(
          `${input.lifeType} 测试温度为 ${test.temperatureC}℃，与所需测试条件未对齐`,
        );
      if (input.rippleApplied && !test.rippleApplied)
        failures.push('该寿命试验未注明施加额定纹波');
    }
  }
  if (input.ripple) {
    const value = p.ripple.find(
      (r) =>
        r.frequencyHz === Number(input.frequency) &&
        r.temperatureC === Number(input.temperature),
    );
    if (!value) failures.push('未取得指定频率及温度下的纹波电流值');
    else if (value.currentA < Number(input.ripple))
      failures.push(`该条件下纹波电流为 ${value.currentA} A`);
  }
  return failures;
}
const poolFor = (input: Inputs) =>
  input.focusModels
    ? products.filter((p) => input.focusModels.split(',').includes(p.model))
    : products;
function description(p: SpecificationProduct, input: Inputs) {
  const parts = [
    `${p.model}：${p.capacitanceUf} μF，${p.ratedVoltageV} V DC，${mountName(p.mountingType)}，工作温区 ${p.temperatureMinC}～${p.temperatureMaxC}℃。`,
  ];
  if (input.life) {
    const test = lifetime(p, input);
    if (test)
      parts.push(
        `${input.lifeType} 为 ${test.hours} h，${test.temperatureC}℃，施加额定电压${test.rippleApplied ? '和额定纹波' : '（未注明施加额定纹波）'}。`,
      );
  }
  if (input.ripple) {
    const r = p.ripple.find(
      (r) =>
        r.frequencyHz === Number(input.frequency) &&
        r.temperatureC === Number(input.temperature),
    );
    if (r)
      parts.push(
        `在 ${r.frequencyHz >= 1000 ? r.frequencyHz / 1000 + ' kHz' : r.frequencyHz + ' Hz'}、${r.temperatureC}℃下的纹波电流为 ${r.currentA} A。`,
      );
  }
  if (input.diameter || input.height)
    parts.push(
      `名义本体尺寸 D×L 为 ${p.diameterNominalMm}×${p.heightNominalMm} mm；含公差最大直径 ${p.diameterMaxMm ?? '未给出'} mm、最大长度 ${p.heightMaxMm ?? '未给出'} mm。长度不含引脚；SMD 本体直径不代表整个底座和焊盘占地。`,
    );
  return parts.join('');
}
export function buildCustomerAnalysis(input: Inputs): Analysis {
  const selected = poolFor(input).filter(
    (p) => conflicts(p, input).length === 0,
  );
  return {
    title: selected.length
      ? `找到 ${selected.length} 款候选型号`
      : '当前资料无匹配型号',
    summary: '按客户提供的 15 份规格书核对已明确的参数。',
    metrics: [],
    columns: ['型号', '容量', '额定电压', '安装方式', '工作温区'],
    rows: selected.map((p) => [
      p.model,
      `${p.capacitanceUf} μF`,
      `${p.ratedVoltageV} V`,
      mountName(p.mountingType),
      `${p.temperatureMinC}～${p.temperatureMaxC}℃`,
    ]),
    bars: [],
    chartTitle: '',
    steps: [],
    empty: selected.length === 0,
    recommendation: '匹配仅针对已明确的参数条件。',
    basis: ['规格值保留测试类型、频率、温度与尺寸公差口径。'],
    sources: uniqueSources(
      (selected.length ? selected : poolFor(input)).flatMap((p) => [
        pageSource(p),
        ...(input.diameter || input.height ? [pageSource(p, 2)] : []),
      ]),
    ),
  };
}
export function replyToCustomer(
  question: string,
  current: Inputs,
): CustomerReply {
  const q = question.trim();
  const input = parseQuestion(q, current);
  const pool = poolFor(input);
  const refs = (list = pool, dimensions = false) =>
    uniqueSources(
      list.flatMap((p) => [
        pageSource(p),
        ...(dimensions ? [pageSource(p, 2)] : []),
      ]),
    );
  const reply = (
    answer: string,
    sources: SourceReference[] = [],
    missing?: string[],
  ): CustomerReply => ({ answer, inputs: input, sources, missing });
  if (/能做什么|怎么用|如何使用|什么功能/.test(q))
    return reply(
      `可以按容量、电压、温度和安装方式找型号，比较真实型号，并核对纹波、寿命测试及尺寸公差。当前资料覆盖 15 个型号。\n\n${customerExamples.map((c) => c.question).join('\n\n')}`,
    );
  if (/^(你好|您好|嗨|谢谢|感谢|HI|HELLO)[！!。\s]*$/i.test(q))
    return reply('可以直接提出电容器参数要求，或输入完整型号查询规格。');
  if (/价格|报价|多少钱|库存|有货|交期|交货|到货/.test(q) || input.leadDays)
    return reply(
      '这 15 份规格书没有报价、库存或交期记录，无法据此确认供货安排。请向销售补充查询；此前已识别的技术条件保留。',
    );
  if (/ESR|阻抗|认证|AEC|焊盘|降额|实际.*寿命|使用.*年/i.test(q))
    return reply(
      '这项问题需要进一步核对原文和具体工况，当前参数查询尚不能自动判断。请明确型号及所需测试条件，再查看对应规格书；不能用其他参数匹配代替这一项结论。',
      input.focusModels ? refs() : [],
    );
  const unknown = q
    .toUpperCase()
    .match(/\b(?=[A-Z0-9-]{6,}\b)(?=[A-Z0-9-]*\d)[A-Z][A-Z0-9-]*\b/g)
    ?.filter((m) => !products.some((p) => p.model === m));
  if (unknown?.length)
    return reply(
      `当前 15 份规格书中未找到 ${unknown.join('、')}，请核对完整型号或补充其规格书。`,
    );
  if (input.needsConfirmation)
    return reply(
      '旧对话的参数和备注已保留。请核对分析条件后点击“按这些条件分析”，或输入“新的需求”重新描述；确认后再按当前规格书查询。',
      [],
      ['确认历史条件'],
    );
  const invalid = [
    'voltage',
    'capacity',
    'temperature',
    'life',
    'diameter',
    'height',
    'frequency',
    'ripple',
  ].find(
    (k) =>
      input[k] &&
      (!Number.isFinite(Number(input[k])) ||
        Math.abs(Number(input[k])) > 1e6 ||
        (k !== 'temperature' && Number(input[k]) <= 0)),
  );
  if (invalid)
    return reply(
      '有一项参数无效，请检查数值。容量、电压、时间、尺寸、频率和电流必须大于 0。',
    );
  if (/资料来源|原文件|来源是什么|数据从哪/.test(q))
    return reply(
      '当前问答依据客户提供的 15 份产品规格书。文末引用可以打开 PDF 原页，核对参数表和尺寸图。',
      refs(),
    );
  if (
    pool.length > 1 &&
    input.focusModels &&
    /比较|对比|替代|替换|不能改板|焊孔/.test(q)
  ) {
    return reply(
      `${pool.map((p) => description(p, customerDefaults)).join('\n\n')}\n\n${new Set(pool.map((p) => p.mountingType)).size > 1 ? '安装方式不同，不能仅凭容量相同、额定电压更高就认定可在原 PCB 上直接替换。' : '相同的基础参数不足以确认可以直接替代。'}${input.mounting === 'THT' ? '原板要求 THT 插件焊孔且不能改板时，SMD 型号不满足安装条件。' : ''}还需核对实际电压、纹波条件、本体尺寸和引脚布局。`,
      refs(pool, true),
    );
  }
  if (/替代|替换/.test(q) || input.replacement)
    return reply(
      '请提供原型号与候选型号的完整料号，并说明安装方式及不可调整的条件。需要逐项核对参数和 PCB 结构后判断。',
      input.focusModels ? refs(pool, true) : [],
      ['原型号与候选型号', '安装约束'],
    );
  if (
    (input.ripple || /纹波电流/.test(q)) &&
    (!input.frequency || !input.temperature)
  ) {
    const missing = [
      !input.frequency && '纹波频率',
      !input.temperature && '温度',
    ].filter(Boolean) as string[];
    return reply(
      `请补充${missing.join('和')}。规格书在不同频率及温度下给出的纹波电流不同，需要在同一条件下比较。`,
      input.focusModels ? refs() : [],
      missing,
    );
  }
  if (input.life && (!input.lifeType || !input.temperature)) {
    const missing = [
      !input.lifeType && '寿命测试类型',
      !input.temperature && '寿命测试温度',
    ].filter(Boolean) as string[];
    return reply(
      `请确认${!input.lifeType ? '所需的是 Useful Life 还是 Endurance 耐久试验，两项时长及验收标准不同。' : ''}${!input.temperature ? '还需要明确寿命测试温度。' : ''}如果要求实际设备使用寿命，需要具体工况，不能直接用试验小时数判断。`,
      input.focusModels ? refs() : [],
      missing,
    );
  }
  if (
    input.ripple &&
    !pool.some((p) =>
      p.ripple.some(
        (r) =>
          r.frequencyHz === Number(input.frequency) &&
          r.temperatureC === Number(input.temperature),
      ),
    )
  )
    return reply(
      '当前规格书没有给出这一频率和温度组合下可直接比较的纹波电流值，无法确认是否符合。不能套用其他条件的数值。',
      refs(),
    );
  if (
    !input.focusModels &&
    ![
      'capacity',
      'voltage',
      'temperature',
      'mounting',
      'life',
      'diameter',
      'height',
      'ripple',
    ].some((k) => input[k])
  )
    return reply(
      '请给出完整型号，或描述容量、电压、温度、安装方式等具体要求。只查询已明确的参数，未提出的条件不会自动补上。',
    );
  const dimensionQuery = Boolean(input.diameter || input.height);
  const selected = pool
    .filter((p) => conflicts(p, input).length === 0)
    .sort(
      (a, b) =>
        a.ratedVoltageV - b.ratedVoltageV || a.model.localeCompare(b.model),
    );
  const excluded = pool.filter(
    (p) =>
      !selected.includes(p) &&
      (!input.capacity || p.capacitanceUf === Number(input.capacity)) &&
      (!input.voltage || p.ratedVoltageV >= Number(input.voltage)),
  );
  const details = selected.map((p) => description(p, input));
  if (excluded.length)
    details.push(
      `未匹配原因：${excluded.map((p) => `${p.model}：${conflicts(p, input).join('；')}`).join('。')}。`,
    );
  const conclusion = selected.length
    ? `当前资料中有 ${selected.length} 款型号符合已明确的参数条件。`
    : '当前 15 份规格书中没有可确认满足全部条件的型号。';
  return reply(
    `${conclusion}\n\n${details.join('\n\n')}${input.life ? '\n\n寿命小时数对应所列试验条件，不等同于实际设备使用年限。' : ''}${dimensionQuery ? '\n\n尺寸按第 2 页图纸的公差上限核对；完整装配还需确认底座、引脚和安装间隙。' : ''}${input.application ? '\n\n应用场景作为需求背景保留，资料中的基础参数匹配不能单独确认应用适用性。' : ''}`,
    refs(selected.length ? [...selected, ...excluded] : pool, dimensionQuery),
  );
}
