import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin-server';
import LoginForm from './login-form';
export const dynamic = 'force-dynamic';
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
async function Login({ searchParams }: { searchParams: SearchParams }) {
  if (await isAdmin()) redirect('/');
  const params = await searchParams;
  const account = typeof params.account === 'string' ? params.account : '';
  const notice = params.updated === '1'
    ? '请重新登录。'
    : '';
  return <LoginForm initialAccount={account} notice={notice} />;
}
export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return <Login searchParams={searchParams} />;
}
