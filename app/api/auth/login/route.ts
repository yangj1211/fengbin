import { adminConfig } from '@/lib/admin-server';
import {
  createSession,
  sameOrigin,
  sessionCookie,
  validConfig,
  verifyPassword,
} from '@/lib/admin-auth';
export const dynamic = 'force-dynamic';
const attempts = new Map<string, { count: number; until: number }>();
function json(
  body: object,
  status: number,
  extra: Record<string, string> = {},
) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store', ...extra },
  });
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return json({ error: '请求来源无效，请刷新页面重试。' }, 403);
  const config = adminConfig();
  if (!validConfig(config))
    return json({ error: '登录服务尚未准备好，请联系管理员。' }, 503);
  const now = Date.now();
  const key = request.headers.get('cf-connecting-ip') ?? 'unknown';
  for (const [id, value] of attempts)
    if (value.until <= now) attempts.delete(id);
  if (attempts.size > 2000)
    return json({ error: '请求过于频繁，请稍后重试。' }, 429, {
      'Retry-After': '600',
    });
  const current = attempts.get(key);
  if (current && current.until > now && current.count >= 6)
    return json({ error: '尝试次数过多，请 10 分钟后再试。' }, 429, {
      'Retry-After': String(Math.ceil((current.until - now) / 1000)),
    });
  const limiter = current ?? { count: 0, until: now + 600000 };
  limiter.count++;
  attempts.set(key, limiter);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return json({ error: '请求格式不正确。' }, 400);
  if (Number(request.headers.get('content-length') ?? 0) > 4096)
    return json({ error: '请求内容过长。' }, 413);
  let payload: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: '请输入账号和密码。' }, 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 4096) {
        await reader.cancel();
        return json({ error: '请求内容过长。' }, 413);
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return json({ error: '请求格式不正确。' }, 400);
  }
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('username' in payload) ||
    !('password' in payload) ||
    typeof payload.username !== 'string' ||
    typeof payload.password !== 'string' ||
    !payload.username ||
    !payload.password ||
    payload.username.length > 80 ||
    payload.password.length > 256
  )
    return json({ error: '请输入有效的账号和密码。' }, 400);
  if (!(await verifyPassword(payload.username, payload.password, config)))
    return json({ error: '账号或密码不正确，请重试。' }, 401);
  attempts.delete(key);
  const token = await createSession(config);
  return json({ ok: true }, 200, {
    'Set-Cookie': sessionCookie(
      token,
      new URL(request.url).protocol === 'https:',
    ),
  });
}
