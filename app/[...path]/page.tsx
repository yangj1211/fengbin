import { redirect, notFound } from 'next/navigation';
import { isAdmin } from '@/lib/admin-server';
import Workspace from '../workspace';
export const dynamic = 'force-dynamic';
async function ProtectedPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  if (!(await isAdmin())) redirect('/login');
  const segments = (await params).path;
  const path = '/' + segments.join('/');
  if (
    !/^\/(apps\/(customer|maintenance|energy|production|supplier)|records(?:\/[a-zA-Z0-9-]+)?|data)$/.test(
      path,
    )
  )
    notFound();
  return <Workspace path={path} />;
}
export default function ApplicationPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  return <ProtectedPage params={params} />;
}
