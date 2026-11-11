import { NextResponse } from 'next/server';
import { validateLead } from '@/lib/form';
import { insertLead } from '@/lib/db';
import { leadMessage, sendTelegram } from '@/lib/telegram';
import { sendToCrm } from '@/lib/crm';
import { cleanSource, detectChannel } from '@/lib/source';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LANGS = ['ro', 'ru', 'en'];

// POST /api/leads — formularul public trimite aici cererea.
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  // Câmp-capcană pentru boți: oamenii nu-l văd, boții îl completează.
  if (body?.website) {
    return NextResponse.json({ ok: true });
  }

  const { ok, errors, data } = validateLead(body);
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'validation', errors }, { status: 422 });
  }

  const lang = LANGS.includes(body?.lang) ? body.lang : null;
  const utm = cleanSource(body?.source);
  const { channel } = detectChannel(utm);

  let lead;
  try {
    lead = await insertLead({ ...data, lang, source: channel, utm });
  } catch (e) {
    console.error('[leads] nu s-a salvat:', e.message);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }

  // Așteptăm trimiterile: pe Vercel funcția se oprește după răspuns.
  await Promise.all([sendTelegram(leadMessage(lead)), sendToCrm(lead)]);

  return NextResponse.json({ ok: true, id: lead.id });
}
