'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  modules,
  defaultInputs,
  type Inputs,
} from './application/model';
import { hasDashboard } from './application/dashboard-data';
import BusinessDashboard from './application/dashboard';
import {
  useWorkspace,
  storageMessage,
  updateWorkspace,
  setWorkspaceUser,
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
import DataManager from './application/data-manager';
import UserManagement from './application/user-management';
import ChangePassword from './application/change-password';
import type { AccountUser } from './application/account-types';
import {
  navigateWorkspace,
  syncWorkspaceHistory,
  workspaceView,
  readWorkspaceSearch,
  subscribeWorkspaceNavigation,
} from './application/workspace-path';
import { monitorAdminSession } from './application/session-monitor';

// Mount a board only after it is requested, then retain its filters while this
// agent stays open. Changing agents resets this keyed component.
function DeferredDashboard({
  visible,
  children,
}: {
  visible: boolean;
  children: ReactNode;
}) {
  const [opened, setOpened] = useState(visible);
  if (visible && !opened) setOpened(true);
  return visible || opened ? (
    <section hidden={!visible} aria-label="业务看板">
      {children}
    </section>
  ) : null;
}
export default function Workspace({
  path = '/',
}: {
  path?: string;
}) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const acceptUser = useCallback((nextUser: AccountUser) => {
    if (!setWorkspaceUser(nextUser.id, nextUser.isDefaultAdmin)) {
      setUser(null);
      setError(storageMessage() || '无法读取当前账号的对话，请重试。');
      return;
    }
    setUser(nextUser);
    setError('');
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (response.status === 401) { window.location.replace('/login'); return; }
        const result = await response.json() as { user?: AccountUser };
        if (!response.ok || !result.user) throw new Error();
        if (!controller.signal.aborted) acceptUser(result.user);
      } catch {
        if (!controller.signal.aborted) setError('登录信息暂时无法加载，请检查网络后重试。');
      }
    })();
    return () => controller.abort();
  }, [retry, acceptUser]);
  if (!user) return <main className="account-bootstrap" aria-busy={!error}>
    <strong>丰宾电子 · 智能制造平台</strong>
    {error ? <><p role="alert">{error}</p><Button variant="outline" onClick={() => { setError(''); setRetry((old) => old + 1); }}>重试</Button></> : <output>正在进入工作区…</output>}
  </main>;
  return <WorkspaceContent key={user.id} path={path} user={user} onUserChange={acceptUser} />;
}
function WorkspaceContent({
  path: initialPath = '/',
  user,
  onUserChange,
}: {
  path?: string;
  user: AccountUser;
  onUserChange: (user: AccountUser) => void;
}) {
  const path = usePathname() ?? initialPath;
  const search = useSyncExternalStore<string | null>(
    subscribeWorkspaceNavigation,
    readWorkspaceSearch,
    () => null,
  );
  const state = useWorkspace();
  const [message, setMessage] = useState('');
  const [messagePath, setMessagePath] = useState(path);
  if (messagePath !== path) {
    setMessagePath(path);
    setMessage('');
  }
  const [loggingOut, setLoggingOut] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [energyInput, setEnergyInput] = useState<Inputs>(() =>
    ({ ...defaultInputs.energy }),
  );
  const leaveGuard = useRef<((discard?: boolean) => boolean) | null>(null);
  const registerLeaveGuard = useCallback(
    (guard: ((discard?: boolean) => boolean) | null) => {
      leaveGuard.current = guard;
    },
    [],
  );
  const canLeave = (discard = false) => leaveGuard.current?.(discard) ?? true;
  const navigate = (url: string) => {
    return navigateWorkspace(url, canLeave);
  };
  useEffect(
    () => syncWorkspaceHistory(() => leaveGuard.current?.() ?? true),
    [],
  );
  useEffect(() => monitorAdminSession(onUserChange), [path, onUserChange]);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [path]);
  const activeModule = modules.find((m) => path === '/apps/' + m.id);
  // Energy, production and supplier open their boards; explicit chat URLs stay in chat.
  const view = workspaceView(path, search ?? '');
  const dashboardVisible = Boolean(
    activeModule && hasDashboard(activeModule.id) && view === 'dashboard',
  );
  const session = activeModule
    ? currentSession(state, activeModule.id)
    : undefined;
  const activeSessionId = session?.id;
  useEffect(() => {
    if (search === null || !activeModule || activeSessionId || view !== 'chat')
      return;
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
  }, [activeModule, activeSessionId, view, search]);
  function navigateView(value: 'chat' | 'dashboard') {
    if (!activeModule) return false;
    return navigateWorkspace(
      `/apps/${activeModule.id}?mode=${value}`,
      () => true,
    );
  }
  function newConversation() {
    if (!activeModule || !canLeave()) return false;
    const ok = updateWorkspace((s) =>
      startConversation(s, activeModule.id),
    );
    if (!ok) setMessage(storageMessage());
    else {
      setMessage('');
      navigateView('chat');
    }
    return ok;
  }
  function selectSession(sessionId: string) {
    if (sessionId === session?.id && view === 'chat') return true;
    if (!canLeave()) return false;
    const ok = updateWorkspace((s) => selectConversation(s, sessionId));
    if (!ok) setMessage(storageMessage());
    else {
      setMessage('');
      navigateView('chat');
    }
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
    if (!activeModule) return false;
    if (value === 'dashboard' && !hasDashboard(activeModule.id)) return false;
    if (value === view) return true;
    if (!canLeave()) return false;
    setMessage('');
    return navigateView(value);
  }
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
      onOpenDashboard={
        hasDashboard(activeModule.id)
          ? () => changeView('dashboard')
          : undefined
      }
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
      style={
        {
          '--sidebar-width': '240px',
          '--sidebar-width-icon': '64px',
        } as React.CSSProperties
      }
    >
      <Navigation
        path={path}
        navigate={navigate}
        onLogout={logout}
        loggingOut={loggingOut}
        username={user.name}
        canManage={user.role === 'admin'}
        onChangePassword={() => { if (canLeave()) setPasswordOpen(true); }}
      />
      <ChangePassword open={passwordOpen} onOpenChange={setPasswordOpen} account={user.account} />
      <main
        className={
          'application-main' + (dashboardVisible ? ' is-dashboard' : '')
        }
      >
        <div
          className={'application-content' + (activeModule ? ' is-chat' : '')}
        >
          {(message || storageMessage()) && (
            <output className="app-message">
              {message || storageMessage()}
            </output>
          )}
          {path === '/' ? (
            <AgentPlaza navigate={navigate} />
          ) : activeModule ? (
            hasDashboard(activeModule.id) ? (
              <div key={activeModule.id}>
                <DeferredDashboard
                  visible={search !== null && view === 'dashboard'}
                >
                  <BusinessDashboard
                    id={activeModule.id}
                    state={state}
                    onOpenChat={() => changeView('chat')}
                    navigate={navigate}
                    energyInput={energyInput}
                    onEnergyInputChange={setEnergyInput}
                  />
                </DeferredDashboard>
                {view === 'chat' && conversation}
              </div>
            ) : (
              conversation
            )
          ) : (path === '/data' || path === '/users') && user.role !== 'admin' ? (
            <section className="account-bootstrap">
              <strong>无访问权限</strong>
              <p>平台管理仅管理员可访问。</p>
              <Button onClick={() => navigate('/')}>返回智能体广场</Button>
            </section>
          ) : path === '/data' ? (
            <DataManager state={state} />
          ) : path === '/users' ? (
            <UserManagement currentUser={user} onUserChange={onUserChange} />
          ) : (
            <AgentPlaza navigate={navigate} />
          )}
        </div>
      </main>
    </SidebarProvider>
  );
}
