'use client';
import { useRef, useState, useSyncExternalStore } from 'react';
import {
  ArrowRight,
  Layers2,
  LockKeyhole,
  ShieldCheck,
  UsersRound,
  Wrench,
  Zap,
  ChartNoAxesCombined,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PasswordInput from './password-input';
function formText(form: FormData, field: string) {
  const value = form.get(field);
  return typeof value === 'string' ? value : '';
}
function subscribeClientReady() {
  return () => {};
}
export default function LoginForm({ initialAccount = '', notice = '' }: {
  initialAccount?: string;
  notice?: string;
}) {
  const ready = useSyncExternalStore(subscribeClientReady, () => true, () => false);
  const [account, setAccount] = useState(initialAccount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const submitting = useRef(false);
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || submitting.current) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const identifier = account.trim().toLowerCase();
    const password = formText(form, 'password');
    const errors: Record<string, string> = {};
    if (!identifier) errors.account = '请输入账号。';
    if (!password) errors.password = '请输入密码。';
    setFieldErrors(errors);
    setError('');
    if (Object.keys(errors).length) {
      (formElement.elements.namedItem(Object.keys(errors)[0]) as HTMLInputElement | null)?.focus();
      return;
    }
    submitting.current = true;
    setPending(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          account: identifier,
          password,
        }),
      });
      if (response.ok) {
        window.location.replace('/');
        return;
      }
      const result = (await response.json()) as { error?: string };
      setError(result.error ?? '登录失败，请稍后重试。');
    } catch {
      setError('暂时无法连接，请检查网络后重试。');
    }
    setPending(false);
    submitting.current = false;
  }
  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="brand">
          <div className="brand-symbol">
            <Layers2 size={24} />
          </div>
          <div>
            <strong>丰宾电子</strong>
            <span>智能制造平台</span>
          </div>
        </div>
        <div className="login-story">
          <span className="login-edition">丰宾电子智能制造平台</span>
          <h1>
            业务有问题，
            <br />
            数据有答案。
          </h1>
          <p>
            从客户需求到工厂运营，
            <br />
            在同一个平台处理业务、分析数据。
          </p>
          <div className="login-scene-list">
            {[
              [UsersRound, '客户画像与产品推荐'],
              [Wrench, '设备维修方案'],
              [Zap, '能源消耗预测'],
              [ChartNoAxesCombined, '生产洞察与预警'],
              [ShieldCheck, '供应商评估与预警'],
            ].map(([Icon, name]) => {
              const SceneIcon = Icon as typeof UsersRound;
              return (
                <span key={String(name)}>
                  <SceneIcon size={16} />
                  {String(name)}
                </span>
              );
            })}
          </div>
        </div>
        <span className="login-brand-footer">丰宾电子 · 智能制造平台</span>
      </section>
      <section className="login-form-panel">
        <span className="login-demo-tag">FENG BIN</span>
        <div className="login-form-wrap">
          <div className="login-icon">
            <LockKeyhole size={25} />
          </div>
          <h2>欢迎登录</h2>
          <p>使用账号和密码登录，进入智能体广场。</p>
          {notice && <output className="account-success">{notice}</output>}
          <form method="post" action="/api/auth/login" onSubmit={submit} noValidate data-ready={ready ? 'true' : 'false'}>
            <div className="login-field">
              <Label htmlFor="account">账号</Label>
              <Input
                id="account"
                name="account"
                type="text"
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                placeholder="请输入账号"
                autoComplete="username"
                required
                maxLength={32}
                disabled={pending}
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={Boolean(fieldErrors.account)}
                aria-describedby={fieldErrors.account ? 'account-error' : undefined}
              />
              {fieldErrors.account && <p id="account-error" className="account-field-error">{fieldErrors.account}</p>}
            </div>
            <div className="login-field">
              <Label htmlFor="password">密码</Label>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="请输入密码"
                  required
                  maxLength={256}
                  disabled={pending}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                />
              {fieldErrors.password && <p id="password-error" className="account-field-error">{fieldErrors.password}</p>}
            </div>
            <p className="login-error" aria-live="polite">
              {error}
            </p>
            <Button type="submit" className="login-submit" disabled={!ready || pending}>
              {pending ? '正在登录…' : '登录并进入'}
              {!pending && <ArrowRight size={17} />}
            </Button>
          </form>
        </div>
        <p className="login-footer">丰宾电子 · 智能制造平台</p>
      </section>
    </main>
  );
}
