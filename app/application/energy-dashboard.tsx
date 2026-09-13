'use client';
import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { AlertTriangle, Gauge, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  defaultInputs,
  validateInputs,
  type Dataset,
  type Inputs,
} from './model';
import { energyDetailAnalysis, energyPointThreshold } from './energy-data';
import { AgentIdentity } from './identity';
import DashboardChatEntry from './dashboard-chat-entry';
import { Choice, DataTable } from './ui';
import DetailExport from './detail-export';
import ListPagination from './list-pagination';
import DashboardMetric from './dashboard-metric';
import { scopeLabel } from './scope';

const GroupComparison = lazy(() => import('./energy-comparison-chart'));
const SeriesPlot = lazy(() => import('./energy-series-chart'));
function LinePlot(props: React.ComponentProps<typeof SeriesPlot>) {
  return (
    <Suspense
      fallback={
        <div className="energy-comparison-loading" role="status">
          正在加载图表…
        </div>
      }
    >
      <SeriesPlot {...props} />
    </Suspense>
  );
}

const f = (n: number, digits = 1) =>
  n.toLocaleString('zh-CN', { maximumFractionDigits: digits });
function Panel({
  title,
  description,
  children,
  action,
  className = '',
}: {
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`dashboard-panel ${className}`}>
      <div className="dashboard-panel-heading">
        <div className="energy-panel-title">
          <h2>{title}</h2>
          {action}
        </div>
        <p>{description}</p>
      </div>
      {children}
    </section>
  );
}
export default function EnergyDashboard({
  dataset,
  input: controlled,
  onInputChange,
  onOpenChat,
}: {
  dataset: Dataset;
  input?: Inputs;
  onInputChange?: Dispatch<SetStateAction<Inputs>>;
  onOpenChat: () => boolean;
}) {
  const [local, setLocal] = useState<Inputs>({ ...defaultInputs.energy });
  const input = controlled ?? local;
  const setInput = onInputChange ?? setLocal;
  const data = energyDetailAnalysis(dataset, input)!;
  const [plan, setPlan] = useState(input.plannedProduction || '');
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState(data.rangeStart);
  const [dateTo, setDateTo] = useState(data.rangeEnd);
  const [dateError, setDateError] = useState('');
  const [anomalyPage, setAnomalyPage] = useState(1);
  const [anomalyPageSize, setAnomalyPageSize] = useState(10);
  const anomalyTableId = useId();
  useEffect(() => {
    setAnomalyPage(1);
  }, [input.process, input.line, input.dateFrom, input.dateTo, dataset]);
  useEffect(() => {
    setPlan(input.plannedProduction || '');
    setError('');
  }, [input.plannedProduction, input.change]);
  useEffect(() => {
    setDateFrom(data.rangeStart);
    setDateTo(data.rangeEnd);
    setDateError('');
  }, [data.rangeStart, data.rangeEnd]);
  const updateScope = (scope: Inputs) => {
    setInput((previous) => ({
      ...previous,
      ...scope,
      plannedProduction: '',
      change: '0',
    }));
    setPlan('');
    setError('');
  };
  const updateDates = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
    const next = { ...input, dateFrom: from, dateTo: to };
    const problem =
      !from || !to ? '请选择完整的起止日期。' : validateInputs('energy', next);
    setDateError(problem ? `${problem} 仍显示上次选择的范围。` : '');
    if (!problem) updateScope({ dateFrom: from, dateTo: to });
  };
  const anomalyPageCount = Math.max(
    1,
    Math.ceil(data.issues.length / anomalyPageSize),
  );
  const currentAnomalyPage = Math.min(anomalyPage, anomalyPageCount);
  const anomalyOffset = (currentAnomalyPage - 1) * anomalyPageSize;
  const anomalyColumns = [
    '日期',
    '产线',
    '班次',
    '工序',
    '用电量\n(kWh)',
    '产量\n(千只)',
    '实际单耗\n(kWh/千只)',
    '基准单耗\n(kWh/千只)',
    '偏高比例',
    '核查建议',
  ];
  const anomalyRows = data.issues.map((row) => [
    row.date,
    row.line,
    row.shift,
    row.process,
    f(row.kwh, 2),
    f(row.production, 3),
    f(row.unit, 2),
    f(row.baseline, 2),
    `+${f(row.deviation)}%`,
    '核对该班次产量与用电记录，再检查装载率及空载时长。',
  ]);
  const visibleAnomalies = anomalyRows.slice(
    anomalyOffset,
    anomalyOffset + anomalyPageSize,
  );
  const processOptions = [
    '全部工序',
    ...new Set(dataset.energyDetails!.map((r) => r.process)),
  ];
  const lineOptions = [
    '全部产线',
    ...new Set(dataset.energyDetails!.map((r) => r.line)),
  ];
  const peak = data.daily.reduce(
    (highest, row) => (row.total > (highest?.total ?? -1) ? row : highest),
    data.daily[0],
  );
  const grainLabel = { day: '日', month: '月', year: '年' }[
    data.trendGranularity
  ];
  const scope = `${scopeLabel(input.process, '全部工序')} · ${scopeLabel(input.line, '全部产线')}`;
  const referenceLabel =
    data.forecastSource === 'plan'
      ? '按手动计划估算'
      : data.forecastSource === 'change'
        ? `按对话设定的产量${data.productionChange >= 0 ? '增加' : '减少'} ${f(Math.abs(data.productionChange))}% 估算`
        : '按历史产量延续';
  return (
    <div className="business-dashboard dashboard-energy energy-detailed">
      <div className="dashboard-heading">
        <div className="dashboard-heading-copy">
          <AgentIdentity id="energy" />
          <div>
            <span className="dashboard-eyebrow">能源管理 / 业务看板</span>
            <h1>能源预测与优化</h1>
            <p>
              数据周期：{data.availableStart} — {data.availableEnd}
            </p>
          </div>
        </div>
        <DashboardChatEntry onClick={onOpenChat} />
      </div>
      <div className="dashboard-toolbar energy-simple-toolbar">
        <div
          className="energy-date-range"
          role="group"
          aria-label="统计日期范围"
        >
          <div className="app-field">
            <Label htmlFor="energy-date-from">开始日期</Label>
            <Input
              id="energy-date-from"
              type="date"
              value={dateFrom}
              aria-invalid={Boolean(dateError)}
              aria-describedby={dateError ? 'energy-date-error' : undefined}
              onChange={(event) => updateDates(event.target.value, dateTo)}
            />
          </div>
          <span aria-hidden="true">—</span>
          <div className="app-field">
            <Label htmlFor="energy-date-to">结束日期</Label>
            <Input
              id="energy-date-to"
              type="date"
              value={dateTo}
              aria-invalid={Boolean(dateError)}
              aria-describedby={dateError ? 'energy-date-error' : undefined}
              onChange={(event) => updateDates(dateFrom, event.target.value)}
            />
          </div>
        </div>
        <Choice
          label="工序"
          name="energy-process"
          value={input.process}
          options={processOptions}
          multiple
          allLabel="全部工序"
          searchable
          searchPlaceholder="搜索工序"
          onChange={(process) => updateScope({ process })}
        />
        <Choice
          label="产线"
          name="energy-line"
          value={input.line || '全部产线'}
          options={lineOptions}
          multiple
          allLabel="全部产线"
          searchable
          searchPlaceholder="搜索产线"
          onChange={(line) => updateScope({ line })}
        />
        <span className="dashboard-source">
          {data.days} 天有记录 · 共 {data.rows.length} 条
        </span>
      </div>
      {dateError && (
        <p id="energy-date-error" className="energy-input-error" role="alert">
          {dateError}
        </p>
      )}
      {data.rows.length > 0 && data.days < data.calendarDays && (
        <p className="energy-filter-note">
          所选 {data.rangeStart} — {data.rangeEnd} 中，仅 {data.days}{' '}
          天有记录。以下按已有记录统计，缺失日期不计为 0。
        </p>
      )}
      {!data.rows.length ? (
        <p className="energy-coverage-note">
          {data.rangeStart} — {data.rangeEnd} 的{scope}
          没有记录，请调整日期、工序或产线。
        </p>
      ) : (
        <>
          <div className="dashboard-metrics metrics-3">
            <DashboardMetric
              label="统计用电量"
              value={f(data.total / 1000)}
              unit="MWh"
              detail={`${data.days} 天用电记录`}
              icon={Zap}
              trend={data.daily.map((day) => day.total)}
            />
            <DashboardMetric
              label="单位产量电耗"
              value={f(data.unit, 2)}
              unit="kWh/千只"
              detail={`基准 ${f(data.baseline, 2)} · 同批产量不重复计算`}
              icon={Gauge}
            />
            <DashboardMetric
              label="异常点"
              value={data.issues.length}
              unit="个"
              detail={`单条单耗高于基准 ${energyPointThreshold}%`}
              icon={AlertTriangle}
              warning={data.issues.length > 0}
            />
          </div>
          <div className="dashboard-chart-grid energy-analysis-grid energy-overview-grid">
            <Panel
              title="能耗趋势"
              className="energy-trend-panel"
              description={`${data.rangeStart} — ${data.rangeEnd} · ${scope}`}
              action={
                <Select
                  value={data.trendGranularity}
                  items={[
                    { value: 'day', label: '按日' },
                    { value: 'month', label: '按月' },
                    { value: 'year', label: '按年' },
                  ]}
                  onValueChange={(value) => {
                    if (value)
                      setInput((previous) => ({
                        ...previous,
                        granularity: value,
                      }));
                  }}
                >
                  <SelectTrigger aria-label="能耗趋势统计粒度">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">按日</SelectItem>
                    <SelectItem value="month">按月</SelectItem>
                    <SelectItem value="year">按年</SelectItem>
                  </SelectContent>
                </Select>
              }
            >
              <LinePlot
                title={`按${grainLabel}汇总用电量，来自已有的 ${data.days} 天记录`}
                points={data.trend.map((row) => ({
                  label: row.name,
                  value: row.total / 1000,
                }))}
              />
              <p className="dashboard-chart-note">
                {data.trendGranularity === 'day'
                  ? `日均 ${f(data.average / 1000, 2)} MWh，${peak.name} 用电最高，为 ${f(peak.total / 1000, 2)} MWh。`
                  : `按已有 ${data.days} 天记录汇总，当前共 ${data.trend.length} 个${grainLabel}度数据点，不代表完整${grainLabel}度用电。`}
              </p>
            </Panel>
            <Panel
              title="基础预测示意"
              className="energy-prediction-panel"
              description="按计划产量，估算未来一段时间的用电量"
            >
              <div className="energy-forecast-inputs">
                <Choice
                  label="预测天数"
                  name="energy-forecast-days"
                  value={input.period}
                  options={['7', '14', '30']}
                  onChange={(period) =>
                    setInput((previous) => ({ ...previous, period }))
                  }
                />
                <div className="app-field">
                  <Label htmlFor="energy-planned-production">
                    计划总产量（千只）
                  </Label>
                  <Input
                    id="energy-planned-production"
                    type="number"
                    min="0"
                    step="any"
                    value={plan}
                    placeholder={f(data.plannedProduction, 3)}
                    aria-describedby="energy-plan-source"
                    aria-invalid={Boolean(error)}
                    onChange={(event) => {
                      const value = event.target.value;
                      setPlan(value);
                      const next = {
                        ...input,
                        plannedProduction: value,
                        change: '0',
                      };
                      const problem = validateInputs('energy', next);
                      setError(
                        problem ? `${problem} 仍按上次有效条件估算。` : '',
                      );
                      if (!problem) setInput(next);
                    }}
                  />
                </div>
              </div>
              {error && (
                <p className="energy-input-error" role="alert">
                  {error}
                </p>
              )}
              <p id="energy-plan-source" className="energy-plan-source">
                {data.forecastSource === 'plan'
                  ? `采用手动填写的 ${f(data.plannedProduction, 3)} 千只，覆盖未来 ${input.period} 天。`
                  : data.forecastSource === 'change'
                    ? `采用对话中的产量调整，推算未来 ${input.period} 天共 ${f(data.plannedProduction, 3)} 千只。`
                    : `未填写计划，按历史日均 ${f(data.production / data.days, 3)} 千只延续，未来 ${input.period} 天共 ${f(data.plannedProduction, 3)} 千只。`}
              </p>
              <div className="energy-projected-total">
                <strong>
                  {f(data.projected / 1000)}
                  <span>MWh</span>
                </strong>
                <p>
                  {data.forecastStart} — {data.forecastEnd}
                </p>
              </div>
              <LinePlot
                forecast
                points={data.forecast.map((point) => ({
                  label: point.date,
                  value: point.projected,
                  reference: point.baseline,
                }))}
              />
              <div className="dashboard-chart-legend">
                <span>
                  <i />
                  {referenceLabel}
                </span>
                {data.forecastSource !== 'history' && (
                  <span>
                    <i className="muted" />
                    历史产量延续
                  </span>
                )}
              </div>
              <p className="dashboard-chart-note">
                历史单耗 {f(data.unit, 2)} kWh/千只 × 计划总产量{' '}
                {f(data.plannedProduction, 3)} 千只。
                按每日均匀生产绘制累计值，仅作基础估算。
              </p>
            </Panel>
            <Panel
              title="班次对比 · 白班 / 夜班"
              className="energy-shift-panel"
              description={`${data.start} — ${data.end} · ${scope}`}
            >
              <Suspense
                fallback={
                  <div className="energy-comparison-loading" role="status">
                    正在加载对比图…
                  </div>
                }
              >
                <GroupComparison items={data.shifts} label="班次对比" />
              </Suspense>
              <p className="dashboard-chart-note">
                按资料中的白班、夜班归组，跨日汇总。每个班次用电量 ÷
                该班次产量，比较同等产量的用电水平。
              </p>
            </Panel>
            <Panel
              title="产线对比"
              className="energy-line-panel"
              description={`${data.start} — ${data.end} · ${scopeLabel(input.process, '全部工序')} · 包含白班和夜班`}
            >
              <Suspense
                fallback={
                  <div className="energy-comparison-loading" role="status">
                    正在加载对比图…
                  </div>
                }
              >
                <GroupComparison items={data.lines} />
              </Suspense>
              <p className="dashboard-chart-note">
                {data.lines.length < 2
                  ? '当前只选择了一条产线，选择“全部产线”可对比各产线。'
                  : '每条产线分别汇总白班、夜班的用电与产量，再计算单耗，避免把产量不同直接当成耗能效率差异。'}
              </p>
            </Panel>
          </div>
          <section className="dashboard-detail-panel energy-anomaly-list">
            <div className="dashboard-panel-heading">
              <div className="detail-list-title">
                <h2>
                  异常点列表 <span>{data.issues.length}</span>
                </h2>
                <DetailExport
                  name="能耗异常明细"
                  columns={anomalyColumns}
                  rows={anomalyRows}
                />
              </div>
              <div className="energy-anomaly-definition">
                <p>
                  <strong>异常定义：</strong>实际单耗比基准高出超过{' '}
                  <strong>{energyPointThreshold}%</strong>
                  ，列为待核查异常。按日期、产线、班次、工序逐条判断。
                </p>
                <p>
                  实际单耗 = 用电量 ÷ 产量（千只）；偏高比例 =（实际单耗 ÷
                  基准单耗 − 1）× 100%。
                </p>
                <p>
                  基准取自资料中的“基准单耗”。异常阈值固定，不支持修改；异常需进一步核查。
                </p>
              </div>
            </div>
            {data.issues.length ? (
              <>
                <div id={anomalyTableId}>
                  <DataTable columns={anomalyColumns} rows={visibleAnomalies} />
                </div>
                <ListPagination
                  total={data.issues.length}
                  page={currentAnomalyPage}
                  pageSize={anomalyPageSize}
                  onPageChange={setAnomalyPage}
                  onPageSizeChange={setAnomalyPageSize}
                  controls={anomalyTableId}
                  label="异常点分页"
                  sizeLabel="每页异常点条数"
                />
              </>
            ) : (
              <p className="energy-no-anomalies">
                当前范围没有超过异常阈值的记录。
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
