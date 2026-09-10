'use client';
import {
  ArrowUpRight,
  ArrowRight,
  FileText,
  Workflow,
  FileCheck2,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { modules, type ModuleId } from './model';
import AgentArtwork from './agent-artwork';
import { hasDashboard } from './dashboard-data';
const descriptions: Record<ModuleId, string> = {
  customer: '理解需求，匹配产品',
  maintenance: '定位故障，辅助排查',
  energy: '洞察用能，预测变化',
  production: '掌握产线，发现异常',
  supplier: '评估表现，识别风险',
};
export default function AgentPlaza({
  navigate,
}: {
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
        </div>
        <Button variant="ghost" onClick={() => navigate('/records')}>
          <History size={16} />
          分析记录
          <ArrowUpRight size={16} />
        </Button>
      </div>
      <div className="agent-plaza-grid">
        {modules.map((m) => {
          return (
            <button
              key={m.id}
              className={'plaza-agent-card agent-tone-' + m.id}
              onClick={() => navigate('/apps/' + m.id)}
              aria-label={`${m.name}，${hasDashboard(m.id) ? '进入应用' : '开始对话'}`}
            >
              <AgentArtwork id={m.id} />
              <div className="plaza-card-copy">
                <h3>{m.name}</h3>
                <p className="plaza-card-description">{descriptions[m.id]}</p>
              </div>
              <div className="plaza-card-bottom">
                <strong>{hasDashboard(m.id) ? '进入应用' : '开始对话'}</strong>
                <span className="plaza-entry-arrow">
                  <ArrowUpRight size={18} />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
