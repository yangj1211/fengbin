import {
  analyze,
  type Dataset,
  type Inputs,
  type ModuleId,
  type Row,
} from './model';
import { belowProductionThreshold as belowProduction } from './production-metrics';
import { supplierRisk } from './supplier-metrics';
import { withFixedRules } from './fixed-rules';
import { filterScope, normalizeScopeName } from './scope';
export type DashboardId = 'energy' | 'production' | 'supplier';
export const hasDashboard = (id: ModuleId): id is DashboardId =>
  id === 'energy' || id === 'production' || id === 'supplier';
export const numberLabel = (value: number, digits = 1) =>
  value.toLocaleString('zh-CN', { maximumFractionDigits: digits });
const compactNumber = new Intl.NumberFormat('zh-CN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
export const chartNumber = (value: number, digits = 1) =>
  Math.abs(value) >= 1e12
    ? value.toExponential(0)
    : Math.abs(value) >= 10000
      ? compactNumber.format(value)
      : numberLabel(value, digits);
const n = (r: Row, key: string) => Number(r[key]);
const sum = (rows: Row[], key: string) =>
  rows.reduce((s, r) => s + n(r, key), 0);
export function buildDashboard(
  id: DashboardId,
  dataset: Dataset,
  input: Inputs,
) {
  input = withFixedRules(id, input);
  const field =
    id === 'energy' ? '工序' : id === 'production' ? '产线' : '供应商';
  const scopeKey =
    id === 'energy' ? 'process' : id === 'production' ? 'line' : 'supplier';
  const all =
    id === 'energy'
      ? '全部工序'
      : id === 'production'
        ? '全部产线'
        : '全部供应商';
  const rows = filterScope(
    dataset.rows,
    input[scopeKey],
    all,
    (row) => String(row[field]),
    id === 'supplier'
      ? (name) => normalizeScopeName(name).replace(/^供应商/, '')
      : normalizeScopeName,
  );
  const analysis = analyze(id, input, dataset);
  const issues = rows.flatMap((r) => {
    const name = String(r[field]);
    const reasons: string[] = [];
    if (id === 'energy') {
      const deviation =
        (n(r, '用电量(kWh)') / n(r, '产量(千只)') / n(r, '基准单耗(kWh/千只)') -
          1) *
        100;
      if (
        n(r, '用电量(kWh)') / n(r, '产量(千只)') >
        n(r, '基准单耗(kWh/千只)') * 1.05
      )
        reasons.push(`单位电耗高于基准 ${numberLabel(deviation)}%`);
    } else if (id === 'production') {
      const completion =
        (n(r, '实际产量(万只)') / n(r, '计划产量(万只)')) * 100;
      const defect = (n(r, '不良数量') / n(r, '检验数量')) * 100;
      if (
        belowProduction(
          n(r, '实际产量(万只)') * 100,
          n(r, '计划产量(万只)') * Number(input.completion),
        )
      )
        reasons.push(
          `完成率 ${numberLabel(completion)}%，低于 ${input.completion}% 目标`,
        );
      if (
        belowProduction(
          n(r, '检验数量') * Number(input.defect),
          n(r, '不良数量') * 100,
        )
      )
        reasons.push(
          `不良率 ${numberLabel(defect, 2)}%，超过 ${input.defect}% 上限`,
        );
    } else {
      const risk = supplierRisk(r, input);
      if (risk.delivery)
        reasons.push(
          `交付及时率 ${numberLabel(n(r, '交付及时率(%)'))}%，低于 ${input.deliveryTarget}% 目标`,
        );
      if (risk.quality)
        reasons.push(
          `来料合格率 ${numberLabel(n(r, '来料合格率(%)'))}%，低于 ${input.qualityTarget}% 目标`,
        );
    }
    return reasons.length
      ? [
          {
            name,
            row: r,
            detail: reasons.join('；'),
            inputs: { ...input, [scopeKey]: name },
            question: `请分析${name}的${id === 'energy' ? '能耗异常，给出优化建议' : id === 'production' ? '生产异常，给出排查建议' : '交付与质量风险，给出改善建议'}。`,
          },
        ]
      : [];
  });
  const energyTotal = sum(rows, '用电量(kWh)');
  const actual = sum(rows, '实际产量(万只)');
  const planned = sum(rows, '计划产量(万只)');
  const inspected = sum(rows, '检验数量');
  const rejected = sum(rows, '不良数量');
  const metrics =
    id === 'energy'
      ? [
          {
            label: '统计用电量',
            value: numberLabel(energyTotal / 1000),
            unit: 'MWh',
            detail: `${rows.length} 个工序 · 按 7 天统计`,
          },
          {
            label: '情景预测用电',
            value: numberLabel(
              (((energyTotal / 1000) * Number(input.period)) / 7) *
                (1 + Number(input.change) / 100),
            ),
            unit: 'MWh',
            detail: `未来 ${input.period} 天 · 产量变化 ${input.change}%`,
          },
          {
            label: '基准以上电耗',
            value: numberLabel(
              rows.reduce(
                (s, r) =>
                  s +
                  Math.max(
                    0,
                    n(r, '用电量(kWh)') -
                      n(r, '产量(千只)') * n(r, '基准单耗(kWh/千只)'),
                  ),
                0,
              ) / 1000,
            ),
            unit: 'MWh',
            detail: '各工序高于基准部分之和',
          },
          {
            label: '异常工序',
            value: String(issues.length),
            unit: '个',
            detail: '单耗高于基准 5%',
            warning: issues.length > 0,
          },
        ]
      : id === 'production'
        ? [
            {
              label: '实际产量',
              value: numberLabel(actual),
              unit: '万只',
              detail: `计划 ${numberLabel(planned)} 万只`,
            },
            {
              label: '计划完成率',
              value: planned ? numberLabel((actual / planned) * 100, 2) : '—',
              unit: '%',
              detail: `目标 ≥ ${input.completion}%`,
              warning:
                planned > 0 &&
                belowProduction(
                  actual * 100,
                  planned * Number(input.completion),
                ),
            },
            {
              label: '检验良率',
              value: inspected
                ? numberLabel((1 - rejected / inspected) * 100, 2)
                : '—',
              unit: '%',
              detail: '按检验数量加权',
            },
            {
              label: '累计停机',
              value: numberLabel(sum(rows, '停机时长(min)')),
              unit: 'min',
              detail: `${rows.length} 条产线汇总`,
            },
            {
              label: '异常产线',
              value: String(issues.length),
              unit: '条',
              detail: '产量或质量指标未达标',
              warning: issues.length > 0,
            },
          ]
        : [
            {
              label: '评估供应商',
              value: String(rows.length),
              unit: '家',
              detail: '当前评估范围',
            },
            {
              label: '平均综合评分',
              value: rows.length
                ? numberLabel(
                    analysis.bars.reduce((s, b) => s + b.value, 0) /
                      rows.length,
                  )
                : '—',
              unit: '分',
              detail: '各供应商综合评分的算术平均',
            },
            {
              label: '交付风险',
              value: String(
                rows.filter((r) => supplierRisk(r, input).delivery).length,
              ),
              unit: '家',
              detail: `及时率低于 ${input.deliveryTarget}%`,
              warning: rows.some((r) => supplierRisk(r, input).delivery),
            },
            {
              label: '质量风险',
              value: String(
                rows.filter((r) => supplierRisk(r, input).quality).length,
              ),
              unit: '家',
              detail: `合格率低于 ${input.qualityTarget}%`,
              warning: rows.some((r) => supplierRisk(r, input).quality),
            },
          ];
  return { analysis, rows, issues, metrics, field, scopeKey, all, energyTotal };
}
