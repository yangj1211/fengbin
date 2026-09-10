'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Inline SVG charts need an image role; replacing the SVG with an img would remove its content. */
import {
  useEffect,
  useId,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  ArrowUpRight,
  SlidersHorizontal,
  Download,
  MessageSquareText,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Database,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  defaultInputs,
  modules,
  validateInputs,
  csvExport,
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
import { Choice, Field, DataTable, download, EmptyState } from './ui';
import AnalysisConditions from './conditions';
import { ProductionChart, SupplierRanking } from './dashboard-charts';

type Comparison = {
  name: string;
  value: number;
  comparison?: number;
  warning?: boolean;
  comparisonWarning?: boolean;
};
function Panel({
  title,
  description,
  children,
  className = '',
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={'dashboard-panel ' + className}>
      <div className="dashboard-panel-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children}
    </section>
  );
}
function ComparisonChart({
  items,
  labels,
  unit,
  onSelect,
  maxValue,
}: {
  items: Comparison[];
  labels: string[];
  unit: string;
  onSelect?: (name: string) => void;
  maxValue?: number;
}) {
  const Item = onSelect ? 'button' : 'div';
  const max = Math.max(
    1,
    maxValue ?? 0,
    ...items.flatMap((item) => [item.value, item.comparison ?? 0]),
  );
  return (
    <>
      <div className="dashboard-chart-legend">
        {labels.map((label, i) => (
          <span key={label}>
            <i className={i ? 'muted' : ''} />
            {label}
          </span>
        ))}
        {onSelect && <small>点击查看明细</small>}
      </div>
      <div className="dashboard-comparisons">
        {items.slice(0, 8).map((item, i) => (
          <Item
            key={i}
            className="dashboard-comparison"
            onClick={onSelect ? () => onSelect(item.name) : undefined}
            aria-label={`${onSelect ? '查看' : ''}${item.name}${onSelect ? '明细' : ''}，${labels[0]} ${f(item.value, 2)} ${unit}${item.warning ? '，需关注' : ''}${item.comparison === undefined ? '' : `，${labels[1]} ${f(item.comparison, 2)} ${unit}${item.comparisonWarning ? '，需关注' : ''}`}`}
          >
            <span className="dashboard-comparison-name">
              {item.name}
              {onSelect && <ArrowUpRight size={13} />}
            </span>
            <span className="dashboard-comparison-bars">
              <span className="dashboard-comparison-track">
                <i
                  className={item.warning ? 'warning' : ''}
                  style={{ width: (item.value / max) * 100 + '%' }}
                />
              </span>
              {item.comparison !== undefined && (
                <span className="dashboard-comparison-track">
                  <i
                    className={
                      'muted' + (item.comparisonWarning ? ' warning' : '')
                    }
                    style={{ width: (item.comparison / max) * 100 + '%' }}
                  />
                </span>
              )}
            </span>
            <span className="dashboard-comparison-values">
              <b>
                {chartNumber(item.value, 2)} <small>{unit}</small>
              </b>
              {item.comparison !== undefined && (
                <small>
                  {chartNumber(item.comparison, 2)} {unit}
                </small>
              )}
            </span>
          </Item>
        ))}
      </div>
      {items.length > 8 && (
        <p className="dashboard-chart-note">
          图表展示前 8 项，完整数据见下方明细。
        </p>
      )}
    </>
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
  const gradientId = useId();
  const baseline = ((total / 1000) * days) / 7;
  const projected = baseline * (1 + change / 100);
  const max = Math.max(1, baseline, projected) * 1.14;
  const y = (v: number) => 200 - (v / max) * 168;
  return (
    <>
      <div className="dashboard-forecast-value">
        <strong>
          {chartNumber(projected)}
          <span>MWh</span>
        </strong>
        <p>未来 {days} 天累计用电估算</p>
      </div>
      <svg
        className="dashboard-forecast-svg"
        viewBox="0 0 620 245"
        role="img"
        aria-label={`未来 ${days} 天累计用电情景估算 ${f(projected)} MWh，产量不变时 ${f(baseline)} MWh；线性估算，不是实测趋势。`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--dashboard-accent)"
              stopOpacity=".3"
            />
            <stop
              offset="100%"
              stopColor="var(--dashboard-accent)"
              stopOpacity=".02"
            />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="88"
              x2="580"
              y1={200 - i * 56}
              y2={200 - i * 56}
              stroke="var(--border)"
              strokeDasharray="3 5"
            />
            <text x="76" y={204 - i * 56} textAnchor="end">
              {chartNumber((max * i) / 3, max < 10 ? 2 : 1)}
            </text>
          </g>
        ))}
        <polygon
          points={`88,200 580,${y(projected)} 580,200`}
          fill={`url(#${gradientId})`}
        />
        <path
          d={`M88 200 L580 ${y(baseline)}`}
          stroke="var(--dashboard-reference)"
          strokeWidth="2"
          strokeDasharray="6 5"
          fill="none"
        />
        <path
          className="dashboard-forecast-line"
          pathLength="1"
          d={`M88 200 L580 ${y(projected)}`}
          stroke="var(--dashboard-accent)"
          strokeWidth="3"
          fill="none"
        />
        <circle
          className="dashboard-forecast-endpoint"
          cx="580"
          cy={y(projected)}
          r="5"
          fill="var(--dashboard-accent)"
        />
        <text x="88" y="230">
          预测起点
        </text>
        <text
          x={88 + (492 * Math.round(days / 2)) / days}
          y="230"
          textAnchor="middle"
        >
          第 {Math.round(days / 2)} 天
        </text>
        <text x="580" y="230" textAnchor="end">
          第 {days} 天
        </text>
      </svg>
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
export default function BusinessDashboard({
  id,
  state,
  onAsk,
  navigate,
  energyInput,
  onEnergyInputChange,
}: {
  id: DashboardId;
  state: WorkspaceState;
  onAsk: (input: Inputs) => boolean;
  navigate: (path: string) => boolean;
  energyInput?: Inputs;
  onEnergyInputChange?: Dispatch<SetStateAction<Inputs>>;
}) {
  const agent = modules.find((m) => m.id === id)!;
  const dataset = state.datasets.find((d) => d.module === id)!;
  const [localInput, setLocalInput] = useState<Inputs>({
    ...defaultInputs[id],
  });
  const input = id === 'energy' && energyInput ? energyInput : localInput;
  const setInput =
    id === 'energy' && onEnergyInputChange
      ? onEnergyInputChange
      : setLocalInput;
  const [draft, setDraft] = useState<Inputs>(input);
  const [settings, setSettings] = useState(false);
  const [error, setError] = useState('');
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
  const scoped = input[scopeKey] !== all;
  const issueNames = new Set(issues.map((i) => i.name));
  const tableRows = analysis.rows;
  function drill(name: string) {
    setInput((old) => ({ ...old, [scopeKey]: name }));
  }
  function ask(inputToUse: Inputs, question: string) {
    return onAsk({ ...inputToUse, question });
  }
  const descriptions = {
    energy: '关注工序用能变化，把异常转化为优化行动。',
    production: '从产线表现到异常明细，掌握生产执行情况。',
    supplier: '综合交付、质量与响应，及时发现供应风险。',
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
            <p>{descriptions[id]}</p>
          </div>
        </div>
        {id !== 'energy' && (
          <Button
            onClick={() =>
              ask(
                input,
                id === 'production'
                  ? '请分析当前产线表现，找出需要关注的异常。'
                  : '请评估供应商绩效，找出交付和质量风险。',
              )
            }
          >
            <MessageSquareText size={16} />
            问问助手
            <ArrowUpRight size={15} />
          </Button>
        )}
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
        <div className="dashboard-toolbar-actions">
          <span className="dashboard-source">
            <i />
            {dataset.origin === 'sample' ? '示例数据' : '本地数据'} ·{' '}
            {dataset.rows.length} 条记录
          </span>
          {id !== 'energy' && (
            <>
              <Button
                variant="outline"
                aria-expanded={settings}
                aria-controls="dashboard-settings"
                onClick={() => {
                  setDraft(input);
                  setSettings(!settings);
                  setError('');
                }}
              >
                <SlidersHorizontal size={15} />
                指标规则
              </Button>
              <Button
                variant="outline"
                disabled={!rows.length}
                onClick={() =>
                  download(
                    `${agent.name}-看板明细.csv`,
                    csvExport(analysis.columns, tableRows),
                    'text/csv;charset=utf-8',
                  )
                }
              >
                <Download size={15} />
                导出
              </Button>
            </>
          )}
        </div>
      </div>
      {id === 'energy' && error && (
        <p className="energy-input-error" role="alert">
          {error}
        </p>
      )}
      {id !== 'energy' && settings && (
        <form
          id="dashboard-settings"
          className="dashboard-settings"
          onSubmit={(e) => {
            e.preventDefault();
            const problem = validateInputs(id, draft);
            if (problem) {
              setError(problem);
              return;
            }
            setInput(draft);
            setSettings(false);
            setError('');
          }}
        >
          <h2>调整评估规则</h2>
          <AnalysisConditions
            id={id}
            dataset={dataset}
            input={draft}
            change={(key, value) => setDraft((s) => ({ ...s, [key]: value }))}
            disabled={false}
          />
          {error && <p role="alert">{error}</p>}
          <div className="dashboard-settings-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSettings(false)}
            >
              取消
            </Button>
            <Button type="submit">应用到看板</Button>
          </div>
        </form>
      )}
      {id !== 'energy' && scoped && (
        <button className="dashboard-reset-scope" onClick={() => drill(all)}>
          <ArrowLeft size={14} />
          返回{all} · 当前查看 {input[scopeKey]}
        </button>
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
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className={metric.warning ? 'needs-attention' : ''}
              >
                <span>
                  {metric.label}
                  {metric.warning && <AlertTriangle size={13} />}
                </span>
                <strong>
                  {metric.value}
                  <small>{metric.unit}</small>
                </strong>
                <p>{metric.detail}</p>
              </div>
            ))}
          </div>
          <div
            className={
              'dashboard-chart-grid ' +
              (id === 'energy' ? 'energy-chart-grid' : '')
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
                      value: Number(r['用电量(kWh)']) / Number(r['产量(千只)']),
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
                      warning:
                        (Number(r['不良数量']) / Number(r['检验数量'])) * 100 >
                        Number(input.defect),
                    }))}
                    labels={['不良率', '目标上限']}
                    unit="%"
                    onSelect={drill}
                  />
                </Panel>
              </>
            ) : (
              <>
                <Panel
                  title="供应商综合评分"
                  description={`交付 ${input.deliveryWeight}% · 质量 ${input.qualityWeight}% · 响应 ${100 - Number(input.deliveryWeight) - Number(input.qualityWeight)}%`}
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
                  title="交付与质量对比"
                  description={`目标：交付 ≥ ${input.deliveryTarget}% · 质量 ≥ ${input.qualityTarget}%`}
                >
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
          ) : (
            <section className="dashboard-detail-panel">
              <Tabs defaultValue="issues">
                <div className="dashboard-detail-heading">
                  <TabsList variant="line">
                    <TabsTrigger value="issues">
                      {id === 'supplier' ? '风险明细' : '异常明细'}
                      <span className="dashboard-count">{issues.length}</span>
                    </TabsTrigger>
                    <TabsTrigger value="all">
                      全部明细
                      <span className="dashboard-count">{rows.length}</span>
                    </TabsTrigger>
                  </TabsList>
                  <span>基于当前筛选与规则</span>
                </div>
                <TabsContent value="issues">
                  {issues.length ? (
                    <div className="dashboard-issues">
                      {issues.map((issue) => (
                        <div className="dashboard-issue" key={issue.name}>
                          <span className="dashboard-issue-icon">
                            <AlertTriangle size={19} />
                          </span>
                          <div>
                            <h3>
                              {issue.name}
                              <span>需关注</span>
                            </h3>
                            <p>{issue.detail}</p>
                          </div>
                          <Button
                            variant="ghost"
                            onClick={() => ask(issue.inputs, issue.question)}
                          >
                            分析原因
                            <ArrowRight size={15} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="dashboard-no-issues">
                      <CheckCircle2 size={25} />
                      <strong>当前范围未发现指标异常</strong>
                      <p>可在“指标规则”中调整阈值，或查看全部明细。</p>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="all">
                  <DataTable
                    columns={analysis.columns}
                    rows={tableRows}
                    actions={(i) => (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => drill(tableRows[i][0])}
                      >
                        查看
                        <ArrowUpRight size={14} />
                      </Button>
                    )}
                  />
                </TabsContent>
              </Tabs>
            </section>
          )}
        </>
      )}
      {id === 'energy' ? (
        <p className="energy-coverage-note">
          当前为工序用电汇总，按 7 天口径估算；尚无日、班次及设备时段明细。
        </p>
      ) : (
        <div className="dashboard-data-coverage">
          <Database size={18} />
          <div>
            <strong>
              {id === 'production'
                ? '节拍 —　·　在制品 WIP —　·　班次对比 —'
                : '价格稳定性 / 订单批次：待补充明细'}
            </strong>
            <p>
              {id === 'production'
                ? '当前日报未提供节拍、在制品和班次字段；已有指标随产线数据更新。'
                : '当前使用供应商汇总指标，风险明细展示指标偏差；价格和订单分析需要对应记录。'}
            </p>
          </div>
          <Button variant="ghost" onClick={() => navigate('/data')}>
            查看数据
            <ArrowUpRight size={15} />
          </Button>
        </div>
      )}
      <footer className="dashboard-footer">
        <span>
          {dataset.name} ·{' '}
          {dataset.origin === 'sample'
            ? '示例资料'
            : (dataset.fileName ?? '本地维护')}
        </span>
        <span>筛选与规则调整后自动重算</span>
      </footer>
    </div>
  );
}
