'use client';
import { useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
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
export default function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          username: form.get('username'),
          password: form.get('password'),
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
          <h2>管理员登录</h2>
          <p>登录后，进入智能体广场。</p>
          <form onSubmit={submit}>
            <div className="login-field">
              <Label htmlFor="username">管理员账号</Label>
              <Input
                id="username"
                name="username"
                defaultValue="admin"
                autoComplete="username"
                required
                maxLength={80}
                disabled={pending}
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <div className="login-field">
              <Label htmlFor="password">密码</Label>
              <div className="password-field">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="请输入管理员密码"
                  required
                  maxLength={256}
                  disabled={pending}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </Button>
              </div>
            </div>
            <p className="login-error" aria-live="polite">
              {error}
            </p>
            <Button type="submit" className="login-submit" disabled={pending}>
              {pending ? '正在登录…' : '登录并进入'}
              {!pending && <ArrowRight size={17} />}
            </Button>
          </form>
          <div className="login-session-note">
            <ShieldCheck size={14} />
            <span>管理员专用 · 登录状态保留 8 小时</span>
          </div>
        </div>
        <p className="login-footer">企业应用 · 管理员访问</p>
      </section>
    </main>
  );
}
