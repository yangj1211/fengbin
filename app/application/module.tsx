'use client';
import { presentAnswer } from './business-presentation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  ArrowUpRight,
  SlidersHorizontal,
  Paperclip,
  Save,
  ChevronDown,
  MessageSquareText,
  RotateCcw,
  Square,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  defaultInputs,
  initialDatasets,
  modules,
  type ModuleId,
  type Inputs,
  type WorkspaceState,
} from './model';
import { updateWorkspace, storageMessage } from './store';
import {
  replyToQuestion,
  suggestions,
  type ConversationTurn,
  type ConversationSession,
} from './conversation';
import { conversationTitle, mergeConversationTurns } from './sessions';
import { AgentIdentity } from './identity';
import AnalysisConditions from './conditions';
import { SourceLibrary } from './customer-sources';
import ConversationAnswer from './conversation-answer';
import { answerText, processingSummary } from './answer-presentation';
import { normalizeMaintenanceInputs } from './maintenance-engine';
import { normalizeCustomerInputs } from './customer-engine';
const customerWelcomeCards = [
  { title: '工业电源选型', description: '450 V、470 μF，比较符合条件的型号。' },
  { title: '小型化选型', description: '限定直径与高度，寻找合适的电容。' },
  { title: '型号替代', description: '查找 OLD-450-220 的替代候选。' },
];
type StreamFrame = {
  turn: ConversationTurn;
  processing: string;
  answer: string;
  phase: 'thinking' | 'answer';
};
type AnswerRun = StreamFrame & { captured: Inputs };
const emptyTurns: ConversationTurn[] = [];
export default function ModuleWorkspace({
  id,
  state,
  navigate,
  session,
  registerLeaveGuard,
}: {
  id: ModuleId;
  state: WorkspaceState;
  navigate: (path: string) => void;
  session?: ConversationSession;
  registerLeaveGuard: (guard: ((discard?: boolean) => boolean) | null) => void;
}) {
  const m = modules.find((m) => m.id === id)!;
  const plainReply =
    id === 'customer' ||
    id === 'maintenance' ||
    id === 'energy' ||
    id === 'production' ||
    id === 'supplier';
  const sampleLibrary = id === 'customer' || id === 'maintenance';
  const welcomeSuggestions =
    id === 'customer' ? suggestions[id].slice(0, 3) : suggestions[id];
  const dataset = (sampleLibrary ? initialDatasets : state.datasets).find(
    (d) => d.id === m.dataset,
  )!;
  const [edited, setEdited] = useState<Inputs | null>(null);
  const draft = edited ?? session?.draft ?? defaultInputs[id];
  const input =
    id === 'customer'
      ? normalizeCustomerInputs(draft)
      : id === 'maintenance'
        ? normalizeMaintenanceInputs(draft)
        : draft;
  const [question, setQuestion] = useState<string | null>(null);
  const text = question ?? input.question ?? '';
  const [localTurns, setLocalTurns] = useState<ConversationTurn[] | null>(null);
  const localTurnsRef = useRef(localTurns);
  useEffect(() => {
    localTurnsRef.current = localTurns;
  }, [localTurns]);
  const turns = localTurns ?? session?.turns ?? emptyTurns;
  const displayedTurns = useMemo(() => turns.map(presentAnswer), [turns]);
  const [pending, setPending] = useState('');
  const [stream, setStream] = useState<StreamFrame | null>(null);
  const run = useRef<AnswerRun | null>(null);
  const [message, setMessage] = useState('');
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const chatBody = useRef<HTMLDivElement>(null);
  const followOutput = useRef(true);
  const composer = useRef<HTMLTextAreaElement>(null);
  const scrollNext = useRef(false);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      run.current = null;
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
  useEffect(() => {
    if (stream && followOutput.current && chatBody.current)
      chatBody.current.scrollTop = chatBody.current.scrollHeight;
  }, [stream]);
  useEffect(() => {
    registerLeaveGuard((discard = false) => {
      if (pending) {
        setMessage('请等待本次回答完成，或先点击停止，再切换对话。');
        return false;
      }
      if (discard || !session) return true;
      const draft = { ...input, question: text };
      if (
        !localTurns &&
        JSON.stringify(draft) === JSON.stringify(session.draft)
      )
        return true;
      const ok = updateWorkspace((s) => ({
        ...s,
        sessions: (s.sessions ?? []).map((item) =>
          item.id === session.id
            ? {
                ...item,
                draft,
                turns: localTurns
                  ? mergeConversationTurns(item.turns, localTurns)
                  : item.turns,
                title: conversationTitle(
                  item,
                  item.turns.length
                    ? item.title
                    : text.trim().slice(0, 48) || '新对话',
                ),
              }
            : item,
        ),
      }));
      if (!ok) setMessage(storageMessage());
      return ok;
    });
    return () => registerLeaveGuard(null);
  });
  function change(key: string, value: string) {
    setEdited({ ...input, [key]: value });
    setMessage('');
  }
  function persistTurn(turn: ConversationTurn, nextInput: Inputs) {
    if (!session) return false;
    const bufferedTurns = localTurnsRef.current;
    let next = [...(bufferedTurns ?? turns), turn].slice(-20);
    const saved = updateWorkspace((current) => ({
      ...current,
      sessions: (current.sessions ?? []).map((item) =>
        item.id === session.id
          ? {
              ...item,
              turns: (next = bufferedTurns
                ? mergeConversationTurns(item.turns, next)
                : [...item.turns, turn].slice(-20)),
              draft: nextInput,
              title: conversationTitle(
                item,
                item.turns[0]?.question.slice(0, 48) ||
                  turn.question.slice(0, 48),
              ),
              updatedAt: turn.createdAt,
            }
          : item,
      ),
    }));
    setEdited(nextInput);
    localTurnsRef.current = saved ? null : next;
    setLocalTurns(localTurnsRef.current);
    if (!saved) setMessage(storageMessage());
    return saved;
  }
  function send(value = text) {
    const query = value.trim();
    if (!query || run.current) return;
    if (!session) {
      setMessage('对话尚未准备好，请稍后重试。');
      return;
    }
    if (query.length > 2000) {
      setMessage('问题请控制在 2000 字以内。');
      return;
    }
    const active: AnswerRun = {
      turn: {
        id: crypto.randomUUID(),
        question: query,
        answer: '',
        createdAt: new Date().toISOString(),
        inputs: { ...input },
        sourceName: dataset.name,
        sourceOrigin: dataset.origin,
      },
      captured: { ...input },
      processing: '',
      answer: '',
      phase: 'thinking',
    };
    run.current = active;
    setMessage('');
    setPending(query);
    setStream({ ...active });
    setQuestion('');
    setConditionsOpen(false);
    followOutput.current = true;
    scrollNext.current = true;

    const showFrame = () => {
      if (run.current === active) setStream({ ...active });
    };
    const schedule = (callback: () => void, delay = 24) => {
      timer.current = setTimeout(() => {
        if (run.current === active) callback();
      }, delay);
    };
    schedule(() => {
      try {
        const reply = replyToQuestion(id, query, active.captured, dataset);
        active.turn = presentAnswer({
          ...active.turn,
          ...reply,
          status: 'complete',
        });
        active.turn.processingSummary = processingSummary(id, active.turn);
        const thinkingCharacters = Array.from(active.turn.processingSummary);
        const answerCharacters = Array.from(answerText(id, active.turn));
        const answerChunk = Math.max(
          4,
          Math.ceil(answerCharacters.length / 150),
        );
        let thinkingPosition = 0;
        let answerPosition = 0;
        const outputAnswer = () => {
          answerPosition = Math.min(
            answerCharacters.length,
            answerPosition + answerChunk,
          );
          active.answer = answerCharacters.slice(0, answerPosition).join('');
          showFrame();
          if (answerPosition < answerCharacters.length) schedule(outputAnswer);
          else {
            persistTurn(active.turn, { ...reply.inputs, question: '' });
            run.current = null;
            timer.current = null;
            setStream(null);
            setPending('');
          }
        };
        const outputThinking = () => {
          thinkingPosition = Math.min(
            thinkingCharacters.length,
            thinkingPosition + 4,
          );
          active.processing = thinkingCharacters
            .slice(0, thinkingPosition)
            .join('');
          showFrame();
          if (thinkingPosition < thinkingCharacters.length)
            schedule(outputThinking);
          else
            schedule(() => {
              active.phase = 'answer';
              outputAnswer();
            }, 160);
        };
        outputThinking();
      } catch (error) {
        run.current = null;
        timer.current = null;
        setStream(null);
        setPending('');
        setQuestion(query);
        setMessage(
          error instanceof Error
            ? error.message
            : '暂时无法完成分析，请调整条件后再试。',
        );
      }
    }, 60);
  }
  function stop() {
    const active = run.current;
    if (!active) return;
    if (timer.current) clearTimeout(timer.current);
    run.current = null;
    timer.current = null;
    // Persist only text already displayed; unfinished structured results stay private to this run.
    const interrupted: ConversationTurn = {
      id: active.turn.id,
      question: active.turn.question,
      answer: active.answer,
      createdAt: active.turn.createdAt,
      inputs: active.captured,
      sourceName: active.turn.sourceName,
      sourceOrigin: active.turn.sourceOrigin,
      processingSummary: active.processing,
      status: 'stopped',
    };
    const saved = persistTurn(interrupted, {
      ...active.captured,
      question: active.turn.question,
    });
    setQuestion(active.turn.question);
    setStream(null);
    setPending('');
    if (saved) setMessage('已停止生成，已输出的内容已保留。');
  }
  const rateAnswer = useCallback(
    (turnId: string, value: 'like' | 'dislike') => {
      if (!session) return false;
      const ok = updateWorkspace((s) => ({
        ...s,
        sessions: (s.sessions ?? []).map((item) =>
          item.id === session.id
            ? {
                ...item,
                turns: (localTurns
                  ? mergeConversationTurns(item.turns, localTurns)
                  : item.turns
                ).map((turn) =>
                  turn.id === turnId
                    ? {
                        ...turn,
                        feedback: turn.feedback === value ? null : value,
                      }
                    : turn,
                ),
              }
            : item,
        ),
      }));
      if (ok) setLocalTurns(null);
      return ok;
    },
    [session, localTurns],
  );
  function saveDraft() {
    if (
      updateWorkspace((s) => ({
        ...s,
        sessions: (s.sessions ?? []).map((item) =>
          item.id === session?.id
            ? {
                ...item,
                draft: { ...input, question: text },
                title: conversationTitle(
                  item,
                  item.turns.length
                    ? item.title
                    : text.trim().slice(0, 48) || '新对话',
                ),
              }
            : item,
        ),
      }))
    )
      setMessage('问题与分析条件已保存为草稿。');
    else setMessage(storageMessage());
  }
  return (
    <div className={'chat-workspace agent-tone-' + id}>
      <h1 className="sr-only">{m.name}</h1>
      <div
        ref={chatBody}
        className="chat-body"
        onScroll={(event) => {
          const body = event.currentTarget;
          followOutput.current =
            body.scrollHeight - body.scrollTop - body.clientHeight < 100;
        }}
      >
        {!turns.length && !pending ? (
          <div className="chat-welcome">
            <AgentIdentity id={id} large />
            <p className="chat-welcome-label">{m.category} · 专属业务助手</p>
            <h2>
              {id === 'customer'
                ? '为客户，找到更合适的产品。'
                : id === 'maintenance'
                  ? '把设备问题，变成具体维修方案。'
                  : id === 'energy'
                    ? '让每一度电，都有据可循。'
                    : id === 'production'
                      ? '看见产线表现，及时发现偏差。'
                      : '让供应商表现，清晰可见。'}
            </h2>
            <p>
              {id === 'customer'
                ? '描述应用、参数或替代型号。信息不完整时，我会先帮你补齐；每条建议都可以查看原文件。'
                : id === 'maintenance'
                  ? '描述设备、告警或现象，获取处理步骤、备件建议和修后验证方法。'
                  : id === 'production'
                    ? '生成生产日报，查询产量、质量和停机情况，也可以比较产线、追问异常依据。'
                    : id === 'supplier'
                      ? '查看评分排名、交付与质量风险，比较供应商表现，也可以追问评分依据和异常原因。'
                      : m.description + '直接告诉我您想解决的问题。'}
            </p>
            <div
              className={
                plainReply
                  ? 'chat-prompt-grid customer-example-cards'
                  : 'chat-prompt-grid'
              }
            >
              {welcomeSuggestions.map((p, index) => (
                <button
                  key={p.title}
                  onClick={() => send(p.question)}
                  title={p.question}
                >
                  <span className="prompt-number">
                    <MessageSquareText size={17} />
                    <ArrowUpRight size={15} />
                  </span>
                  <strong>
                    {id === 'customer'
                      ? customerWelcomeCards[index].title
                      : p.title}
                  </strong>
                  <span>
                    {id === 'customer'
                      ? customerWelcomeCards[index].description
                      : p.question}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="conversation-thread" aria-label="问答记录">
            {[...displayedTurns, ...(stream ? [stream.turn] : [])].map(
              (turn) => (
                <ConversationAnswer
                  key={turn.id}
                  module={id}
                  turn={turn}
                  phase={stream?.turn.id === turn.id ? stream.phase : undefined}
                  processing={
                    stream?.turn.id === turn.id ? stream.processing : undefined
                  }
                  content={
                    stream?.turn.id === turn.id ? stream.answer : undefined
                  }
                  onFeedback={rateAnswer}
                />
              ),
            )}
            <div ref={end} />
          </div>
        )}
      </div>
      <div className="chat-composer-region">
        {message && <output className="chat-feedback">{message}</output>}
        <div className="chat-composer">
          {conditionsOpen && id !== 'production' && id !== 'supplier' && (
            <div className="chat-conditions-panel">
              <div className="conditions-panel-heading">
                <div>
                  <h2>分析条件</h2>
                  <p>
                    {id === 'customer'
                      ? '已识别的需求在这里核对；必需信息为空时会先询问。'
                      : '问题中明确的参数会更新这些条件，其余沿用当前值。'}
                  </p>
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
                  : id === 'maintenance'
                    ? '描述设备、告警或现象，也可以补充已检查的结果…'
                    : id === 'energy'
                      ? '问问用电、异常或优化建议，例如：产量增长5%，下周用电多少？'
                      : id === 'production'
                        ? '例如：哪些产线没达到计划？3号产线有哪些异常？'
                        : '例如：哪些供应商交付未达标？供应商C的评分怎么算？'
              }
              maxLength={2000}
              disabled={Boolean(pending)}
              rows={3}
            />
            <div className="composer-toolbar">
              <div>
                {sampleLibrary ? (
                  <SourceLibrary module={id as 'customer' | 'maintenance'} />
                ) : id === 'energy' ||
                  id === 'production' ||
                  id === 'supplier' ? null : (
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
                )}
                {id !== 'maintenance' &&
                  id !== 'energy' &&
                  id !== 'production' &&
                  id !== 'supplier' && (
                    <>
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
                    </>
                  )}
              </div>
              <div>
                {pending ? (
                  <Button
                    type="button"
                    className="send-message-button"
                    aria-label="停止分析"
                    onClick={(event) => {
                      event.preventDefault();
                      stop();
                    }}
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
          <span>回答依据业务资料，请结合实际情况核对</span>
          <span>{turns.length >= 20 ? '保留最近 20 轮对话' : ''}</span>
        </div>
      </div>
    </div>
  );
}
