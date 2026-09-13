import { sameOrigin } from './admin-auth';
import { AccountError, canAccessManagement, type StoredUser } from './user-store';

export function requireAccountAdmin(user: StoredUser | null): StoredUser {
  if (!user) throw new AccountError('登录已失效，请重新登录。', 401);
  if (!canAccessManagement(user)) throw new AccountError('仅管理员可管理用户。', 403);
  return user;
}

export function accountJson(body: object, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', ...extra } });
}
export function accountError(error: unknown) {
  return error instanceof AccountError
    ? accountJson({ error: error.message }, error.status)
    : accountJson({ error: '账号服务暂时不可用，请稍后重试。' }, 503);
}
export function requireSameOrigin(request: Request) {
  if (!sameOrigin(request)) throw new AccountError('请求来源无效，请刷新页面重试。', 403);
}
export async function accountPayload(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new AccountError('请求格式不正确。');
  if (Number(request.headers.get('content-length') ?? 0) > 4096) throw new AccountError('请求内容过长。', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AccountError('请求内容不能为空。');
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 4096) { await reader.cancel(); throw new AccountError('请求内容过长。', 413); }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error();
    return payload;
  } catch { throw new AccountError('请求格式不正确。'); }
}
// This preserves the existing per-instance request backoff; account records live in D1.
const attempts = new Map<string, { count: number; until: number }>();
export function authClientKey(request: Request): string {
  if (typeof process !== 'undefined' && process.env.VERCEL === '1') {
    // Vercel supplies this header at its edge; do not accept cf-connecting-ip
    // or a client-supplied X-Forwarded-For chain on the Vercel deployment.
    const address = request.headers.get('x-vercel-forwarded-for')?.trim();
    return address && address.length <= 45 && /^[0-9a-f:.]+$/i.test(address)
      ? address.toLowerCase() : 'unknown';
  }
  return request.headers.get('cf-connecting-ip') ?? 'unknown';
}
export function authAttempt(request: Request): string {
  const now = Date.now();
  const key = authClientKey(request);
  for (const [id, value] of attempts) if (value.until <= now) attempts.delete(id);
  if (attempts.size > 2000) throw new AccountError('请求过于频繁，请稍后重试。', 429);
  const current = attempts.get(key);
  if (current && current.count >= 6) throw new AccountError('尝试次数过多，请 10 分钟后再试。', 429);
  const limiter = current ?? { count: 0, until: now + 600000 };
  limiter.count++;
  attempts.set(key, limiter);
  return key;
}
export function authSucceeded(key: string) { attempts.delete(key); }
