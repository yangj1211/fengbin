import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin-server';
import LoginForm from './login-form';
export const dynamic = 'force-dynamic';
async function Login() {
  if (await isAdmin()) redirect('/');
  return <LoginForm />;
}
export default function LoginPage() {
  return <Login />;
}
