'use client';
import { useId } from 'react';
import { BarChart } from '@/components/tremor/BarChart';
import { BarList } from '@/components/tremor/BarList';
import { DonutChart } from '@/components/tremor/DonutChart';
import { numberLabel as f } from './dashboard-data';
import {
  ChartWindowControls,
  shortChartLabel,
  useChartWindow,
} from './chart-window';

export type ChartItem = {
  name: string;
  value: number;
  comparison?: number;
  warning?: boolean;
  comparisonWarning?: boolean;
};
const warning = 'var(--dashboard-warning)';

function Legend({
  labels,
  planned = false,
}: {
  labels: string[];
  planned?: boolean;
}) {
  return (
    <div className="dashboard-chart-legend">
      {labels.map((label, index) => (
        <span key={label}>
          <i className={index ? (planned ? 'planned' : 'muted') : ''} />
          {label}
        </span>
      ))}
    </div>
  );
}

export function ProductionChart({
  items,
  onSelect,
}: {
  items: ChartItem[];
  onSelect: (name: string) => void;
}) {
  const descriptionId = useId();
  const window = useChartWindow(items, 6, (item) => item.name);
  const visible = window.items;
  return (
    <>
      <Legend labels={['实际产量', '计划产量']} planned />
      <div className="chart-unit-row">
        <span>万只</span>
        {items.some((item) => item.warning) && (
          <span>
            <i />
            需关注产线
          </span>
        )}
      </div>
      <BarChart
        className="tremor-chart dashboard-bar-chart"
        data={visible.map((item) => ({
          name: item.name,
          实际产量: item.value,
          计划产量: item.comparison ?? 0,
          warning: item.warning,
        }))}
        index="name"
        categoryFormatter={shortChartLabel}
        categories={['实际产量', '计划产量']}
        colors={['actual', 'planned']}
        showLegend={false}
        showValueLabels
        minValue={0}
        maxValue={
          items.reduce(
            (max, item) => Math.max(max, item.value, item.comparison ?? 0),
            1,
          ) * 1.2
        }
        valueFormatter={(v) => f(v, 2)}
        yAxisWidth={40}
        barCategoryGap="24%"
        enableLegendInteraction={false}
        barColor={(item, category) =>
          category === '实际产量' && item.warning ? warning : undefined
        }
        onValueChange={(event) => {
          if (event?.eventType === 'bar' && typeof event.name === 'string')
            onSelect(event.name);
        }}
        aria-describedby={descriptionId}
      />
      <p className="dashboard-chart-note">点击柱形查看产线明细</p>
      <ChartWindowControls window={window} label="产线计划与实际" />
      <ul id={descriptionId} className="sr-only">
        {visible.map((item) => (
          <li key={item.name}>
            {item.name}：实际 {f(item.value, 2)} 万只，计划{' '}
            {f(item.comparison ?? 0, 2)} 万只{item.warning ? '，需关注' : ''}
          </li>
        ))}
      </ul>
    </>
  );
}

export function ComparisonChart({
  items,
  labels,
  unit,
  onSelect,
  maxValue,
}: {
  items: ChartItem[];
  labels: string[];
  unit: string;
  onSelect?: (name: string) => void;
  maxValue?: number;
}) {
  const id = useId();
  const window = useChartWindow(items, 6, (item) => item.name);
  const categories = items.some((item) => item.comparison !== undefined)
    ? labels
    : labels.slice(0, 1);
  return (
    <>
      <Legend labels={categories} />
      <div className="chart-unit-row">
        <span>{unit}</span>
      </div>
      <BarChart
        className="tremor-chart dashboard-comparison-chart"
        data={window.items.map((item) => ({
          name: item.name,
          [labels[0]]: item.value,
          [labels[1] ?? '参考值']: item.comparison,
          warning: item.warning,
          comparisonWarning: item.comparisonWarning,
        }))}
        index="name"
        categoryFormatter={shortChartLabel}
        categories={categories}
        colors={['actual', 'reference']}
        layout="vertical"
        showLegend={false}
        minValue={0}
        maxValue={
          maxValue ??
          items.reduce(
            (max, item) => Math.max(max, item.value, item.comparison ?? 0),
            1,
          ) * 1.12
        }
        valueFormatter={(v) => f(v, 2)}
        yAxisWidth={84}
        barCategoryGap="24%"
        enableLegendInteraction={false}
        barColor={(item, category) =>
          (category === labels[0] ? item.warning : item.comparisonWarning)
            ? warning
            : undefined
        }
        onValueChange={
          onSelect
            ? (event) => {
                if (
                  event?.eventType === 'bar' &&
                  typeof event.name === 'string'
                )
                  onSelect(event.name);
              }
            : undefined
        }
        aria-describedby={id}
      />
      <ChartWindowControls window={window} label={labels.join('与')} />
      <ul id={id} className="sr-only">
        {window.items.map((item) => (
          <li key={item.name}>
            {item.name}：{labels[0]} {f(item.value, 2)} {unit}；{labels[1]}{' '}
            {f(item.comparison ?? 0, 2)} {unit}
            {item.warning || item.comparisonWarning ? '，需关注' : ''}
          </li>
        ))}
      </ul>
    </>
  );
}

