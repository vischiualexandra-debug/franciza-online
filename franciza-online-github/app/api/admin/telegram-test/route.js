import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { sendTelegram } from '@/lib/telegram';
import { SITE } from '@/lib/site';

export const runtime = 'nodejs';

// POST /api/admin/telegram-test — verifică dacă botul poate scrie proprietarului.
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const r = await sendTelegram(`✅ Test: botul pentru ${SITE.product} funcționează.`);
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
