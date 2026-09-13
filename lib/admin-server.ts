import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE,
  type AdminConfig,
} from './admin-auth';
import { AccountError, UserStore, type StoredUser } from './user-store';
export function adminConfig(): AdminConfig {
  const values = env as unknown as Record<string, string | undefined>;
  return {
    username: values.ADMIN_USERNAME ?? '',
    passwordHash: values.ADMIN_PASSWORD_HASH ?? '',
    sessionSecret: values.ADMIN_SESSION_SECRET ?? '',
  };
}
export async function userStore() {
  const db = (env as unknown as { AUTH_DB?: D1Database }).AUTH_DB;
  if (!db) throw new AccountError('账号服务尚未准备好，请稍后重试。', 503);
  const store = new UserStore(db, adminConfig());
  await store.initialize();
  return store;
}
export async function currentUser(store?: UserStore): Promise<StoredUser | null> {
  return (store ?? await userStore()).sessionUser((await cookies()).get(SESSION_COOKIE)?.value);
}
// Historical name retained for page guards; every signed-in user can use the app.
export async function isAdmin() {
  try { return Boolean(await currentUser()); } catch { return false; }
}
