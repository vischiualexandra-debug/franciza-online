import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { deleteDocument, getLead, insertPayment, listPayments, saveDocument } from '@/lib/db';
import { validatePayment } from '@/lib/form';
import { readUpload } from '@/lib/upload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf' };

// GET /api/admin/payments — lista plăților (doar pentru cont logat).
export async function GET() {
  if (!(await currentUser())) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  try {
    const payments = await listPayments();
    return NextResponse.json({ ok: true, payments }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[payments] listare:', e.message);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}

// POST /api/admin/payments  (FormData: file + fields = JSON cu câmpurile verificate pe ecranul de verificare)
// Salvează originalul în Storage și plata în lista „De plată”.
export async function POST(req) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: 'doc_no_file' }, { status: 400 });
  let fields;
  try {
    fields = JSON.parse(String(form.get('fields') || '{}'));
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const { ok, errors, data } = validatePayment(fields);
  if (!ok) return NextResponse.json({ ok: false, error: 'validation', errors }, { status: 422 });
  if (data.lead_id && !(await getLead(data.lead_id).catch(() => null))) data.lead_id = null;

  const up = await readUpload(form);
  if (up.error) return NextResponse.json({ ok: false, error: up.error }, { status: 422 });

  const filePath = `payments/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${EXT[up.type]}`;
  try {
    await saveDocument(filePath, up.buffer, up.type);
  } catch (e) {
    console.error('[payments] Storage:', e.message);
    return NextResponse.json({ ok: false, error: 'doc_storage' }, { status: 500 });
  }

  try {
    const payment = await insertPayment({
      ...data,
      created_by: me.name,
      document_path: filePath,
      document_type: up.type,
    });
    return NextResponse.json({ ok: true, payment });
  } catch (e) {
    console.error('[payments] salvare:', e.message);
    await deleteDocument(filePath).catch(() => {}); // nu lăsăm fișiere fără plată
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}
