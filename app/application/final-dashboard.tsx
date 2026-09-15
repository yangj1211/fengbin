'use client';
import { lazy, Suspense, useId, useState, type ReactNode } from 'react';
import {
  BadgeCheck,
  Boxes,
  CircleAlert,
  Target,
  Timer,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type Inputs, type WorkspaceState, modules } from './model';
import { Choice, Field } from './ui';
import { BarList } from '@/components/tremor/BarList';
import DashboardMetric from './dashboard-metric';
import DashboardChatEntry from './dashboard-chat-entry';
import { DashboardRules, ForecastConditions } from './dashboard-dialogs';
import { AgentIdentity } from './identity';
import { updateWorkspace, storageMessage } from './store';
import {
  energyDates,
  energyProcess,
  energyStatus,
  finalDefaults,
  formatFinal as f,
  getFinalEnergy,
  getFinalProduction,
  normalizeFinalInput,
  processNames,
  productionDates,
  productionQualityGap,
  sumBy,
  validFinalDates,
} from './final-data';
const ComparisonChart = lazy(() =>
  import('./dashboard-charts').then((m) => ({ default: m.ComparisonChart })),
);
const Series = lazy(() => import('./final-series-chart'));
type SetInput = (patch: Inputs) => boolean;
const percent = (n: number | null) => (n === null ? '—' : `${f(n, 2)}%`);
const timeLabel = (s: string) => s.replace('T', ' ').replace(/:00$/, '');
const processChartLabel = (name: string) =>
  name.startsWith('3161')
    ? '钉卷'
    : name.startsWith('3162')
      ? '组立'
      : name.startsWith('3164')
        ? '老化选别'
        : name;

function Panel({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`dashboard-panel ${className}`}>
      <div className="dashboard-panel-heading final-panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      <Suspense fallback={<p className="final-empty">正在加载图表…</p>}>
        {children}
      </Suspense>
    </section>
  );
}
function ViewChoice({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
  label: string;
}) {
  const name = useId();
  return (
    <div className="final-view-choice">
      <Choice
        label={label}
        name={name}
        value={options.find(([v]) => v === value)?.[1] || options[0][1]}
        options={options.map(([, text]) => text)}
        onChange={(text) => onChange(options.find(([, t]) => t === text)![0])}
      />
    </div>
  );
}
function Bars({
  items,
  labels,
  unit,
  onSelect,
  categoryFormatter,
}: {
  items: {
    name: string;
    value: number;
    comparison?: number;
    warning?: boolean;
  }[];
  labels: string[];
  unit: string;
  onSelect?: (s: string) => void;
  categoryFormatter?: (name: string) => string;
}) {
  return items.length ? (
    <ComparisonChart
      items={items}
      labels={labels}
      unit={unit}
      onSelect={onSelect}
      categoryFormatter={categoryFormatter}
    />
  ) : (
    <p className="final-empty">当前范围没有可展示的记录。</p>
  );
}
export default function FinalDashboard({
  id,
  state,
  onOpenChat,
}: {
  id: 'energy' | 'production';
  state: WorkspaceState;
  onOpenChat: (input?: Inputs) => boolean;
}) {
  const input = normalizeFinalInput(id, state.dashboardInputs?.[id] || {});
  const [error, setError] = useState('');
  const [draftDates, setDraftDates] = useState({
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  });
  const effectiveDates = input.dateFrom + '/' + input.dateTo;
  const [lastDates, setLastDates] = useState(effectiveDates);
  if (lastDates !== effectiveDates) {
    setLastDates(effectiveDates);
    setDraftDates({ dateFrom: input.dateFrom, dateTo: input.dateTo });
  }
  function setInput(patch: Inputs) {
    const next = { ...input, ...patch };
    if (!validFinalDates(next)) {
      setError(
        '请输入有效日期，开始日期不能晚于结束日期。图表保留上次有效范围。',
      );
      return false;
    }
    const ok = updateWorkspace((s) => ({
      ...s,
      dashboardInputs: { ...s.dashboardInputs, [id]: next },
    }));
    setError(ok ? '' : storageMessage());
    return ok;
  }
  function dateChange(key: 'dateFrom' | 'dateTo', value: string) {
    const next = { ...draftDates, [key]: value };
    setDraftDates(next);
    setInput({ ...next, snapshot: '' });
  }
  const dates = id === 'energy' ? energyDates : productionDates;
  const p = id === 'production' ? getFinalProduction(input) : null;
  return (
    <div className={`business-dashboard dashboard-${id} final-dashboard`}>
      <div className="dashboard-heading">
        <div className="dashboard-heading-copy">
          <AgentIdentity id={id} />
          <div>
            <h1>{modules.find((m) => m.id === id)!.name}</h1>
          </div>
        </div>
        <div className="dashboard-heading-actions">
          <DashboardRules id={id} />
          <DashboardChatEntry onClick={() => onOpenChat(input)} />
        </div>
      </div>
      <div className="dashboard-toolbar final-filters">
        <Field
          label="开始生产日"
          name={`${id}-from`}
          type="date"
          value={draftDates.dateFrom}
          onChange={(v) => dateChange('dateFrom', v)}
        />
        <Field
          label="结束生产日"
          name={`${id}-to`}
          type="date"
          value={draftDates.dateTo}
          onChange={(v) => dateChange('dateTo', v)}
        />
        {id === 'production' ? (
          <>
            <Choice
              label="工序"
              name="final-process"
              value={input.process}
              options={['全部工序', ...processNames]}
              onChange={(v) =>
                setInput({ process: v, machine: '全部机台', snapshot: '' })
              }
              multiple
              allLabel="全部工序"
            />
            <Choice
              label="机台"
              name="final-machine"
              value={input.machine}
              options={['全部机台', ...p!.machines]}
              onChange={(v) => setInput({ machine: v, snapshot: '' })}
              multiple
              allLabel="全部机台"
            />
          </>
        ) : (
          <div className="app-field final-fixed-process">
            <span>工序</span>
            <strong>{energyProcess}</strong>
          </div>
        )}
        <Choice
          label="班次"
          name={`${id}-shift`}
          value={input.shift}
          options={['全部班次', 'A', 'B']}
          onChange={(v) =>
            setInput({
              shift: v,
              machine: id === 'production' ? '全部机台' : '',
              snapshot: '',
            })
          }
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDraftDates({ dateFrom: dates[0], dateTo: dates.at(-1)! });
            setInput({ ...finalDefaults[id] });
          }}
        >
          重置
        </Button>
      </div>
      {error && (
        <p className="energy-input-error" role="alert">
          {error}
        </p>
      )}
      {id === 'production' && (
        <details className="final-more final-context">
          <summary>
            工单 / 卡号筛选{input.order || input.card ? ' · 已启用' : ''}
          </summary>
          <div>
            <Field
              label="工单号"
              name="final-order"
              value={input.order}
              onChange={(v) => setInput({ order: v, snapshot: '' })}
            />
            <Field
              label="卡号"
              name="final-card"
              value={input.card}
              onChange={(v) => setInput({ card: v, snapshot: '' })}
            />
          </div>
        </details>
      )}
      {id === 'energy' ? (
        <Energy input={input} setInput={setInput} />
      ) : (
        <Production input={input} setInput={setInput} />
      )}
    </div>
  );
}

