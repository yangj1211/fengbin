'use client';
import { useState } from 'react';
import {
  Home,
  Database,
  History,
  Layers2,
  Plus,
  MessageSquareText,
  Trash2,
  LogOut,
  ChevronsUpDown,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { modules, type ModuleId, type WorkspaceState } from './model';
import { agentIcons } from './identity';
export default function Navigation({
  path,
  navigate,
  state,
  moduleId,
  sessionId,
  onNew,
  onSelect,
  onDelete,
  onLogout,
  loggingOut,
}: {
  path: string;
  navigate: (path: string) => boolean;
  state: WorkspaceState;
  moduleId?: ModuleId;
  sessionId?: string;
  onNew: () => boolean;
  onSelect: (id: string) => boolean;
  onDelete: (id: string) => boolean;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const { setOpenMobile } = useSidebar();
  const [remove, setRemove] = useState<string | null>(null);
  function go(path: string) {
    if (navigate(path)) setOpenMobile(false);
  }
  const agent = modules.find((m) => m.id === moduleId);
  const sessions = (state.sessions ?? [])
    .filter((s) => s.module === moduleId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const target = state.sessions?.find((s) => s.id === remove);
  return (
    <>
      <Sidebar
        className={
          'application-sidebar' + (moduleId ? ' conversation-sidebar' : '')
        }
      >
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
          {moduleId ? (
            <>
              <div className="sidebar-chat-start">
                <span className="sidebar-agent-name">{agent?.name}</span>
                <Button
                  className="sidebar-new-chat"
                  onClick={() => {
                    if (onNew()) setOpenMobile(false);
                  }}
                >
                  <Plus size={18} />
                  新建对话
                </Button>
              </div>
              <div className="sidebar-history-heading">
                <span>对话历史</span>
                <span>{sessions.length}</span>
              </div>
              <div
                className="sidebar-conversations"
                aria-label="当前智能体的对话历史"
              >
                {sessions.length ? (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      className={
                        'sidebar-conversation-row' +
                        (session.id === sessionId ? ' is-current' : '')
                      }
                    >
                      <button
                        className="sidebar-conversation-link"
                        aria-current={
                          session.id === sessionId ? 'page' : undefined
                        }
                        title={session.title}
                        onClick={() => {
                          if (onSelect(session.id)) setOpenMobile(false);
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
                        className="sidebar-delete-conversation"
                        title="删除对话"
                        aria-label={'删除对话：' + session.title}
                        onClick={() => setRemove(session.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="sidebar-history-empty">
                    开始提问后，对话会保存在这里。
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="workspace-label nav-group-label">智能体应用</div>
              <SidebarMenu className="agent-menu">
                {modules.map((m) => {
                  const Icon = agentIcons[m.id];
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
            </>
          )}
          <div className="sidebar-workspace-links">
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
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setRemove(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (remove && onDelete(remove)) setRemove(null);
              }}
            >
              删除对话
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
