'use client';
import { memo, useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ConversationTurn } from './conversation';
import { modules, type ModuleId } from './model';
import { AgentIdentity } from './identity';
import { answerSources, answerText } from './answer-presentation';
import { AnswerSources } from './customer-sources';
import AnswerInteraction from './answer-interaction';
import CopyMessageButton from './copy-message-button';
import MessageContent from './message-content';

export type AnswerPhase = 'thinking' | 'answer' | 'complete' | 'stopped';

export default memo(function ConversationAnswer({
  module,
  turn,
  phase = turn.status === 'stopped' ? 'stopped' : 'complete',
  processing = turn.processingSummary ?? '',
  content,
  onFeedback,
}: {
  module: ModuleId;
  turn: ConversationTurn;
  phase?: AnswerPhase;
  processing?: string;
  content?: string;
  onFeedback: (turnId: string, value: 'like' | 'dislike') => boolean;
}) {
  const processingId = useId();
  const [choice, setChoice] = useState<{ stage: string; open: boolean } | null>(
    null,
  );
  // Completing the stream keeps a manual expansion made while reading the answer.
  const stage = phase === 'thinking' ? 'thinking' : 'answer';
  const expanded = choice?.stage === stage ? choice.open : stage === 'thinking';
  const body = content ?? answerText(module, turn);
  const busy = phase === 'thinking' || phase === 'answer';
  const sourceRefs =
    phase === 'complete' ? answerSources(module, turn) : undefined;
  const answer = (
    <MessageContent content={body} interactive={!busy && phase !== 'stopped'} />
  );
  return (
    <div className="conversation-turn" data-answer-phase={phase}>
      <div className="user-message">
        <span className="message-person">我</span>
        <div className="user-message-body">
          <p>{turn.question}</p>
          <CopyMessageButton text={() => turn.question} label="复制问题" />
        </div>
      </div>
      <div className="assistant-message">
        <AgentIdentity id={module} />
        <div className="assistant-message-body">
          <div className="assistant-name">
            {modules.find((item) => item.id === module)!.name}
          </div>
          <div className="answer-thinking">
            <button
              type="button"
              className={
                'answer-thinking-toggle' + (expanded ? ' is-expanded' : '')
              }
              aria-expanded={expanded}
              aria-controls={processingId}
              onClick={() => setChoice({ stage, open: !expanded })}
            >
              <ChevronRight size={15} aria-hidden="true" />
              <span>思考过程</span>
              <span className="answer-thinking-state">
                {phase === 'thinking'
                  ? '思考中…'
                  : phase === 'stopped'
                    ? '已停止'
                    : '已完成'}
              </span>
            </button>
            <div
              id={processingId}
              className="answer-thinking-content"
              hidden={!expanded}
            >
              <p>
                {processing ||
                  (phase === 'thinking'
                    ? '正在读取问题…'
                    : phase === 'stopped'
                      ? '已停止处理。'
                      : '此历史回答未记录处理过程。')}
              </p>
            </div>
          </div>
          <output className="sr-only" aria-live="polite">
            {phase === 'thinking'
              ? '正在处理问题'
              : phase === 'answer'
                ? '正在输出最终答案'
                : phase === 'stopped'
                  ? '已停止生成'
                  : '回答已完成'}
          </output>
          {phase !== 'thinking' && (
            <div className="answer-final" aria-busy={phase === 'answer'}>
              <h3>最终答案</h3>
              {phase === 'complete' ? (
                <AnswerInteraction
                  feedback={turn.feedback}
                  onFeedback={(value) => onFeedback(turn.id, value)}
                >
                  {answer}
                  {(module === 'customer' || module === 'maintenance') && (
                    <AnswerSources sources={sourceRefs} legacy={!sourceRefs} emptyIsExpected={module === 'maintenance'} />
                  )}
                </AnswerInteraction>
              ) : (
                <>
                  {body && answer}
                  {phase === 'stopped' && (
                    <>
                      <p className="answer-stopped">
                        {body ? '已停止生成' : '已停止，尚未生成答案。'}
                      </p>
                      {body && (
                        <CopyMessageButton text={() => body} label="复制回答" />
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
