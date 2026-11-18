import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { recognizeDocument } from '@/lib/ocr';
import { readUpload } from '@/lib/upload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST /api/admin/ocr  (FormData: file) — doar recunoaște, NU salvează nimic.
// Răspuns: { ok: true, fields } sau { ok: false, error: 'not_document' | 'no_data' | … }
export async function POST(req) {
  if (!(await currentUser())) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: 'doc_no_file' }, { status: 400 });

  const up = await readUpload(form);
  if (up.error) return NextResponse.json({ ok: false, error: up.error }, { status: 422 });

  const r = await recognizeDocument(up.buffer, up.type);
  if (!r.ok) {
    const status = r.error === 'not_document' || r.error === 'no_data' ? 422 : 502;
    return NextResponse.json({ ok: false, error: r.error, reason: r.reason || null }, { status });
  }
  return NextResponse.json({ ok: true, fields: r.fields });
}
