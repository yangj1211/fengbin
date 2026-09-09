import { isAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const authenticated = await isAdmin();
  return Response.json(
    { authenticated },
    {
      status: authenticated ? 200 : 401,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}
