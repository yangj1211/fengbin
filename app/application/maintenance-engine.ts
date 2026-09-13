import type { Inputs } from './model';
import {
  maintenanceCases,
  maintenanceFixtures,
  type MaintenanceCase,
} from './maintenance-data';
import type { SourceReference } from './customer-types';

export const maintenanceDefaults: Inputs = {
  device: '',
  model: '',
  code: '',
  symptom: '',
  caseId: '',
  observations: '',
  question: '',
  maintenanceVersion: '1',
};
export function normalizeMaintenanceInputs(input: Inputs): Inputs {
  // Old drafts contain automatically selected equipment and faults; keep the
  // original turns, but do not treat those defaults as confirmed field facts.
  return input.maintenanceVersion === '1'
    ? { ...maintenanceDefaults, ...input }
    : { ...maintenanceDefaults, question: input.question ?? '' };
}
const intakeSection = maintenanceFixtures.documents
  .find((document) => document.id === 'maintenance-parts')!
  .sections.find((section) => section.id === 'intake')!;
const intake: SourceReference[] = [
  {
    documentId: 'maintenance-parts',
    sectionId: 'intake',
    page: intakeSection.page,
  },
];
const list = (items: string[], numbered = false) =>
  items
    .map((item, index) => `${numbered ? `${index + 1}.` : '-'} ${item}`)
    .join('\n');
