'use client';
import {
  ArrowUpRight,
  UsersRound,
  Wrench,
  Zap,
  ChartNoAxesCombined,
  ShieldCheck,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { modules, type WorkspaceState } from './model';
const icons = [UsersRound, Wrench, Zap, ChartNoAxesCombined, ShieldCheck];
const capabilities = [
  ['需求分析', '产品选型', '候选对比'],
  ['故障匹配', '维修方案', '排查步骤'],
  ['用能预测', '单耗分析', '优化建议'],
  ['产线洞察', '质量分析', '异常预警'],
  ['绩效评分', '风险识别', '供应商对比'],
];
export default function AgentPlaza({
  state,
  navigate,
}: {
  state: WorkspaceState;
  navigate: (path: string) => void;
}) {
  return (
    <>
      <div className="plaza-heading">
        <div>
          <p className="plaza-eyebrow">
            <span /> 丰宾电子 · 企业智能体
          </p>
          <h1>智能体广场</h1>
          <p className="plaza-description">
            选择一位业务助手，开始今天的工作。
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/records')}>
          <History size={16} /> 我的分析记录
        </Button>
      </div>
      <div className="plaza-section-label">
        <h2>
          全部智能体 <span>05</span>
        </h2>
        <p>覆盖销售、设备、能源、生产与采购</p>
      </div>
      <div className="agent-plaza-grid">
        {modules.map((m, i) => {
          const Icon = icons[i];
          const recordCount = state.records.filter(
            (r) => r.module === m.id,
          ).length;
          return (
            <button
              className={'plaza-agent-card agent-tone-' + m.id}
              key={m.id}
              onClick={() => navigate('/apps/' + m.id)}
            >
              <div className="plaza-card-top">
                <span className="plaza-agent-icon">
                  <Icon size={26} strokeWidth={1.65} />
                </span>
                <span className="plaza-agent-category">{m.category}</span>
              </div>
              <h3>{m.name}</h3>
              <p className="plaza-card-description">{m.description}</p>
              <div className="plaza-capabilities">
                {capabilities[i].map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              <div className="plaza-card-bottom">
                <span>
                  {recordCount ? recordCount + ' 份分析记录' : '开始一份新分析'}
                </span>
                <strong>
                  进入智能体 <ArrowUpRight size={17} />
                </strong>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
