import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE,
  validConfig,
  verifySession,
  type AdminConfig,
} from './admin-auth';
export function adminConfig(): AdminConfig {
  const values = env as unknown as Record<string, string | undefined>;
  return {
    username: values.ADMIN_USERNAME ?? '',
    passwordHash: values.ADMIN_PASSWORD_HASH ?? '',
    sessionSecret: values.ADMIN_SESSION_SECRET ?? '',
  };
}
export async function isAdmin() {
  const config = adminConfig();
  if (!validConfig(config)) return false;
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value, config);
}