type SectionProps = {
  input: Inputs;
  setInput: SetInput;
};
function Energy({ input, setInput }: SectionProps) {
  const d = getFinalEnergy(input);
  const issueSummary = ['单耗偏高', '零产量用电', '记录不完整']
    .map((status) => ({
      status,
      count: d.issues.filter((row) => energyStatus(row) === status).length,
    }))
    .filter(({ count }) => count > 0)
    .map(({ status, count }) => `${count} 个班次${status}`)
    .join('；');
  return (
    <>
      <div className="dashboard-metrics">
        <DashboardMetric
          label="总用电量"
          value={d.rows.length ? f(d.total, 3) : '—'}
          unit="kWh"
          detail={`${d.rows.length} 个班次`}
          icon={Zap}
        />
        <DashboardMetric
          label="班次产量"
          value={d.rows.length ? f(d.output) : '—'}
          unit="件"
          icon={Boxes}
        />
        <DashboardMetric
          label="生产单耗"
          value={f(d.unit, 4)}
          unit="kWh/千件"
          icon={Target}
        />
        <DashboardMetric
          label="零产量用电"
          value={d.rows.length ? f(d.zeroEnergy, 3) : '—'}
          unit="kWh"
          detail={`${d.rows.filter((r) => r.production === 0).length} 个班次`}
          icon={CircleAlert}
          warning={d.zeroEnergy > 0}
        />
      </div>
      {issueSummary && (
        <div className="final-notice" aria-label="用能异常摘要">
          <CircleAlert size={17} aria-hidden="true" />
          <span>{issueSummary}。</span>
        </div>
      )}
      <div className="final-chart-grid">
        <Panel
          title="用电趋势"
          className="energy-trend-panel"
          action={
            <ViewChoice
              value={input.granularity}
              options={[
                ['day', '按日'],
                ['shift', '按班次'],
                ['hour', '按小时'],
              ]}
              onChange={(v) => setInput({ granularity: v })}
              label="趋势粒度"
            />
          }
        >
          <div className="final-chart-filter">
            <Choice
              label="趋势电表"
              name="energy-meter"
              value={input.meter}
              options={['全部电表', ...d.meters.map((r) => r.name)]}
              onChange={(v) => setInput({ meter: v })}
            />
          </div>
          <Series items={d.trend} label="用电量" unit="kWh" />
        </Panel>
        <Panel
          title="计划用电估算"
          className="energy-forecast-panel"
          action={<ForecastConditions input={input} onApply={setInput} />}
        >
          <div className="final-estimate">
            <strong>
              {f(d.estimate, 3)}
              <small> kWh</small>
            </strong>
            <p>
              {d.plan === null
                ? '请设置预测条件'
                : `计划 ${f(d.plan)} 件 · ${input.shift === '全部班次' ? 'A/B 全部班次' : `${input.shift} 班`}`}
            </p>
          </div>
          <p className="dashboard-chart-note">不含停产、待机用电。</p>
        </Panel>
        <Panel
          title="班次生产单耗"
          className="energy-shift-panel"
          action={<span className="energy-panel-unit">kWh/千件</span>}
        >
          {d.shifts.some((r) => r.value !== null) ? (
            <BarList
              className="energy-compact-bars"
              data={d.shifts
                .filter((r) => r.value !== null)
                .map((r) => ({ name: r.name, value: r.value! }))}
              sortOrder="none"
              valueFormatter={(n) => f(n, 2)}
              aria-label="班次生产单耗，单位 kWh/千件"
            />
          ) : (
            <p className="final-empty">当前范围没有可展示的记录。</p>
          )}
        </Panel>
        <Panel
          title="电表用电分布"
          className="energy-meter-panel"
          action={<span className="energy-panel-unit">kWh</span>}
        >
          {d.rows.length ? (
            <BarList
              className="energy-compact-bars"
              data={d.meters.map((r) => ({
                ...r,
                name: '电表 ' + r.name.split('_').at(-1),
              }))}
              sortOrder="none"
              valueFormatter={(n) => f(n, 3)}
              aria-label="电表用电分布，单位 kWh"
            />
          ) : (
            <p className="final-empty">当前范围没有可展示的记录。</p>
          )}
        </Panel>
      </div>
    </>
  );
}

