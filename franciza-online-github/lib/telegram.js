import 'server-only';
import { SITE } from './site';
import { dict, optionLabel } from './i18n';
import { sourceText, sourceLabels } from './source';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const ro = (k) => dict.ro[k] ?? k;
const yn = (b) => (b ? '✅ Da' : '❌ Nu');

export function formatDate(iso) {
  return new Intl.DateTimeFormat('ro-RO', {
    timeZone: SITE.timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function leadMessage(lead) {
  const o = (field) => esc(optionLabel(ro, field, lead[field]));
  const lines = [
    `🐼 <b>Cerere nouă #${lead.id}</b> — ${esc(SITE.product)}`,
    `🕒 ${formatDate(lead.created_at)}`,
    '',
    `👤 <b>${esc(lead.name)}</b>, ${esc(lead.age)} ani`,
    `📞 ${esc(lead.phone)}`,
    `✉️ ${esc(lead.email)}`,
    `📍 ${esc(lead.city)}`,
    '',
    `<b>Experiență în turism:</b> ${yn(lead.exp_tourism)}`,
    `<b>Experiență în vânzări / clienți:</b> ${yn(lead.exp_sales)}`,
    `<b>Experiența profesională:</b>\n${esc(lead.experience)}`,
    '',
    `<b>Ce l-a atras:</b> ${o('attraction')}`,
    `<b>Ore pe zi:</b> ${o('hours')}`,
    `<b>Buget:</b> ${o('budget')}`,
    `<b>Sursa bugetului:</b> ${o('budget_source')}`,
    `<b>Gata să înceapă:</b> ${o('start_when')}`,
  ];
  if (lead.comment) lines.push('', `💬 <b>Comentariu:</b>\n${esc(lead.comment)}`);
  lines.push(
    '',
    `🎯 <b>Sursa:</b> ${esc(sourceText(lead.source, lead.utm, sourceLabels(ro)))}`,
    `🌐 Limba: ${esc((lead.lang || 'ro').toUpperCase())} · 📌 Status: nouă`
  );
  return lines.join('\n');
}

// Trimite mesaj proprietarului. Nu aruncă erori: cererea e deja salvată,
// o problemă cu Telegram nu trebuie să-i arate clientului o eroare.
export async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID lipsesc — mesajul nu a fost trimis:\n' + text);
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) {
      console.error('[telegram] eroare:', res.status, body.description);
      return { ok: false, error: body.description || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error('[telegram] eroare de rețea:', e.message);
    return { ok: false, error: e.message };
  }
}
