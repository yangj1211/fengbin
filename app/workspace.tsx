'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, LayoutDashboard, MessageSquareText } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { modules, type Inputs } from './application/model';
import { hasDashboard } from './application/dashboard-data';
import BusinessDashboard from './application/dashboard';
import {
  useWorkspace,
  storageMessage,
  updateWorkspace,
} from './application/store';
import {
  currentSession,
  startConversation,
  selectConversation,
  removeConversation,
} from './application/sessions';
import Navigation from './application/navigation';
import AgentPlaza from './application/home';
import ModuleWorkspace from './application/module';
import ConversationLayout from './application/conversation-layout';
import Records from './application/records';
import DataManager from './application/data-manager';
export default function Workspace({ path = '/' }: { path?: string }) {
  const router = useRouter();
  const state = useWorkspace();
  const [message, setMessage] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const leaveGuard = useRef<((discard?: boolean) => boolean) | null>(null);
  const registerLeaveGuard = useCallback(
    (guard: ((discard?: boolean) => boolean) | null) => {
      leaveGuard.current = guard;
    },
    [],
  );
  const canLeave = (discard = false) => leaveGuard.current?.(discard) ?? true;
  const navigate = (url: string) => {
    if (!canLeave()) return false;
    router.push(url);
    return true;
  };
  const activeModule = modules.find((m) => path === '/apps/' + m.id);
  const view =
    activeModule && hasDashboard(activeModule.id)
      ? (state.moduleViews?.[activeModule.id] ?? 'dashboard')
      : 'chat';
  const session = activeModule
    ? currentSession(state, activeModule.id)
    : undefined;
  const activeSessionId = session?.id;
  useEffect(() => {
    if (!activeModule || activeSessionId || view !== 'chat') return;
    const timer = setTimeout(() => {
      if (storageMessage()) {
        setMessage(storageMessage());
        return;
      }
      if (
        !updateWorkspace((s) =>
          currentSession(s, activeModule.id)
            ? s
            : startConversation(s, activeModule.id),
        )
      )
        setMessage(storageMessage());
    }, 0);
    return () => clearTimeout(timer);
  }, [activeModule, activeSessionId, view]);
  function newConversation(input?: Inputs) {
    if (!activeModule || !canLeave()) return false;
    const ok = updateWorkspace((s) =>
      startConversation(s, activeModule.id, input),
    );
    if (!ok) setMessage(storageMessage());
    else setMessage('');
    return ok;
  }
  function selectSession(sessionId: string) {
    if (sessionId === session?.id && view === 'chat') return true;
    if (!canLeave()) return false;
    const ok = updateWorkspace((s) => selectConversation(s, sessionId));
    if (!ok) setMessage(storageMessage());
    else setMessage('');
    return ok;
  }
  function deleteSession(sessionId: string) {
    if (sessionId === session?.id && !canLeave(true)) return false;
    const ok = updateWorkspace((s) => removeConversation(s, sessionId));
    if (!ok) setMessage(storageMessage());
    else setMessage('');
    return ok;
  }
  function changeView(value: 'chat' | 'dashboard') {
    if (!activeModule || value === view || !canLeave()) return;
    if (
      !updateWorkspace((s) => ({
        ...s,
        moduleViews: { ...s.moduleViews, [activeModule.id]: value },
      }))
    )
      setMessage(storageMessage());
    else setMessage('');
  }
  const title =
    path === '/'
      ? '智能体广场'
      : (activeModule?.name ??
        (path.startsWith('/records') ? '分析记录' : '数据管理'));
  async function logout() {
    if (loggingOut || !canLeave()) return;
    setLoggingOut(true);
    try {
      const r = await fetch('/api/auth/logout', { method: 'POST' });
      if (!r.ok) throw new Error();
      window.location.replace('/login');
    } catch {
      setMessage('退出失败，请稍后重试。');
      setLoggingOut(false);
    }
  }
  const conversation = activeModule ? (
    <ConversationLayout
      key={activeModule.id}
      state={state}
      moduleId={activeModule.id}
      sessionId={session?.id}
      onNew={newConversation}
      onSelect={selectSession}
      onDelete={deleteSession}
    >
      <ModuleWorkspace
        key={activeModule.id + (session?.id ?? 'initial')}
        id={activeModule.id}
        session={session}
        registerLeaveGuard={registerLeaveGuard}
        state={state}
        navigate={navigate}
      />
    </ConversationLayout>
  ) : null;
  return (
    <SidebarProvider
      style={{ '--sidebar-width': '240px' } as React.CSSProperties}
    >
      <Navigation
        path={path}
        navigate={navigate}
        onLogout={logout}
        loggingOut={loggingOut}
      />
      <main className="application-main">
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger aria-label="切换导航" />
            <span>丰宾电子</span>
            <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <button
              className="data-mode-button"
              onClick={() => navigate('/data')}
            >
              <span className="status-dot" />
              {state.datasets.every((d) => d.origin === 'sample')
                ? '示例数据'
                : '本地数据工作区'}
            </button>
          </div>
        </header>
        <div
          className={'application-content' + (activeModule ? ' is-chat' : '')}
        >
          {(message || storageMessage()) && (
            <output className="app-message">
              {message || storageMessage()}
            </output>
          )}
          {path === '/' ? (
            <AgentPlaza state={state} navigate={navigate} />
          ) : activeModule ? (
            hasDashboard(activeModule.id) ? (
              <Tabs
                key={activeModule.id}
                value={view}
                onValueChange={(value) => {
                  if (value === 'chat' || value === 'dashboard')
                    changeView(value);
                }}
                className="agent-mode-tabs"
              >
                <div className="agent-mode-bar">
                  <TabsList variant="line">
                    <TabsTrigger value="dashboard">
                      <LayoutDashboard size={16} />
                      业务看板
                    </TabsTrigger>
                    <TabsTrigger value="chat">
                      <MessageSquareText size={16} />
                      智能问答
                    </TabsTrigger>
                  </TabsList>
                  <span>看指标 · 查异常 · 问原因</span>
                </div>
                <TabsContent value="dashboard" keepMounted>
                  <BusinessDashboard
                    id={activeModule.id}
                    state={state}
                    onAsk={newConversation}
                    navigate={navigate}
                  />
                </TabsContent>
                <TabsContent value="chat">{conversation}</TabsContent>
              </Tabs>
            ) : (
              conversation
            )
          ) : path.startsWith('/records') ? (
            <Records
              key={path}
              recordId={path.split('/')[2]}
              state={state}
              navigate={navigate}
            />
          ) : (
            <DataManager state={state} navigate={navigate} />
          )}
          {!activeModule && (
            <footer className="application-footer">
              <span>丰宾电子 · 智能制造平台</span>
              <span>工作记录保存在当前浏览器</span>
            </footer>
          )}
        </div>
      </main>
    </SidebarProvider>
  );
}
