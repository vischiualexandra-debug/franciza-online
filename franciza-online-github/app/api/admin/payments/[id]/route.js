import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { setPaymentStatus } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH /api/admin/payments/:id  { status: 'paid' | 'unpaid' }
export async function PATCH(req, { params }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const paymentId = Number(id);
  const { status } = await req.json().catch(() => ({}));
  if (!Number.isInteger(paymentId) || !['paid', 'unpaid'].includes(status)) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
  try {
    const payment = await setPaymentStatus(paymentId, status, me.name);
    if (!payment) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, payment });
  } catch (e) {
    console.error('[payments] status:', e.message);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}
