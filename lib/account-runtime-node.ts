import { createD1HttpDatabase } from './d1-http-database';
import { createLibSqlDatabase } from './libsql-database';

export function accountEnvironment(): Record<string, unknown> {
  return process.env;
}
export function accountDatabase() {
  if (process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN) {
    return createLibSqlDatabase({
      databaseUrl: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return createD1HttpDatabase({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID,
    apiToken: process.env.CLOUDFLARE_D1_API_TOKEN,
  });
}
