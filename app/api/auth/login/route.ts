import { adminConfig, userStore } from '@/lib/admin-server';
import { createUserSession, sessionCookie } from '@/lib/admin-auth';
import { accountError, accountJson, accountPayload, authAttempt, authSucceeded, requireSameOrigin } from '@/lib/account-http';
import { AccountError, publicUser } from '@/lib/user-store';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const key = authAttempt(request);
    const payload = await accountPayload(request);
    const identifier = payload.account;
    if (typeof identifier !== 'string' || !identifier.trim() || identifier.length > 64 ||
        typeof payload.password !== 'string' || !payload.password || payload.password.length > 256)
      throw new AccountError('请输入有效的账号和密码。');
    const store = await userStore();
    const user = await store.authenticate(identifier, payload.password);
    if (!user) throw new AccountError('账号或密码不正确，请重试。', 401);
    authSucceeded(key);
    const token = await createUserSession(user, adminConfig());
    return accountJson({ ok: true, user: publicUser(user) }, 200, {
      'Set-Cookie': sessionCookie(token, new URL(request.url).protocol === 'https:'),
    });
  } catch (error) { return accountError(error); }
}
