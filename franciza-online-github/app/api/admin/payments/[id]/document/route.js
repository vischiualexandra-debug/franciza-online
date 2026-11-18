import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { documentLink, getPayment } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/payments/:id/document — deschide originalul (link temporar de 5 minute; doar cont logat).
export async function GET(_req, { params }) {
  if (!(await currentUser())) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const payment = await getPayment(Number(id)).catch(() => null);
  if (!payment?.document_path) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  try {
    const link = await documentLink(payment.document_path);
    if (link.url) return NextResponse.redirect(link.url, 302);
    return new NextResponse(link.buffer, {
      headers: { 'Content-Type': payment.document_type || 'application/octet-stream', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('[payments] link:', e.message);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}
