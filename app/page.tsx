'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Cpu,
  Database,
  Factory,
  FileSpreadsheet,
  Layers2,
  Lightbulb,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wrench,
  Zap,
  ChartNoAxesCombined,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { scenes, type Scene } from './scenes';
import { flushSync } from 'react-dom';
import { getAnswer } from './answers';
const icons = [UsersRound, Wrench, Zap, ChartNoAxesCombined, ShieldCheck];
function Navigation({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <Sidebar className="app-sidebar" collapsible="offcanvas">
      <SidebarHeader className="brand-area">
        <div className="brand">
          <div className="brand-symbol">
            <Layers2 size={23} />
          </div>
          <div>
            <strong>丰宾电子</strong>
            <span>智能工厂 · AI 工作台</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <div className="workspace-label">
          <span>智能体工作台</span>
          <span className="nav-count">05</span>
        </div>
        <SidebarMenu className="agent-menu">
          {scenes.map((s, i) => {
            const Icon = icons[i];
            return (
              <SidebarMenuItem key={s.id}>
                <SidebarMenuButton
                  isActive={s.id === selected}
                  aria-current={s.id === selected ? 'page' : undefined}
                  onClick={() => {
                    onSelect(s.id);
                    setOpenMobile(false);
                  }}
                  className="agent-nav"
                >
                  <Icon />
                  <span>{s.short}</span>
                  {s.id === selected && (
                    <ChevronRight className="nav-chevron" />
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
        <div className="sidebar-caption">
          <div className="tiny-line" />
          <p>
            让每一份工厂数据，
            <br />
            成为下一步行动的依据。
          </p>
        </div>
      </SidebarContent>
      <SidebarFooter className="sidebar-bottom">
        <div className="demo-note">
          <span className="status-dot" />
          <span>POC 演示环境</span>
        </div>
        <div className="account">
          <span className="avatar">丰</span>
          <div>
            <strong>丰宾电子</strong>
            <span>智能制造场景验证</span>
          </div>
          <Factory size={17} />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
function Chart({ scene }: { scene: Scene }) {
  if (scene.id === '16')
    return (
      <div className="energy-chart">
        <div className="chart-legend">
          <span>
            <i />
            预测用电
          </span>
          <span>单位：MWh</span>
        </div>
        <div className="column-chart">
          {scene.bars.map((b) => (
            <div key={b.label} className="column-item">
              <span>{b.value}</span>
              <div className="column-track">
                <div style={{ height: `${(b.value / 24) * 100}%` }} />
              </div>
              <small>{b.label}</small>
            </div>
          ))}
        </div>
      </div>
    );
  return (
    <div className="bar-chart">
      {scene.bars.map((b, i) => (
        <div className="bar-row" key={b.label}>
          <span>{b.label}</span>
          <div className="bar-track">
            <div
              className={`${i === 0 ? 'primary-bar' : ''} ${scene.id === '10' && i === 2 ? 'warning-bar' : ''}`}
              style={{ width: `${b.value}%` }}
            />
          </div>
          <strong>{b.display}</strong>
        </div>
      ))}
    </div>
  );
}
export default function Home() {
  const [selected, setSelected] = useState('33');
  const scene = scenes.find((s) => s.id === selected)!;
  const [prompt, setPrompt] = useState(scenes[0].prompts[0].text);
  const [preset, setPreset] = useState(0);
  const [phase, setPhase] = useState(-1);
  const [done, setDone] = useState(false);
  const [submitted, setSubmitted] = useState('');
  const [tab, setTab] = useState('result');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const running = phase >= 0 && phase < 4;
  const Icon = icons[scenes.indexOf(scene)];
  const answerIndex =
    done || running
      ? scene.prompts.findIndex((p) => p.text === submitted)
      : preset;
  const answer = getAnswer(scene, Math.max(answerIndex, 0));
  const customRequest =
    done && !scene.prompts.some((p) => p.text === submitted);
  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }
  function selectScene(id: string) {
    const next = scenes.find((s) => s.id === id);
    if (!next) return;
    clearTimers();
    setSelected(id);
    setPrompt(next.prompts[0].text);
    setPreset(0);
    setPhase(-1);
    setDone(false);
    setSubmitted('');
    setTab('result');
  }
  function reset() {
    selectScene(selected);
  }
  function run() {
    if (!prompt.trim() || running) return;
    clearTimers();
    setSubmitted(prompt.trim());
    setDone(false);
    setPhase(0);
    setTab('process');
    [1, 2, 3, 4].forEach((step) =>
      timers.current.push(
        setTimeout(() => {
          setPhase(step);
          if (step === 4) {
            setDone(true);
            setTab('result');
          }
        }, step * 650),
      ),
    );
  }
  const selectRef = useRef(selectScene);
  useEffect(() => {
    selectRef.current = selectScene;
  });
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: object,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'select_demo_scene',
            title: '切换智能体演示场景',
            description:
              '选择丰宾电子的一个固定演示场景并重置该场景的演示。编号：33 产品推荐、29 设备维修、16 能源预测、10 生产洞察、37 供应商评估。',
            inputSchema: {
              type: 'object',
              properties: {
                sceneId: {
                  type: 'string',
                  enum: ['33', '29', '16', '10', '37'],
                },
              },
              required: ['sceneId'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute(input: unknown) {
              if (
                !input ||
                typeof input !== 'object' ||
                Array.isArray(input) ||
                Object.keys(input).length !== 1 ||
                !('sceneId' in input) ||
                typeof input.sceneId !== 'string' ||
                !scenes.some((s) => s.id === input.sceneId)
              )
                throw new Error('请选择有效的场景编号');
              const id = input.sceneId;
              flushSync(() => selectRef.current(id));
              return {
                sceneId: id,
                name: scenes.find((s) => s.id === id)!.name,
                state: 'demo_ready',
                dataMode: 'fixed_samples',
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* This optional browser API may be unavailable. */
    }
    return () => lifecycle.abort();
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <SidebarProvider
      style={{ '--sidebar-width': '244px' } as React.CSSProperties}
    >
      <Navigation selected={selected} onSelect={selectScene} />
      <main className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger aria-label="切换场景导航" />
            <span>智能工厂</span>
            <ChevronRight size={14} />
            <strong>智能体工作台</strong>
          </div>
          <div className="topbar-right">
            <span className="poc-pill">POC DEMO</span>
            <span className="topbar-divider" />
            <span className="workspace-owner">丰宾电子</span>
            <span className="top-avatar">丰</span>
          </div>
        </header>
        <div className="page-content">
          <section className="page-heading">
            <div>
              <div className="scene-meta">
                <span>场景 {scene.id}</span>
                <span>·</span>
                <span>{scene.category}</span>
              </div>
              <h1>
                {scene.name}
                <span className="ai-label">AI</span>
              </h1>
              <p>{scene.description}</p>
            </div>
            <Button
              variant="outline"
              className="reset-button"
              onClick={reset}
              aria-label="重置演示"
            >
              <RotateCcw size={15} />
              重置演示
            </Button>
          </section>
          <div className="workspace-grid">
            <div className="primary-workspace">
              <section className="request-panel" aria-label="分析需求">
                <div className="panel-heading">
                  <div className="title-with-icon">
                    <Icon size={19} />
                    <h2>告诉智能体，你想了解什么</h2>
                  </div>
                  <span className="sample-label">内置样例</span>
                </div>
                <div className="prompt-options" aria-label="示例问题">
                  {scene.prompts.map((p, i) => (
                    <button
                      type="button"
                      key={p.label}
                      aria-pressed={preset === i}
                      className={preset === i ? 'selected' : ''}
                      disabled={running}
                      onClick={() => {
                        setPrompt(p.text);
                        setPreset(i);
                        setDone(false);
                        setPhase(-1);
                        setSubmitted('');
                        setTab('result');
                      }}
                    >
                      {p.label}
                      <ArrowUpRight size={13} />
                    </button>
                  ))}
                </div>
                <label className="sr-only" htmlFor="request">
                  需求描述
                </label>
                <Textarea
                  id="request"
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    setPreset(-1);
                    setDone(false);
                    setPhase(-1);
                  }}
                  disabled={running}
                  maxLength={1500}
                  className="request-input"
                />
                <div className="request-footer">
                  <span>
                    <Database size={14} />
                    已载入 3 份演示资料
                  </span>
                  <Button
                    className="run-button"
                    disabled={running || !prompt.trim()}
                    onClick={run}
                  >
                    {running ? <Cpu size={16} /> : <Sparkles size={16} />}{' '}
                    {running ? '正在分析…' : '运行演示'}
                    {!running && <ArrowRight size={15} />}
                  </Button>
                </div>
              </section>
              <section
                className="result-panel"
                aria-label="智能体分析结果"
                aria-busy={running}
              >
                <div className="result-header">
                  <div className="title-with-icon">
                    <div className="result-mark">
                      <Sparkles size={17} />
                    </div>
                    <h2>智能体分析</h2>
                    <span
                      className={done ? 'result-state done' : 'result-state'}
                    >
                      {running ? '分析中' : done ? '分析完成' : '示例预览'}
                    </span>
                  </div>
                  <span className="result-source">
                    {done ? '基于内置演示样例' : '运行后查看完整过程'}
                  </span>
                </div>
                <Tabs
                  value={tab}
                  onValueChange={(v) => setTab(String(v))}
                  className="result-tabs"
                >
                  <TabsList variant="line" className="result-tab-list">
                    <TabsTrigger value="result">分析结果</TabsTrigger>
                    <TabsTrigger value="evidence">分析依据</TabsTrigger>
                    <TabsTrigger value="process">
                      处理过程{running && <span className="processing-dot" />}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="result" className="result-tab-content">
                    {customRequest && (
                      <div className="question-receipt">
                        <strong>你的问题</strong>
                        {submitted}
                        <p>
                          此 POC
                          使用固定样例，下方展示当前场景示例，未生成真实分析。
                        </p>
                      </div>
                    )}
                    <div className="conclusion">
                      <div className="conclusion-icon">
                        <CheckCheck size={20} />
                      </div>
                      <div>
                        <h3>{answer.resultTitle}</h3>
                        <p>{answer.conclusion}</p>
                      </div>
                    </div>
                    {answer.simple ? (
                      <div className="insight-list">
                        {answer.evidence.map((e) => (
                          <article key={e.title}>
                            <h3>{e.title}</h3>
                            <p>{e.body}</p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="chart-section">
                          <div className="subsection-title">
                            <h3>{scene.chartTitle}</h3>
                            <span>模拟数据</span>
                          </div>
                          <Chart scene={scene} />
                        </div>
                        <div className="result-table">
                          <h3>{scene.tableTitle}</h3>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {scene.columns.map((c) => (
                                  <TableHead key={c}>{c}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {scene.rows.map((row, i) => (
                                <TableRow key={i}>
                                  {row.map((cell, j) => (
                                    <TableCell key={j}>
                                      {j === row.length - 1 ? (
                                        <span
                                          className={`table-status ${cell === '需关注' || cell === '较高风险' ? 'caution' : ''} ${cell === '优先推荐' ? 'preferred' : ''}`}
                                        >
                                          {cell}
                                        </span>
                                      ) : (
                                        cell
                                      )}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </>
                    )}
                    <div className="recommendation">
                      <Lightbulb size={18} />
                      <div>
                        <strong>下一步建议</strong>
                        <p>{answer.recommendation}</p>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="evidence" className="result-tab-content">
                    <div className="evidence-intro">
                      <h3>结论有依据，判断可追溯</h3>
                      <p>以下为当前场景的样例分析口径。</p>
                    </div>
                    {answer.evidence.map((e, i) => (
                      <div className="evidence-row" key={e.title}>
                        <span className="evidence-index">0{i + 1}</span>
                        <div>
                          <h3>{e.title}</h3>
                          <p>{e.body}</p>
                        </div>
                      </div>
                    ))}
                    <div className="evidence-source">
                      <FileSpreadsheet size={16} />
                      数据来源：当前场景内置的 3 份演示资料
                    </div>
                  </TabsContent>
                  <TabsContent value="process" className="result-tab-content">
                    <div className="process-intro">
                      <h3>
                        {running
                          ? '智能体正在处理你的需求'
                          : done
                            ? '本次演示已完成'
                            : '一次分析，四个步骤'}
                      </h3>
                      <p>
                        {done
                          ? '已完成样例检索、分析与结果整理。'
                          : '点击「运行演示」，查看智能体的处理流程。'}
                      </p>
                    </div>
                    <ol className="process-list">
                      {scene.steps.map((step, i) => (
                        <li
                          key={step}
                          className={
                            phase > i ? 'complete' : phase === i ? 'active' : ''
                          }
                        >
                          <span className="process-node">
                            {phase > i ? <Check size={16} /> : i + 1}
                          </span>
                          <div>
                            <strong>{step}</strong>
                            <span>
                              {phase > i
                                ? '已完成'
                                : phase === i
                                  ? '正在处理演示样例…'
                                  : '等待开始'}
                            </span>
                          </div>
                          {phase > i && (
                            <Check size={16} className="step-check" />
                          )}
                        </li>
                      ))}
                    </ol>
                  </TabsContent>
                </Tabs>
                <div className="result-footnote">
                  <CircleHelp size={13} />
                  <span>演示结果为预设样例，用于验证交互流程。</span>
                </div>
              </section>
              <output className="screen-disclaimer">
                {customRequest
                  ? '已记录你的问题；当前 POC 展示本场景固定样例，未按输入生成真实分析。'
                  : '当前为前端 POC · 未连接真实业务系统或 AI 模型'}
              </output>
            </div>
            <aside className="context-rail">
              <section className="agent-overview">
                <div className="agent-visual">
                  <Icon size={26} />
                  <span className="agent-ready-dot" />
                </div>
                <h2>{scene.short}智能体</h2>
                <p>{scene.description}</p>
                <div className="agent-state">
                  <span className="status-dot" />
                  演示就绪
                </div>
              </section>
              <section className="rail-section">
                <div className="rail-title">
                  <h3>演示资料</h3>
                  <span>3 份</span>
                </div>
                <div className="source-list">
                  {scene.sources.map((s) => (
                    <div className="source-item" key={s.name}>
                      <div className="file-icon">
                        <FileSpreadsheet size={17} />
                      </div>
                      <div>
                        <strong>{s.name}</strong>
                        <span>{s.detail}</span>
                      </div>
                      <Check size={13} />
                    </div>
                  ))}
                </div>
              </section>
              <section className="rail-section flow-section">
                <h3>这个场景如何工作</h3>
                <div className="mini-flow">
                  <span>业务问题</span>
                  <ChevronRight size={13} />
                  <span>数据分析</span>
                  <ChevronRight size={13} />
                  <span>行动建议</span>
                </div>
                <p>
                  从明确需求到输出建议，
                  <br />
                  把业务判断放在同一个工作台。
                </p>
              </section>
              <section className="rail-tip">
                <Lightbulb size={17} />
                <div>
                  <h3>演示小提示</h3>
                  <p>
                    选择一个示例问题，点击运行。切换左侧场景，即可体验其他智能体。
                  </p>
                </div>
              </section>
              <div className="scene-progress">
                <span>当前场景</span>
                <strong>
                  0{scenes.indexOf(scene) + 1}
                  <span> / 05</span>
                </strong>
                <div>
                  {scenes.map((s) => (
                    <span
                      key={s.id}
                      className={s.id === scene.id ? 'active' : ''}
                    />
                  ))}
                </div>
              </div>
            </aside>
          </div>
          <footer className="page-footer">
            <span>丰宾电子 · 智能工厂 AI 场景验证</span>
            <span>让数据连接业务</span>
          </footer>
        </div>
      </main>
    </SidebarProvider>
  );
}
