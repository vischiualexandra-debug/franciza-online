import { NextResponse } from 'next/server';
import { currentUser, isAdmin } from '@/lib/auth';
import { insertLead, listLeads } from '@/lib/db';
import { validateManual } from '@/lib/form';

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

// POST /api/admin/leads — client adăugat manual în CRM (apel, întâlnire). Sursa: „Manual”.
export async function POST(req) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { ok, errors, data } = validateManual(body);
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'validation', errors }, { status: 422 });
  }
  try {
    const lead = await insertLead({ ...data, origin: 'manual', source: null, utm: null, lang: null }, me.name);
    return NextResponse.json({ ok: true, lead });
  } catch (e) {
    console.error('[admin] adăugare manuală:', e.message);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}
