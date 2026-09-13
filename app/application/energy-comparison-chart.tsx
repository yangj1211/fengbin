'use client';
import { useId } from 'react';
import { BarChart } from '@/components/tremor/BarChart';
import type { EnergyDetailAnalysis } from './energy-data';
import {
  ChartWindowControls,
  shortChartLabel,
  useChartWindow,
} from './chart-window';
const f = (value: number, digits = 2) =>
  value.toLocaleString('zh-CN', { maximumFractionDigits: digits });
export default function EnergyComparisonChart({
  items,
  label = '产线对比',
}: {
  items: EnergyDetailAnalysis['lines'];
  label?: string;
}) {
  const descriptionId = useId();
  const chartWindow = useChartWindow(items, 6, (item) => item.name);
  const max =
    items.reduce(
      (highest, item) => Math.max(highest, item.unit, item.baseline),
      1,
    ) * 1.2;
  if (!items.length)
    return <p className="dashboard-chart-note">当前范围没有可对比的记录。</p>;
  return (
    <div className="energy-group-comparison">
      <div className="energy-comparison-legend">
        <div className="dashboard-chart-legend">
          <span>
            <i />
            实际单耗
          </span>
          <span>
            <i className="muted" />
            基准单耗
          </span>
        </div>
        <span className="energy-comparison-unit">kWh/千只</span>
      </div>
      <BarChart
        className="energy-comparison-plot tremor-chart"
        data={chartWindow.items.map((item) => ({
          ...item,
          实际单耗: item.unit,
          基准单耗: item.baseline,
        }))}
        index="name"
        categories={['实际单耗', '基准单耗']}
        colors={['actual', 'reference']}
        showLegend={false}
        showValueLabels
        minValue={0}
        maxValue={max}
        categoryFormatter={shortChartLabel}
        valueFormatter={(value) => f(value, 1)}
        yAxisWidth={40}
        barCategoryGap="25%"
        aria-describedby={descriptionId}
        customTooltip={({ active, payload }) => {
          const name = payload?.[0]?.payload?.name;
          const item = chartWindow.items.find((row) => row.name === name);
          if (!active || !item) return null;
          return (
            <div className="energy-comparison-tooltip">
              <strong>{item.name}</strong>
              <dl>
                <div>
                  <dt>实际单耗</dt>
                  <dd>{f(item.unit)} kWh/千只</dd>
                </div>
                <div>
                  <dt>基准单耗</dt>
                  <dd>{f(item.baseline)} kWh/千只</dd>
                </div>
                <div>
                  <dt>用电量</dt>
                  <dd>{f(item.total / 1000)} MWh</dd>
                </div>
                <div>
                  <dt>产量</dt>
                  <dd>{f(item.production, 3)} 千只</dd>
                </div>
              </dl>
            </div>
          );
        }}
      />
      <ChartWindowControls window={chartWindow} label={label} />
      <ul id={descriptionId} className="sr-only">
        {chartWindow.items.map((item) => (
          <li key={item.name}>
            {item.name}：实际单耗 {f(item.unit)}、基准 {f(item.baseline)}{' '}
            kWh/千只；用电 {f(item.total / 1000)} MWh，产量{' '}
            {f(item.production, 3)} 千只。
          </li>
        ))}
      </ul>
    </div>
  );
}
