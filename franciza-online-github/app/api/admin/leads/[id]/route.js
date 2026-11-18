import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { listHistory, moveLeadStage, updateLeadNotes, updateLeadStatus } from '@/lib/db';
import { NOTES_MAX, STAGES, STATUSES } from '@/lib/form';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const unauthorized = () => NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
const badRequest = () => NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });

async function leadIdFrom(params) {
  const { id } = await params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// GET /api/admin/leads/:id — istoricul trecerilor între etape (cu date și autor).
export async function GET(_req, { params }) {
  if (!(await currentUser())) return unauthorized();
  const leadId = await leadIdFrom(params);
  if (!leadId) return badRequest();
  try {
    const history = await listHistory(leadId);
    return NextResponse.json({ ok: true, history }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[admin] istoric:', e.message);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}

// PATCH /api/admin/leads/:id
//   { stage: 'cereri' | 'discutie' | … | 'respins' }  — mută cardul pe altă etapă (se scrie în istoric)
//   { notes: '…' }                                    — salvează notițele
//   { status: 'new' | 'in_progress' | 'closed' }      — vechiul status (compatibilitate)
export async function PATCH(req, { params }) {
  const me = await currentUser();
  if (!me) return unauthorized();
  const leadId = await leadIdFrom(params);
  const body = await req.json().catch(() => ({}));
  if (!leadId) return badRequest();

  try {
    let lead;
    if (typeof body.stage === 'string') {
      if (!STAGES.includes(body.stage)) return badRequest();
      lead = await moveLeadStage(leadId, body.stage, me.name);
    } else if (typeof body.notes === 'string') {
      const notes = body.notes.trim();
      if (notes.length > NOTES_MAX) return badRequest();
      lead = await updateLeadNotes(leadId, notes || null, me.name);
    } else if (STATUSES.includes(body.status)) {
      lead = await updateLeadStatus(leadId, body.status, me.name);
    } else {
      return badRequest();
    }
    if (!lead) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, lead });
  } catch (e) {
    console.error('[admin] actualizare:', e.message);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}
