import 'server-only';

// Recunoașterea contractelor și facturilor prin Claude API (doar pe server; cheia stă în Vercel).
//   ANTHROPIC_API_KEY = cheia de pe console.anthropic.com
//   ANTHROPIC_MODEL   = (opțional) modelul; implicit claude-sonnet-5-5

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

export const DOC_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
export const DOC_MAX_BYTES = 4 * 1024 * 1024; // Vercel primește maxim ~4,5 MB într-o cerere

// Verificăm după primii octeți, nu doar după ce spune browserul.
export function sniffType(buf) {
  const b = buf.subarray(0, 12);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.toString('ascii', 0, 4) === 'GIF8') return 'image/gif';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (b.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  return null;
}

// Claude răspunde OBLIGATORIU prin acest „instrument”, deci primim mereu JSON cu aceste câmpuri.
const TOOL = {
  name: 'payment_document',
  description: 'Rezultatul citirii fișierului: dacă e un contract / factură / act cu o sumă de plată și câmpurile găsite.',
  input_schema: {
    type: 'object',
    properties: {
      is_document: {
        type: 'boolean',
        description:
          'true doar dacă fișierul e un contract, o factură, un cont de plată, un act adițional sau alt document financiar cu o sumă. false pentru poze cu oameni, peisaje, obiecte, mâncare, ecrane, texte fără sumă etc.',
      },
      reason: { type: 'string', description: 'Dacă is_document = false: pe scurt, ce se vede (în română).' },
      doc_kind: { type: 'string', enum: ['contract', 'invoice', 'act', 'other'], description: 'contract = contract/acord; invoice = factură / cont de plată; act = act adițional / proces-verbal' },
      doc_number: { type: 'string', description: 'Numărul documentului, exact cum e scris' },
      doc_date: { type: 'string', description: 'Data documentului, YYYY-MM-DD' },
      counterparty: {
        type: 'string',
        description: 'Cealaltă parte (NU Panda Tour / PANDA TUR S.R.L.): numele persoanei sau al firmei, exact cum e scris',
      },
      direction: {
        type: 'string',
        enum: ['in', 'out'],
        description: 'in = contragentul plătește către Panda Tour (ex.: taxa de franciză); out = Panda Tour plătește contragentului',
      },
      description: { type: 'string', description: 'Pentru ce e plata, scurt (ex.: „Taxă de intrare în franciza online”)' },
      amount: { type: 'number', description: 'Suma de plată (totalul cu TVA, dacă e). Doar numărul, cu punct zecimal.' },
      currency: { type: 'string', enum: ['MDL', 'EUR', 'USD', 'RON'], description: 'lei moldovenești = MDL' },
      due_date: {
        type: 'string',
        description: 'Termenul de plată, YYYY-MM-DD. Dacă e scris „în N zile de la semnare”, calculează de la data documentului. Dacă sunt mai multe rate, prima rată.',
      },
      installments_note: { type: 'string', description: 'Dacă plata e în rate: pe scurt ratele și termenele lor' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Cât de clar se citește documentul' },
    },
    required: ['is_document'],
  },
};

const PROMPT = `Ești contabilul agenției de turism Panda Tour (PANDA TUR S.R.L., Moldova), care vinde francize online.
Ți se trimite o fotografie sau un PDF. Dacă e un contract de franciză, o factură sau alt document cu o sumă de plată,
extrage câmpurile. Copiază numele și numerele exact cum sunt scrise; nu inventa nimic. Câmpurile care lipsesc nu le completa.
Dacă NU e un astfel de document, pune is_document = false și explică pe scurt în reason ce se vede.
Răspunde doar prin instrumentul payment_document.`;

const clean = (v, max = 200) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const isoDate = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) && !isNaN(Date.parse(v)) ? v.trim() : '');

// Întoarce { ok: true, fields } sau { ok: false, error: 'not_document' | 'no_data' | 'no_key' | 'api', reason? }
export async function recognizeDocument(buffer, mediaType) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: 'no_key' };

  const data = buffer.toString('base64');
  const fileBlock =
    mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data } };

  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: TOOL.name },
        messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: PROMPT }] }],
      }),
      signal: AbortSignal.timeout(50000),
    });
  } catch (e) {
    console.error('[ocr] rețea:', e.message);
    return { ok: false, error: 'api' };
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    console.error('[ocr] Claude API:', res.status, body?.error?.type, body?.error?.message);
    return { ok: false, error: 'api' };
  }

  const out = body?.content?.find((c) => c.type === 'tool_use')?.input;
  if (!out) return { ok: false, error: 'api' };
  if (!out.is_document) return { ok: false, error: 'not_document', reason: clean(out.reason, 300) };

  const amount = typeof out.amount === 'number' && out.amount > 0 ? Math.round(out.amount * 100) / 100 : null;
  const fields = {
    doc_kind: ['contract', 'invoice', 'act', 'other'].includes(out.doc_kind) ? out.doc_kind : 'other',
    doc_number: clean(out.doc_number, 60),
    doc_date: isoDate(out.doc_date),
    counterparty: clean(out.counterparty),
    direction: out.direction === 'out' ? 'out' : 'in',
    description: [clean(out.description, 300), clean(out.installments_note, 190)].filter(Boolean).join(' · ').slice(0, 500),
    amount,
    currency: ['MDL', 'EUR', 'USD', 'RON'].includes(out.currency) ? out.currency : 'MDL',
    due_date: isoDate(out.due_date),
    confidence: ['high', 'medium', 'low'].includes(out.confidence) ? out.confidence : 'medium',
  };
  // Un „document” fără sumă și fără contragent nu ne ajută să creăm o plată
  if (!fields.amount && !fields.counterparty) return { ok: false, error: 'no_data' };
  return { ok: true, fields };
}
