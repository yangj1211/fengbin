'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  Plus,
  MessageSquareText,
  Trash2,
  Pencil,
  PanelLeft,
  Search,
  X,
  ChartNoAxesCombined,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { storageMessage, updateWorkspace } from './store';
import {
  CONVERSATION_TITLE_MAX_LENGTH,
  conversationTitleError,
  renameConversation,
  searchConversations,
} from './sessions';
import { SourcePreviewScope } from './source-preview-panel';

type HistoryProps = {
  state: WorkspaceState;
  moduleId: ModuleId;
  sessionId?: string;
  onNew: () => boolean;
  onSelect: (id: string) => boolean;
  onDelete: (id: string) => boolean;
  onOpenDashboard?: () => boolean;
  onDone?: () => void;
};

function ConversationHistory({
  state,
  moduleId,
  sessionId,
  onNew,
  onSelect,
  onDelete,
  onOpenDashboard,
  onDone,
  query,
  onQueryChange,
}: HistoryProps & { query: string; onQueryChange: (query: string) => void }) {
  const [remove, setRemove] = useState<string | null>(null);
  const [rename, setRename] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [renameError, setRenameError] = useState('');
  const renameInput = useRef<HTMLInputElement>(null);
  const renameDraft = useRef<typeof rename>(null);
  const composingName = useRef(false);
  const historyPanel = useRef<HTMLDivElement>(null);
  const renameErrorId = useId();
  const [message, setMessage] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);
  const sessions = (state.sessions ?? [])
    .filter((s) => s.module === moduleId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const target = sessions.find((s) => s.id === remove);
  const matches = searchConversations(sessions, query);
  const searching = Boolean(query.trim());
  useEffect(() => {
    if (!rename?.id) return;
    renameInput.current?.focus();
    renameInput.current?.select();
  }, [rename?.id]);
  function updateName(next: typeof rename) {
    renameDraft.current = next;
    setRename(next);
  }
  function cancelName(refocus = false) {
    const id = renameDraft.current?.id;
    updateName(null);
    composingName.current = false;
    setRenameError('');
    if (refocus)
      requestAnimationFrame(() => {
        const target = Array.from(
          historyPanel.current?.querySelectorAll<HTMLButtonElement>(
            '[data-rename-session]',
          ) ?? [],
        ).find((button) => button.dataset.renameSession === id);
        (target ?? searchInput.current)?.focus();
      });
  }
  function clearSearch() {
    if (!finishName()) return;
    onQueryChange('');
    searchInput.current?.focus();
  }
  function saveName(refocus = false): boolean {
    const draft = renameDraft.current;
    if (!draft) return true;
    if (composingName.current) return false;
    if (!draft.title.trim()) {
      cancelName(refocus);
      return true;
    }
    const validation = conversationTitleError(draft.title);
    if (validation) {
      setRenameError(validation);
      return false;
    }
    try {
      if (
        updateWorkspace((current) =>
          renameConversation(current, draft.id, draft.title),
        )
      ) {
        cancelName(refocus);
        setMessage('');
        return true;
      }
      setRenameError(storageMessage() || '未能保存对话名称，请重试。');
    } catch (error) {
      setRenameError(
        error instanceof Error ? error.message : '未能保存对话名称，请重试。',
      );
    }
    return false;
  }
  function finishName(): boolean {
    if (saveName()) return true;
    renameInput.current?.focus();
    return false;
  }
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
    <div ref={historyPanel} className="conversation-history-panel">
      <div className="conversation-history-start">
        <Button
          className="conversation-new-chat"
          onClick={() => {
            if (!finishName()) return;
            const ok = onNew();
            if (ok) onQueryChange('');
            finish(ok);
          }}
        >
          <Plus size={18} />
          新建对话
        </Button>
        {onOpenDashboard && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start gap-2.5"
            onClick={() => {
              if (finishName()) finish(onOpenDashboard());
            }}
          >
            <ChartNoAxesCombined size={16} />
            查看看板
          </Button>
        )}
      </div>
      <div className="conversation-history-search">
        <Search size={15} aria-hidden="true" />
        <Input
          ref={searchInput}
          type="search"
          aria-label="搜索对话标题或内容"
          placeholder="搜索对话"
          value={query}
          maxLength={200}
          onChange={(event) => {
            if (finishName()) onQueryChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (
              event.key === 'Escape' &&
              query &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              event.stopPropagation();
              clearSearch();
            }
          }}
        />
        {query && (
          <button
            className="conversation-history-search-clear"
            aria-label="清空历史搜索"
            title="清空搜索"
            onClick={clearSearch}
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div className="conversation-history-heading">
        <h2>对话历史</h2>
        <span
          role="status"
          aria-label={
            searching
              ? `找到 ${matches.length} 段对话，共 ${sessions.length} 段`
              : `共 ${sessions.length} 段对话`
          }
        >
          {searching
            ? `${matches.length} / ${sessions.length}`
            : sessions.length}
        </span>
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
        {matches.length ? (
          matches.map((session) => (
            <div
              key={session.id}
              className={
                'conversation-history-row' +
                (session.id === sessionId ? ' is-current' : '')
              }
            >
              {rename?.id === session.id ? (
                <div className="conversation-history-link conversation-history-edit">
                  <MessageSquareText size={15} aria-hidden="true" />
                  <span>
                    <Input
                      ref={renameInput}
                      className="conversation-name-input"
                      aria-label="对话名称"
                      value={rename.title}
                      maxLength={CONVERSATION_TITLE_MAX_LENGTH}
                      autoComplete="off"
                      aria-invalid={Boolean(renameError)}
                      aria-describedby={renameError ? renameErrorId : undefined}
                      onChange={(event) => {
                        updateName({
                          id: session.id,
                          title: event.target.value,
                        });
                        setRenameError('');
                      }}
                      onCompositionStart={() => {
                        composingName.current = true;
                      }}
                      onCompositionEnd={(event) => {
                        composingName.current = false;
                        updateName({
                          id: session.id,
                          title: event.currentTarget.value,
                        });
                        if (document.activeElement !== event.currentTarget)
                          saveName();
                      }}
                      onBlur={() => {
                        saveName();
                      }}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (
                          composingName.current ||
                          event.nativeEvent.isComposing ||
                          event.keyCode === 229
                        )
                          return;
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          saveName(true);
                        } else if (event.key === 'Escape') {
                          event.preventDefault();
                          cancelName(true);
                        }
                      }}
                    />
                    {renameError && (
                      <span
                        id={renameErrorId}
                        className="conversation-name-error"
                        role="alert"
                      >
                        {renameError}
                      </span>
                    )}
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
                </div>
              ) : (
                <>
                  <button
                    className="conversation-history-link"
                    aria-current={session.id === sessionId ? 'page' : undefined}
                    title={session.title}
                    onClick={() => {
                      if (finishName()) finish(onSelect(session.id));
                    }}
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
                    className="conversation-history-rename"
                    data-rename-session={session.id}
                    title="修改对话名称"
                    aria-label={'修改对话名称：' + session.title}
                    onClick={() => {
                      if (!finishName()) return;
                      updateName({ id: session.id, title: session.title });
                      setRenameError('');
                      setMessage('');
                    }}
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                  <button
                    className="conversation-history-delete"
                    title="删除对话"
                    aria-label={'删除对话：' + session.title}
                    onClick={() => {
                      if (!finishName()) return;
                      setRemove(session.id);
                      setMessage('');
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ))
        ) : searching ? (
          <div className="conversation-history-empty conversation-search-empty">
            <strong>没有找到相关对话</strong>
            <p>换个关键词，或清空搜索。</p>
            <Button variant="ghost" size="sm" onClick={clearSearch}>
              清空搜索
            </Button>
          </div>
        ) : (
          <p className="conversation-history-empty">
            开始提问后，对话会保存在这里。
          </p>
        )}
      </div>
      <p className="conversation-history-footer">可通过对话历史继续交流</p>
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
              」的问答与草稿将被删除。
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
  const [query, setQuery] = useState('');
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
        <ConversationHistory
          {...history}
          query={query}
          onQueryChange={setQuery}
        />
      </aside>
      <div className="conversation-pane">
        <SourcePreviewScope key={history.sessionId ?? 'initial'}>
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
                <ConversationHistory
                  {...history}
                  query={query}
                  onQueryChange={setQuery}
                  onDone={() => setOpen(false)}
                />
              </SheetContent>
            </Sheet>
            {history.onOpenDashboard ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={history.onOpenDashboard}
              >
                <ChartNoAxesCombined size={16} />
                查看看板
              </Button>
            ) : (
              <span>当前智能体的独立对话</span>
            )}
          </div>
          {children}
        </SourcePreviewScope>
      </div>
    </div>
  );
}
