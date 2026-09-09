'use client';
import {
  Home,
  Database,
  History,
  Layers2,
  LogOut,
  ChevronsUpDown,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarTrigger,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { modules } from './model';
import { agentIcons } from './identity';
export default function Navigation({
  path,
  navigate,
  onLogout,
  loggingOut,
}: {
  path: string;
  navigate: (path: string) => boolean;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const {
    setOpenMobile,
    state: sidebarState,
    isMobile,
    openMobile,
  } = useSidebar();
  const expanded = isMobile ? openMobile : sidebarState === 'expanded';
  function go(path: string) {
    if (navigate(path)) setOpenMobile(false);
  }
  return (
    <>
      <Sidebar className="application-sidebar" collapsible="icon">
        <SidebarHeader className="brand-area">
          <div className="directory-brand-row">
            <div className="brand">
              <div className="brand-symbol">
                <Layers2 size={24} />
              </div>
              <div>
                <strong>丰宾电子</strong>
                <span>智能制造平台</span>
              </div>
            </div>
            <SidebarTrigger
              className="directory-collapse-trigger"
              aria-label={expanded ? '收起应用目录' : '展开应用目录'}
              title={expanded ? '收起应用目录' : '展开应用目录'}
              aria-expanded={expanded}
            />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu className="agent-menu">
            <SidebarMenuItem>
              <SidebarMenuButton
                className="agent-nav group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-0!"
                aria-label="智能体广场"
                tooltip="智能体广场"
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
            {modules.map((m) => {
              const Icon = agentIcons[m.id];
              return (
                <SidebarMenuItem key={m.id}>
                  <SidebarMenuButton
                    className="agent-nav group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-0!"
                    aria-label={m.name}
                    tooltip={m.name}
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
          <div className="sidebar-workspace-links">
            <div className="workspace-label nav-group-label">工作空间</div>
            <SidebarMenu className="agent-menu">
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="agent-nav group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-0!"
                  aria-label="分析记录"
                  tooltip="分析记录"
                  isActive={path.startsWith('/records')}
                  onClick={() => go('/records')}
                >
                  <History />
                  <span>分析记录</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="agent-nav group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-0!"
                  aria-label="数据管理"
                  tooltip="数据管理"
                  isActive={path === '/data'}
                  onClick={() => go('/data')}
                >
                  <Database />
                  <span>数据管理</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        </SidebarContent>
        <SidebarFooter className="sidebar-bottom">
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={loggingOut}
              render={
                <button
                  className="account sidebar-account-control"
                  aria-label="管理员账户菜单"
                />
              }
            >
              <span className="avatar">管</span>
              <span className="sidebar-account-text">
                <strong>管理员</strong>
                <span>丰宾电子 · 管理员工作区</span>
              </span>
              <ChevronsUpDown size={15} />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              sideOffset={10}
              className="account-dropdown"
            >
              <DropdownMenuItem disabled={loggingOut} onClick={onLogout}>
                <LogOut size={16} />
                {loggingOut ? '正在退出…' : '退出登录'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <div className="mobile-directory-rail">
        <SidebarTrigger
          aria-label="打开应用目录"
          title="打开应用目录"
          aria-expanded={openMobile}
        />
      </div>
    </>
  );
}
