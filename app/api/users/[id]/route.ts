import { currentUser, userStore } from '@/lib/admin-server';
import { sessionCookie } from '@/lib/admin-auth';
import { accountError, accountJson, accountPayload, requireSameOrigin, requireAccountAdmin } from '@/lib/account-http';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    const store = await userStore();
    const current = requireAccountAdmin(await currentUser(store));
    const { id } = await context.params;
    const result = await store.update(id, await accountPayload(request), current.id);
    const requiresLogin = id === current.id && (result.credentialsChanged || result.roleChanged);
    return accountJson({ ok: true, user: result.user, requiresLogin }, 200, requiresLogin ? {
      'Set-Cookie': sessionCookie('', new URL(request.url).protocol === 'https:', true),
    } : {});
  } catch (error) { return accountError(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    const store = await userStore();
    const current = requireAccountAdmin(await currentUser(store));
    await store.remove((await context.params).id, current.id);
    return accountJson({ ok: true });
  } catch (error) { return accountError(error); }
}
