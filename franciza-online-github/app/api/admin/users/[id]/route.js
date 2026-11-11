import { NextResponse } from 'next/server';
import { currentUser, hashPassword } from '@/lib/auth';
import { getUserById, updateUser, deleteUser, countActiveAdmins } from '@/lib/db';
import { ROLES, USER_STATUSES } from '@/lib/users';

export const runtime = 'nodejs';

const fail = (error, status) => NextResponse.json({ ok: false, error }, { status });

async function guard(params) {
  const me = await currentUser();
  if (!me) return { res: fail('unauthorized', 401) };
  if (me.role !== 'admin') return { res: fail('forbidden', 403) };
  const { id } = await params;
  const user = await getUserById(Number(id));
  if (!user) return { res: fail('not_found', 404) };
  return { me, user };
}

// Rămâne cel puțin un administrator activ după schimbare?
async function keepsAnAdmin(user, next) {
  const wasActiveAdmin = user.role === 'admin' && user.status === 'active';
  const staysActiveAdmin = next.role === 'admin' && next.status === 'active';
  if (!wasActiveAdmin || staysActiveAdmin) return true;
  return (await countActiveAdmins()) > 1;
}

// PATCH /api/admin/users/:id { status?, role?, password? }
export async function PATCH(req, { params }) {
  const { me, user, res } = await guard(params);
  if (res) return res;
  const body = await req.json().catch(() => ({}));
  const patch = {};
  if (body.status !== undefined) {
    if (!USER_STATUSES.includes(body.status)) return fail('bad_request', 400);
    patch.status = body.status;
    if (body.status === 'active' && user.status === 'pending') patch.approved_by = me.name;
  }
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) return fail('bad_request', 400);
    patch.role = body.role;
  }
  if (body.password !== undefined) {
    if (typeof body.password !== 'string' || body.password.length < 8) return fail('err_pw_short', 422);
    patch.password_hash = hashPassword(body.password);
  }
  if (!Object.keys(patch).length) return fail('bad_request', 400);
  if (user.id === me.id && (patch.status && patch.status !== 'active' || patch.role === 'member')) {
    return fail('self', 409); // nu te poți bloca singur
  }
  if (!(await keepsAnAdmin(user, { role: patch.role ?? user.role, status: patch.status ?? user.status }))) {
    return fail('last_admin', 409);
  }
  try {
    return NextResponse.json({ ok: true, user: await updateUser(user.id, patch) });
  } catch (e) {
    console.error('[users:update]', e.message);
    return fail('server', 500);
  }
}

// DELETE /api/admin/users/:id
export async function DELETE(req, { params }) {
  const { me, user, res } = await guard(params);
  if (res) return res;
  if (user.id === me.id) return fail('self', 409);
  if (!(await keepsAnAdmin(user, { role: 'member', status: 'disabled' }))) return fail('last_admin', 409);
  try {
    await deleteUser(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[users:delete]', e.message);
    return fail('server', 500);
  }
}
