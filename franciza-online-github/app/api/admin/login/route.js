import { NextResponse } from 'next/server';
import {
  checkBootstrapPassword, createSessionValue, verifyPassword, hashPassword, COOKIE, cookieOptions,
} from '@/lib/auth';
import { getUserByEmail, countActiveAdmins, createUser, updateUser } from '@/lib/db';
import { normEmail, validateAccount } from '@/lib/users';

export const runtime = 'nodejs';

const slow = () => new Promise((r) => setTimeout(r, 700)); // încetinim ghicirea parolei

function loggedIn(user) {
  const res = NextResponse.json({ ok: true, user: { name: user.name, role: user.role } });
  res.cookies.set(COOKIE, createSessionValue(user.id), cookieOptions);
  return res;
}

// POST /api/admin/login  { email, password }
export async function POST(req) {
  const { email: rawEmail, password } = await req.json().catch(() => ({}));
  const email = normEmail(rawEmail);
  if (!email || !password) return NextResponse.json({ ok: false, error: 'wrong' }, { status: 400 });

  try {
    const user = await getUserByEmail(email);

    if (user && verifyPassword(password, user.password_hash)) {
      if (user.status === 'pending') return NextResponse.json({ ok: false, error: 'pending' }, { status: 403 });
      if (user.status !== 'active') return NextResponse.json({ ok: false, error: 'disabled' }, { status: 403 });
      await updateUser(user.id, { last_login: new Date().toISOString() });
      return loggedIn(user);
    }

    // Prima intrare: încă nu există niciun administrator → emailul + ADMIN_PASSWORD
    // creează contul administratorului principal.
    const firstAdmin = checkBootstrapPassword(password) && (await countActiveAdmins()) === 0;
    if (firstAdmin && user && user.status === 'pending') {
      // emailul fusese înregistrat ca cerere de acces → îl facem administrator
      const admin = await updateUser(user.id, {
        password_hash: hashPassword(password),
        role: 'admin',
        status: 'active',
        approved_by: 'ADMIN_PASSWORD',
        last_login: new Date().toISOString(),
      });
      return loggedIn(admin);
    }
    if (firstAdmin && !user) {
      const { ok, data } = validateAccount({ name: email.split('@')[0], email }, { requirePassword: false });
      if (ok) {
        const admin = await createUser({
          email: data.email,
          name: data.name,
          password_hash: hashPassword(password),
          role: 'admin',
          status: 'active',
          approved_by: 'ADMIN_PASSWORD',
          last_login: new Date().toISOString(),
        });
        return loggedIn(admin);
      }
    }
  } catch (e) {
    console.error('[login]', e.message);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }

  await slow();
  return NextResponse.json({ ok: false, error: 'wrong' }, { status: 401 });
}