const aliases: Record<string, string[]> = {
  卷绕机: ['卷绕机', '卷绕设备'],
  含浸机: ['含浸机', '含浸设备'],
  老化柜: ['老化柜', '老化测试设备', '老化设备'],
  电容测试仪: ['电容测试仪', '测试仪'],
  空压机: ['空压机', '空气压缩机'],
};
const faultSignals: Record<string, RegExp> = {
  卷绕机: /张力(?:波动|不稳|异常)|断箔/,
  含浸机: /真空(?:度)?(?:不足|不够|偏低|达不到|上不去)/,
  老化柜: /温度(?:偏高|过高|异常升高)|温升异常|超温/,
  电容测试仪: /(?:测试)?读数(?:波动|不稳)|测量(?:结果)?(?:波动|不稳定)/,
  空压机: /(?:供气)?压力(?:不足|偏低|不够)|供气不足/,
};
function hasSymptom(text: string, example: MaintenanceCase) {
  return text.split(/[，,。；;！!？?]/).some((clause) => {
    const hit = clause.match(faultSignals[example.device]);
    return (
      hit &&
      !/没有|未见|并无|不是|已无|不再|并非/.test(clause.slice(0, hit.index))
    );
  });
}
function partsText(example: MaintenanceCase) {
  return list(example.parts.map((part) => `${part.name}：${part.condition}`));
}
function repairPlanText(example: MaintenanceCase) {
  return [
    '维修前先记录当前告警和已检查结果，由授权人员按适用手册完成停机、隔离及检查条件确认。',
    `具体维修方案：\n\n${list(example.repair, true)}`,
    `修后验证：\n\n${list(example.verification, true)}`,
  ].join('\n\n');
}
export function replyToMaintenance(
  question: string,
  current: Inputs,
): {
  answer: string;
  inputs: Inputs;
  sources: SourceReference[];
} {
  let input = normalizeMaintenanceInputs(current);
  const q = question.trim();
  input = { ...input, question: q };
  if (/换(?:一)?台|另一台|换个设备|切换设备|新的故障|新故障|另一个故障/.test(q))
    input = { ...maintenanceDefaults, question: q };
  const reply = (answer: string, sources = intake) => ({
    answer,
    inputs: input,
    sources,
  });
  if (
    /^(你好|您好|hi|hello|谢谢|感谢)[！!。\s]*$/i.test(q) ||
    /能做什么|怎么用|如何使用/.test(q)
  )
    return reply(
      '可以告诉我设备型号、告警代码或具体故障现象。我会结合设备手册、历史工单和备件资料，给出具体维修方案，包括处理步骤、所需备件及修后验证；不清楚的信息会先向你确认。',
    );

  const labeledCode = q.match(
    /(?:故障码|故障代码|代码|告警码|报警码)\s*(?:是|为)?\s*[:：]?\s*([a-zA-Z0-9_-]+)/,
  )?.[1];
  const tokens = [
    ...new Set(
      [
        ...(q.match(
          /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b|\b[A-Z]{1,4}\d{2,6}\b/gi,
        ) ?? []),
        ...(labeledCode ? [labeledCode] : []),
      ].map((token) => token.toUpperCase()),
    ),
  ];
  const models = maintenanceCases.filter((item) => tokens.includes(item.model));
  const codes = maintenanceCases.filter((item) => tokens.includes(item.code));
  const devices = Object.entries(aliases)
    .filter(([, names]) => names.some((name) => q.includes(name)))
    .map(([name]) => name);
  const unknown = tokens.filter(
    (token) =>
      !maintenanceCases.some(
        (item) => item.model === token || item.code === token,
      ),
  );
  if (unknown.length) {
    input = { ...maintenanceDefaults, question: q };
    return reply(
      `当前资料中没有 ${unknown.join('、')} 的适用说明，不能套用其他型号或故障码的维修建议。请补充对应设备型号、告警原文及具体表现，我会先确认资料是否适用。`,
    );
  }
  if (
    devices.length > 1 ||
    models.length > 1 ||
    codes.length > 1 ||
    (models[0] && codes[0] && models[0].id !== codes[0].id) ||
    (devices[0] &&
      [models[0], codes[0]].some((item) => item && item.device !== devices[0]))
  ) {
    input = { ...maintenanceDefaults, question: q };
    return reply(
      '这条描述中有多台设备，或型号与告警代码的适用关系不一致。请先确认要排查的设备型号和告警原文，我再继续，避免把不同设备的处理方法混在一起。',
    );
  }
  const device = devices[0] ?? models[0]?.device;
  if (device && device !== input.device) {
    input = input.device
      ? { ...maintenanceDefaults, device, question: q }
      : { ...input, device };
  }
  if (models[0]) input.model = models[0].model;
  if (codes[0]) {
    if (input.device && input.device !== codes[0].device) {
      input = { ...maintenanceDefaults, question: q };
      return reply(
        '这个告警代码与前面设备的资料不一致。请确认是否已切换设备，并补充型号。',
      );
    }
    input.code = codes[0].code;
  }
  let identityText = q;
  for (const token of tokens)
    identityText = identityText.replaceAll(new RegExp(token, 'gi'), '');
  for (const names of Object.values(aliases))
    for (const name of names) identityText = identityText.replaceAll(name, '');
  const identityOnly =
    Boolean(device || models[0] || codes[0]) &&
    /^(?:设备型号|型号|设备|机型|这台|确认|改成|换成|是|为|\s|[:：，,。.!])*$/u.test(
      identityText,
    );
  const signalText = identityOnly && input.symptom ? input.symptom : q;
  const symptomMatches = maintenanceCases.filter((item) =>
    hasSymptom(signalText, item),
  );
  const matchedSymptom = symptomMatches.find(
    (item) => item.device === input.device,
  );
  const activeCode = maintenanceCases.find((item) => item.code === input.code);
  if (activeCode && input.device && activeCode.device !== input.device) {
    input = { ...maintenanceDefaults, question: q };
    return reply(
      '前面提到的告警代码与补充的设备型号不一致，请核对铭牌和告警原文后再继续。',
    );
  }
  const asksVerification = /验证|验收|怎么确认|如何确认|怎样确认/.test(q);
  const followup =
    asksVerification ||
    /备件|配件|更换什么|换什么|历史|案例|工单|依据|原因|为什么|注意|步骤|方案|维修|处理|怎么修|如何修|怎么做|详细|继续|仍|还是|已经|已检查|检查过|换料|校准|反馈|处理结果|恢复|解决/.test(
      q,
    );
  const negatedFault =
    !matchedSymptom &&
    q
      .split(/[，,。；;]/)
      .some(
        (clause) =>
          /没有|未见|并无|不是|已无|不再|并非/.test(clause) &&
          maintenanceCases.some((item) =>
            faultSignals[item.device].test(clause),
          ),
      );
  if (
    /无法启动|不能启动|异响|漏油|振动|冒烟|漏电|通信中断/.test(q) ||
    (negatedFault && !(asksVerification && input.caseId))
  ) {
    input.symptom = q;
    input.caseId = '';
    input.code = '';
    return reply(
      '当前现象与前面的故障不同，现有资料还不足以给出对应方案。请补充当前设备型号、告警原文和仍存在的具体表现，我会重新核对，不继续套用先前的故障原因。',
    );
  }
  if (symptomMatches.length && !matchedSymptom && input.device) {
    input.symptom = q;
    input.caseId = '';
    input.code = '';
    return reply(
      `我还没有找到“${input.device}”与这条现象对应的维修资料。请补充型号、告警原文和异常发生时的工况；暂不沿用前一个故障的建议。`,
    );
  }
  if (matchedSymptom) {
    input.symptom = signalText;
    input.caseId = matchedSymptom.id;
    if (!codes[0] && !identityOnly) input.code = '';
  } else if (activeCode && input.device && (identityOnly || codes[0])) {
    input.caseId = activeCode.id;
  } else if (!followup && !device && !models.length && !codes.length) {
    input.symptom = q;
    input.caseId = '';
    input.code = '';
  } else if (
    device &&
    !followup &&
    !identityOnly &&
    !matchedSymptom &&
    !codes.length
  ) {
    input.symptom = '';
    input.caseId = '';
    input.code = '';
  }
  if (!input.device) {
    if (codes[0])
      return reply(
        `在设备手册中，${codes[0].code} 对应 ${codes[0].device} ${codes[0].model} 的“${codes[0].symptom}”。请确认现场设备型号及告警原文，故障码含义需结合适用手册核对，不能仅凭代码认定故障。`,
        [
          ...codes[0].sources.filter(
            (source) => source.documentId === 'maintenance-guide',
          ),
          ...intake,
        ],
      );
    return reply(
      '请先补充设备类型或型号，以及告警原文或具体异常现象。例如：卷绕机 WND-100 换料后张力波动并断箔。仅凭当前描述还不能确定适用哪份维修资料。',
    );
  }
  const example = maintenanceCases.find(
    (item) => item.id === input.caseId && item.device === input.device,
  );
  if (!example)
    return reply(
      `已了解设备是${input.device}${input.model ? ` ${input.model}` : ''}。请补充具体故障现象或告警代码，例如异常表现、何时发生，以及最近是否换料或维修；我不会仅凭设备名称推断故障。`,
    );

  const scope = input.model
    ? `根据你提供的 ${input.device} ${input.model}${input.code ? `、告警 ${input.code}` : ''}，可以参考设备手册中“${example.symptom}”的维修方案。`
    : `你描述的是${input.device}的${example.symptom}。现有相似资料适用于型号 ${example.model}，请补充现场型号确认是否适用。`;
  const cautious =
    '处理动作需根据检查结果选择，不能直接将可能原因当作已确认故障。';
  const wantsPlan =
    /排查|步骤|方案|怎么修|如何修|怎么处理|如何处理|怎么做/.test(q);
  const references = (kinds: string[]) =>
    example.sources.filter((source) => kinds.includes(source.documentId));
  if (
    /已恢复|恢复正常|已解决|解决了|处理结果|反馈/.test(q) &&
    !wantsPlan &&
    !asksVerification
  ) {
    input.observations = [input.observations, q]
      .filter(Boolean)
      .join('\n')
      .slice(-3000);
    return reply(
      '这条处理反馈会随当前对话保留。请继续补充实际检查项、处理动作及复查结果，便于后续复盘；现场恢复使用仍需按规定由负责人确认。当前仅保存对话，未创建或关闭维修工单。',
    );
  }
  if (/仍|还是|已检查|已经检查|检查过/.test(q)) {
    input.observations = [input.observations, q]
      .filter(Boolean)
      .join('\n')
      .slice(-3000);
    if (!wantsPlan && !/备件|配件/.test(q) && !asksVerification)
      return reply(
        `已收到新的排查情况：“${q}”。请结合实际检查结果选择对应处理分支；已经确认正常的项目无需重复处置。\n\n${repairPlanText(example)}\n\n${example.precautions.join(' ')}\n\n请补充实际检查发现与复测结果，以便进一步调整方案。`,
        [...references(['maintenance-guide']), ...intake],
      );
  }
  const partsOnly = /备件|配件|更换什么|换什么/.test(q);
  const historyOnly = /历史|案例|工单/.test(q);
  const causesOnly = /原因|为什么/.test(q);
  const precautionsOnly = /注意|安全/.test(q);
  const verificationOnly = asksVerification;
  if (
    (partsOnly ||
      historyOnly ||
      causesOnly ||
      precautionsOnly ||
      verificationOnly) &&
    !wantsPlan
  )
    return reply(
      [
        scope,
        causesOnly
          ? `${cautious}可能的原因包括：\n\n${list(example.causes)}`
          : '',
        historyOnly
          ? `相似历史工单：${example.history} 历史原因不能直接当作本次故障结论。`
          : '',
        partsOnly
          ? `备件应在检查确认后再核对适配关系：\n\n${partsText(example)}\n\n备件适配以现场铭牌、手册版本和实际部件规格为准。`
          : '',
        precautionsOnly ? `检查时请注意：\n\n${list(example.precautions)}` : '',
        verificationOnly
          ? `修后验证：\n\n${list(example.verification, true)}`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
      references([
        ...(partsOnly ? ['maintenance-parts'] : []),
        ...(historyOnly ? ['maintenance-cases'] : []),
        'maintenance-guide',
      ]),
    );
  if (/依据|引用|来源/.test(q) && !wantsPlan)
    return reply(
      '本次建议参考了对应型号的维修手册、相似历史工单与备件说明。文件和页码列在文末，点击可核对原文；历史处理记录不能直接确定本次故障原因。',
      example.sources,
    );

  return reply(
    [
      `${scope} ${cautious}`,
      `可能的原因包括：\n\n${list(example.causes)}`,
      repairPlanText(example),
      `检查时请注意：${example.precautions.join(' ')}`,
      `如检查指向部件问题，再核对这些备件：\n\n${partsText(example)}`,
      `相似历史工单：${example.history} 该记录仅提供参考，不能据此确定本次根因。`,
      '可以继续补充检查发现和修后验证结果，我会据此调整维修方案。',
    ].join('\n\n'),
    example.sources,
  );
}
