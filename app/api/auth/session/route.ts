import { currentUser } from '@/lib/admin-server';
import { accountError, accountJson } from '@/lib/account-http';
import { publicUser } from '@/lib/user-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await currentUser();
    return accountJson({ authenticated: Boolean(user), user: user ? publicUser(user) : null }, user ? 200 : 401);
  } catch (error) { return accountError(error); }
}
