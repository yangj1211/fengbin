'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import PasswordInput from '../login/password-input';
import { AppHeading } from './ui';
import ListPagination, { getPageRange } from './list-pagination';
import type { AccountUser } from './account-types';

function dateLabel(value: string | null) {
  if (!value) return '尚未登录';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}
function sorted(users: AccountUser[]) {
  return [...users].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}
function formText(form: FormData, field: string) {
  const value = form.get(field);
  return typeof value === 'string' ? value : '';
}
function roleLabel(user: Pick<AccountUser, 'role' | 'isDefaultAdmin'>) {
  if (user.isDefaultAdmin) return '超级管理员';
  return user.role === 'admin' ? '管理员' : '普通用户';
}

export default function UserManagement({ currentUser, onUserChange }: {
  currentUser: AccountUser;
  onUserChange: (user: AccountUser) => void;
}) {
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<AccountUser | 'new' | null>(null);
  const [role, setRole] = useState<AccountUser['role']>('user');
  const [deleting, setDeleting] = useState<AccountUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const savingRef = useRef(false);
  const tableId = useId();
  const formId = useId();

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/users', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (response.status === 401) { window.location.replace('/login'); return; }
        const result = await response.json() as { users?: AccountUser[]; error?: string };
        if (!response.ok || !Array.isArray(result.users)) throw new Error(result.error || '用户列表加载失败，请重试。');
        if (!controller.signal.aborted) setUsers(sorted(result.users));
      } catch (failure) {
        if (!controller.signal.aborted) setLoadError(failure instanceof Error && failure.message !== 'Failed to fetch' ? failure.message : '暂时无法连接，请检查网络后重试。');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [refresh]);

  const search = query.trim().toLocaleLowerCase();
  const visible = users.filter((user) => user.name.toLocaleLowerCase().includes(search) || user.account.toLocaleLowerCase().includes(search));
  const range = getPageRange(visible.length, page, pageSize);
  const editing = editor && editor !== 'new' ? editor : null;
  const ownEdit = editing?.id === currentUser.id;
  const roleLockReason = editing?.isDefaultAdmin
    ? '超级管理员为唯一固定账号，角色不可修改。'
    : ownEdit && editing.role === 'admin' ? '不能修改当前账号角色。' : '';

  function openEditor(user: AccountUser | 'new') {
    setEditor(user); setError(''); setFieldErrors({}); setNotice('');
    setRole(user === 'new' ? 'user' : user.role);
  }
  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || !editor) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = formText(data, 'name').trim();
    const account = editing ? editing.account : formText(data, 'account').trim().toLowerCase();
    const password = formText(data, 'password');
    const oldPassword = formText(data, 'oldPassword');
    const confirm = formText(data, 'confirmPassword');
    const errors: Record<string, string> = {};
    if (!editing && !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(account)) errors.account = '账号名须为 3 至 32 个字符，仅支持小写英文、数字、点、下划线或短横线。';
    if (name.length > 40) errors.name = '姓名最多 40 个字符。';
    if ((editor === 'new' || password) && (password.length < 8 || password.length > 64)) errors.password = '密码须为 8 至 64 个字符。';
    if (ownEdit && password && !oldPassword) errors.oldPassword = '修改自己的密码时，请输入旧密码。';
    if (password !== confirm) errors.confirmPassword = '两次输入的密码不一致。';
    setFieldErrors(errors); setError('');
    if (Object.keys(errors).length) {
      (form.elements.namedItem(Object.keys(errors)[0]) as HTMLInputElement | null)?.focus(); return;
    }
    savingRef.current = true; setSaving(true);
    try {
      const response = await fetch(editing ? `/api/users/${encodeURIComponent(editing.id)}` : '/api/users', {
        method: editing ? 'PATCH' : 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ...(editing ? {} : { account }), role, ...(password ? { password } : {}), ...(ownEdit && password ? { oldPassword } : {}) }),
      });
      if (response.status === 401) { window.location.replace('/login'); return; }
      const result = await response.json() as { user?: AccountUser; error?: string; requiresLogin?: boolean };
      if (!response.ok || !result.user) { setError(result.error || '保存失败，请重试。'); return; }
      if (result.requiresLogin) {
        window.location.replace(`/login?updated=1&account=${encodeURIComponent(result.user.account)}`); return;
      }
      const saved = result.user;
      setUsers((old) => sorted(editing ? old.map((user) => user.id === saved.id ? saved : user) : [saved, ...old.filter((user) => user.id !== saved.id)]));
      if (saved.id === currentUser.id) onUserChange(saved);
      if (!editing) { setQuery(''); setPage(1); }
      else setPage(range.currentPage);
      setNotice(editing ? `已更新“${saved.name}”。` : `已新增“${saved.name}”，可使用账号登录。`);
      setEditor(null);
    } catch { setError('暂时无法连接，请检查网络后重试。'); }
    finally { savingRef.current = false; setSaving(false); }
  }
  async function removeUser() {
    if (!deleting || savingRef.current) return;
    savingRef.current = true; setSaving(true); setError('');
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(deleting.id)}`, { method: 'DELETE', credentials: 'same-origin' });
      if (response.status === 401) { window.location.replace('/login'); return; }
      const result = await response.json() as { error?: string };
      if (!response.ok) { setError(result.error || '删除失败，请重试。'); return; }
      setUsers((old) => old.filter((user) => user.id !== deleting.id));
      setPage(Math.min(range.currentPage, Math.max(1, Math.ceil((visible.length - 1) / pageSize))));
      setNotice(`已删除“${deleting.name}”。`); setDeleting(null);
    } catch { setError('暂时无法连接，请检查网络后重试。'); }
    finally { savingRef.current = false; setSaving(false); }
  }
  function fieldError(field: string) {
    return fieldErrors[field] ? <p id={`${formId}-${field}-error`} className="account-field-error">{fieldErrors[field]}</p> : null;
  }
  function errorProps(field: string) {
    return { 'aria-invalid': Boolean(fieldErrors[field]), 'aria-describedby': fieldErrors[field] ? `${formId}-${field}-error` : undefined };
  }
  return <>
    <AppHeading title="用户管理" description="创建平台账号，维护用户资料、角色和登录密码。" action={<Button onClick={() => openEditor('new')} disabled={loading || Boolean(loadError)}><Plus size={17} />新增用户</Button>} />
    {notice && <output className="data-resource-message">{notice}</output>}
    <section className="app-section user-management" aria-label="平台用户" aria-busy={loading}>
      <div className="data-resource-toolbar user-toolbar">
        <div className="search-field">
          <Search size={17} />
          <Input aria-label="搜索姓名或账号" placeholder="搜索姓名或账号" value={query} disabled={loading} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
          {query && <Button variant="ghost" size="icon" className="user-search-clear" aria-label="清空搜索" onClick={() => { setQuery(''); setPage(1); }}><X size={16} /></Button>}
        </div>
        <span className="user-count">共 {loading ? '—' : visible.length} 位用户</span>
      </div>
      {loadError ? <div className="user-load-error" role="alert"><p>{loadError}</p><Button variant="outline" onClick={() => { setLoading(true); setLoadError(''); setRefresh((old) => old + 1); }}><RefreshCw size={16} />重试</Button></div> : <>
        <Table id={tableId} className="app-table user-table">
          <TableHeader><TableRow><TableHead>姓名</TableHead><TableHead>账号</TableHead><TableHead>角色</TableHead><TableHead>创建时间</TableHead><TableHead>最近登录</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading ? Array.from({ length: 3 }, (_, index) => <TableRow key={index}>{Array.from({ length: 6 }, (_, cell) => <TableCell key={cell}><span className="user-loading-line" /></TableCell>)}</TableRow>) : visible.slice(range.offset, range.offset + pageSize).map((user) => {
              const deleteReason = user.isDefaultAdmin ? '超级管理员不能删除。' : user.id === currentUser.id ? '不能删除当前登录账号。' : '';
              return <TableRow key={user.id}>
                <TableCell><span className="user-name">{user.name}</span></TableCell>
                <TableCell className="user-account">{user.account}</TableCell>
                <TableCell>{roleLabel(user)}</TableCell>
                <TableCell className="user-date">{dateLabel(user.createdAt)}</TableCell><TableCell className="user-date">{dateLabel(user.lastLoginAt)}</TableCell>
                <TableCell><div className="user-actions"><Button variant="ghost" size="icon" aria-label={`编辑${user.name}`} title="编辑" onClick={() => openEditor(user)}><Pencil size={16} /></Button><span title={deleteReason || '删除'}><Button variant="ghost" size="icon" className="user-delete" disabled={Boolean(deleteReason)} aria-label={`删除${user.name}${deleteReason ? `：${deleteReason}` : ''}`} onClick={() => { setDeleting(user); setError(''); setNotice(''); }}><Trash2 size={16} /></Button></span></div>{deleteReason && <span className="user-delete-reason">{deleteReason}</span>}</TableCell>
              </TableRow>;
            })}
            {!loading && !visible.length && <TableRow><TableCell colSpan={6}><div className="user-empty"><p>{search ? '没有找到匹配的用户。' : '暂无用户。'}</p>{search && <Button variant="outline" onClick={() => { setQuery(''); setPage(1); }}>清空搜索</Button>}</div></TableCell></TableRow>}
          </TableBody>
        </Table>
        {!loading && <ListPagination total={visible.length} page={range.currentPage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} controls={tableId} label="用户列表分页" />}
      </>}
    </section>
    <Dialog open={Boolean(editor)} onOpenChange={(open) => { if (!open && !savingRef.current) setEditor(null); }}>
      <DialogContent className="app-dialog user-dialog" showCloseButton={!saving}>
        <DialogHeader><DialogTitle>{editing ? '编辑用户' : '新增用户'}</DialogTitle><DialogDescription>{editing ? '更新用户资料；账号不可修改，密码留空时保持原密码。' : '填写账号和初始密码，创建后即可登录。'}</DialogDescription></DialogHeader>
        <form id={formId} method="post" action={editing ? `/api/users/${encodeURIComponent(editing.id)}` : '/api/users'} onSubmit={save} noValidate key={editor === 'new' ? 'new' : editing?.id}>
          <div className="login-field"><Label htmlFor={`${formId}-name`}>姓名 <span className="optional-label">选填</span></Label><Input id={`${formId}-name`} name="name" autoComplete="off" defaultValue={editing?.name ?? ''} maxLength={40} disabled={saving} placeholder="不填写时使用账号名" {...errorProps('name')} />{fieldError('name')}</div>
          <div className="login-field"><Label htmlFor={`${formId}-account`}>账号</Label><Input id={`${formId}-account`} name="account" type="text" autoComplete="off" defaultValue={editing?.account ?? ''} maxLength={32} disabled={saving || Boolean(editing)} required autoCapitalize="none" spellCheck={false} placeholder="3 至 32 位账号名" {...errorProps('account')} />{editing && <p className="field-help">账号创建后不可修改。</p>}{fieldError('account')}</div>
          <div className="login-field"><Label htmlFor={`${formId}-role`}>角色</Label>{editing?.isDefaultAdmin ? <Input id={`${formId}-role`} value="超级管理员" disabled aria-describedby={`${formId}-role-note`} /> : <Select value={role} disabled={saving || Boolean(roleLockReason)} onValueChange={(value) => { if (value === 'admin' || value === 'user') setRole(value); }} items={[{ label: '普通用户', value: 'user' }, { label: '管理员', value: 'admin' }]}><SelectTrigger id={`${formId}-role`} className="w-full" aria-describedby={roleLockReason ? `${formId}-role-note` : undefined}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="user">普通用户</SelectItem><SelectItem value="admin">管理员</SelectItem></SelectContent></Select>}{roleLockReason && <p id={`${formId}-role-note`} className="user-edit-note">{roleLockReason}</p>}</div>
          {ownEdit && <div className="login-field"><Label htmlFor={`${formId}-oldPassword`}>旧密码</Label><PasswordInput id={`${formId}-oldPassword`} name="oldPassword" label="旧密码" autoComplete="current-password" maxLength={256} disabled={saving} placeholder="修改自己的密码时填写" {...errorProps('oldPassword')} />{fieldError('oldPassword')}</div>}
          <div className="login-field"><Label htmlFor={`${formId}-password`}>{editing ? ownEdit ? '新密码' : '重置密码' : '初始密码'}</Label><PasswordInput id={`${formId}-password`} name="password" label={editing ? ownEdit ? '新密码' : '重置密码' : '初始密码'} autoComplete="new-password" maxLength={64} disabled={saving} required={!editing} placeholder={editing ? '留空不修改；修改时输入 8 至 64 个字符' : '请输入 8 至 64 个字符'} {...errorProps('password')} />{fieldError('password')}</div>
          <div className="login-field"><Label htmlFor={`${formId}-confirmPassword`}>确认密码</Label><PasswordInput id={`${formId}-confirmPassword`} name="confirmPassword" label="确认密码" autoComplete="new-password" maxLength={64} disabled={saving} required={!editing} placeholder={editing ? '修改密码时请再次输入' : '请再次输入密码'} {...errorProps('confirmPassword')} />{fieldError('confirmPassword')}</div>
          {ownEdit && <p className="user-edit-note">修改自己的密码后，需要重新登录。</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
        </form>
        <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setEditor(null)}>取消</Button><Button type="submit" form={formId} disabled={saving}>{saving ? '正在保存…' : '保存'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open && !savingRef.current) setDeleting(null); }}>
      <DialogContent className="app-dialog" showCloseButton={!saving}>
        <DialogHeader><DialogTitle>删除用户？</DialogTitle><DialogDescription>将删除“{deleting?.name}”（{deleting?.account}），该账号将无法再登录，已有登录状态同时失效。</DialogDescription></DialogHeader>
        {error && <p className="form-error" role="alert">{error}</p>}
        <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setDeleting(null)}>取消</Button><Button variant="destructive" disabled={saving} onClick={removeUser}>{saving ? '正在删除…' : '确认删除'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
