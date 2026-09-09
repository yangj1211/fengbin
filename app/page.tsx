import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin-server';
import Workspace from './workspace';
export const dynamic = 'force-dynamic';
async function ProtectedWorkspace() {
  if (!(await isAdmin())) redirect('/login');
  return <Workspace />;
}
export default function Home() {
  return <ProtectedWorkspace />;
}
