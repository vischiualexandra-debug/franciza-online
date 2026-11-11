import { NextResponse } from 'next/server';
import { currentUser, hashPassword } from '@/lib/auth';
import { listUsers, createUser, getUserByEmail } from '@/lib/db';
import { validateAccount, ROLES } from '@/lib/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const deny = (status = 403) => NextResponse.json({ ok: false, error: status === 401 ? 'unauthorized' : 'forbidden' }, { status });

// GET /api/admin/users — lista echipei (doar administratori)
export async function GET() {
  const me = await currentUser();
  if (!me) return deny(401);
  if (me.role !== 'admin') return deny();
  try {
    return NextResponse.json({ ok: true, users: await listUsers() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[users]', e.message);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}

// POST /api/admin/users { name, email, password, role } — administratorul adaugă direct un cont activ
export async function POST(req) {
  const me = await currentUser();
  if (!me) return deny(401);
  if (me.role !== 'admin') return deny();
  const body = await req.json().catch(() => ({}));
  const { ok, errors, data } = validateAccount(body);
  if (!ok) return NextResponse.json({ ok: false, error: 'validation', errors }, { status: 422 });
  const role = ROLES.includes(body.role) ? body.role : 'member';
  try {
    if (await getUserByEmail(data.email)) {
      return NextResponse.json({ ok: false, error: 'validation', errors: { email: 'err_email_taken' } }, { status: 422 });
    }
    const user = await createUser({
      ...data,
      password_hash: hashPassword(body.password),
      role,
      status: 'active',
      approved_by: me.name,
    });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    console.error('[users:create]', e.message);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}
