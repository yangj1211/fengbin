import type { AccountDatabase, AccountSqlValue, AccountStatement } from './account-database';
import { AccountError } from './user-store';

type D1HttpConfig = { accountId?: string; databaseId?: string; apiToken?: string };
type QueryResult = { results: unknown[]; meta: { changes: number } };
const unavailable = () => new AccountError('账号服务暂时不可用，请稍后重试。', 503);
function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}
function queryError(payload: unknown): Error {
  const body = object(payload);
  const results = Array.isArray(body?.result) ? body.result : [];
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  const messages = [...errors, ...results].flatMap(item => {
    const row = object(item);
    return [row?.message, row?.error].filter((value): value is string => typeof value === 'string');
  });
  // Preserve the two SQLite conditions handled by UserStore without exposing
  // raw API messages, SQL, bound passwords, or authentication credentials.
  if (messages.some(message => /UNIQUE constraint failed: app_users\.email/i.test(message)))
    return new Error('UNIQUE constraint failed: app_users.email');
  if (messages.some(message => /duplicate column name: role/i.test(message)))
    return new Error('duplicate column name: role');
  return unavailable();
}

export function createD1HttpDatabase(config: D1HttpConfig, fetcher: typeof fetch = fetch): AccountDatabase {
  const accountId = config.accountId?.trim();
  const databaseId = config.databaseId?.trim();
  const apiToken = config.apiToken?.trim();
  if (!accountId || !databaseId || !apiToken)
    throw new AccountError('账号服务尚未准备好，请稍后重试。', 503);
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;

  async function query(sql: string, params: AccountSqlValue[]): Promise<QueryResult> {
    let response: Response;
    let payload: unknown;
    try {
      response = await fetcher(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
        body: JSON.stringify({ sql, params }),
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
      payload = await response.json();
    } catch {
      throw unavailable();
    }
    const body = object(payload);
    const results = Array.isArray(body?.result) ? body.result : [];
    const result = object(results[0]);
    if (!response.ok || body?.success !== true || results.length !== 1 || result?.success !== true)
      throw queryError(payload);
    const meta = object(result.meta);
    if (!Array.isArray(result.results) || typeof meta?.changes !== 'number' || !Number.isFinite(meta.changes))
      throw unavailable();
    return { results: result.results, meta: { changes: meta.changes } };
  }
  function statement(sql: string, params: AccountSqlValue[] = []): AccountStatement {
    return {
      bind(...values) {
        if (values.some(value => value !== null && typeof value !== 'string' &&
          (typeof value !== 'number' || !Number.isFinite(value))))
          throw new TypeError('Invalid account SQL parameter');
        return statement(sql, [...values]);
      },
      async run() { return query(sql, params); },
      async all<T>() { return { results: (await query(sql, params)).results as T[] }; },
      async first<T>() { return ((await query(sql, params)).results[0] as T | undefined) ?? null; },
    };
  }
  return { prepare: sql => statement(sql) };
}
