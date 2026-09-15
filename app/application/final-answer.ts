import type { Inputs } from './model';
import { encodeScope, scopeLabel } from './scope';
import {
  energyDates,
  energyProcess,
  energyReference,
  finalSourceLink,
  formatFinal as f,
  getFinalEnergy,
  getFinalProduction,
  normalizeFinalInput,
  processNames,
  productionAbnormal,
  productionDates,
  productionQualityGap,
  productionRecords,
  ratio,
  sumBy,
  taktProductionMachine,
  validFinalDates,
} from './final-data';

export const finalExamples = {
  energy: [
    {
      title: '比较班次单耗',
      question: '比较当前范围A班与B班的生产单耗，说明用电与产量。',
    },
    {
      title: '查看用电异常',
      question: '列出当前范围单耗偏高和零产量用电的班次。',
    },
    {
      title: '估算计划用电',
      question: '计划生产100000件，按历史生产单耗估算用电。',
    },
  ],
  production: [
    {
      title: '生成工序日报',
      question: '生成当前范围的工序生产报告，说明计划、产量、质量与停线。',
    },
    {
      title: '查看停线原因',
      question: '查看当前范围的停线时长，按原因和机台展开。',
    },
    {
      title: '查看时点在制',
      question: '查看当前范围末次统计时点的在制数量，按机台展开。',
    },
  ],
};
function extractInput(
  id: 'energy' | 'production',
  question: string,
  current: Inputs,
) {
  const input: Inputs = { ...normalizeFinalInput(id, current), question };
  const q = question.replace(/，/g, ',');
  const matchDates = [
    ...q.matchAll(
      /(?<![\dA-Za-z-])(?:(20\d{2})[-年/])?(\d{1,2})[-月/](\d{1,2})(?:日|号)?(?!\d)/g,
    ),
  ].map(
    (m) =>
      `${m[1] || '2026'}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`,
  );
  if (matchDates.length) {
    input.dateFrom = matchDates[0];
    input.dateTo = matchDates.at(-1)!;
    input.snapshot = '';
  }
  if (/全部日期|全部历史|全周期|整批|所有日期/.test(q)) {
    const ds = id === 'energy' ? energyDates : productionDates;
    input.dateFrom = ds[0];
    input.dateTo = ds.at(-1)!;
    input.snapshot = '';
  }
  if (/今天|今日|昨天|昨日/.test(q)) {
    const now = new Date();
    const china = new Date(
      now.getTime() + 8 * 3600000 - (/昨天|昨日/.test(q) ? 86400000 : 0),
    );
    input.dateFrom = input.dateTo = china.toISOString().slice(0, 10);
    input.snapshot = '';
  }
  if (/最新.*日|最后.*日/.test(q)) {
    input.dateFrom = input.dateTo = (
      id === 'energy' ? energyDates : productionDates
    ).at(-1)!;
    input.snapshot = '';
  }
  const a = /A\s*班|白班/i.test(q),
    b = /B\s*班|夜班/i.test(q);
  if ((a && b) || /全部班次|所有班次|两班|A\/?B班/i.test(q))
    input.shift = '全部班次';
  else if (a || b) {
    input.shift = a ? 'A' : 'B';
    input.snapshot = '';
  }
  if (id === 'production') {
    const aliases = [
      ['3161', /3161|钉卷|釘卷/],
      ['3162', /3162|组立|組立|套胶/],
      ['3164', /3164|老化|选别/],
    ] as const;
    const matched = aliases.filter(([, pattern]) => pattern.test(q));
    if (matched.length === 1) {
      input.process = processNames.find((p) => p.startsWith(matched[0][0]))!;
      input.machine = '全部机台';
      input.snapshot = '';
    }
    if (matched.length > 1) {
      input.process = encodeScope(
        matched.map(([code]) => processNames.find((p) => p.startsWith(code))!),
        '全部工序',
      );
      input.machine = '全部机台';
      input.snapshot = '';
    }
    if (/全部工序|所有工序|跨工序|各工序/.test(q)) {
      input.process = '全部工序';
      input.machine = '全部机台';
      input.snapshot = '';
    }
    const machines = [...q.matchAll(/\b6[A-Z]+\d+\b/gi)].map((match) =>
      match[0].toUpperCase(),
    );
    if (machines.length) input.machine = encodeScope(machines, '全部机台');
    if (/全部机台|所有机台/.test(q)) input.machine = '全部机台';
    const order = q.match(/SF313-\d+/i);
    if (order) input.order = order[0].toUpperCase();
    const card = q.match(/卡号\s*[：:]?\s*(\d+)/);
    if (card) input.card = card[1];
    if (/全部工单/.test(q)) input.order = '';
    if (/全部卡号/.test(q)) input.card = '';
    if (/末次|最新.*在制|最后.*快照/.test(q)) input.snapshot = '';
  } else {
    const qty = q.match(
      /(?:计划|预计|准备)[^\d+.\-。\n]{0,14}([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(万|千)?\s*(件|只)/,
    );
    if (qty)
      input.plannedProduction = String(
        Number(qty[1].replaceAll(',', '')) *
          (qty[2] === '万' ? 10000 : qty[2] === '千' ? 1000 : 1),
      );
    if (/按小时|小时趋势|逐小时/.test(q)) input.granularity = 'hour';
    else if (/按班次/.test(q)) input.granularity = 'shift';
    else if (/按日|每日|每天/.test(q)) input.granularity = 'day';
    if (/清空计划/.test(q)) input.plannedProduction = '';
    if (/按历史日均|历史产量延续/.test(q)) {
      const days = Number(q.match(/(?:未来|接下来)\s*(\d+)\s*天/)?.[1] || 7);
      input.period = String(days);
      input.plannedProduction = String(
        Math.round(
          (sumBy(getFinalEnergy(input).rows, (r) => r.production) /
            Math.max(
              1,
              new Set(getFinalEnergy(input).rows.map((r) => r.date)).size,
            )) *
            days,
        ),
      );
    }
  }
  return input;
}
const scope = (input: Inputs) =>
  `${input.dateFrom}—${input.dateTo}，${input.shift}${input.shift === '全部班次' ? '' : '班'}，${scopeLabel(input.process, '全部工序')}${input.machine && input.machine !== '全部机台' ? `，机台${scopeLabel(input.machine, '全部机台')}` : ''}${input.order ? `，工单${input.order}` : ''}${input.card ? `，卡号${input.card}` : ''}`;
const percent = (n: number | null) => (n === null ? '无法计算' : `${f(n, 2)}%`);

export function replyToFinalData(
  id: 'energy' | 'production',
  question: string,
  current: Inputs,
) {
  const input = extractInput(id, question, current);
  if (!validFinalDates(input))
    return {
      inputs: normalizeFinalInput(id, current),
      answer: '日期范围无效，请使用完整日期且开始日期不晚于结束日期。',
    };
  if (/能做什么|什么功能|怎么使用|如何使用/.test(question))
    return {
      inputs: input,
      answer:
        id === 'energy'
          ? `可以查看${energyProcess}的用电趋势、A/B班生产单耗、电表电量，定位偏高班次与零产量用电，并按计划件数估算生产用电。当前生产日为${energyDates[0]}至${energyDates.at(-1)}，来源按小时记录用电、按班次记录产量。\n\n参考数据：${finalSourceLink('final-energy-readings')}；${finalSourceLink('final-energy-production')}。`
          : `可以按日期、班次、工序和机台查看计划、报工产量、检验质量、停线原因和指定时点在制数，也可以追溯工单卡号、查看节拍记录、生成工序报告。节拍仅作表内参考，数据核查问题与业务异常分开说明。\n\n参考数据：${finalSourceLink('final-production')}；${finalSourceLink('final-downtime')}；${finalSourceLink('final-wip')}；${finalSourceLink('final-takt')}。`,
    };
  if (id === 'energy') {
    const d = getFinalEnergy(input);
    const parts = [`统计范围：${scope(input)}。`];
    if (!d.rows.length)
      return {
        inputs: input,
        answer: `${parts[0]}当前没有匹配的班次记录。资料覆盖${energyDates[0]}—${energyDates.at(-1)}，没有记录不能解释为零用电。\n\n参考数据：${finalSourceLink('final-energy-readings')}；${finalSourceLink('final-energy-production')}。`,
      };
    const forecast = /估算|预测|计划|预计/.test(question);
    if (forecast)
      parts.push(
        d.estimate === null
          ? '请提供大于或等于0的计划产量（件），例如“计划生产100000件，估算用电”。'
          : `计划生产${f(d.plan)}件，按${input.shift}历史正产量班次参考单耗${f(d.estimateRate, 4)} kWh/千件，估算生产用电${f(d.estimate, 3)} kWh。参考周期${energyDates[0]}—${energyDates.at(-1)}，不含未建模的停产或待机用电；这是产量情景估算。`,
      );
    else
      parts.push(
        `共${d.rows.length}个班次，用电${f(d.total, 3)} kWh，产量${f(d.output)}件。正产量班次加权生产单耗${f(d.unit, 4)} kWh/千件；零产量班次用电${f(d.zeroEnergy, 3)} kWh单列。`,
      );
    if (/班次|A班|B班|白班|夜班|对比|比较/.test(question))
      parts.push(
        ...d.shifts.map((r) => {
          const group = d.rows.filter((row) => row.shift === r.name[0]);
          const positive = group.filter(
            (row) => row.production > 0 && row.complete,
          );
          return `${r.name}：总用电${f(
            sumBy(group, (row) => row.kwh),
            3,
          )} kWh，产量${f(sumBy(group, (row) => row.production))}件；正产量班次用电${f(
            sumBy(positive, (row) => row.kwh),
            3,
          )} kWh，生产单耗${f(r.value, 4)} kWh/千件。零产量用电${f(
            sumBy(
              group.filter((row) => row.production === 0),
              (row) => row.kwh,
            ),
            3,
          )} kWh单列。`;
        }),
      );
    if (/电表/.test(question))
      parts.push(
        ...d.meters.map((r) => `${r.name}：${f(r.value, 3)} kWh。`),
        '电表没有独立产量，电量占比不表示设备效率。',
      );
    if (/趋势|每日/.test(question))
      parts.push(
        d.trend.map((r) => `${r.name}：${f(r.value, 3)} kWh`).join('；') + '。',
      );
    if (/异常|偏高|零产量|为什么|原因|核查/.test(question)) {
      parts.push(
        `偏高提醒使用本批正产量班次加权参考${f(energyReference, 4)} kWh/千件，超过其20%提示。它是历史相对参考，不是客户标准。`,
      );
      parts.push(
        d.issues.length
          ? d.issues
              .map(
                (r) =>
                  `${r.date} ${r.shift}班：${f(r.kwh, 3)} kWh，${f(r.production)}件，${r.production === 0 ? '零产量用电，单耗不可计算' : `单耗${f(r.unit, 4)} kWh/千件，较参考偏高${f((r.unit! / energyReference - 1) * 100, 2)}%`}。生产来源${finalSourceLink('final-energy-production', r.sourceRow)}；用电来源${finalSourceLink('final-energy-readings', r.readings[0]?.sourceRow)}。`,
              )
              .join('\n\n')
          : '当前范围没有触发偏高或零产量用电提醒的班次。',
      );
      parts.push(
        '可先核对班次产量、用电计量和生产安排。现有两表没有设备运行状态、空载记录及处置结果，不能确认浪费、故障原因或处理完成。',
      );
    }
    if (/电费|成本|节省|节能收益|峰谷|需量|功率/.test(question))
      parts.push(
        '本批没有电价、需量或瞬时功率记录，不能计算电费节省或瞬时峰值。小时电量仅表示该小时的用电。',
      );
    parts.push(
      `参考数据：${finalSourceLink('final-energy-readings')}；${finalSourceLink('final-energy-production')}。按生产日归属班次，B班跨午夜仍计入开始所在生产日。`,
    );
    return { inputs: input, answer: parts.join('\n\n') };
  }
  // An explicit clock time selects an actual snapshot even when its calendar day
  // differs from the owning production date. Do not infer an unavailable day.
  const clock = question.match(/(\d{1,2})[:：](\d{2})/);
  if (clock && /在制|快照/.test(question)) {
    const desiredTime = `${clock[1].padStart(2, '0')}:${clock[2]}:00`;
    const candidates = getFinalProduction({ ...input, snapshot: '' }).times;
    const requestedCalendarDate = input.dateFrom;
    const exact = candidates.find(
      (t) => t.startsWith(requestedCalendarDate) && t.endsWith(desiredTime),
    );
    input.snapshot = exact || `${requestedCalendarDate}T${desiredTime}`;
    // Clock and date explicitly name the snapshot; permit the preceding business
    // day only if its snapshot exists, and expose that business day in the scope.
    if (!exact) {
      const all = getFinalProduction({
        ...input,
        dateFrom: productionDates[0],
        dateTo: productionDates.at(-1)!,
        snapshot: input.snapshot,
      });
      if (all.snapshotRows.length)
        input.dateFrom = input.dateTo = all.snapshotRows[0].date;
    }
  }
  const d = getFinalProduction(input),
    parts = [`统计范围：${scope(input)}。`];
  const trace =
    /追溯|其他日期|其他工序|流转/.test(question) && (input.card || input.order);
  if (trace) {
    const traced = productionRecords
      .filter(
        (r) =>
          (!input.order || r.order === input.order) &&
          (!input.card || r.card === input.card),
      )
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.process.localeCompare(b.process),
      );
    parts.push(
      '以下按指定工单卡号跨日期、跨工序追溯，各工序分别列出：',
      ...traced
        .slice(0, 30)
        .map(
          (r) =>
            `${r.date} ${r.shift}班，${r.process}，机台${r.machine}，工单${r.order}，卡号${r.card}：报工${f(r.output)}件、合格${f(r.good)}件、不良${f(r.rejected)}件。${finalSourceLink('final-production', r.sourceRow)}`,
        ),
    );
    if (!traced.length) parts.push('没有找到匹配的生产记录。');
    if (traced.length > 30)
      parts.push(`共${traced.length}条，以上列出前30条，请指定卡号缩小范围。`);
    parts.push(
      '日期为报表业务日，没有实测开工、完工时间，不能据此计算加工或等待时长。',
    );
    return { inputs: input, answer: parts.join('\n\n') };
  }
  if (!d.rows.length && !d.downtime.length && !d.snapshotRows.length)
    return {
      inputs: input,
      answer: `${parts[0]}当前范围没有匹配记录，资料生产日覆盖${productionDates[0]}—${productionDates.at(-1)}。没有记录不表示产量、停线或在制为0。\n\n参考数据：${finalSourceLink('final-production')}。`,
    };
  const wipRequest = /在制|快照/.test(question),
    taktRequest = /节拍|效率|OEE|瓶颈/.test(question),
    stopRequest = /停线|停机|原因/.test(question),
    report = /报告|日报|班报|汇总|综合/.test(question);
  if (report || (!wipRequest && !taktRequest && !stopRequest)) {
    if (report) parts.push('工序生产报告');
    for (const p of d.perProcess) {
      if (!p.records) {
        parts.push(`${p.name}：当前范围无生产记录。`);
        continue;
      }
      parts.push(
        `${p.name}：报表计划${f(p.planned)}件，报工${f(p.output)}件，完成率${percent(p.completion)}，较计划${p.output >= p.planned ? '多' : '少'}${f(Math.abs(p.output - p.planned))}件。检验${f(p.inspected)}件、合格${f(p.good)}件、不良${f(p.rejected)}件，检验良率${percent(p.yield)}、不良率${percent(p.defect)}。`,
      );
      if (p.qualityIssues.length)
        parts.push(
          `该工序含${p.qualityIssues.length}条检验数量待核查记录，质量汇总保留原始数值，不能视为已核对通过。`,
        );
    }
    if (d.perProcess.length > 1)
      parts.push(
        '各工序为不同报工环节，不把跨工序产量相加为成品产量，也不合并为全流程良率。',
      );
    if (/机台|比较|对比|排名/.test(question) && d.singleProcess)
      parts.push(
        ...d.machineGroups.map(
          (r) =>
            `${r.name}：报工${f(r.output)}件，计划完成率${percent(r.completion)}，检验良率${percent(r.yield)}。`,
        ),
      );
  }
  if (report || /异常|不良|质量|核查/.test(question)) {
    const abnormal = d.rows.filter(productionAbnormal);
    parts.push(
      `应用提醒规则：报表计划完成率低于95%，或不良率超过2%；等于阈值不触发。当前${abnormal.length}条生产记录触发提醒。`,
    );
    parts.push(
      ...abnormal
        .slice(0, 12)
        .map(
          (r) =>
            `${r.date} ${r.shift}班 ${r.machine}，工单${r.order}、卡号${r.card}：完成率${percent(ratio(r.output, r.planned))}，不良率${percent(ratio(r.rejected, r.inspected))}。${finalSourceLink('final-production', r.sourceRow)}`,
        ),
    );
    if (abnormal.length > 12)
      parts.push(
        `以上列出前12条，另有${abnormal.length - 12}条。可按日期、班次或机台缩小范围继续查询，完整原始记录可通过文末来源引用分页查看。`,
      );
    parts.push(
      ...d.summary.qualityIssues.map(
        (r) =>
          `${r.date} ${r.shift}班，卡号${r.card}：检验${f(r.inspected)}，合格${f(r.good)}，不良${f(r.rejected)}，差额${f(productionQualityGap(r))}件待核查。${finalSourceLink('final-production', r.sourceRow)}。保留原数，不能将差额自动补入不良。`,
      ),
    );
    if (/不良.*原因|为什么.*不良/.test(question))
      parts.push(
        '生产表没有不良项目和检验原因明细，不能用停线原因直接解释产品不良。',
      );
  }
  if (report || stopRequest) {
    parts.push(
      d.downtime.length
        ? `当前范围${d.downtime.length}次停线，累计${f(d.totalMinutes)}分钟（按机台事件累计）。`
        : '当前范围未匹配到停线记录，不能据此确认机台从未停线。',
    );
    parts.push(...d.stopReasons.map((r) => `${r.name}：${f(r.value)}分钟。`));
    if (stopRequest)
      parts.push(
        ...d.downtime
          .slice(0, 10)
          .map(
            (r) =>
              `${r.id}，${r.machine}，${r.start}至${r.end}，${r.minutes}分钟，${r.reason}。表内处理措施：${r.action}。${finalSourceLink('final-downtime', r.sourceRow)}`,
          ),
      );
    if (/为什么|导致|影响|原因/.test(question))
      parts.push(
        '上述原因来自停线记录；与产量、质量是否存在因果关系仍需结合现场情况核对。',
      );
  }
  if (report || wipRequest) {
    parts.push(`在制统计时点：${d.snapshot || '无可用时点'}。`);
    for (const p of d.perProcess)
      parts.push(
        `${p.name}：${p.wip === null ? '该时点无记录' : `${f(p.wip)}件在制`}。`,
      );
    if (d.singleProcess && wipRequest)
      parts.push(...d.wipMachines.map((r) => `${r.name}：${f(r.value)}件。`));
    parts.push(
      '在制仅汇总同一时点已记录的工序范围，不跨日期累计，也不把缺少快照视为0。',
    );
  }
  if (taktRequest) {
    parts.push(
      `当前匹配${d.takt.length}条节拍记录，其中${d.takt.filter((r) => r.calculationIssue).length}条算术口径待核查，${d.takt.filter((r) => r.machineMismatch).length}条机台编码与生产表不同。`,
    );
    parts.push(
      ...d.takt
        .slice(0, 8)
        .map(
          (r) =>
            `${r.date} ${r.shift}班，报工机台${taktProductionMachine(r)}，节拍表机台${r.machine}，工单${r.order}、卡号${r.card}：标准值${f(r.standardRate, 4)}、表内实际值${f(r.rate, 4)}，标准产量${f(r.standardQuantity, 3)}、表内实际产量${f(r.quantity)}。${r.calculationIssue ? '本条计算待核查。' : ''}${finalSourceLink('final-takt', r.sourceRow)}`,
        ),
    );
    parts.push(
      '表内公式对应件/分钟，但最终表头未注明单位，且没有实测运行时间。节拍表的实际产量对应生产表检验数，不能替代报工产量。不能据此给出实测设备效率、OEE或确定的瓶颈结论。',
    );
  }
  if (/交期|交付|订单完成|出货/.test(question))
    parts.push(
      '报表计划完成率不是客户订单交付进度，本批没有订单交期或出货记录。',
    );
  const sources = [
    'final-production',
    ...(stopRequest || report ? ['final-downtime'] : []),
    ...(wipRequest || report ? ['final-wip'] : []),
    ...(taktRequest ? ['final-takt'] : []),
  ];
  parts.push(
    `参考数据：${sources.map((id) => finalSourceLink(id)).join('；')}。`,
  );
  return {
    inputs: { ...input, snapshot: d.snapshot },
    answer: parts.join('\n\n'),
  };
}
