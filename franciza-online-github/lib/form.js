// Întrebările formularului de franciză + validarea lor.
// Rulează și în browser (formular), și pe server (API) — aceleași reguli în ambele locuri.

export const STATUSES = ['new', 'in_progress', 'closed'];

// Variantele de răspuns (codurile se salvează în baza de date; textele sunt în lib/i18n.js).
export const OPTIONS = {
  hours: ['3-4', '7-8'],
  attraction: ['tourism', 'flexible', 'income', 'brand'],
  budget: ['under_500', '500_1000', '1000_5000', 'over_5000'],
  budget_source: ['savings', 'family', 'credit'],
  start_when: ['now', 'month', '2_3_months'],
};
// Întrebări unde se poate alege „Altceva” și scrie textul propriu.
export const ALLOW_OTHER = ['hours', 'budget_source', 'start_when'];
export const OTHER = '__other';

export const LIMITS = {
  nameMin: 3,
  nameMax: 80,
  cityMax: 80,
  experienceMin: 10,
  experienceMax: 2000,
  commentMax: 1000,
  otherMax: 100,
  ageMin: 16,
  ageMax: 99,
  phoneDigitsMin: 7,
  phoneDigitsMax: 15,
};

export const EMPTY_FORM = {
  name: '',
  phone_cc: '+373',
  phone: '',
  email: '',
  city: '',
  age: '',
  hours: '',
  hours_other: '',
  exp_tourism: '',
  exp_sales: '',
  experience: '',
  attraction: '',
  budget: '',
  budget_source: '',
  budget_source_other: '',
  start_when: '',
  start_when_other: '',
  comment: '',
  consent: false,
};

const line = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

// ---------- telefon ----------
// Prefixe disponibile: câte cifre are numărul fără prefix + cum îl grupăm la afișare.
export const PHONE_COUNTRIES = [
  { cc: '+373', flag: '🇲🇩', digits: 8, groups: [2, 3, 3], example: '69 123 456' },
  { cc: '+40', flag: '🇷🇴', digits: 9, groups: [3, 3, 3], example: '712 345 678' },
  { cc: '+380', flag: '🇺🇦', digits: 9, groups: [2, 3, 2, 2], example: '67 123 45 67' },
];
export const PHONE_OTHER = 'other';
export const DEFAULT_CC = '+373';

const group = (digits, sizes) => {
  const out = [];
  let i = 0;
  for (const s of sizes) {
    out.push(digits.slice(i, i + s));
    i += s;
  }
  return out.filter(Boolean).join(' ');
};

// Primește prefixul ales + ce a scris omul. Acceptă și „069…”, „37369…”, „+373 69…”.
// Întoarce { phone: '+373 69 123 456', error }.
export function normalizePhone(cc, raw) {
  const text = line(raw);
  if (!text) return { phone: '', error: 'err_required' };
  if (!/^\+?[\d\s()./-]+$/.test(text)) return { phone: text, error: 'err_phone' };
  let digits = text.replace(/\D/g, '');
  const country = PHONE_COUNTRIES.find((c) => c.cc === cc);

  if (!country) {
    // „Altă țară” (sau client vechi fără prefix): numărul complet, cu prefix
    if (digits.length < LIMITS.phoneDigitsMin || digits.length > LIMITS.phoneDigitsMax)
      return { phone: text, error: 'err_phone' };
    return { phone: text.startsWith('+') ? text : `+${digits}`, error: null };
  }

  const ccDigits = country.cc.slice(1);
  if (digits.length > country.digits && digits.startsWith(ccDigits)) digits = digits.slice(ccDigits.length);
  digits = digits.replace(/^0+/, ''); // 069… → 69…
  if (digits.length !== country.digits) return { phone: text, error: 'err_phone' };
  return { phone: `${country.cc} ${group(digits, country.groups)}`, error: null };
}

// Pentru afișare în câmp (fără prefix), după ce omul termină de scris
export function formatLocal(cc, raw) {
  const country = PHONE_COUNTRIES.find((c) => c.cc === cc);
  if (!country) return raw;
  const { phone, error } = normalizePhone(cc, raw);
  return error ? raw : phone.slice(country.cc.length + 1);
}
const text = (v) => (typeof v === 'string' ? v.trim() : '');