function Production({ input, setInput }: SectionProps) {
  const d = getFinalProduction(input),
    s = d.summary;
  const [view, setView] = useState('machine'),
    [stopView, setStopView] = useState('reason');
  const show = (n: number | null, digits = 0) =>
    d.rows.length ? f(n, digits) : '—';
  const calculationIssues = d.takt.filter((row) => row.calculationIssue).length;
  const machineMismatches = d.takt.filter((row) => row.machineMismatch).length;
  const reviewSummary = [
    s.qualityIssues.length
      ? `数量差额 ${s.qualityIssues.length} 条（共 ${f(sumBy(s.qualityIssues, productionQualityGap))} 件）`
      : '',
    calculationIssues ? `节拍计算 ${calculationIssues} 条` : '',
    machineMismatches ? `机台编码 ${machineMismatches} 条` : '',
  ]
    .filter(Boolean)
    .join('；');
  return (
    <>
      {d.singleProcess ? (
        <div className="dashboard-metrics metrics-5">
          <DashboardMetric
            label="工序报工产量"
            value={show(s.output)}
            unit="件"
            detail={`报表计划 ${show(s.planned)} 件`}
            icon={Boxes}
          />
          <DashboardMetric
            label="计划完成率"
            value={show(s.completion, 2)}
            unit="%"
            icon={Target}
            warning={s.completion !== null && s.completion < 95}
          />
          <DashboardMetric
            label="检验良率"
            value={show(s.yield, 2)}
            unit="%"
            detail={`${s.qualityIssues.length ? `${s.qualityIssues.length} 条待核查` : `不良率 ${percent(s.defect)}`}`}
            icon={BadgeCheck}
            warning={s.qualityIssues.length > 0}
          />
          <DashboardMetric
            label="累计停线"
            value={d.downtime.length ? f(d.totalMinutes) : '—'}
            unit="分钟"
            detail={`${d.downtime.length} 次事件`}
            icon={Timer}
          />
          <DashboardMetric
            label="时点在制"
            value={f(d.wipQuantity)}
            unit="件"
            detail={d.snapshot ? timeLabel(d.snapshot) : '无可用统计时点'}
            icon={Boxes}
          />
        </div>
      ) : null}
      {s.abnormal.length > 0 && (
        <div className="final-notice" aria-label="生产异常摘要">
          <CircleAlert size={17} aria-hidden="true" />
          <span>{s.abnormal.length} 条生产记录未达标。</span>
        </div>
      )}
      {reviewSummary && (
        <div className="final-notice" aria-label="数据核查摘要">
          <CircleAlert size={17} aria-hidden="true" />
          <span>待核查：{reviewSummary}。</span>
        </div>
      )}
      <div className="final-chart-grid">
        <Panel
          title={
            !d.singleProcess
              ? '工序计划与报工'
              : view === 'machine'
                ? '机台计划与报工'
                : '每日报工趋势'
          }
          action={
            d.singleProcess && (
              <ViewChoice
                value={view}
                options={[
                  ['machine', '按机台'],
                  ['day', '按日'],
                ]}
                onChange={setView}
                label="报工图表维度"
              />
            )
          }
        >
          {!d.singleProcess ? (
            <Bars
              categoryFormatter={processChartLabel}
              items={d.perProcess
                .filter((p) => p.records > 0)
                .map((p) => ({
                  name: p.name,
                  value: p.output,
                  comparison: p.planned,
                  warning: (p.completion ?? 100) < 95,
                }))}
              labels={['报工产量', '报表计划']}
              unit="件"
              onSelect={(name) =>
                setInput({ process: name, machine: '全部机台', snapshot: '' })
              }
            />
          ) : view === 'day' ? (
            <Series items={d.trend} label="报工产量" unit="件" />
          ) : (
            <Bars
              items={d.machineGroups.map((r) => ({
                name: r.name,
                value: r.output,
                comparison: r.planned,
                warning: (r.completion ?? 100) < 95,
              }))}
              labels={['报工产量', '报表计划']}
              unit="件"
              onSelect={(name) => setInput({ machine: name, snapshot: '' })}
            />
          )}
        </Panel>
        <Panel title={d.singleProcess ? '机台不良率' : '工序不良率'}>
          {d.singleProcess ? (
            <Bars
              items={d.machineGroups
                .filter((r) => r.defect !== null)
                .map((r) => ({
                  name: r.name,
                  value: r.defect!,
                  comparison: 2,
                  warning: r.defect! > 2,
                }))}
              labels={['不良率', '提醒阈值']}
              unit="%"
              onSelect={(name) => setInput({ machine: name, snapshot: '' })}
            />
          ) : (
            <Bars
              categoryFormatter={processChartLabel}
              items={d.perProcess
                .filter((p) => p.defect !== null)
                .map((p) => ({
                  name: p.name,
                  value: p.defect!,
                  comparison: 2,
                  warning: p.defect! > 2,
                }))}
              labels={['不良率', '提醒阈值']}
              unit="%"
              onSelect={(name) =>
                setInput({ process: name, machine: '全部机台', snapshot: '' })
              }
            />
          )}
        </Panel>
        <Panel
          title="停线分布"
          action={
            <ViewChoice
              value={stopView}
              options={[
                ['reason', '按原因'],
                ['machine', '按机台'],
              ]}
              onChange={setStopView}
              label="停线图表维度"
            />
          }
        >
          <Bars
            items={stopView === 'reason' ? d.stopReasons : d.stopMachines}
            labels={['停线时长']}
            unit="分钟"
          />
        </Panel>
        <Panel title="时点在制分布">
          <div className="final-snapshot">
            <Choice
              label="统计时点"
              name="production-snapshot"
              value={
                input.snapshot ? timeLabel(input.snapshot) : '当前范围末次时点'
              }
              options={[
                '当前范围末次时点',
                ...[
                  ...new Set([
                    ...d.times,
                    ...(input.snapshot ? [input.snapshot] : []),
                  ]),
                ]
                  .sort()
                  .map(timeLabel),
              ]}
              searchable
              onChange={(v) =>
                setInput({
                  snapshot:
                    v === '当前范围末次时点' ? '' : v.replace(' ', 'T') + ':00',
                })
              }
            />
          </div>
          <p className="dashboard-chart-note">
            {d.snapshot ? timeLabel(d.snapshot) : '当前范围没有在制快照'}
          </p>
          <Bars
            items={
              d.singleProcess
                ? d.wipMachines
                : d.perProcess
                    .filter((p) => p.wip !== null)
                    .map((p) => ({ name: p.name, value: p.wip! }))
            }
            labels={['在制数量']}
            unit="件"
            categoryFormatter={!d.singleProcess ? processChartLabel : undefined}
          />
          {!d.singleProcess && d.perProcess.some((p) => p.wip === null) && (
            <p className="dashboard-chart-note">
              {d.perProcess
                .filter((p) => p.wip === null)
                .map((p) => `${p.name}：该时点无记录`)
                .join('；')}
            </p>
          )}
        </Panel>
      </div>
    </>
  );
}
