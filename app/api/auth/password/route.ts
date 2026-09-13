import { currentUser, userStore } from '@/lib/admin-server';
import { sessionCookie } from '@/lib/admin-auth';
import { accountError, accountJson, accountPayload, requireSameOrigin } from '@/lib/account-http';
import { AccountError } from '@/lib/user-store';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const store = await userStore();
    const current = await currentUser(store);
    if (!current) throw new AccountError('登录已失效，请重新登录。', 401);
    const payload = await accountPayload(request);
    await store.changePassword(current.id, payload.oldPassword, payload.newPassword);
    return accountJson({ ok: true, requiresLogin: true }, 200, {
      'Set-Cookie': sessionCookie('', new URL(request.url).protocol === 'https:', true),
    });
  } catch (error) { return accountError(error); }
}
