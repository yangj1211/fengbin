import { redirect, notFound } from 'next/navigation';
import { currentUser } from '@/lib/admin-server';
import { canAccessManagement } from '@/lib/user-store';
import Workspace from '../workspace';
import { isWorkspacePath } from '../application/workspace-path';
export const dynamic = 'force-dynamic';
async function ProtectedPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const segments = (await params).path;
  const path = '/' + segments.join('/');
  if (!isWorkspacePath(path)) notFound();
  if ((path === '/data' || path === '/users') && !canAccessManagement(user)) redirect('/');
  return <Workspace path={path} />;
}
export default function ApplicationPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  return <ProtectedPage params={params} />;
}
