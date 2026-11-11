import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { getUserByEmail, createUser } from '@/lib/db';
import { validateAccount } from '@/lib/users';
import { sendTelegram } from '@/lib/telegram';

export const runtime = 'nodejs';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// POST /api/admin/register  { name, email, password }
// Creează un cont „în așteptare”. Fără aprobarea unui administrator nu poate intra și nu vede nimic.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  if (body?.website) return NextResponse.json({ ok: true }); // capcană pentru boți

  const { ok, errors, data } = validateAccount(body);
  if (!ok) return NextResponse.json({ ok: false, error: 'validation', errors }, { status: 422 });

  try {
    const existing = await getUserByEmail(data.email);
    // Răspundem la fel și când emailul există — nu dezvăluim ce conturi sunt în sistem.
    if (!existing) {
      await createUser({
        email: data.email,
        name: data.name,
        password_hash: hashPassword(body.password),
        role: 'member',
        status: 'pending',
      });
      const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
      await sendTelegram(
        [
          '🔐 <b>Cerere de acces în panoul admin</b>',
          '',
          `👤 ${esc(data.name)}`,
          `✉️ ${esc(data.email)}`,
          '',
          `Aprobă sau respinge în panou → Echipa${host ? `:\nhttps://${host}/admin?tab=team` : '.'}`,
        ].join('\n')
      );
    }
  } catch (e) {
    console.error('[register]', e.message);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