// Returnează { ok, errors, data }. errors: { câmp: 'cheie_traducere' }.
// data: valorile curate, gata de salvat (variantele „Altceva” devin textul scris de om).
export function validateLead(input = {}) {
  const errors = {};
  const data = {};

  // Nume
  const name = line(input.name);
  if (!name) errors.name = 'err_required';
  else if (name.length < LIMITS.nameMin) errors.name = 'err_name_short';
  else if (name.length > LIMITS.nameMax) errors.name = 'err_too_long';
  else if (!/^[\p{L}][\p{L}\s'’.-]*$/u.test(name)) errors.name = 'err_name_chars';
  data.name = name;

  // Telefon: prefixul țării se alege separat (implicit +373), omul scrie doar restul numărului
  const ph = normalizePhone(input.phone_cc, input.phone);
  if (ph.error) errors.phone = ph.error;
  data.phone = ph.phone;

  // Email
  const email = line(input.email).toLowerCase();
  if (!email) errors.email = 'err_required';
  else if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'err_email';
  data.email = email;

  // Oraș
  const city = line(input.city);
  if (!city) errors.city = 'err_required';
  else if (city.length < 2) errors.city = 'err_city';
  else if (city.length > LIMITS.cityMax) errors.city = 'err_too_long';
  data.city = city;

  // Vârstă (doar număr plauzibil; cerința 21+ e afișată ca informație, nu blochează)
  const ageStr = line(String(input.age ?? ''));
  const age = Number(ageStr);
  if (!ageStr) errors.age = 'err_required';
  else if (!/^\d{1,2}$/.test(ageStr) || age < LIMITS.ageMin || age > LIMITS.ageMax) errors.age = 'err_age';
  data.age = errors.age ? null : age;

  // Da / Nu
  for (const k of ['exp_tourism', 'exp_sales']) {
    const v = input[k];
    if (v === 'yes' || v === true) data[k] = true;
    else if (v === 'no' || v === false) data[k] = false;
    else errors[k] = 'err_choose';
  }

  // Experiența profesională
  const experience = text(input.experience);
  if (!experience) errors.experience = 'err_required';
  else if (experience.length < LIMITS.experienceMin) errors.experience = 'err_experience_short';
  else if (experience.length > LIMITS.experienceMax) errors.experience = 'err_too_long';
  data.experience = experience;

  // Variante (+ „Altceva”)
  for (const [k, opts] of Object.entries(OPTIONS)) {
    const v = input[k];
    if (ALLOW_OTHER.includes(k) && v === OTHER) {
      const other = line(input[`${k}_other`]);
      if (!other) errors[k] = 'err_other';
      else if (other.length > LIMITS.otherMax) errors[k] = 'err_too_long';
      data[k] = other;
    } else if (opts.includes(v)) {
      data[k] = v;
    } else {
      errors[k] = 'err_choose';
    }
  }

  // Comentariu (opțional)
  const comment = text(input.comment);
  if (comment.length > LIMITS.commentMax) errors.comment = 'err_too_long';
  data.comment = comment || null;

  // Acord prelucrare date
  if (input.consent !== true) errors.consent = 'err_consent';

  return { ok: Object.keys(errors).length === 0, errors, data };
}

// Pașii formularului și câmpurile fiecăruia (în ordinea afișării).
export const STEPS = [
  { title: 'sec_contact', fields: ['name', 'phone', 'email', 'city', 'age'] },
  { title: 'sec_profile', fields: ['exp_tourism', 'exp_sales', 'experience', 'attraction'] },
  { title: 'sec_plans', fields: ['hours', 'budget', 'budget_source', 'start_when', 'comment', 'consent'] },
];

export const FIELD_ORDER = STEPS.flatMap((s) => s.fields);

// Pasul pe care se află un câmp (pentru a sări la prima eroare).
export const stepOf = (field) => STEPS.findIndex((s) => s.fields.includes(field));
