'use client';
import {
  ArrowUpRight,
  ArrowRight,
  MessageSquareText,
  FileText,
  Workflow,
  FileCheck2,
  History,
  Check,
  LayoutDashboard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  modules,
  analyze,
  defaultInputs,
  type WorkspaceState,
  type ModuleId,
} from './model';
import { AgentIdentity } from './identity';
import { hasDashboard } from './dashboard-data';
const capabilities = [
  ['客户需求', '产品选型'],
  ['故障排查', '维修建议'],
  ['用能预测', '单耗分析'],
  ['生产洞察', '异常预警'],
  ['绩效评估', '风险识别'],
];
function AgentPreview({ id, state }: { id: ModuleId; state: WorkspaceState }) {
  const dataset = state.datasets.find((d) => d.module === id)!;
  const result = analyze(id, defaultInputs[id], dataset);
  if (id === 'customer')
    return (
      <div className="agent-preview preview-match">
        <span className="preview-caption">产品选型 · 当前目录</span>
        <div>
          {dataset.rows.slice(0, 2).map((r, i) => (
            <span key={i}>
              <span className="preview-product-mark">
                <i />
                <i />
                <i />
              </span>
              <b>{String(r['产品型号'])}</b>
              <small>{r['额定电压(V)']} V</small>
            </span>
          ))}
        </div>
      </div>
    );
  if (id === 'maintenance')
    return (
      <div className="agent-preview preview-process">
        <span className="preview-caption">从故障描述，到排查方案</span>
        <div>
          {['定位现象', '关联知识', '输出方案'].map((s, i) => (
            <span key={s}>
              <i>{i === 2 ? <Check size={15} /> : i + 1}</i>
              <b>{s}</b>
              {i < 2 && <ArrowRight size={15} />}
            </span>
          ))}
        </div>
      </div>
    );
  return (
    <div className={'agent-preview preview-' + id}>
      <span className="preview-caption">
        {id === 'energy'
          ? '各工序用能概览'
          : id === 'production'
            ? '产线计划完成率'
            : '供应商综合评分'}{' '}
        <small>· 当前数据</small>
      </span>
      <div className="preview-chart">
        {result.bars.slice(0, 3).map((b, i) => (
          <div key={i}>
            <span>{b.label}</span>
            <i>
              <em
                style={{ width: Math.max(0, Math.min(100, b.value)) + '%' }}
              />
            </i>
            <b>{b.display}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
export default function AgentPlaza({
  state,
  navigate,
}: {
  state: WorkspaceState;
  navigate: (path: string) => void;
}) {
  return (
    <>
      <div className="plaza-intro">
        <div className="plaza-intro-copy">
          <span className="platform-signature">
            <Workflow size={17} /> FENG BIN INTELLIGENCE
          </span>
          <h1>智能体广场</h1>
          <p>把业务问题，交给专业助手。</p>
          <div className="plaza-intro-details">
            <span>五个制造业务场景</span>
            <span>业务看板与专业问答</span>
          </div>
        </div>
        <div className="plaza-workflow" aria-label="从业务资料到分析结果">
          <span className="workflow-caption">让每一份资料，成为决策依据</span>
          <div>
            <span>
              <FileText size={22} />
              <b>业务资料</b>
            </span>
            <ArrowRight size={20} />
            <span className="workflow-center">
              <Workflow size={24} />
              <b>智能分析</b>
            </span>
            <ArrowRight size={20} />
            <span>
              <FileCheck2 size={22} />
              <b>可追溯结果</b>
            </span>
          </div>
        </div>
      </div>
      <div className="plaza-library-heading">
        <div>
          <h2>
            选择你的业务助手 <span>5</span>
          </h2>
          <p>每位助手专注一个领域，查看业务看板，或直接开始对话。</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/records')}>
          <History size={16} />
          分析记录
          <ArrowUpRight size={16} />
        </Button>
      </div>
      <div className="agent-plaza-grid">
        {modules.map((m, i) => {
          const count = state.records.filter((r) => r.module === m.id).length;
          return (
            <button
              key={m.id}
              className={'plaza-agent-card agent-tone-' + m.id}
              onClick={() => navigate('/apps/' + m.id)}
            >
              <div className="plaza-card-top">
                <AgentIdentity id={m.id} />
                <span className="plaza-agent-category">{m.category}</span>
                <ArrowUpRight className="plaza-entry-arrow" size={19} />
              </div>
              <h3>{m.name}</h3>
              <p className="plaza-card-description">{m.description}</p>
              <AgentPreview id={m.id} state={state} />
              <div className="plaza-card-bottom">
                <span>{capabilities[i].join(' · ')}</span>
                <strong>
                  {hasDashboard(m.id) ? (
                    <LayoutDashboard size={16} />
                  ) : (
                    <MessageSquareText size={16} />
                  )}
                  {hasDashboard(m.id) ? '进入应用' : '开始对话'}
                </strong>
              </div>
              {count > 0 && (
                <span className="plaza-record-count">
                  已保存 {count} 份分析
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
