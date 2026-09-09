import type { ConversationTurn, ConversationSession } from './conversation';
export const modules = [
  {
    id: 'customer',
    scene: '33',
    name: '客户与产品推荐',
    category: '销售服务',
    description: '梳理客户需求，匹配合适的电容器产品。',
    action: '创建选型分析',
    inputTitle: '客户需求',
    resultTitle: '候选产品',
    dataset: 'products',
  },
  {
    id: 'maintenance',
    scene: '29',
    name: '设备维修助手',
    category: '设备管理',
    description: '关联设备与故障知识，形成可执行的排查方案。',
    action: '生成维修方案',
    inputTitle: '故障信息',
    resultTitle: '维修方案',
    dataset: 'maintenance',
  },
  {
    id: 'energy',
    scene: '16',
    name: '能源预测与优化',
    category: '能源管理',
    description: '结合用能记录与产量计划，评估能源变化。',
    action: '生成能耗预测',
    inputTitle: '预测条件',
    resultTitle: '能耗预测',
    dataset: 'energy',
  },
  {
    id: 'production',
    scene: '10',
    name: '生产洞察与预警',
    category: '生产管理',
    description: '查看产线表现，追踪产量与质量偏差。',
    action: '分析生产表现',
    inputTitle: '分析范围',
    resultTitle: '生产分析',
    dataset: 'production',
  },
  {
    id: 'supplier',
    scene: '37',
    name: '供应商绩效评估',
    category: '采购管理',
    description: '综合交付与来料质量，识别供应商风险。',
    action: '开始绩效评估',
    inputTitle: '评估条件',
    resultTitle: '绩效评估',
    dataset: 'suppliers',
  },
] as const;
export type ModuleId = (typeof modules)[number]['id'];
export type Row = Record<string, string | number>;
export type Dataset = {
  id: string;
  name: string;
  module: ModuleId;
  columns: string[];
  rows: Row[];
  origin: 'sample' | 'local';
  fileName?: string;
  updatedAt?: string;
};
function data(
  id: string,
  name: string,
  module: ModuleId,
  columns: string[],
  values: (string | number)[][],
): Dataset {
  return {
    id,
    name,
    module,
    columns,
    rows: values.map((v) =>
      Object.fromEntries(columns.map((c, i) => [c, v[i]])),
    ),
    origin: 'sample',
  };
}
export const initialDatasets: Dataset[] = [
  data(
    'products',
    '电容器产品目录',
    'customer',
    ['产品型号', '额定电压(V)', '容量(μF)', '温度(℃)', '寿命(h)', '应用'],
    [
      ['FB-LH470', 450, 470, 105, 5000, '工业电源'],
      ['FB-LS470', 450, 470, 105, 3000, '工业电源'],
      ['FB-HV470', 400, 470, 105, 5000, '工业电源'],
      ['FB-LV470', 50, 470, 105, 2000, '消费电子'],
      ['FB-HT330', 450, 330, 125, 10000, '工业电源'],
    ],
  ),
  data(
    'maintenance',
    '设备故障知识库',
    'maintenance',
    ['案例编号', '设备类型', '故障现象', '排查方向', '处理建议'],
    [
      [
        'M-014',
        '卷绕机',
        '张力波动 / 断箔',
        '张力传感器信号偏移',
        '按维修规程检查传感器与校准记录',
      ],
      [
        'M-008',
        '卷绕机',
        '张力波动 / 断箔',
        '导向辊与走箔路径',
        '检查导向辊转动、路径与异物',
      ],
      [
        'M-026',
        '含浸机',
        '真空度不足',
        '密封与真空系统',
        '核对目标真空度并检查密封状态',
      ],
      [
        'M-031',
        '老化柜',
        '温度偏高',
        '通风与温度检测',
        '核查散热风道及测温记录',
      ],
      [
        'M-021',
        '卷绕机',
        '张力波动 / 断箔',
        '材料接头异常',
        '核对材料批次与接头记录',
      ],
    ],
  ),
  data(
    'energy',
    '工序用电与产量',
    'energy',
    ['工序', '用电量(kWh)', '产量(千只)', '基准单耗(kWh/千只)'],
    [
      ['老化', 56700, 4200, 12],
      ['含浸', 37800, 4200, 8.8],
      ['其他', 31500, 4200, 7.5],
    ],
  ),
  data(
    'production',
    '产线生产日报',
    'production',
    [
      '产线',
      '计划产量(万只)',
      '实际产量(万只)',
      '检验数量',
      '不良数量',
      '停机时长(min)',
    ],
    [
      ['1号产线', 10, 9.8, 10000, 120, 18],
      ['2号产线', 10, 9.6, 10000, 150, 25],
      ['3号产线', 10, 8.2, 10000, 280, 76],
      ['4号产线', 10, 9.7, 10000, 110, 21],
    ],
  ),
  data(
    'suppliers',
    '供应商交付与质量',
    'supplier',
    ['供应商', '交付及时率(%)', '来料合格率(%)', '响应评分'],
    [
      ['供应商 A', 98, 99.6, 95],
      ['供应商 B', 94, 98.8, 88],
      ['供应商 C', 82, 95, 72],
    ],
  ),
];
export type Inputs = Record<string, string>;
export const defaultInputs: Record<ModuleId, Inputs> = {
  customer: {
    customer: '新客户',
    application: '工业电源',
    voltage: '450',
    capacity: '470',
    temperature: '105',
    life: '3000',
    notes: '',
  },
  maintenance: {
    device: '卷绕机 W-03',
    symptom: '张力波动 / 断箔',
    priority: '正常',
    notes: '',
  },
  energy: { period: '7', change: '5', process: '全部工序', notes: '' },
  production: { line: '全部产线', completion: '95', defect: '2', notes: '' },
  supplier: {
    supplier: '全部供应商',
    deliveryTarget: '95',
    qualityTarget: '98',
    deliveryWeight: '40',
    qualityWeight: '40',
    notes: '',
  },
};
export type Analysis = {
  title: string;
  summary: string;
  metrics: { label: string; value: string; detail: string }[];
  columns: string[];
  rows: string[][];
  bars: { label: string; value: number; display: string; warning?: boolean }[];
  chartTitle: string;
  steps: { title: string; body: string }[];
  recommendation: string;
  basis: string[];
  empty?: boolean;
};
export type AnalysisRecord = {
  id: string;
  module: ModuleId;
  name: string;
  createdAt: string;
  inputs: Inputs;
  analysis: Analysis;
  sourceName: string;
  sourceOrigin: 'sample' | 'local';
  state: '待跟进' | '已完成';
  note: string;
};
export type WorkspaceState = {
  version: 1;
  records: AnalysisRecord[];
  datasets: Dataset[];
  drafts: Partial<Record<ModuleId, Inputs>>;
  conversations?: Partial<Record<ModuleId, ConversationTurn[]>>;
  sessions?: ConversationSession[];
  activeSessionIds?: Partial<Record<ModuleId, string>>;
  moduleViews?: Partial<Record<ModuleId, 'dashboard' | 'chat'>>;
};
export const STORAGE_KEY = 'fengbin.application.v1';
const n = (row: Row, key: string) => Number(row[key]);
const f = (value: number, d = 1) =>
  Number(value.toFixed(d)).toLocaleString('zh-CN');
