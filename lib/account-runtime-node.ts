import { createD1HttpDatabase } from './d1-http-database';

export function accountEnvironment(): Record<string, unknown> {
  return process.env;
}
export function accountDatabase() {
  return createD1HttpDatabase({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID,
    apiToken: process.env.CLOUDFLARE_D1_API_TOKEN,
  });
}
