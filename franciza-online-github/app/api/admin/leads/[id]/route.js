import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { updateLeadStatus } from '@/lib/db';
import { STATUSES } from '@/lib/form';

export const runtime = 'nodejs';

// PATCH /api/admin/leads/:id  { status: 'new' | 'in_progress' | 'closed' }
export async function PATCH(req, { params }) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const leadId = Number(id);
  const { status } = await req.json().catch(() => ({}));
  if (!Number.isInteger(leadId) || !STATUSES.includes(status)) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
  try {
    const lead = await updateLeadStatus(leadId, status, me.name);
    if (!lead) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, lead });
  } catch (e) {
    console.error('[admin] status:', e.message);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}
