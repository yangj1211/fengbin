import type { Inputs } from './model';
import {
  maintenanceFaults,
  maintenancePlans,
  maintenanceStandards,
  maintenanceParts,
  maintenanceImages,
  type MaintenanceFault,
  type MaintenanceStandard,
} from './maintenance-data';
import type { SourceReference } from './customer-types';

export const maintenanceDefaults: Inputs = {
  device: '',
  model: '',
  code: '',
  symptom: '',
  caseId: '',
  observations: '',
  standardIds: '',
  partIds: '',
  pendingFaultIds: '',
  question: '',
  maintenanceVersion: '2',
};

export function normalizeMaintenanceInputs(input: Inputs): Inputs {
  // Earlier drafts contain demo models and alarms absent from the final data.
  return input.maintenanceVersion === '2'
    ? { ...maintenanceDefaults, ...input }
    : { ...maintenanceDefaults, question: input.question ?? '' };
}

const normalized = (value: string) =>
  value
    .toUpperCase()
    .replace(/針/g, '针')
    .replace(/機/g, '机')
    .replace(/膠/g, '胶')
    .replace(/鋁/g, '铝')
    .replace(/電/g, '电')
    .replace(/燈/g, '灯')
    .replace(/繼/g, '继')
    .replace(/电机/g, '马达')
    .replace(/\s+/g, '');
const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasId = (question: string, id: string) =>
  new RegExp(`(^|[^A-Z0-9-])${escapeRegExp(id)}(?=$|[^A-Z0-9-])`, 'i').test(
    question,
  );
