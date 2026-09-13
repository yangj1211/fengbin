'use client';
import { useRef, useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  FileText,
  Workflow,
  FileCheck2,
  Search,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { modules, type ModuleId } from './model';
import AgentArtwork from './agent-artwork';
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
  const [query, setQuery] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);
  const normalize = (value: string) =>
    value.normalize('NFKC').toLocaleLowerCase('zh-CN').trim();
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const matches = modules.filter((module) => {
    const text = normalize(
      [
        module.name,
        module.category,
        module.description,
        descriptions[module.id],
        module.action,
        module.inputTitle,
        module.resultTitle,
      ].join(' '),
    );
    return terms.every((term) => text.includes(term));
  });
  function clearSearch() {
    setQuery('');
    searchInput.current?.focus();
  }
  return (
    <>
      <div className="plaza-intro">
        <div className="plaza-intro-copy">
          <h1>智能体广场</h1>
          <p>把业务问题，交给专业助手。</p>
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
            选择你的业务助手 <span aria-hidden="true">{matches.length}</span>
          </h2>
        </div>
        <search className="plaza-agent-search" aria-label="搜索智能体">
          <Search size={18} aria-hidden="true" />
          <Input
            ref={searchInput}
            type="search"
            aria-label="搜索智能体名称或用途"
            aria-controls="plaza-agent-results"
            placeholder="搜索智能体名称或用途"
            autoComplete="off"
            maxLength={200}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                clearSearch();
              }
            }}
          />
          {query && (
            <button
              type="button"
              className="plaza-search-clear"
              aria-label="清空智能体搜索"
              title="清空搜索"
              onClick={clearSearch}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </search>
      </div>
      <output className="sr-only" aria-live="polite" aria-atomic="true">
        {terms.length ? '找到' : '共'} {matches.length} 个智能体
      </output>
      <div id="plaza-agent-results" className="agent-plaza-grid">
        {matches.map((m) => {
          return (
            <button
              key={m.id}
              className={'plaza-agent-card agent-tone-' + m.id}
              onClick={() => navigate('/apps/' + m.id)}
              aria-label={`${m.name}，开始使用`}
            >
              <AgentArtwork id={m.id} />
              <div className="plaza-card-copy">
                <h3>{m.name}</h3>
                <p className="plaza-card-description">{descriptions[m.id]}</p>
              </div>
              <div className="plaza-card-bottom">
                <strong>开始使用</strong>
                <span className="plaza-entry-arrow">
                  <ArrowUpRight size={18} />
                </span>
              </div>
            </button>
          );
        })}
        {!matches.length && (
          <div className="plaza-search-empty">
            <h3>未找到匹配的智能体</h3>
            <p>试试其他名称或用途关键词。</p>
            <Button variant="ghost" onClick={clearSearch}>
              清空搜索
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
