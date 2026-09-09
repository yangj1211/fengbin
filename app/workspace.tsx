'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home,
  UsersRound,
  Wrench,
  Zap,
  ChartNoAxesCombined,
  ShieldCheck,
  Database,
  History,
  LogOut,
  Layers2,
  ChevronRight,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { modules } from './application/model';
import { useWorkspace, storageMessage } from './application/store';
import AgentPlaza from './application/home';
import ModuleWorkspace from './application/module';
import Records from './application/records';
import DataManager from './application/data-manager';
const icons = [UsersRound, Wrench, Zap, ChartNoAxesCombined, ShieldCheck];
function Navigation({
  path,
  navigate,
}: {
  path: string;
  navigate: (path: string) => void;
}) {
  const { setOpenMobile } = useSidebar();
  function go(url: string) {
    navigate(url);
    setOpenMobile(false);
  }
  return (
    <Sidebar className="application-sidebar">
      <SidebarHeader className="brand-area">
        <div className="brand">
          <div className="brand-symbol">
            <Layers2 size={24} />
          </div>
          <div>
            <strong>丰宾电子</strong>
            <span>智能制造平台</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="agent-menu">
          <SidebarMenuItem>
            <SidebarMenuButton
              className="agent-nav"
              isActive={path === '/'}
              onClick={() => go('/')}
            >
              <Home />
              <span>智能体广场</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="workspace-label nav-group-label">智能体应用</div>
        <SidebarMenu className="agent-menu">
          {modules.map((m, i) => {
            const Icon = icons[i];
            return (
              <SidebarMenuItem key={m.id}>
                <SidebarMenuButton
                  className="agent-nav"
                  isActive={path === '/apps/' + m.id}
                  onClick={() => go('/apps/' + m.id)}
                >
                  <Icon />
                  <span>{m.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
        <div className="workspace-label nav-group-label">工作空间</div>
        <SidebarMenu className="agent-menu">
          <SidebarMenuItem>
            <SidebarMenuButton
              className="agent-nav"
              isActive={path.startsWith('/records')}
              onClick={() => go('/records')}
            >
              <History />
              <span>分析记录</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="agent-nav"
              isActive={path === '/data'}
              onClick={() => go('/data')}
            >
              <Database />
              <span>数据管理</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="sidebar-bottom">
        <div className="account">
          <span className="avatar">管</span>
          <div>
            <strong>管理员</strong>
            <span>丰宾电子 · 管理员工作区</span>
          </div>
          <ShieldCheck size={17} />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
export default function Workspace({ path = '/' }: { path?: string }) {
  const router = useRouter();
  const state = useWorkspace();
  const [message, setMessage] = useState('');
  const navigate = (url: string) => router.push(url);
  const activeModule = modules.find((m) => path === '/apps/' + m.id);
  const title =
    path === '/'
      ? '智能体广场'
      : (activeModule?.name ??
        (path.startsWith('/records') ? '分析记录' : '数据管理'));
  async function logout() {
    try {
      const r = await fetch('/api/auth/logout', { method: 'POST' });
      if (!r.ok) throw new Error();
      window.location.replace('/login');
    } catch {
      setMessage('退出失败，请稍后重试。');
    }
  }
  return (
    <SidebarProvider
      style={{ '--sidebar-width': '240px' } as React.CSSProperties}
    >
      <Navigation path={path} navigate={navigate} />
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
            <span className="topbar-divider" />
            <span className="workspace-owner">管理员</span>
            <span className="top-avatar">管</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="退出登录"
              title="退出登录"
              onClick={logout}
            >
              <LogOut size={16} />
            </Button>
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
            <ModuleWorkspace
              key={activeModule.id}
              id={activeModule.id}
              state={state}
              navigate={navigate}
            />
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
