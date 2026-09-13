import { hashPassword, readUserSession, validConfig, verifyPasswordHash, type AdminConfig } from './admin-auth';

export const DEFAULT_ADMIN_ID = 'default-admin';
export const DEFAULT_ADMIN_ACCOUNT = 'admin';
export type UserRole = 'admin' | 'user';
export type PublicUser = {
  id: string; name: string; account: string; role: UserRole; isDefaultAdmin: boolean;
  createdAt: string; lastLoginAt: string | null;
};
export type StoredUser = PublicUser & { passwordHash: string; sessionVersion: number };
type UserRow = Omit<StoredUser, 'isDefaultAdmin' | 'account'> & { email: string; isDefaultAdmin: number };
export class AccountError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function publicUser(user: StoredUser): PublicUser {
  const { id, name, account, role, isDefaultAdmin, createdAt, lastLoginAt } = user;
  return { id, name, account, role, isDefaultAdmin, createdAt, lastLoginAt };
}
const selectColumns = 'id, name, email, role, is_default_admin AS isDefaultAdmin, created_at AS createdAt, last_login_at AS lastLoginAt, password_hash AS passwordHash, session_version AS sessionVersion';
function fromRow(row: UserRow | null): StoredUser | null {
  if (!row) return null;
  const { email: account, isDefaultAdmin, ...rest } = row;
  return { ...rest, account, isDefaultAdmin: Boolean(isDefaultAdmin) };
}
export function normalizeAccount(value: unknown): string {
  if (typeof value !== 'string') throw new AccountError('请输入有效账号名。');
  const account = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(account))
    throw new AccountError('账号名须为 3–32 个字符，仅支持小写英文、数字、点、下划线或短横线。');
  return account;
}
function legacyAccount(value: string, used: Set<string>): string {
  const source = value.trim().toLowerCase();
  let base = source.includes('@') ? source.split('@')[0] : source;
  base = base.replace(/[^a-z0-9._-]/g, '-').replace(/^[^a-z0-9]+/, '').slice(0, 32);
  if (base.length < 3) base = `user-${base}`.slice(0, 32);
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(base)) base = `user-${crypto.randomUUID().slice(0, 8)}`;
  let account = base;
  for (let index = 2; used.has(account); index++) {
    const suffix = `-${index}`;
    account = `${base.slice(0, 32 - suffix.length)}${suffix}`;
  }
  used.add(account);
  return account;
}
function normalizeName(value: unknown, account: string): string {
  if (value !== undefined && typeof value !== 'string') throw new AccountError('请输入有效名称。');
  const name = typeof value === 'string' ? value.trim() : '';
  if (name.length > 40) throw new AccountError('名称最多 40 个字符。');
  return name || account.slice(0, 40);
}
function validatePassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 64)
    throw new AccountError('密码须为 8–64 个字符。');
  return value;
}
function validateRole(value: unknown): UserRole {
  if (value !== 'admin' && value !== 'user') throw new AccountError('请选择有效的用户角色。');
  return value;
}
export function canAccessManagement(user: Pick<PublicUser, 'role'> | null): boolean {
  return user?.role === 'admin';
}
export class UserStore {
  constructor(private db: D1Database, private config: AdminConfig) {}
  async initialize() {
    if (!this.db || !validConfig(this.config)) throw new AccountError('账号服务尚未准备好，请稍后重试。', 503);
    await this.db.prepare(`CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL, is_default_admin INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
      session_version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, last_login_at TEXT
    )`).run();
    const { results: columns } = await this.db.prepare('PRAGMA table_info(app_users)').all<{ name: string }>();
    if (!columns.some(column => column.name === 'role')) {
      // Upgrade the existing account table in place, retaining every password and record.
      try {
        await this.db.prepare("ALTER TABLE app_users ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user'))").run();
      } catch (error) {
        if (!(error instanceof Error) || !/duplicate column name: role/i.test(error.message)) throw error;
      }
    }
    // This fixed account is the single super administrator in the product UI.
    await this.db.prepare("UPDATE app_users SET role = 'admin' WHERE id = ? AND role <> 'admin'").bind(DEFAULT_ADMIN_ID).run();
    await this.db.prepare(`INSERT OR IGNORE INTO app_users
      (id, name, email, password_hash, role, is_default_admin, session_version, created_at)
      VALUES (?, ?, ?, ?, 'admin', 1, 1, ?)`)
      .bind(DEFAULT_ADMIN_ID, '管理员', DEFAULT_ADMIN_ACCOUNT, this.config.passwordHash, new Date().toISOString()).run();
    await this.migrateLegacyAccounts();
  }
  async get(id: string): Promise<StoredUser | null> {
    return fromRow(await this.db.prepare(`SELECT ${selectColumns} FROM app_users WHERE id = ?`).bind(id).first<UserRow>());
  }
  async list(): Promise<PublicUser[]> {
    const { results } = await this.db.prepare(`SELECT ${selectColumns} FROM app_users ORDER BY created_at DESC, id ASC`).all<UserRow>();
    return results.map(row => publicUser(fromRow(row)!));
  }
  async add(input: Record<string, unknown>): Promise<PublicUser> {
    const account = normalizeAccount(input.account);
    const name = normalizeName(input.name, account);
    const role = input.role === undefined ? 'user' : validateRole(input.role);
    const passwordHash = await hashPassword(validatePassword(input.password));
    const id = crypto.randomUUID();
    try {
      await this.db.prepare('INSERT INTO app_users (id, name, email, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(id, name, account, role, passwordHash, new Date().toISOString()).run();
    } catch (error) { this.rethrowWriteError(error); }
    return publicUser((await this.get(id))!);
  }
  async authenticate(identifier: string, password: string): Promise<StoredUser | null> {
    const normalized = identifier.trim().toLowerCase();
    const alias = normalized === 'admin' || normalized === this.config.username.trim().toLowerCase();
    const user = alias ? await this.get(DEFAULT_ADMIN_ID) : fromRow(await this.db
      .prepare(`SELECT ${selectColumns} FROM app_users WHERE email = ?`).bind(normalized).first<UserRow>());
    const matches = await verifyPasswordHash(password, user?.passwordHash ?? this.config.passwordHash);
    if (!user || !matches) return null;
    const lastLoginAt = new Date().toISOString();
    await this.db.prepare('UPDATE app_users SET last_login_at = ? WHERE id = ?').bind(lastLoginAt, user.id).run();
    return { ...user, lastLoginAt };
  }
  async sessionUser(token: string | undefined, now?: number): Promise<StoredUser | null> {
    const claims = await readUserSession(token, this.config, now);
    if (!claims) return null;
    const user = await this.get(claims.sub);
    return user && user.sessionVersion === claims.version ? user : null;
  }
  async update(id: string, input: Record<string, unknown>, currentUserId: string): Promise<{ user: PublicUser; credentialsChanged: boolean; roleChanged: boolean }> {
    const previous = await this.get(id);
    if (!previous) throw new AccountError('该用户已不存在，请刷新列表。', 404);
    const account = previous.account;
    const name = input.name === undefined ? previous.name : normalizeName(input.name, account);
    const role = input.role === undefined ? previous.role : validateRole(input.role);
    if (previous.isDefaultAdmin && role !== 'admin') throw new AccountError('超级管理员角色不可修改。', 403);
    if (id === currentUserId && previous.role === 'admin' && role !== 'admin')
      throw new AccountError('不能将当前登录账号设为普通用户，请由其他管理员操作。', 403);
    const changePassword = input.password !== undefined && input.password !== '';
    if (changePassword && id === currentUserId) {
      if (typeof input.oldPassword !== 'string' || !input.oldPassword || input.oldPassword.length > 256)
        throw new AccountError('请输入当前账号的旧密码。');
      if (!await verifyPasswordHash(input.oldPassword, previous.passwordHash))
        throw new AccountError('旧密码不正确，请重试。');
    }
    const passwordHash = changePassword ? await hashPassword(validatePassword(input.password)) : previous.passwordHash;
    const credentialsChanged = changePassword;
    const roleChanged = role !== previous.role;
    try {
      const result = await this.db.prepare(`UPDATE app_users SET name = ?, email = ?, role = ?, password_hash = ?,
        session_version = session_version + ? WHERE id = ? AND session_version = ?`)
        .bind(name, account, role, passwordHash, credentialsChanged || roleChanged ? 1 : 0, id, previous.sessionVersion).run();
      if (!result.meta.changes) throw new AccountError('该用户信息已变更，请刷新后重试。', 409);
    } catch (error) { this.rethrowWriteError(error); }
    return { user: publicUser((await this.get(id))!), credentialsChanged, roleChanged };
  }
  async changePassword(id: string, oldPassword: unknown, newPassword: unknown) {
    return this.update(id, { oldPassword, password: validatePassword(newPassword) }, id);
  }
  async remove(id: string, currentUserId: string): Promise<void> {
    const user = await this.get(id);
    if (!user) throw new AccountError('该用户已不存在，请刷新列表。', 404);
    if (user.isDefaultAdmin) throw new AccountError('超级管理员不能删除。', 403);
    if (user.id === currentUserId) throw new AccountError('不能删除当前登录账号。', 403);
    await this.db.prepare('DELETE FROM app_users WHERE id = ?').bind(id).run();
  }
  private rethrowWriteError(error: unknown): never {
    if (error instanceof Error && /UNIQUE constraint failed: app_users\.email/i.test(error.message))
      throw new AccountError('该账号名已存在，请使用其他账号名。', 409);
    throw error;
  }
  private async migrateLegacyAccounts() {
    const { results } = await this.db.prepare('SELECT id, email FROM app_users ORDER BY is_default_admin DESC, created_at ASC, id ASC').all<{ id: string; email: string }>();
    const used = new Set<string>();
    for (const row of results) {
      const current = row.email.trim().toLowerCase();
      const needsMigration = current.includes('@') || !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(current) || used.has(current);
      const account = needsMigration
        ? row.id === DEFAULT_ADMIN_ID ? DEFAULT_ADMIN_ACCOUNT : legacyAccount(row.email, used)
        : current;
      used.add(account);
      if (row.email !== account) {
        try {
          await this.db.prepare('UPDATE app_users SET email = ? WHERE id = ?').bind(account, row.id).run();
        } catch (error) { this.rethrowWriteError(error); }
      }
    }
  }
}
