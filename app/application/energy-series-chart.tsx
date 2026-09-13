'use client';
import { useId } from 'react';
import { AreaChart } from '@/components/tremor/AreaChart';
import { LineChart } from '@/components/tremor/LineChart';
import { ChartWindowControls, useChartWindow } from './chart-window';

const f = (value: number) =>
  value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
export default function EnergySeriesChart({
  points,
  forecast = false,
  title,
}: {
  points: { label: string; value: number; reference?: number }[];
  forecast?: boolean;
  title?: string;
}) {
  const descriptionId = useId();
  const chartWindow = useChartWindow(
    points,
    31,
    (point) => `${point.label}/${point.value}/${point.reference ?? ''}`,
  );
  const data = chartWindow.items.map((point) => ({
    日期: point.label,
    [forecast ? '累计预测' : '用电量']: point.value,
    历史产量延续: point.reference ?? 0,
  }));
  const categories = forecast ? ['累计预测', '历史产量延续'] : ['用电量'];
  const max =
    points.reduce(
      (highest, point) => Math.max(highest, point.value, point.reference ?? 0),
      1,
    ) * 1.2;
  const shared = {
    data,
    index: '日期',
    categories,
    colors: forecast
      ? (['actual', 'reference'] as const)
      : (['actual'] as const),
    minValue: 0,
    maxValue: max,
    valueFormatter: f,
    categoryFormatter: (value: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? value.slice(5).replace('-', '/')
        : value,
    showLegend: false,
    yAxisWidth: 48,
    tickGap: 28,
    className: 'tremor-series-plot tremor-chart',
    'aria-describedby': descriptionId,
  };
  if (!points.length)
    return <p className="dashboard-chart-note">当前范围没有可展示的记录。</p>;
  return (
    <>
      <div className={`energy-series-view${forecast ? ' is-forecast' : ''}`}>
        <span className="chart-unit">MWh</span>
        {forecast ? (
          <LineChart
            {...shared}
            colors={['actual', 'reference']}
            strokeDasharray="6 4"
          />
        ) : (
          <AreaChart {...shared} colors={['actual']} fill="gradient" />
        )}
      </div>
      <ChartWindowControls
        window={chartWindow}
        label={forecast ? '用电预测' : '能耗趋势'}
      />
      <ul
        id={descriptionId}
        className="sr-only"
        aria-label={
          title ??
          (forecast ? '累计用电基础预测，单位 MWh' : '用电趋势，单位 MWh')
        }
      >
        {chartWindow.items.map((point) => (
          <li key={point.label}>
            {point.label}：{f(point.value)} MWh
            {point.reference === undefined
              ? ''
              : `，历史产量延续时 ${f(point.reference)} MWh`}
          </li>
        ))}
      </ul>
    </>
  );
}
