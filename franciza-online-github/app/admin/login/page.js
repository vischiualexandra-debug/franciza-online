import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import AdminLogin from '@/components/AdminLogin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — login', robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (await isAdmin()) redirect('/admin');
  return <AdminLogin />;
}
