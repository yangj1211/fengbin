'use client';
import { useRef, useState, type ReactNode } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ConversationTurn } from './conversation';
import CopyMessageButton from './copy-message-button';

function answerText(element: HTMLElement): string {
  if (element.matches('[role="tablist"]')) return '';
  if (!element.querySelector('[role="tablist"]')) return element.innerText;
  return Array.from(element.childNodes, (child) =>
    child instanceof HTMLElement
      ? answerText(child)
      : child.nodeType === Node.TEXT_NODE
        ? (child.textContent?.trim() ?? '')
        : '',
  )
    .filter(Boolean)
    .join('\n\n');
}

export default function AnswerInteraction({
  children,
  actions,
  feedback,
  onFeedback,
}: {
  children: ReactNode;
  actions?: ReactNode;
  feedback: ConversationTurn['feedback'];
  onFeedback: (value: 'like' | 'dislike') => boolean;
}) {
  const content = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState('');

  function rate(value: 'like' | 'dislike') {
    setNotice(onFeedback(value) ? '' : '未能保存评价，请重试。');
  }

  return (
    <>
      <div ref={content} className="answer-content">
        {children}
      </div>
      {actions}
      <div className="answer-feedback-bar" role="group" aria-label="回答操作">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="点赞"
          title={feedback === 'like' ? '取消点赞' : '点赞'}
          aria-pressed={feedback === 'like'}
          onClick={() => rate('like')}
        >
          <ThumbsUp aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="点踩"
          title={feedback === 'dislike' ? '取消点踩' : '点踩'}
          aria-pressed={feedback === 'dislike'}
          onClick={() => rate('dislike')}
        >
          <ThumbsDown aria-hidden="true" />
        </Button>
        <CopyMessageButton
          text={() =>
            content.current ? answerText(content.current).trim() : ''
          }
          label="复制回答"
        />
        <span className="answer-feedback-notice" role="status">
          {notice}
        </span>
      </div>
    </>
  );
}
