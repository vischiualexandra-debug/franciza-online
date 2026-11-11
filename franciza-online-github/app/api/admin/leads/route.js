import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { listLeads } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/leads — doar pentru admin logat.
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    const leads = await listLeads();
    return NextResponse.json({ ok: true, leads }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[admin] listare:', e.message);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}