const finite = (value: string) =>
  typeof value === 'string' &&
  Number.isFinite(Number(value)) &&
  Math.abs(Number(value)) <= 1e12 &&
  value.trim() !== '';
export function validateInputs(id: ModuleId, input: Inputs): string | null {
  if (
    !input ||
    typeof input !== 'object' ||
    Object.values(input).some((v) => typeof v !== 'string' || v.length > 4000)
  )
    return '输入格式不正确，请重新填写。';
  if (id === 'energy' && !['7', '14', '30'].includes(input.period))
    return '请选择 7、14 或 30 天的预测周期。';
  const numeric: Record<ModuleId, string[]> = {
    customer: ['voltage', 'capacity', 'temperature', 'life'],
    maintenance: [],
    energy: ['change'],
    production: ['completion', 'defect'],
    supplier: [
      'deliveryTarget',
      'qualityTarget',
      'deliveryWeight',
      'qualityWeight',
    ],
  };
  for (const key of numeric[id])
    if (!finite(input[key])) return '请填写有效的数值。';
  if (
    id === 'customer' &&
    (['voltage', 'capacity', 'life'].some((k) => Number(input[k]) <= 0) ||
      Number(input.temperature) < -55 ||
      Number(input.temperature) > 200)
  )
    return '请检查电压、容量、温度与寿命要求。';
  if (
    id === 'energy' &&
    (Number(input.change) < -90 || Number(input.change) > 200)
  )
    return '产量变化范围应在 -90% 至 200% 之间。';
  if (
    id === 'production' &&
    (Number(input.completion) < 1 ||
      Number(input.completion) > 100 ||
      Number(input.defect) < 0 ||
      Number(input.defect) > 100)
  )
    return '完成率目标应为 1–100%，不良率阈值应为 0–100%。';
  if (
    id === 'supplier' &&
    (numeric.supplier.some(
      (k) => Number(input[k]) < 0 || Number(input[k]) > 100,
    ) ||
      Number(input.deliveryWeight) + Number(input.qualityWeight) > 100)
  )
    return '各项应为 0–100%，交付与质量权重之和不能超过 100%。';
  return null;
}
export function analyze(
  id: ModuleId,
  input: Inputs,
  dataset: Dataset,
): Analysis {
  const error = validateInputs(id, input);
  if (error) throw new Error(error);
  const datasetError = validateDataset(dataset);
  if (datasetError) throw new Error(datasetError);
  const emptyRange: Analysis = {
    title: '当前筛选范围没有数据',
    summary: '请重新选择范围，或补充对应数据后再次分析。',
    metrics: [],
    columns: [],
    rows: [],
    bars: [],
    chartTitle: '',
    steps: [],
    recommendation: '检查数据管理中的可用条目。',
    basis: ['当前范围未找到数据，未进行计算。'],
    empty: true,
  };
  const common = {
    basis: [
      `来源：${dataset.name}（${dataset.origin === 'sample' ? '示例数据' : '本地导入'}，${dataset.rows.length} 条）。`,
      '当前结果按可见参数及前端规则计算；AI 服务尚未接入。',
    ],
    steps: [] as Analysis['steps'],
  };
  if (id === 'customer') {
    const matches = dataset.rows
      .filter(
        (r) =>
          n(r, '额定电压(V)') >= Number(input.voltage) &&
          n(r, '容量(μF)') === Number(input.capacity) &&
          n(r, '温度(℃)') >= Number(input.temperature) &&
          n(r, '寿命(h)') >= Number(input.life) &&
          String(r['应用']) === input.application,
      )
      .sort((a, b) => n(b, '寿命(h)') - n(a, '寿命(h)'));
    return {
      ...common,
      title: matches.length
        ? `找到 ${matches.length} 款满足条件的候选产品`
        : '当前目录中没有满足全部条件的产品',
      summary: matches.length
        ? `${input.customer || '客户'}的${input.application}需求已完成筛选。优先比较 ${matches[0]['产品型号']}，最终选型仍需确认尺寸、纹波电流和规格书。`
        : '请检查输入规格，或调整条件后重新筛选。系统不会推荐不符合硬性参数的型号。',
      empty: !matches.length,
      metrics: [
        {
          label: '电压要求',
          value: input.voltage + ' V',
          detail: '候选额定电压不低于此值',
        },
        {
          label: '容量要求',
          value: input.capacity + ' μF',
          detail: '按相同标称容量匹配',
        },
        {
          label: '最低寿命',
          value: f(Number(input.life), 0) + ' h',
          detail: input.temperature + '℃ 温度条件',
        },
      ],
      columns: ['候选型号', '额定电压', '容量', '温度', '寿命'],
      rows: matches.map((r) => [
        String(r['产品型号']),
        r['额定电压(V)'] + ' V',
        r['容量(μF)'] + ' μF',
        r['温度(℃)'] + '℃',
        f(n(r, '寿命(h)'), 0) + ' h',
      ]),
      bars: matches.map((r) => ({
        label: String(r['产品型号']),
        value:
          (n(r, '寿命(h)') / Math.max(...matches.map((v) => n(v, '寿命(h)')))) *
          100,
        display: f(n(r, '寿命(h)'), 0) + ' h',
      })),
      chartTitle: '候选产品寿命对比',
      recommendation:
        '与产品工程师确认外形尺寸、安装方式及纹波电流，完成规格书复核后安排送样。',
      basis: [
        ...common.basis,
        '电压、温度、寿命按最低要求筛选；容量与应用按精确值匹配。',
        '候选产品按标称寿命从高到低排列，不代表最终选型结论。',
      ],
    };
  }
  if (id === 'maintenance') {
    const type = input.device.replace(/\s+(?:W-03|I-02|A-06)$/, '');
    const matches = dataset.rows.filter(
      (r) =>
        String(r['设备类型']) === type &&
        String(r['故障现象']) === input.symptom,
    );
    return {
      ...common,
      title: matches.length
        ? `为 ${input.device} 整理了 ${matches.length} 条排查线索`
        : '未找到匹配的故障知识',
      summary: matches.length
        ? `当前现象：${input.symptom}。以下方案依据设备类型和故障知识生成，按步骤核查后记录结果。`
        : '请调整设备与故障现象，或在数据管理中补充对应知识条目。',
      empty: !matches.length,
      metrics: [
        { label: '设备', value: input.device, detail: type + '设备' },
        { label: '故障现象', value: input.symptom, detail: '匹配知识库分类' },
        { label: '优先级', value: input.priority, detail: '由提交人指定' },
      ],
      columns: ['案例编号', '排查方向', '处理建议'],
      rows: matches.map((r) => [
        String(r['案例编号']),
        String(r['排查方向']),
        String(r['处理建议']),
      ]),
      bars: [],
      chartTitle: '',
      steps: [
        {
          title: '确认现场状态',
          body: '由设备人员按现场规程停机隔离，核对报警和运行记录。',
        },
        ...matches.map((r) => ({
          title: String(r['排查方向']),
          body: String(r['处理建议']),
        })),
        {
          title: '验证并留档',
          body: '完成维修后按规程复机验证，将排查结果记录到分析单。',
        },
      ],
      recommendation:
        '维修方案须由设备人员结合对应型号手册确认；完成后在记录详情中填写处置结果。',
      basis: [
        ...common.basis,
        '按设备类型与故障类别关联知识条目，补充描述保留在分析记录中。',
        '匹配案例为排查依据，不能单独确认故障根因。',
      ],
    };
  }
  if (id === 'energy') {
    const rows = dataset.rows.filter(
      (r) =>
        input.process === '全部工序' || String(r['工序']) === input.process,
    );
    if (!rows.length) return emptyRange;
    const current = rows.reduce((sum, r) => sum + n(r, '用电量(kWh)'), 0);
    const days = Number(input.period);
    const projected = current * (days / 7) * (1 + Number(input.change) / 100);
    const anomalies = rows.filter(
      (r) =>
        n(r, '用电量(kWh)') / n(r, '产量(千只)') >
        n(r, '基准单耗(kWh/千只)') * 1.05,
    );
    return {
      ...common,
      title: `未来 ${days} 天预计用电 ${f(projected / 1000)} MWh`,
      summary: `按所选工序近 7 天用电及产量变化 ${input.change}% 估算。${anomalies.length ? anomalies.map((r) => r['工序']).join('、') + '单耗高于基准 5%，建议优先核查。' : '所选工序单耗未触发偏差阈值。'}`,
      metrics: [
        {
          label: '历史用电',
          value: f(current / 1000) + ' MWh',
          detail: '近 7 天所选工序',
        },
        {
          label: '预测用电',
          value: f(projected / 1000) + ' MWh',
          detail: '未来 ' + days + ' 天',
        },
        {
          label: '需关注工序',
          value: String(anomalies.length),
          detail: '单耗高于基准 5%',
        },
      ],
      columns: ['工序', '历史用电', '单位产量电耗', '基准单耗', '预测用电'],
      rows: rows.map((r) => [
        String(r['工序']),
        f(n(r, '用电量(kWh)') / 1000) + ' MWh',
        f(n(r, '用电量(kWh)') / n(r, '产量(千只)'), 2) + ' kWh/千只',
        f(n(r, '基准单耗(kWh/千只)'), 2) + ' kWh/千只',
        f(
          (n(r, '用电量(kWh)') *
            (days / 7) *
            (1 + Number(input.change) / 100)) /
            1000,
        ) + ' MWh',
      ]),
      bars: rows.map((r) => ({
        label: String(r['工序']),
        value:
          (n(r, '用电量(kWh)') /
            Math.max(1, ...rows.map((v) => n(v, '用电量(kWh)')))) *
          100,
        display:
          f(
            (n(r, '用电量(kWh)') *
              (days / 7) *
              (1 + Number(input.change) / 100)) /
              1000,
          ) + ' MWh',
        warning: anomalies.includes(r),
      })),
      chartTitle: '各工序预测用电',
      recommendation:
        '优先检查高偏差工序的空载时长与批次装载率，结合实际生产约束评估优化措施。',
      basis: [
        ...common.basis,
        '预测电量 = 近 7 天电量 × 预测天数 / 7 ×（1 + 计划产量变化）。',
        '单位电耗 = 用电量 / 产量；高于基准 5% 时提示关注。本页为线性估算，未使用 AI 预测模型。',
      ],
    };
  }
  if (id === 'production') {
    const rows = dataset.rows.filter(
      (r) => input.line === '全部产线' || r['产线'] === input.line,
    );
    if (!rows.length) return emptyRange;
    const issues = rows.filter(
      (r) =>
        (n(r, '实际产量(万只)') / n(r, '计划产量(万只)')) * 100 <
          Number(input.completion) ||
        (n(r, '不良数量') / n(r, '检验数量')) * 100 > Number(input.defect),
    );
    const planned = rows.reduce((s, r) => s + n(r, '计划产量(万只)'), 0);
    const actual = rows.reduce((s, r) => s + n(r, '实际产量(万只)'), 0);
    const checked = rows.reduce((s, r) => s + n(r, '检验数量'), 0);
    const rejected = rows.reduce((s, r) => s + n(r, '不良数量'), 0);
    return {
      ...common,
      title: issues.length
        ? `${issues.length} 条产线需要关注`
        : '所选产线均在目标范围内',
      summary: issues.length
        ? `${issues.map((r) => r['产线']).join('、')}存在计划完成率或不良率偏差。建议对照停机记录及检验批次进一步核查。`
        : '所选数据未触发当前阈值；可调整分析范围查看其他产线。',
      metrics: [
        {
          label: '计划完成率',
          value: f((actual / planned) * 100) + '%',
          detail: `实际 ${f(actual)} / 计划 ${f(planned)} 万只`,
        },
        {
          label: '综合不良率',
          value: f((rejected / checked) * 100, 2) + '%',
          detail: '按检验数量加权',
        },
        {
          label: '需关注产线',
          value: String(issues.length),
          detail: `完成率 < ${input.completion}% 或不良率 > ${input.defect}%`,
        },
      ],
      columns: [
        '产线',
        '计划 / 实际(万只)',
        '完成率',
        '不良率',
        '停机时长',
        '状态',
      ],
      rows: rows.map((r) => [
        String(r['产线']),
        `${r['计划产量(万只)']} / ${r['实际产量(万只)']}`,
        f((n(r, '实际产量(万只)') / n(r, '计划产量(万只)')) * 100) + '%',
        f((n(r, '不良数量') / n(r, '检验数量')) * 100, 2) + '%',
        r['停机时长(min)'] + ' min',
        issues.includes(r) ? '需关注' : '正常',
      ]),
      bars: rows.map((r) => ({
        label: String(r['产线']),
        value: Math.min(
          (n(r, '实际产量(万只)') / n(r, '计划产量(万只)')) * 100,
          100,
        ),
        display:
          f((n(r, '实际产量(万只)') / n(r, '计划产量(万只)')) * 100) + '%',
        warning: issues.includes(r),
      })),
      chartTitle: '产线完成率',
      recommendation:
        '将异常产线的停机时段、设备报警与检验批次关联核查，并记录处理结论。',
      basis: [
        ...common.basis,
        '完成率 = 实际产量 / 计划产量；不良率 = 不良数量 / 检验数量。',
        '同时考虑两个阈值，满足任意一项即标记为需关注。',
      ],
    };
  }
  const rows = dataset.rows.filter(
    (r) => input.supplier === '全部供应商' || r['供应商'] === input.supplier,
  );
  if (!rows.length) return emptyRange;
  const dw = Number(input.deliveryWeight) / 100;
  const qw = Number(input.qualityWeight) / 100;
  const rw = 1 - dw - qw;
  const score = (r: Row) =>
    n(r, '交付及时率(%)') * dw +
    n(r, '来料合格率(%)') * qw +
    n(r, '响应评分') * rw;
  const risks = (r: Row) =>
    Number(n(r, '交付及时率(%)') < Number(input.deliveryTarget)) +
    Number(n(r, '来料合格率(%)') < Number(input.qualityTarget));
  const sorted = [...rows].sort((a, b) => score(b) - score(a));
  const needs = rows.filter((r) => risks(r) > 0);
  return {
    ...common,
    title: needs.length
      ? `${needs.length} 家供应商需要跟进`
      : '所选供应商均达到交付与质量目标',
    summary: needs.length
      ? `${needs.map((r) => r['供应商']).join('、')}存在交付或质量指标偏差。综合评分依据当前配置的权重计算，风险等级由目标达成情况决定。`
      : '当前评估范围未发现目标偏差，建议持续跟踪后续交付与来料质量。',
    metrics: [
      {
        label: '评估供应商',
        value: String(rows.length),
        detail: '当前筛选范围',
      },
      {
        label: '需跟进',
        value: String(needs.length),
        detail: '至少一项未达标',
      },
      {
        label: '评分权重',
        value: `${input.deliveryWeight} / ${input.qualityWeight} / ${f(rw * 100, 0)}`,
        detail: '交付 / 质量 / 响应（%）',
      },
    ],
    columns: ['供应商', '交付及时率', '来料合格率', '综合评分', '风险等级'],
    rows: sorted.map((r) => [
      String(r['供应商']),
      r['交付及时率(%)'] + '%',
      r['来料合格率(%)'] + '%',
      f(score(r), 1),
      risks(r) === 2 ? '较高风险' : risks(r) === 1 ? '需观察' : '低风险',
    ]),
    bars: sorted.map((r) => ({
      label: String(r['供应商']),
      value: score(r),
      display: f(score(r), 1) + ' 分',
      warning: risks(r) > 0,
    })),
    chartTitle: '供应商综合评分',
    recommendation:
      '请采购与质量人员共同确认未达标原因，明确受影响订单或批次，并形成改善跟进记录。',
    basis: [
      ...common.basis,
      `综合评分 = 交付及时率 × ${input.deliveryWeight}% + 来料合格率 × ${input.qualityWeight}% + 响应评分 × ${f(rw * 100, 0)}%。`,
      '风险等级按交付、质量是否达标评定：两项未达标为较高风险，一项为需观察。',
    ],
  };
}
export function validateDataset(dataset: Dataset): string | null {
  if (
    !dataset ||
    !Array.isArray(dataset.rows) ||
    !Array.isArray(dataset.columns)
  )
    return '数据格式不正确。';
  if (dataset.rows.length < 1 || dataset.rows.length > 500)
    return '数据应包含 1–500 行。';
  const reference = initialDatasets.find((d) => d.id === dataset.id);
  if (!reference) return '不支持此数据类型。';
  if (
    dataset.columns.length !== reference.columns.length ||
    reference.columns.some((c) => !dataset.columns.includes(c))
  )
    return '列名不完整，请使用对应模板。';
  for (const row of dataset.rows) {
    for (const key of reference.columns) {
      if (
        !row ||
        typeof row !== 'object' ||
        String(row[key] ?? '').length > 1000
      )
        return '字段内容不正确或过长。';
      if (row[key] === undefined || String(row[key]).trim() === '')
        return '存在空字段，请补全后导入。';
      if (
        typeof reference.rows[0][key] === 'number' &&
        (!Number.isFinite(Number(row[key])) ||
          Number(row[key]) < 0 ||
          Number(row[key]) > 1e12)
      )
        return key + '必须是非负数值。';
    }
    if (
      dataset.id === 'energy' &&
      (n(row, '产量(千只)') <= 0 || n(row, '基准单耗(kWh/千只)') <= 0)
    )
      return '产量与基准单耗必须大于 0。';
    if (
      dataset.id === 'production' &&
      (n(row, '计划产量(万只)') <= 0 ||
        n(row, '检验数量') <= 0 ||
        n(row, '不良数量') > n(row, '检验数量'))
    )
      return '请检查计划产量、检验数量和不良数量。';
    if (
      dataset.id === 'suppliers' &&
      reference.columns.slice(1).some((c) => n(row, c) > 100)
    )
      return '供应商评分和比例必须在 0–100 之间。';
  }
  return null;
}
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted) quoted = false;
      else if (cell.length === 0) quoted = true;
      else throw new Error('CSV 引号格式不正确。');
    } else if (c === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('CSV 存在未闭合的引号。');
  row.push(cell.trim());
  if (row.some((v) => v !== '')) rows.push(row);
  return rows;
}
export function importCSV(
  reference: Dataset,
  text: string,
  fileName: string,
): Dataset {
  const [columns, ...values] = parseCSV(text);
  if (!columns || new Set(columns).size !== columns.length)
    throw new Error('列名为空或存在重复。');
  if (values.some((v) => v.length !== columns.length))
    throw new Error('CSV 行列数量不一致。');
  const dataset: Dataset = {
    ...reference,
    columns,
    rows: values.map((v) =>
      Object.fromEntries(columns.map((c, i) => [c, v[i]])),
    ),
    origin: 'local',
    fileName,
    updatedAt: new Date().toISOString(),
  };
  const error = validateDataset(dataset);
  if (error) throw new Error(error);
  return dataset;
}
export function csvExport(
  columns: string[],
  rows: (string | number)[][],
): string {
  return (
    '\uFEFF' +
    [columns, ...rows]
      .map((row) =>
        row
          .map((v) => {
            let cell = String(v);
            if (/^[=+@-]/.test(cell)) cell = "'" + cell;
            return '"' + cell.replaceAll('"', '""') + '"';
          })
          .join(','),
      )
      .join('\r\n')
  );
}
