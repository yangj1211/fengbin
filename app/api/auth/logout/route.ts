import { sameOrigin, sessionCookie } from '@/lib/admin-auth';
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json(
      { error: '请求来源无效。' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  return Response.json(
    { ok: true },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Set-Cookie': sessionCookie(
          '',
          new URL(request.url).protocol === 'https:',
          true,
        ),
      },
    },
  );
}
