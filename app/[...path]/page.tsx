import { redirect, notFound } from 'next/navigation';
import { isAdmin } from '@/lib/admin-server';
import Workspace from '../workspace';
import { isWorkspacePath } from '../application/workspace-path';
export const dynamic = 'force-dynamic';
async function ProtectedPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  if (!(await isAdmin())) redirect('/login');
  const segments = (await params).path;
  const path = '/' + segments.join('/');
  if (!isWorkspacePath(path)) notFound();
  return <Workspace path={path} />;
}
export default function ApplicationPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  return <ProtectedPage params={params} />;
}