export function SupplierRanking({
  items,
  onSelect,
}: {
  items: ChartItem[];
  onSelect: (name: string) => void;
}) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const window = useChartWindow(sorted, 6, (item) => item.name);
  return (
    <>
      <div className="supplier-ranking-scale">
        <span>综合评分</span>
        <span>满分 100</span>
      </div>
      <BarList
        className={`tremor-bar-list supplier-ranking-list${window.pageCount > 1 ? ' is-windowed' : ''}`}
        maxValue={100}
        data={window.items.map((item) => ({
          ...item,
          color: item.warning
            ? 'color-mix(in srgb,var(--dashboard-warning) 26%,transparent)'
            : 'color-mix(in srgb,var(--dashboard-accent) 26%,transparent)',
        }))}
        valueFormatter={(v) => `${f(v, 1)} 分`}
        onValueChange={(item) => onSelect(item.name)}
        showAnimation={false}
      />
      <p className="dashboard-chart-note">
        按综合评分排序 · 点击供应商查看评估明细
      </p>
      <ChartWindowControls window={window} label="供应商综合评分" />
    </>
  );
}

export function DowntimeChart({ items }: { items: ChartItem[] }) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const window = useChartWindow(sorted, 6, (item) => item.name);
  return (
    <>
      <div className="downtime-total">
        <strong>{f(items.reduce((sum, item) => sum + item.value, 0))}</strong>
        <span>分钟累计停机</span>
      </div>
      <BarList
        className={`tremor-bar-list downtime-bar-list${window.pageCount > 1 ? ' is-windowed' : ''}`}
        data={window.items}
        maxValue={sorted[0]?.value ?? 0}
        valueFormatter={(v) => `${f(v)} min`}
        showAnimation={false}
      />
      <p className="dashboard-chart-note">按停机时长从高到低排列</p>
      <ChartWindowControls window={window} label="停机时长分布" />
    </>
  );
}

export function SupplierRiskDistribution({
  items,
}: {
  items: { delivery: boolean; quality: boolean }[];
}) {
  const groups = [
    {
      name: '未触发风险',
      value: items.filter((item) => !item.delivery && !item.quality).length,
      color: 'var(--dashboard-accent)',
    },
    {
      name: '仅交付风险',
      value: items.filter((item) => item.delivery && !item.quality).length,
      color: 'var(--dashboard-planned)',
    },
    {
      name: '仅质量风险',
      value: items.filter((item) => !item.delivery && item.quality).length,
      color: 'var(--dashboard-reference)',
    },
    {
      name: '交付与质量风险',
      value: items.filter((item) => item.delivery && item.quality).length,
      color: warning,
    },
  ];
  return (
    <div className="supplier-risk-distribution">
      <div className="risk-donut-wrap">
        <DonutChart
          className="tremor-chart risk-donut"
          data={groups}
          category="name"
          value="value"
          colors={['actual', 'planned', 'reference', 'warning']}
          valueFormatter={(v) => `${v} 家`}
          aria-label={`供应风险分布：${groups.map((group) => `${group.name} ${group.value} 家`).join('，')}`}
        />
        <div className="risk-donut-center" aria-hidden="true">
          <strong>{items.length}</strong>
          <span>家供应商</span>
        </div>
      </div>
      <div className="risk-distribution-legend">
        {groups.map((group) => (
          <div key={group.name}>
            <i style={{ background: group.color }} />
            <span>{group.name}</span>
            <strong>{group.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