const source = (documentId: string, sectionId: string): SourceReference => ({
  documentId,
  sectionId,
  page: 1,
});
// Workbook cells are literal content, including multiplication stars in sizes.
const literal = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/[\\`*_{}[\]()<>~|#!]/g, '\\$&')
    .replace(/^(\s*)(\d+)\.(?=\s)/gm, '$1$2\\.')
    .replace(/^([ \t]*)([-+])(?=\s)/gm, '$1\\$2')
    // Leading source indentation must not turn a standard into a code block.
    .replace(/^[ \t]+/gm, (space) => space.replace(/ /g, '&#32;').replace(/\t/g, '&#9;'));
const numberedList = (items: string[]) =>
  items.map((item, index) => `${index + 1}. ${item}`).join('\n');
const faultAliases: Record<string, RegExp> = {
  CJGZ00001: /胶盖(?:破损|破了|损坏)/,
  CJGZ00002: /主马达(?:不转|转不动|故障)|机台不动作/,
  DJGZ00024: /掉素子|素子掉落/,
  DJGZ00025: /花瓣(?:箔灰重|处箔灰多)|钉接(?:花瓣)?处?箔灰多/,
  DJGZ00026: /毛刷(?:马达)?(?:不转|转不动|故障)/,
  DJGZ00027: /断箔/,
  DJGZ00028: /花瓣(?:残缺|大小不均|不均匀|大小不一)/,
  RJGZ00001: /导针(?:弯曲|弯了)/,
  RJGZ00002: /虚焊|焊接不牢/,
  RJGZ00003: /素子平送不顺畅|卡素子/,
};

function faultMatches(question: string): MaintenanceFault[] {
  const clauses = normalized(question)
    .split(/[，,。；;！!？?]/)
    .filter((clause) => !/没有|未见|并无|不是|已无|不再|并非/.test(clause));
  const scored = maintenanceFaults.map((fault) => {
    let score = 0;
    for (const clause of clauses) {
      if (clause.includes(normalized(fault.name))) score = Math.max(score, 90);
      if (fault.symptom && clause.includes(normalized(fault.symptom)))
        score = Math.max(score, 90);
      if (faultAliases[fault.id]?.test(clause)) score = Math.max(score, 80);
      // An unspecified motor could mean either of the two motor fault records.
      if (
        /马达(?:不转|转不动)/.test(clause) &&
        !/毛刷|主马达/.test(clause) &&
        ['CJGZ00002', 'DJGZ00026'].includes(fault.id)
      )
        score = Math.max(score, 60);
    }
    return { fault, score };
  });
  const maximum = Math.max(...scored.map((item) => item.score));
  return maximum > 0
    ? scored.filter((item) => item.score === maximum).map((item) => item.fault)
    : [];
}

function standardTerms(standard: MaintenanceStandard): string[] {
  const mainName = standard.name.split(/[（(]/)[0];
  return [
    mainName,
    ...standard.name.split(/[（()）/、，,;；]/),
    mainName.replace(/装置|机构/g, ''),
  ]
    .map(normalized)
    .filter((term) => term.length > 1);
}

function namedStandards(question: string): MaintenanceStandard[] {
  const q = normalized(question)
    .split(/[，,。；;！!？?]/)
    .filter((clause) => !/没有|未见|并无|不是|已无|不再|并非/.test(clause))
    .join(' ');
  const matches = maintenanceStandards
    .map((standard) => ({
      standard,
      terms: standardTerms(standard).filter((term) => q.includes(term)),
    }))
    .filter((item) => item.terms.length > 0);
  // A specific component (导针平送) takes precedence over a generic substring
  // (平送) in a different component's title.
  return matches
    .filter(
      (item) =>
        !matches.some((other) =>
          item.terms.every((term) =>
            other.terms.some(
              (otherTerm) =>
                otherTerm.length > term.length && otherTerm.includes(term),
            ),
          ),
        ),
    )
    .map((item) => item.standard);
}

function relatedStandards(fault: MaintenanceFault): MaintenanceStandard[] {
  if (fault.id === 'DJGZ00026')
    return maintenanceStandards.filter((item) => item.id === 'CXS-GQ-0089-021');
  const referenceText = maintenancePlans
    .filter((plan) => plan.faultId === fault.id)
    .map((plan) => `${plan.cause} ${plan.repair}`)
    .join(' ');
  return namedStandards(referenceText);
}

function namedParts(question: string) {
  const q = normalized(question)
    .split(/[，,。；;！!？?]/)
    .filter((clause) => !/没有|未见|并无|不是|已无|不再|并非/.test(clause))
    .join(' ');
  return maintenanceParts.filter((part) => q.includes(normalized(part.name)));
}

export function replyToMaintenance(
  question: string,
  current: Inputs,
): {
  answer: string;
  inputs: Inputs;
  sources: SourceReference[];
} {
  const q = question.trim();
  let input: Inputs = { ...normalizeMaintenanceInputs(current), question: q };
  const reset = () => {
    input = { ...maintenanceDefaults, question: q };
  };
  const reply = (answer: string, sources: SourceReference[] = []) => ({
    answer,
    inputs: input,
    sources: sources.filter(
      (item, index) =>
        sources.findIndex(
          (other) =>
            other.documentId === item.documentId &&
            other.sectionId === item.sectionId,
        ) === index,
    ),
  });
  if (!q || /^(你好|您好|嗨|HI|HELLO|谢谢|感谢)[！!。\s]*$/i.test(q))
    return reply('可以描述故障现象，或询问部件的操作标准、备件料号和规格。');
  if (/能做什么|怎么用|如何使用|什么功能/.test(q))
    return reply(
      '我可以查询故障原因与维修参考、相关图片、操作标准，以及备件料号和规格。比如“毛刷马达不转，怎么处理？有图片吗？”',
    );
  if (/换(?:一)?台|另一台|换个设备|切换设备|新的故障|新故障|另一个故障/.test(q))
    reset();

  const exactPlans = maintenancePlans.filter((item) => hasId(q, item.id));
  const exactFaults = maintenanceFaults.filter((item) => hasId(q, item.id));
  const exactStandards = maintenanceStandards.filter((item) =>
    hasId(q, item.id),
  );
  const exactParts = maintenanceParts.filter((item) => hasId(q, item.id));
  const standardFileNumbers = [
    ...new Set(maintenanceStandards.map((item) => item.fileNumber)),
  ];
  const exactFiles = standardFileNumbers.filter((id) => hasId(q, id));
  let unrecognized = q.toUpperCase();
  const knownIds = [
    ...maintenanceFaults,
    ...maintenancePlans,
    ...maintenanceStandards,
    ...maintenanceParts,
  ].map((item) => item.id);
  for (const id of [...knownIds, ...standardFileNumbers].sort(
    (a, b) => b.length - a.length,
  ))
    unrecognized = unrecognized.replace(
      new RegExp(`(^|[^A-Z0-9-])${escapeRegExp(id)}(?=$|[^A-Z0-9-])`, 'g'),
      '$1 ',
    );
  const unknownIds = unrecognized.match(
    /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b|\b[A-Z]{1,8}\d{3,}[A-Z0-9-]*\b/g,
  );
  if (unknownIds?.length) {
    reset();
    return reply(`未查到 ${literal([...new Set(unknownIds)].join('、'))} 的对应记录。`);
  }

  const asksImage = /图片|配图|照片|图示|看图/.test(q);
  const asksCause = /原因|为什么|为何/.test(q);
  const supportedQuestion = q.replace(
    /维修工时|维修时间|历史工单|维修工单|历史案例|相似案例|维修记录|维修验收|修后验证/g,
    '',
  );
  const asksRepair =
    /处理|维修|修理|怎么修|怎么办|如何修|解决|方法|方案|步骤|怎么换|换什么|更换什么/.test(
      supportedQuestion,
    );
  const asksStandard =
    /标准|尺寸|怎么调|如何调|怎样调|调到|调节|调整到|间隙|什么状态|保养|温度|多宽|多高|多大/.test(
      q,
    );
  const asksParts = /备件|配件|料号|规格|品名|单位/.test(q);
  const missingRequests = [
    { pattern: /库存|有货|余量/, label: '库存' },
    { pattern: /工时|维修时间|多久修好/, label: '维修工时' },
    {
      pattern: /历史工单|维修工单|历史案例|相似案例|维修记录/,
      label: '维修工单或历史案例',
    },
    {
      pattern: /修后验证|维修验收|修完怎么验证|怎么确认修好/,
      label: '修后验证',
    },
  ].filter((item) => item.pattern.test(q));
  const missingText = missingRequests.length
    ? `未查到${missingRequests.map((item) => item.label).join('、')}数据。`
    : '';
  if (
    missingText &&
    !asksImage &&
    !asksCause &&
    !asksRepair &&
    !asksStandard &&
    !asksParts
  )
    return reply(missingText);
  let faults = exactPlans.length
    ? maintenanceFaults.filter((fault) =>
        exactPlans.some((plan) => plan.faultId === fault.id),
      )
    : exactFaults.length
      ? exactFaults
      : faultMatches(q);
  let standards = exactStandards.length
    ? exactStandards
    : exactFiles.length
      ? maintenanceStandards.filter((item) =>
          exactFiles.includes(item.fileNumber),
        )
      : namedStandards(q);
  let parts = exactParts.length ? exactParts : namedParts(q);
  if (!faults.length && input.pendingFaultIds) {
    faults = maintenanceFaults.filter(
      (item) =>
        input.pendingFaultIds.split(',').includes(item.id) &&
        normalized(q).includes(normalized(item.name.replace(/故障|不转/g, ''))),
    );
    if (faults.length === 1 && !asksStandard) standards = [];
  }
  const oldFault = maintenanceFaults.find((item) => item.id === input.caseId);
  const hasExplicitFault = faults.length > 0;
  const hasExplicitStandard = standards.length > 0;
  const hasExplicitPart = parts.length > 0;
  const hasNewUnmatchedSymptom =
    !hasExplicitFault &&
    /无法启动|不能启动|异响|漏油|振动异常|冒烟|漏电|通信中断|真空度不足|没有|不再|不是|未见/.test(
      q,
    );
  const followup =
    !hasNewUnmatchedSymptom &&
    /^(?:那|这个|那个|它|这|该|再|继续)|^(?:请|给我|说一下|说下|看下|看一下|有|什么|怎么|如何|具体|只看|只要|仅看|仅要|的|是|和|及|原因|为什么|图片|配图|照片|处理|操作|相关|对应|还有|应该|需要|正常|标准|调到|状态|料号|规格|尺寸|维修|方法|方案|步骤|吗|呢|一下|哪些|多少|[，,。？！?!\s])+$/u.test(
      q,
    );
  if (
    !faults.length &&
    !hasExplicitStandard &&
    !hasExplicitPart &&
    followup &&
    oldFault
  )
    faults = [oldFault];
  if (!standards.length && asksStandard && faults.length === 1)
    standards = relatedStandards(faults[0]);
  if (
    !standards.length &&
    !hasExplicitFault &&
    !hasExplicitPart &&
    followup &&
    input.standardIds
  )
    standards = maintenanceStandards.filter((item) =>
      input.standardIds.split(',').includes(item.id),
    );
  if (
    !parts.length &&
    !hasExplicitFault &&
    !hasExplicitStandard &&
    followup &&
    input.partIds
  )
    parts = maintenanceParts.filter((item) =>
      input.partIds.split(',').includes(item.id),
    );
  const showStandards =
    standards.length > 0 &&
    (asksStandard ||
      exactStandards.length > 0 ||
      exactFiles.length > 0 ||
      (!faults.length && !asksParts));
  const showParts =
    parts.length > 0 &&
    (asksParts || exactParts.length > 0 || (!faults.length && !showStandards));
  const showFault =
    faults.length > 0 &&
    (asksRepair ||
      asksCause ||
      asksImage ||
      (!asksStandard && !asksParts && !missingText));
  if (
    faults.length > 1 &&
    showFault &&
    !exactFaults.length &&
    !exactPlans.length
  ) {
    reset();
    input.pendingFaultIds = faults.map((item) => item.id).join(',');
    return reply(
      `查到 ${faults.length} 条可能对应的故障，请确认是哪一种：\n\n${faults
        .map(
          (item) =>
            `- ${literal(item.name)}（${literal(item.id)}）${item.symptom ? `：${literal(item.symptom)}` : ''}`,
        )
        .join('\n')}`,
      faults.map((item) => source('maintenance-faults', item.id)),
    );
  }
  if (!showFault && !showStandards && !showParts) {
    reset();
    return reply(
      missingText ||
        '未查到对应记录。可以换用故障名称、部件名称、标准编号或备件料号查询。',
    );
  }
  // Keep fault context for its own standards, but clear it for a new subject.
  const retainedFault =
    faults.length === 1
      ? faults[0]
      : !hasExplicitPart &&
          oldFault &&
          standards.some((standard) =>
            relatedStandards(oldFault).some(
              (related) => related.id === standard.id,
            ),
          )
        ? oldFault
        : undefined;
  reset();
  if (retainedFault) {
    input.caseId = retainedFault.id;
    input.symptom = retainedFault.symptom || retainedFault.name;
  }
  if (showStandards)
    input.standardIds = standards.map((item) => item.id).join(',');
  if (showParts) input.partIds = parts.map((item) => item.id).join(',');
  const sections: string[] = [];
  const sources: SourceReference[] = [];
  if (showFault)
    for (const fault of faults) {
      const plans = exactPlans.length
        ? exactPlans.filter((item) => item.faultId === fault.id)
        : maintenancePlans.filter((item) => item.faultId === fault.id);
      const title = `**${literal(fault.name)}（${literal(fault.id)}）**${fault.symptom ? `\n\n记录现象：${literal(fault.symptom)}。` : ''}`;
      const imageOnly = asksImage && !asksCause && !asksRepair;
      const causeOnly = asksCause && !asksRepair;
      if (!imageOnly) {
        sections.push(
          `${title}\n\n${
            causeOnly
              ? `记录中的可能原因：\n\n${plans.map((plan) => `- ${literal(plan.cause)}`).join('\n')}`
              : `记录中的可能原因与对应维修参考：\n\n${numberedList(
                  plans.map(
                    (plan) =>
                      `可能原因：**${literal(plan.cause)}**；维修参考：${literal(plan.repair)}。`,
                  ),
                )}`
          }`,
        );
        sources.push(
          ...plans.map((plan) => source('maintenance-plans', plan.id)),
        );
      } else sections.push(title);
      sources.push(source('maintenance-faults', fault.id));
      if (asksImage) {
        const image = maintenanceImages.find(
          (item) => item.faultId === fault.id,
        );
        if (image) {
          sections.push(`![${literal(fault.name)}参考图片](${image.url})`);
          sources.push(source(`maintenance-image-${fault.id}`, fault.id));
        }
      }
    }
  if (showStandards)
    for (const standard of standards) {
      sections.push(
        `**${literal(standard.name)} · ${literal(standard.location)}**\n\n${literal(standard.text)}\n\n标准编号：${literal(standard.id)}（${literal(standard.version)}）。`,
      );
      sources.push(source('maintenance-standards', standard.id));
    }
  if (showParts) {
    sections.push(
      `查到 ${parts.length} 条备件记录：\n\n${numberedList(
        parts.map(
          (part) =>
            `**${literal(part.name)}（${literal(part.id)}）**：${literal(part.spec)}；工序：${literal(part.process)}；单位：${literal(part.unit)}。`,
        ),
      )}`,
    );
    sources.push(
      ...parts.map((part) => source('maintenance-parts-final', part.id)),
    );
  }
  if (missingText) sections.push(missingText);
  return reply(sections.join('\n\n'), sources);
}
