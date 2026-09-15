'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Inline SVG charts need an image role; replacing the SVG with an img would remove its content. */
import {
  useEffect,
  useId,
  lazy,
  Suspense,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  AlertTriangle,
  Boxes,
  Target,
  BadgeCheck,
  Timer,
  Building2,
  Gauge,
  Truck,
  Zap,
} from 'lucide-react';
import {
  defaultInputs,
  modules,
  validateInputs,
  type Inputs,
  type WorkspaceState,
} from './model';
import {
  buildDashboard,
  numberLabel as f,
  chartNumber,
  type DashboardId,
} from './dashboard-data';
import { AgentIdentity } from './identity';
import DashboardChatEntry from './dashboard-chat-entry';
import { DashboardRules } from './dashboard-dialogs';
import { Choice, Field, DataTable, EmptyState } from './ui';
import DetailExport from './detail-export';
import ListPagination, { getPageRange } from './list-pagination';
import {
  withFixedRules,
  productionRuleDescription,
} from './fixed-rules';
const ProductionChart = lazy(() =>
  import('./dashboard-charts').then((m) => ({ default: m.ProductionChart })),
);
const SupplierRanking = lazy(() =>
  import('./dashboard-charts').then((m) => ({ default: m.SupplierRanking })),
);
const DowntimeChart = lazy(() =>
  import('./dashboard-charts').then((m) => ({ default: m.DowntimeChart })),
);
const SupplierRiskDistribution = lazy(() =>
  import('./dashboard-charts').then((m) => ({
    default: m.SupplierRiskDistribution,
  })),
);
const ComparisonChart = lazy(() =>
  import('./dashboard-charts').then((m) => ({ default: m.ComparisonChart })),
);
const SeriesPlot = lazy(() => import('./energy-series-chart'));
import DashboardMetric from './dashboard-metric';
import FinalDashboard from './final-dashboard';
import { supplierRisk } from './supplier-metrics';
import { belowProductionThreshold } from './production-metrics';

