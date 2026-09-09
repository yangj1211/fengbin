'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  Plus,
  SlidersHorizontal,
  Paperclip,
  Save,
  Check,
  FileText,
  ChevronDown,
  MessageSquareText,
  RotateCcw,
  History,
  Square,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import {
  defaultInputs,
  modules,
  type ModuleId,
  type Inputs,
  type WorkspaceState,
} from './model';
import { updateWorkspace, storageMessage } from './store';
import {
  replyToQuestion,
  conditionSummary,
  suggestions,
  type ConversationTurn,
} from './conversation';
import { AgentIdentity } from './identity';
import AnalysisConditions from './conditions';
import AnalysisResult from './result';
export default function ModuleWorkspace({
  id,
  state,
  navigate,
}: {
  id: ModuleId;
  state: WorkspaceState;
  navigate: (path: string) => void;
}) {
  const m = modules.find((m) => m.id === id)!;
  const dataset = state.datasets.find((d) => d.id === m.dataset)!;
  const [edited, setEdited] = useState<Inputs | null>(null);
  const input = edited ?? state.drafts[id] ?? defaultInputs[id];
  const [question, setQuestion] = useState<string | null>(null);
  const text = question ?? input.question ?? '';
  const [localTurns, setLocalTurns] = useState<ConversationTurn[] | null>(null);
  const turns = localTurns ?? state.conversations?.[id] ?? [];
  const [pending, setPending] = useState('');
  const [message, setMessage] = useState('');
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [saveTarget, setSaveTarget] = useState<ConversationTurn | null>(null);
  const [recordName, setRecordName] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const scrollNext = useRef(false);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (scrollNext.current) {
      end.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
        block: 'end',
      });
      scrollNext.current = false;
    }
  }, [turns.length, pending]);
  function change(key: string, value: string) {
    setEdited({ ...input, [key]: value });
    setMessage('');
  }
  function send(value = text) {
    const query = value.trim();
    if (!query || pending) return;
    if (query.length > 2000) {
      setMessage('问题请控制在 2000 字以内。');
      return;
    }
    setMessage('');
    setPending(query);
    setQuestion('');
    setConditionsOpen(false);
    scrollNext.current = true;
    const captured = { ...input };
    timer.current = setTimeout(() => {
      try {
        const reply = replyToQuestion(id, query, captured, dataset);
        const turn: ConversationTurn = {
          ...reply,
          id: crypto.randomUUID(),
          question: query,
          createdAt: new Date().toISOString(),
          sourceName: dataset.name,
          sourceOrigin: dataset.origin,
        };
        const next = [...turns, turn].slice(-20);
        const nextInput = { ...reply.inputs, question: '' };
        setEdited(nextInput);
        if (
          updateWorkspace((s) => ({
            ...s,
            conversations: { ...s.conversations, [id]: next },
            drafts: { ...s.drafts, [id]: nextInput },
          }))
        )
          setLocalTurns(null);
        else {
          setLocalTurns(next);
          setMessage(storageMessage());
        }
      } catch (e) {
        setMessage(
          e instanceof Error
            ? e.message
            : '暂时无法完成分析，请调整条件后再试。',
        );
        setQuestion(query);
      }
      setPending('');
      scrollNext.current = true;
    }, 240);
  }
  function stop() {
    if (timer.current) clearTimeout(timer.current);
    setQuestion(pending);
    setPending('');
    setMessage('已停止本次分析，问题保留在输入框中。');
  }
  function saveDraft() {
    if (
      updateWorkspace((s) => ({
        ...s,
        drafts: { ...s.drafts, [id]: { ...input, question: text } },
      }))
    )
      setMessage('问题与分析条件已保存为草稿。');
    else setMessage(storageMessage());
  }
  function saveRecord() {
    if (!saveTarget?.analysis || !recordName.trim()) return;
    if (state.records.length >= 100) {
      setMessage('最多保存 100 份分析，请先导出并清理旧记录。');
      setSaveTarget(null);
      return;
    }
    const recordId = crypto.randomUUID();
    const target = saveTarget;
    const record = {
      id: recordId,
      module: id,
      name: recordName.trim(),
      createdAt: new Date().toISOString(),
      inputs: target.inputs,
      analysis: target.analysis!,
      sourceName: target.sourceName,
      sourceOrigin: target.sourceOrigin,
      state: '待跟进' as const,
      note: '',
    };
    const next = turns.map((t) =>
      t.id === target.id ? { ...t, savedRecordId: recordId } : t,
    );
    if (
      updateWorkspace((s) => ({
        ...s,
        records: [record, ...s.records],
        conversations: { ...s.conversations, [id]: next },
      }))
    ) {
      setLocalTurns(null);
      setSaveTarget(null);
      setMessage('分析已保存，可在分析记录中继续跟进。');
    } else setMessage(storageMessage());
  }
  function clear() {
    if (
      updateWorkspace((s) => ({
        ...s,
        conversations: { ...s.conversations, [id]: [] },
        drafts: { ...s.drafts, [id]: { ...defaultInputs[id], question: '' } },
      }))
    ) {
      setLocalTurns(null);
      setEdited(null);
      setQuestion('');
      setClearOpen(false);
      setMessage('');
      composer.current?.focus();
    } else setMessage(storageMessage());
  }
  return (
    <div className={'chat-workspace agent-tone-' + id}>
      <div className="chat-heading">
        <div className="chat-heading-identity">
          <button
            aria-label="返回智能体广场"
            title="返回智能体广场"
            className="chat-back"
            onClick={() => navigate('/')}
          >
            <ArrowLeft size={18} />
          </button>
          <AgentIdentity id={id} />
          <div>
            <h1>{m.name}</h1>
            <p>
              {m.category}
              <span>·</span>资料驱动的业务助手
            </p>
          </div>
        </div>
        <div className="chat-heading-actions">
          <Button variant="ghost" onClick={() => navigate('/records')}>
            <History size={16} />
            <span>分析记录</span>
          </Button>
          <Button
            variant="outline"
            disabled={Boolean(pending)}
            onClick={() => {
              if (turns.length || text.trim() || edited || state.drafts[id])
                setClearOpen(true);
              else composer.current?.focus();
            }}
          >
            <Plus size={17} />
            <span>新对话</span>
          </Button>
        </div>
      </div>
      <div className="chat-body">
        {!turns.length && !pending ? (
          <div className="chat-welcome">
            <AgentIdentity id={id} large />
            <p className="chat-welcome-label">{m.category} · 专属业务助手</p>
            <h2>
              {id === 'customer'
                ? '为客户，找到更合适的产品。'
                : id === 'maintenance'
                  ? '一起找到设备问题的排查方向。'
                  : id === 'energy'
                    ? '让每一度电，都有据可循。'
                    : id === 'production'
                      ? '看见产线表现，及时发现偏差。'
                      : '让供应商表现，清晰可见。'}
            </h2>
            <p>{m.description}直接告诉我您想解决的问题。</p>
            <div className="chat-prompt-grid">
              {suggestions[id].map((p) => (
                <button key={p.title} onClick={() => send(p.question)}>
                  <span className="prompt-number">
                    <MessageSquareText size={17} />
                    <ArrowUpRight size={15} />
                  </span>
                  <strong>{p.title}</strong>
                  <span>{p.question}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="conversation-thread" aria-label="问答记录">
            {turns.map((turn) => {
              const saved =
                turn.savedRecordId &&
                state.records.some((r) => r.id === turn.savedRecordId);
              return (
                <div className="conversation-turn" key={turn.id}>
                  <div className="user-message">
                    <span className="message-person">我</span>
                    <p>{turn.question}</p>
                  </div>
                  <div className="assistant-message">
                    <AgentIdentity id={id} />
                    <div className="assistant-message-body">
                      <div className="assistant-name">
                        {m.name}
                        <span>资料分析</span>
                      </div>
                      <p className="assistant-answer">{turn.answer}</p>
                      {turn.analysis && (
                        <>
                          <div className="answer-conditions">
                            {conditionSummary(id, turn.inputs).map((v, i) => (
                              <span key={i}>{v}</span>
                            ))}
                          </div>
                          <div className="chat-analysis-panel">
                            <AnalysisResult
                              analysis={turn.analysis}
                              module={id}
                            />
                          </div>
                          <div className="answer-actions">
                            <span>
                              <FileText size={14} />
                              {turn.sourceName}
                            </span>
                            <Button
                              variant="ghost"
                              onClick={() => {
                                if (saved)
                                  navigate('/records/' + turn.savedRecordId);
                                else {
                                  setSaveTarget(turn);
                                  setRecordName(turn.question.slice(0, 55));
                                }
                              }}
                            >
                              {saved ? <Check size={15} /> : <Save size={15} />}{' '}
                              {saved ? '已保存 · 打开记录' : '保存分析'}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {pending && (
              <div className="conversation-turn">
                <div className="user-message">
                  <span className="message-person">我</span>
                  <p>{pending}</p>
                </div>
                <div className="assistant-message">
                  <AgentIdentity id={id} />
                  <div className="assistant-message-body">
                    <div className="assistant-name">{m.name}</div>
                    <output className="chat-pending">
                      <span>
                        <i />
                        <i />
                        <i />
                      </span>
                      正在分析本地资料…
                    </output>
                  </div>
                </div>
              </div>
            )}
            <div ref={end} />
          </div>
        )}
      </div>
      <div className="chat-composer-region">
        {message && <output className="chat-feedback">{message}</output>}
        {turns.length > 0 && !pending && (
          <div className="chat-followups">
            {suggestions[id].slice(1).map((p) => (
              <button key={p.title} onClick={() => send(p.question)}>
                {p.title}
                <ArrowUpRight size={13} />
              </button>
            ))}
          </div>
        )}
        <div className="chat-composer">
          {conditionsOpen && (
            <div className="chat-conditions-panel">
              <div className="conditions-panel-heading">
                <div>
                  <h2>分析条件</h2>
                  <p>问题中明确的参数会更新这些条件，其余沿用当前值。</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="重置分析条件"
                  onClick={() =>
                    setEdited({ ...defaultInputs[id], question: text })
                  }
                >
                  <RotateCcw size={16} />
                </Button>
              </div>
              <AnalysisConditions
                id={id}
                input={input}
                dataset={dataset}
                change={change}
                disabled={Boolean(pending)}
              />
              <Button
                variant="outline"
                onClick={() => send('请按当前分析条件完成分析。')}
                disabled={Boolean(pending)}
              >
                按这些条件分析
                <ArrowUpRight size={15} />
              </Button>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <Label htmlFor="agent-question" className="sr-only">
              向{m.name}提问
            </Label>
            <Textarea
              id="agent-question"
              ref={composer}
              value={text}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={
                id === 'customer'
                  ? '描述客户需求，例如：工业电源用，450V、470μF，推荐哪些型号？'
                  : '输入您的问题，也可以继续追问或调整分析条件…'
              }
              maxLength={2000}
              disabled={Boolean(pending)}
              rows={3}
            />
            <div className="composer-toolbar">
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="管理资料与导入文件"
                  title="管理资料与导入文件"
                  onClick={() => navigate('/data')}
                >
                  <Paperclip size={17} />
                  <span>资料</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  aria-expanded={conditionsOpen}
                  onClick={() => setConditionsOpen(!conditionsOpen)}
                >
                  <SlidersHorizontal size={16} />
                  <span>分析条件</span>
                  <ChevronDown
                    size={13}
                    className={conditionsOpen ? 'rotated' : ''}
                  />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="保存当前问题和条件为草稿"
                  title="保存草稿"
                  onClick={saveDraft}
                  disabled={Boolean(pending)}
                >
                  <Save size={16} />
                </Button>
              </div>
              <div>
                <span className="composer-shortcut">
                  Enter 发送 · Shift + Enter 换行
                </span>
                {pending ? (
                  <Button
                    type="button"
                    className="send-message-button"
                    aria-label="停止分析"
                    onClick={stop}
                  >
                    <Square size={16} />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="send-message-button"
                    aria-label="发送问题"
                    disabled={!text.trim()}
                  >
                    <ArrowUp size={20} />
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
        <div className="chat-composer-footnote">
          <span>
            {dataset.origin === 'sample' ? '示例资料' : '本地资料'} ·
            问答由当前数据与规则生成
          </span>
          <span>
            {turns.length >= 20 ? '保留最近 20 轮对话' : '对话保存在当前浏览器'}
          </span>
        </div>
      </div>
      <Dialog
        open={Boolean(saveTarget)}
        onOpenChange={(open) => {
          if (!open) setSaveTarget(null);
        }}
      >
        <DialogContent className="app-dialog">
          <DialogHeader>
            <DialogTitle>保存分析记录</DialogTitle>
            <DialogDescription>
              保留本次问题、条件与分析结果，方便后续跟进或导出。
            </DialogDescription>
          </DialogHeader>
          <div className="app-field">
            <Label htmlFor="record-name">记录名称</Label>
            <Input
              id="record-name"
              maxLength={100}
              value={recordName}
              onChange={(e) => setRecordName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTarget(null)}>
              取消
            </Button>
            <Button onClick={saveRecord} disabled={!recordName.trim()}>
              保存记录
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent className="app-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>开始一段新对话？</AlertDialogTitle>
            <AlertDialogDescription>
              将清空此智能体的当前问答和草稿。已保存到分析记录的内容仍然保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setClearOpen(false)}>
              取消
            </Button>
            <Button onClick={clear}>开始新对话</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
