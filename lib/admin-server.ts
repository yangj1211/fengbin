import { accountDatabase, accountEnvironment } from './account-runtime';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE,
  type AdminConfig,
} from './admin-auth';
import { AccountError, UserStore, type StoredUser } from './user-store';
export function adminConfig(): AdminConfig {
  const values = accountEnvironment();
  return {
    username: typeof values.ADMIN_USERNAME === 'string' ? values.ADMIN_USERNAME : '',
    passwordHash: typeof values.ADMIN_PASSWORD_HASH === 'string' ? values.ADMIN_PASSWORD_HASH : '',
    sessionSecret: typeof values.ADMIN_SESSION_SECRET === 'string' ? values.ADMIN_SESSION_SECRET : '',
  };
}
export async function userStore() {
  const db = accountDatabase();
  if (!db) throw new AccountError('账号服务尚未准备好，请稍后重试。', 503);
  const store = new UserStore(db, adminConfig());
  await store.initialize();
  return store;
}
export async function currentUser(store?: UserStore): Promise<StoredUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return (store ?? await userStore()).sessionUser(token);
}
// Historical name retained for page guards; every signed-in user can use the app.
export async function isAdmin() {
  try { return Boolean(await currentUser()); } catch { return false; }
}
