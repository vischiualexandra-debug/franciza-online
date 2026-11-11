import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import AdminApp from '@/components/AdminApp';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin', robots: { index: false, follow: false } };

export default async function AdminPage() {
  const me = await currentUser();
  if (!me) redirect('/admin/login');
  return <AdminApp me={{ id: me.id, name: me.name, email: me.email, role: me.role }} />;
}
