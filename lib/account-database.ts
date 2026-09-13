// The account store only needs this subset of the D1 binding API. Node uses
// the same prepared SQL statements through Cloudflare's authenticated D1 API.
export type AccountSqlValue = string | number | null;
export interface AccountStatement {
  bind(...values: AccountSqlValue[]): AccountStatement;
  run(): Promise<{ meta: { changes: number } }>;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
}
export interface AccountDatabase {
  prepare(sql: string): AccountStatement;
}
