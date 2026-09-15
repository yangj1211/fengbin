'use client';
import { LineChart } from '@/components/tremor/LineChart';
import { ChartWindowControls, useChartWindow } from './chart-window';
import { formatFinal } from './final-data';

export default function FinalSeriesChart({
  items,
  unit,
  label,
}: {
  items: { name: string; value: number }[];
  unit: string;
  label: string;
}) {
  const window = useChartWindow(items, 24, (r) => `${r.name}/${r.value}`);
  if (!items.length)
    return <p className="final-empty">当前范围没有可展示的记录。</p>;
  return (
    <>
      <p className="dashboard-chart-note">{unit}</p>
      <LineChart
        data={window.items.map((r) => ({ 时间: r.name, [label]: r.value }))}
        index="时间"
        categories={[label]}
        colors={['actual']}
        minValue={0}
        showLegend={false}
        yAxisWidth={58}
        valueFormatter={(n) => formatFinal(n, 2)}
        categoryFormatter={(s) =>
          s.replace('2026-', '').replace('T', ' ').replace(':00:00', ':00')
        }
        className="tremor-series-plot tremor-chart"
        aria-label={`${label}，单位${unit}`}
      />
      <ChartWindowControls window={window} label={label} />
    </>
  );
}
