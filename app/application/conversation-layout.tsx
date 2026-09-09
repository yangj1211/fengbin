'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Plus, MessageSquareText, Trash2, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import type { ModuleId, WorkspaceState } from './model';
import { storageMessage } from './store';

type HistoryProps = {
  state: WorkspaceState;
  moduleId: ModuleId;
  sessionId?: string;
  onNew: () => boolean;
  onSelect: (id: string) => boolean;
  onDelete: (id: string) => boolean;
  onDone?: () => void;
};

function ConversationHistory({
  state,
  moduleId,
  sessionId,
  onNew,
  onSelect,
  onDelete,
  onDone,
}: HistoryProps) {
  const [remove, setRemove] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const sessions = (state.sessions ?? [])
    .filter((s) => s.module === moduleId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const target = sessions.find((s) => s.id === remove);
  function finish(ok: boolean) {
    if (ok) {
      setMessage('');
      onDone?.();
    } else
      setMessage(
        storageMessage() ||
          '当前回答尚未完成，请先返回对话，等待完成或停止后重试。',
      );
  }
  return (
    <div className="conversation-history-panel">
      <div className="conversation-history-start">
        <Button
          className="conversation-new-chat"
          onClick={() => finish(onNew())}
        >
          <Plus size={18} />
          新建对话
        </Button>
      </div>
      <div className="conversation-history-heading">
        <h2>对话历史</h2>
        <span>{sessions.length}</span>
      </div>
      {message && (
        <p className="conversation-history-feedback" role="status">
          {message}
        </p>
      )}
      <div
        className="conversation-history-list"
        aria-label="当前智能体的对话历史"
      >
        {sessions.length ? (
          sessions.map((session) => (
            <div
              key={session.id}
              className={
                'conversation-history-row' +
                (session.id === sessionId ? ' is-current' : '')
              }
            >
              <button
                className="conversation-history-link"
                aria-current={session.id === sessionId ? 'page' : undefined}
                title={session.title}
                onClick={() => finish(onSelect(session.id))}
              >
                <MessageSquareText size={15} />
                <span>
                  <strong>{session.title}</strong>
                  <small>
                    {session.turns.length
                      ? new Date(session.updatedAt).toLocaleDateString(
                          'zh-CN',
                          { month: '2-digit', day: '2-digit' },
                        ) +
                        ' · ' +
                        session.turns.length +
                        ' 轮问答'
                      : '草稿'}
                  </small>
                </span>
              </button>
              <button
                className="conversation-history-delete"
                title="删除对话"
                aria-label={'删除对话：' + session.title}
                onClick={() => {
                  setRemove(session.id);
                  setMessage('');
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        ) : (
          <p className="conversation-history-empty">
            开始提问后，对话会保存在这里。
          </p>
        )}
      </div>
      <p className="conversation-history-footer">对话保存在当前浏览器</p>
      <AlertDialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open) setRemove(null);
        }}
      >
        <AlertDialogContent className="app-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>删除这段对话？</AlertDialogTitle>
            <AlertDialogDescription>
              「{target?.title}
              」的问答与草稿将被删除。已保存的分析记录仍然保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {message && (
            <p role="status" className="conversation-history-feedback">
              {message}
            </p>
          )}
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setRemove(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (remove && onDelete(remove)) {
                  setRemove(null);
                  setMessage('');
                } else finish(false);
              }}
            >
              删除对话
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ConversationLayout({
  children,
  ...history
}: HistoryProps & { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1101px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);
  return (
    <div className="conversation-layout">
      <aside className="conversation-history-rail" aria-label="智能体对话导航">
        <ConversationHistory {...history} />
      </aside>
      <div className="conversation-pane">
        <div className="conversation-mobile-toolbar">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" />}>
              <PanelLeft size={17} />
              对话历史
            </SheetTrigger>
            <SheetContent side="left" className="conversation-history-sheet">
              <SheetHeader className="sr-only">
                <SheetTitle>对话历史</SheetTitle>
                <SheetDescription>
                  查看当前智能体的对话，或新建一段对话。
                </SheetDescription>
              </SheetHeader>
              <ConversationHistory {...history} onDone={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <span>当前智能体的独立对话</span>
        </div>
        {children}
      </div>
    </div>
  );
}
