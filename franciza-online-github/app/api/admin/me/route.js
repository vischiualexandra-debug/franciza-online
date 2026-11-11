import { NextResponse } from 'next/server';
import { currentUser, verifyPassword, hashPassword } from '@/lib/auth';
import { getUserById, updateUser } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/me — contul logat
export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ ok: true, user: me }, { headers: { 'Cache-Control': 'no-store' } });
}

// POST /api/admin/me { current, next } — schimbarea propriei parole
export async function POST(req) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const { current, next } = await req.json().catch(() => ({}));
  if (typeof next !== 'string' || next.length < 8) {
    return NextResponse.json({ ok: false, error: 'err_pw_short' }, { status: 422 });
  }
  const full = await getUserById(me.id);
  if (!verifyPassword(current || '', full?.password_hash)) {
    await new Promise((r) => setTimeout(r, 700));
    return NextResponse.json({ ok: false, error: 'err_pw_current' }, { status: 403 });
  }
  await updateUser(me.id, { password_hash: hashPassword(next) });
  return NextResponse.json({ ok: true });
}