function Panel({
  title,
  description,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={'dashboard-panel ' + className}>
      <div className="dashboard-panel-heading">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}
function Forecast({
  total,
  days,
  change,
}: {
  total: number;
  days: number;
  change: number;
}) {
  const baseline = ((total / 1000) * days) / 7;
  const projected = baseline * (1 + change / 100);
  return (
    <>
      <div className="dashboard-forecast-value">
        <strong>
          {chartNumber(projected)}
          <span>MWh</span>
        </strong>
        <p>未来 {days} 天累计用电估算</p>
      </div>
      <Suspense
        fallback={
          <div className="energy-comparison-loading">正在加载图表…</div>
        }
      >
        <SeriesPlot
          forecast
          points={Array.from({ length: days + 1 }, (_, day) => ({
            label: `第 ${day} 天`,
            value: (projected * day) / days,
            reference: (baseline * day) / days,
          }))}
        />
      </Suspense>
      <div className="dashboard-chart-legend">
        <span>
          <i />
          计划产量变化 {change}%
        </span>
        <span>
          <i className="muted" />
          产量不变
        </span>
      </div>
      <p className="dashboard-chart-note">
        按 7 天汇总用电 × 预测天数 / 7 × 产量变化系数估算。
      </p>
    </>
  );
}
type DashboardProps = {
  id: DashboardId;
  state: WorkspaceState;
  onOpenChat: (input?: Inputs) => boolean;
  navigate: (path: string) => boolean;
  energyInput?: Inputs;
  onEnergyInputChange?: Dispatch<SetStateAction<Inputs>>;
};
export default function BusinessDashboard(props: DashboardProps) {
  if (props.id === 'energy' || props.id === 'production')
    return (
      <FinalDashboard
        id={props.id}
        state={props.state}
        onOpenChat={props.onOpenChat}
      />
    );
  return <AggregateDashboard {...props} />;
}
function AggregateDashboard({
  id,
  state,
  onOpenChat,
  energyInput,
  onEnergyInputChange,
}: DashboardProps) {
  const agent = modules.find((m) => m.id === id)!;
  const dataset = state.datasets.find((d) => d.module === id)!;
  const [localInput, setLocalInput] = useState<Inputs>({
    ...defaultInputs[id],
  });
  const input = withFixedRules(
    id,
    id === 'energy' && energyInput ? energyInput : localInput,
  );
  const setInput =
    id === 'energy' && onEnergyInputChange
      ? onEnergyInputChange
      : setLocalInput;
  const [draft, setDraft] = useState<Inputs>(input);
  const [error, setError] = useState('');
  const [productionStatus, setProductionStatus] = useState('全部');
  const [detailPage, setDetailPage] = useState(1);
  const [detailPageSize, setDetailPageSize] = useState(10);
  const detailTableId = useId();
  useEffect(() => {
    if (id === 'energy' && energyInput) {
      setDraft(energyInput);
      setError('');
    }
  }, [id, energyInput]);
  const board = buildDashboard(id, dataset, input);
  const { rows, issues, analysis, all, field, scopeKey } = board;
  const metrics =
    id === 'energy'
      ? board.metrics.filter((metric) => metric.label !== '基准以上电耗')
      : board.metrics;
  const scopeOptions = Array.from(
    new Set([all, ...dataset.rows.map((r) => String(r[field]))]),
  );
  const issueNames = new Set(issues.map((i) => i.name));
  const issueDetails = new Map(
    issues.map((issue) => [issue.row, issue.detail]),
  );
  const productionRows =
    id === 'production'
      ? rows.filter((row) => {
          const abnormal = issueDetails.has(row);
          return (
            productionStatus === '全部' ||
            (productionStatus === '异常' ? abnormal : !abnormal)
          );
        })
      : [];
  const productionColumns = [
    '产线',
    '计划产量（万只）',
    '实际产量（万只）',
    '完成率',
    '不良率',
    '停机（分钟）',
    '是否异常',
    '异常说明',
  ];
  const productionTableRows = productionRows.map((row) => {
    const planned = Number(row['计划产量(万只)']);
    const actual = Number(row['实际产量(万只)']);
    const inspected = Number(row['检验数量']);
    const rejected = Number(row['不良数量']);
    return [
      String(row['产线']),
      f(planned, 2),
      f(actual, 2),
      planned > 0 ? `${f((actual / planned) * 100, 2)}%` : '—',
      inspected > 0 ? `${f((rejected / inspected) * 100, 2)}%` : '—',
      f(Number(row['停机时长(min)'])),
      issueDetails.has(row) ? '是' : '否',
      issueDetails.get(row) ?? '',
    ];
  });
  const detailRange = getPageRange(
    productionTableRows.length,
    detailPage,
    detailPageSize,
  );
  const visibleDetailRows = productionTableRows.slice(
    detailRange.offset,
    detailRange.offset + detailPageSize,
  );
  function drill(name: string) {
    setDetailPage(1);
    setInput((old) => ({ ...old, [scopeKey]: name }));
  }
  const descriptions = {
    energy: '关注工序用能变化，把异常转化为优化行动。',
    production: '从产线表现到异常明细，掌握生产执行情况。',
  };
  return (
    <div className={'business-dashboard dashboard-' + id}>
      <div className="dashboard-heading">
        <div className="dashboard-heading-copy">
          <AgentIdentity id={id} />
          <div>
            <span className="dashboard-eyebrow">
              {agent.category} / 业务看板
            </span>
            <h1>{agent.name}</h1>
            {id !== 'supplier' && <p>{descriptions[id]}</p>}
          </div>
        </div>
        <div className="dashboard-heading-actions">
          {id === 'supplier' && <DashboardRules id="supplier" />}
          <DashboardChatEntry onClick={onOpenChat} />
        </div>
      </div>
      <div
        className={
          'dashboard-toolbar' +
          (id === 'energy' ? ' energy-simple-toolbar' : '')
        }
      >
        <Choice
          label={
            id === 'energy'
              ? '工序范围'
              : id === 'production'
                ? '产线范围'
                : '供应商范围'
          }
          name={'dashboard-scope-' + id}
          value={input[scopeKey]}
          options={scopeOptions}
          multiple
          allLabel={all}
          searchable
          searchPlaceholder={
            id === 'energy'
              ? '搜索工序'
              : id === 'production'
                ? '搜索产线'
                : '搜索供应商'
          }
          onChange={drill}
        />
        {id === 'energy' && (
          <>
            <Choice
              label="估算未来"
              name="energy-period"
              value={input.period + ' 天'}
              options={['7 天', '14 天', '30 天']}
              onChange={(value) =>
                setInput((old) => ({ ...old, period: value.split(' ')[0] }))
              }
            />
            <Field
              label="产量变化"
              name="energy-change"
              type="number"
              suffix="%"
              value={draft.change}
              onChange={(value) => {
                setDraft((old) => ({ ...old, change: value }));
                const next = { ...input, change: value };
                const problem = validateInputs('energy', next);
                setError(
                  problem ? `${problem} 当前仍按 ${input.change}% 估算。` : '',
                );
                if (!problem) setInput(next);
              }}
            />
          </>
        )}
        {id !== 'supplier' && (
          <div className="dashboard-toolbar-actions">
            <span className="dashboard-source">
              <i />
              {rows.length} 条记录
            </span>
          </div>
        )}
      </div>
      {id === 'energy' && error && (
        <p className="energy-input-error" role="alert">
          {error}
        </p>
      )}
      {id !== 'supplier' && (
        <section className="dashboard-rule-note" aria-label="默认规则">
          <strong>默认规则</strong>
          <p>
            {id === 'production'
              ? productionRuleDescription
              : '工序实际单耗 = 用电量 ÷ 产量（千只），高于资料中基准单耗 5% 时提示异常，等于阈值不触发。预测用电按近 7 天用电、预测天数与计划产量变化估算。'}
            当前规则固定，不支持修改。
          </p>
        </section>
      )}
      {!rows.length ? (
        <EmptyState
          title="当前范围没有数据"
          description="筛选对象可能已被修改，请重新选择范围。"
          onAction={() => drill(all)}
          action="查看全部"
        />
      ) : (
        <>
          <div className={'dashboard-metrics metrics-' + metrics.length}>
            {metrics.map((metric, index) => (
              <DashboardMetric
                key={metric.label}
                {...metric}
                detail={
                  id === 'supplier' && index < 2 ? '' : metric.detail
                }
                icon={
                  (id === 'production'
                    ? [Boxes, Target, BadgeCheck, Timer, AlertTriangle]
                    : id === 'supplier'
                      ? [Building2, Gauge, Truck, BadgeCheck]
                      : [Zap, Gauge, AlertTriangle])[index] ?? Gauge
                }
                progress={
                  metric.unit === '%' || metric.unit === '分'
                    ? Number(metric.value.replace(/,/g, ''))
                    : undefined
                }
              />
            ))}
          </div>
          <Suspense
            fallback={
              <div className="energy-comparison-loading" role="status">
                正在加载图表…
              </div>
            }
          >
            <div
              className={
                'dashboard-chart-grid ' +
                (id === 'energy'
                  ? 'energy-chart-grid'
                  : 'dashboard-overview-grid')
              }
            >
              {id === 'energy' ? (
                <>
                  <Panel
                    title="用电估算"
                    description="按产量变化估算 · MWh"
                    className="dashboard-forecast-panel"
                  >
                    <Forecast
                      total={board.energyTotal}
                      days={Number(input.period)}
                      change={Number(input.change)}
                    />
                  </Panel>
                  <Panel
                    title="工序用电对比"
                    description="统计用电与按基准单耗计算的电量"
                  >
                    <ComparisonChart
                      items={rows.map((r) => ({
                        name: String(r['工序']),
                        value: Number(r['用电量(kWh)']) / 1000,
                        comparison:
                          (Number(r['产量(千只)']) *
                            Number(r['基准单耗(kWh/千只)'])) /
                          1000,
                        warning: issueNames.has(String(r['工序'])),
                      }))}
                      labels={['统计用电', '基准电量']}
                      unit="MWh"
                    />
                  </Panel>
                  <Panel
                    title="单位产量电耗"
                    description="单耗超过基准 5% 时标记为需关注"
                  >
                    <ComparisonChart
                      items={rows.map((r) => ({
                        name: String(r['工序']),
                        value:
                          Number(r['用电量(kWh)']) / Number(r['产量(千只)']),
                        comparison: Number(r['基准单耗(kWh/千只)']),
                        warning: issueNames.has(String(r['工序'])),
                      }))}
                      labels={['实际单耗', '基准单耗']}
                      unit="kWh/千只"
                    />
                  </Panel>
                </>
              ) : id === 'production' ? (
                <>
                  <Panel
                    title="产线计划与实际"
                    description="产量对比 · 点击产线钻取"
                    className="dashboard-primary-chart"
                  >
                    <ProductionChart
                      items={rows.map((r) => ({
                        name: String(r['产线']),
                        value: Number(r['实际产量(万只)']),
                        comparison: Number(r['计划产量(万只)']),
                        warning: issueNames.has(String(r['产线'])),
                      }))}
                      onSelect={drill}
                    />
                  </Panel>
                  <Panel
                    title="产线质量表现"
                    description={`不良率上限 ${input.defect}% · 按各产线检验数量计算`}
                  >
                    <ComparisonChart
                      items={rows.map((r) => ({
                        name: String(r['产线']),
                        value:
                          (Number(r['不良数量']) / Number(r['检验数量'])) * 100,
                        comparison: Number(input.defect),
                        warning: belowProductionThreshold(
                          Number(r['检验数量']) * Number(input.defect),
                          Number(r['不良数量']) * 100,
                        ),
                      }))}
                      labels={['不良率', '目标上限']}
                      unit="%"
                      onSelect={drill}
                    />
                  </Panel>
                  <Panel
                    title="停机时长分布"
                    description="按当前产线范围统计 · 分钟"
                    className="dashboard-compact-chart"
                  >
                    <DowntimeChart
                      items={rows.map((row) => ({
                        name: String(row['产线']),
                        value: Number(row['停机时长(min)']),
                      }))}
                    />
                  </Panel>
                </>
              ) : (
                <>
                  <Panel
                    title="供应商综合评分"
                    className="dashboard-primary-chart"
                  >
                    <SupplierRanking
                      items={analysis.bars.map((b) => ({
                        name: b.label,
                        value: b.value,
                        warning: b.warning,
                      }))}
                      onSelect={drill}
                    />
                  </Panel>
                  <Panel
                    title="供应风险分布"
                    className="dashboard-compact-chart"
                  >
                    <SupplierRiskDistribution
                      items={rows.map((row) => supplierRisk(row, input))}
                    />
                  </Panel>
                  <Panel title="交付与质量对比">
                    <ComparisonChart
                      items={rows.map((r) => ({
                        name: String(r['供应商']),
                        value: Number(r['交付及时率(%)']),
                        comparison: Number(r['来料合格率(%)']),
                        warning:
                          Number(r['交付及时率(%)']) <
                          Number(input.deliveryTarget),
                        comparisonWarning:
                          Number(r['来料合格率(%)']) <
                          Number(input.qualityTarget),
                      }))}
                      labels={['交付及时率', '来料合格率']}
                      unit="%"
                      maxValue={100}
                      onSelect={drill}
                    />
                  </Panel>
                </>
              )}
            </div>
          </Suspense>
          {id === 'energy' ? (
            <section className="dashboard-detail-panel energy-simple-issues">
              <h2>需要关注的问题</h2>
              {issues.length ? (
                issues.map((issue) => (
                  <div key={issue.name}>
                    <h3>
                      {issue.name} · {issue.detail}
                    </h3>
                    <p>
                      先核对产量统计，再结合空载时长、批次装载率和设备运行记录，确认偏差原因。
                    </p>
                  </div>
                ))
              ) : (
                <p>当前工序的单位电耗未超过基准 5%。</p>
              )}
            </section>
          ) : id === 'production' ? (
            <section className="dashboard-detail-panel production-detail">
              <div className="dashboard-detail-heading">
                <div>
                  <h2>产线明细</h2>
                  <p>
                    完成率低于 {input.completion}% 或不良率超过 {input.defect}%
                    时提示异常，等于阈值不触发。
                  </p>
                </div>
                <div className="production-detail-controls">
                  <span aria-live="polite">共 {productionRows.length} 条</span>
                  <Choice
                    label="是否异常"
                    name="production-status"
                    value={productionStatus}
                    options={['全部', '异常', '正常']}
                    onChange={(value) => {
                      setProductionStatus(value);
                      setDetailPage(1);
                    }}
                  />
                  <DetailExport
                    name="生产产线明细"
                    columns={productionColumns}
                    rows={productionTableRows}
                  />
                </div>
              </div>
              <div id={detailTableId}>
                <DataTable
                  columns={productionColumns}
                  rows={visibleDetailRows}
                />
              </div>
              {productionRows.length === 0 && (
                <p className="production-detail-empty" role="status">
                  当前筛选条件下没有产线记录。
                </p>
              )}
              <ListPagination
                total={productionTableRows.length}
                page={detailRange.currentPage}
                pageSize={detailPageSize}
                onPageChange={setDetailPage}
                onPageSizeChange={setDetailPageSize}
                controls={detailTableId}
                label="产线明细分页"
                sizeLabel="每页产线条数"
              />
            </section>
          ) : null}
        </>
      )}
      {id === 'energy' ? (
        <p className="energy-coverage-note">
          当前为工序用电汇总，按 7 天口径估算；尚无日、班次及设备时段明细。
        </p>
      ) : null}
    </div>
  );
}
