import { createClient } from '@libsql/client/web';
import type { AccountDatabase, AccountSqlValue, AccountStatement } from './account-database';
import { AccountError } from './user-store';

type LibSqlConfig = { databaseUrl?: string; authToken?: string };
type QueryResult = { rows: unknown[]; rowsAffected: number };
type ClientFactory = (config: { url: string; authToken: string; intMode: 'number'; fetch: typeof fetch }) => {
  execute(statement: { sql: string; args: AccountSqlValue[] }): Promise<QueryResult>;
};
const unavailable = () => new AccountError('账号服务暂时不可用，请稍后重试。', 503);
function queryError(error: unknown): Error {
  // Only these fixed SQLite conditions have a safe, explicit UserStore handler.
  // Never attach the provider error as a cause: it can contain SQL or credentials.
  const message = error instanceof Error ? error.message : '';
  if (/UNIQUE constraint failed: app_users\.email(?![\w.])/i.test(message))
    return new Error('UNIQUE constraint failed: app_users.email');
  if (/duplicate column name: role(?![\w.])/i.test(message))
    return new Error('duplicate column name: role');
  return unavailable();
}

export function createLibSqlDatabase(config: LibSqlConfig, factory: ClientFactory = createClient): AccountDatabase {
  const databaseUrl = typeof config?.databaseUrl === 'string' ? config.databaseUrl.trim() : '';
  const authToken = typeof config?.authToken === 'string' ? config.authToken.trim() : '';
  let client: ReturnType<ClientFactory>;
  try {
    if (!databaseUrl || !authToken || /\s/.test(authToken) || /[\s\\?#]/.test(databaseUrl)) throw unavailable();
    const url = new URL(databaseUrl);
    // The web client uses HTTPS for libsql:// URLs. Reject URL credentials and
    // query overrides (including tls=0 and authToken) before constructing it.
    if (!/^(https|libsql):\/\/[^/]/i.test(databaseUrl) || !['https:', 'libsql:'].includes(url.protocol) ||
      !url.hostname || url.username || url.password || url.search || url.hash)
      throw unavailable();
    client = factory({
      url: databaseUrl, authToken, intMode: 'number',
      fetch(input, init) {
        const signals = [AbortSignal.timeout(10_000)];
        if (input instanceof Request) signals.push(input.signal);
        if (init?.signal) signals.push(init.signal);
        return fetch(input, { ...init, signal: AbortSignal.any(signals), cache: 'no-store', redirect: 'error' });
      },
    });
    if (!client || typeof client.execute !== 'function') throw unavailable();
  } catch {
    throw unavailable();
  }

  async function query(sql: string, args: AccountSqlValue[]): Promise<QueryResult> {
    try {
      const result = await client.execute({ sql, args: [...args] });
      if (!result || !Array.isArray(result.rows) ||
        result.rows.some(row => row === null || typeof row !== 'object' || Array.isArray(row)) ||
        !Number.isSafeInteger(result.rowsAffected) || result.rowsAffected < 0)
        throw unavailable();
      return result;
    } catch (error) {
      throw queryError(error);
    }
  }
  function statement(sql: string, args: AccountSqlValue[] = []): AccountStatement {
    return {
      bind(...values) {
        if (values.some(value => value !== null && typeof value !== 'string' &&
          (typeof value !== 'number' || !Number.isFinite(value))))
          throw unavailable();
        return statement(sql, [...values]);
      },
      async run() { return { meta: { changes: (await query(sql, args)).rowsAffected } }; },
      async all<T>() { return { results: (await query(sql, args)).rows as T[] }; },
      async first<T>() { return ((await query(sql, args)).rows[0] as T | undefined) ?? null; },
    };
  }
  return {
    prepare(sql) {
      if (typeof sql !== 'string' || !sql.trim()) throw unavailable();
      return statement(sql);
    },
  };
}
