import { currentUser, userStore } from '@/lib/admin-server';
import { accountError, accountJson, accountPayload, requireSameOrigin, requireAccountAdmin } from '@/lib/account-http';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const store = await userStore();
    requireAccountAdmin(await currentUser(store));
    return accountJson({ users: await store.list() });
  } catch (error) { return accountError(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const store = await userStore();
    requireAccountAdmin(await currentUser(store));
    return accountJson({ ok: true, user: await store.add(await accountPayload(request)) }, 201);
  } catch (error) { return accountError(error); }
}
