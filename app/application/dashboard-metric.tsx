'use client';
import { lazy, Suspense } from 'react';
import { CircleAlert, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/tremor/Card';
import { ProgressCircle } from '@/components/tremor/ProgressCircle';

const SparkLineChart = lazy(() =>
  import('@/components/tremor/SparkChart').then((m) => ({
    default: m.SparkLineChart,
  })),
);

export default function DashboardMetric({
  label,
  value,
  unit,
  detail,
  warning = false,
  icon: Icon,
  progress,
  trend,
}: {
  label: string;
  value: string | number;
  unit: string;
  detail?: string;
  warning?: boolean;
  icon: LucideIcon;
  progress?: number;
  trend?: number[];
}) {
  const validProgress =
    progress !== undefined &&
    Number.isFinite(progress) &&
    progress >= 0 &&
    progress <= 100;
  return (
    <Card className={`dashboard-kpi${warning ? ' needs-attention' : ''}`}>
      <span className="dashboard-kpi-label">
        <span>{label}</span>
        {warning ? (
          <CircleAlert size={17} aria-hidden="true" />
        ) : (
          <Icon size={17} aria-hidden="true" />
        )}
      </span>
      <div className="dashboard-kpi-value">
        <strong>
          {value}
          <small>{unit}</small>
        </strong>
        {validProgress ? (
          <span className="dashboard-kpi-progress" aria-hidden="true">
            <ProgressCircle
              value={progress}
              radius={22}
              strokeWidth={3}
              showAnimation={false}
            />
          </span>
        ) : trend && trend.length > 1 ? (
          <div className="dashboard-kpi-spark" aria-hidden="true">
            <Suspense fallback={null}>
              <SparkLineChart
                data={trend.map((value, index) => ({ index, value }))}
                index="index"
                categories={['value']}
                colors={['actual']}
                autoMinValue
                className="size-full"
              />
            </Suspense>
          </div>
        ) : null}
      </div>
      {detail && <p>{detail}</p>}
    </Card>
  );
}
