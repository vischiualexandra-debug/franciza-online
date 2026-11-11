import 'server-only';
import { leadAnswers } from './answers';

// Trimite cererea și în franciza-crm (coloana „Cereri”), prin același webhook
// pe care îl folosește scriptul Google. Opțional: dacă variabilele lipsesc, se sare peste.
//   CRM_WEBHOOK_URL    = https://ADRESA-CRM.vercel.app/api/webhook/google-form
//   CRM_WEBHOOK_SECRET = aceeași valoare ca WEBHOOK_SECRET din proiectul franciza-crm
export async function sendToCrm(lead) {
  const url = process.env.CRM_WEBHOOK_URL;
  const secret = process.env.CRM_WEBHOOK_SECRET;
  if (!url || !secret) return { ok: false, skipped: true };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        responseId: `site-${lead.id}`, // CRM-ul ignoră dublurile după acest id
        submittedAt: lead.created_at,
        respondentEmail: lead.email,
        answers: leadAnswers(lead),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error('[crm] eroare:', res.status, await res.text().catch(() => ''));
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error('[crm] eroare de rețea:', e.message);
    return { ok: false, error: e.message };
  }
}
