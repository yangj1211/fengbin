'use client';

import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PasswordInput from '../login/password-input';

type ChangePasswordProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: string;
};
type PasswordField = 'oldPassword' | 'newPassword' | 'confirmPassword';

function passwordValue(data: FormData, field: PasswordField) {
  const value = data.get(field);
  return typeof value === 'string' ? value : '';
}

export default function ChangePassword({ open, onOpenChange, account }: ChangePasswordProps) {
  return open ? <PasswordDialog key={account} onOpenChange={onOpenChange} account={account} /> : null;
}

function PasswordDialog({ onOpenChange, account }: Omit<ChangePasswordProps, 'open'>) {
  const formId = useId();
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<PasswordField, string>>>({});

  function clearError(field: PasswordField) {
    setError('');
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
      ...(field === 'newPassword' ? { confirmPassword: undefined } : {}),
    }));
  }

  function errorProps(field: PasswordField) {
    return {
      'aria-invalid': Boolean(fieldErrors[field]),
      'aria-describedby': fieldErrors[field] ? `${formId}-${field}-error` : undefined,
      onChange: () => clearError(field),
    };
  }

  function fieldError(field: PasswordField) {
    return fieldErrors[field] ? <p id={`${formId}-${field}-error`} className="account-field-error">{fieldErrors[field]}</p> : null;
  }

  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const oldPassword = passwordValue(data, 'oldPassword');
    const newPassword = passwordValue(data, 'newPassword');
    const confirmPassword = passwordValue(data, 'confirmPassword');
    const errors: Partial<Record<PasswordField, string>> = {};
    if (!oldPassword) errors.oldPassword = '请输入旧密码。';
    if (newPassword.length < 8 || newPassword.length > 64) errors.newPassword = '新密码须为 8 至 64 个字符。';
    if (!confirmPassword) errors.confirmPassword = '请再次输入新密码。';
    else if (newPassword !== confirmPassword) errors.confirmPassword = '两次输入的新密码不一致。';
    setFieldErrors(errors);
    setError('');
    const firstError = Object.keys(errors)[0];
    if (firstError) {
      (form.elements.namedItem(firstError) as HTMLInputElement | null)?.focus();
      return;
    }

    savingRef.current = true;
    setSaving(true);
    let redirecting = false;
    try {
      const response = await fetch('/api/auth/password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      if (response.status === 401) {
        redirecting = true;
        window.location.replace('/login');
        return;
      }
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        setError(result?.error || '密码修改失败，请重试。');
        return;
      }
      redirecting = true;
      window.location.replace(`/login?updated=1&account=${encodeURIComponent(account)}`);
    } catch {
      setError('暂时无法连接，请检查网络后重试。');
    } finally {
      if (!redirecting) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  }

  return <Dialog open onOpenChange={(nextOpen) => { if (!savingRef.current) onOpenChange(nextOpen); }}>
    <DialogContent className="app-dialog user-dialog" showCloseButton={!saving}>
      <DialogHeader>
        <DialogTitle>修改密码</DialogTitle>
        <DialogDescription>修改当前账号的登录密码，保存成功后需要重新登录。</DialogDescription>
      </DialogHeader>
      <form id={formId} method="post" action="/api/auth/password" data-ready="true" onSubmit={save} noValidate aria-busy={saving}>
        <div className="login-field">
          <Label htmlFor={`${formId}-oldPassword`}>旧密码</Label>
          <PasswordInput id={`${formId}-oldPassword`} name="oldPassword" label="旧密码" autoComplete="current-password" defaultValue="" maxLength={256} disabled={saving} required placeholder="请输入旧密码" {...errorProps('oldPassword')} />
          {fieldError('oldPassword')}
        </div>
        <div className="login-field">
          <Label htmlFor={`${formId}-newPassword`}>新密码</Label>
          <PasswordInput id={`${formId}-newPassword`} name="newPassword" label="新密码" autoComplete="new-password" defaultValue="" minLength={8} maxLength={64} disabled={saving} required placeholder="请输入 8 至 64 个字符" {...errorProps('newPassword')} />
          {fieldError('newPassword')}
        </div>
        <div className="login-field">
          <Label htmlFor={`${formId}-confirmPassword`}>确认新密码</Label>
          <PasswordInput id={`${formId}-confirmPassword`} name="confirmPassword" label="确认新密码" autoComplete="new-password" defaultValue="" minLength={8} maxLength={64} disabled={saving} required placeholder="请再次输入新密码" {...errorProps('confirmPassword')} />
          {fieldError('confirmPassword')}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
      <DialogFooter>
        <Button variant="outline" disabled={saving} onClick={() => { if (!savingRef.current) onOpenChange(false); }}>取消</Button>
        <Button type="submit" form={formId} disabled={saving}>{saving ? '正在保存…' : '保存并重新登录'}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
