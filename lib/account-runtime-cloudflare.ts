import { env } from 'cloudflare:workers';
import type { AccountDatabase } from './account-database';

export function accountEnvironment(): Record<string, unknown> {
  return env as unknown as Record<string, unknown>;
}
export function accountDatabase(): AccountDatabase | undefined {
  return (env as unknown as { AUTH_DB?: D1Database }).AUTH_DB;
}
