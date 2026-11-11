import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import AdminRegister from '@/components/AdminRegister';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — cerere de acces', robots: { index: false, follow: false } };

export default async function RegisterPage() {
  if (await currentUser()) redirect('/admin');
  return <AdminRegister />;
}
