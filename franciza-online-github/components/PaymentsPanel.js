'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CURRENCIES, DIRECTIONS, DOC_KINDS } from '@/lib/form';

// =================== Plăți din contracte și facturi (recunoscute de Claude) ===================

const MAX_BYTES = 4 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';
const DAY = 86400000;

// Data de azi în fusul orar al browserului, ca „YYYY-MM-DD”
const todayIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

// Pozele de pe telefon au adesea 5–10 MB: le micșorăm în browser (max 2200 px, JPEG),
// ca să încapă în limita Vercel și să ajungă repede. PDF-urile rămân cum sunt.
async function prepareFile(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2200 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    if (!blob || (blob.size >= file.size && file.size <= MAX_BYTES)) return file;
    return new File([blob], (file.name || 'document').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

function money(amount, currency, lang) {
  const n = Number(amount);
  const s = new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-GB' : 'ro-RO', {
    minimumFractionDigits: n % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(n);
  return `${s} ${currency}`;
}

// { MDL: 1200, EUR: 50 } → „1 200 MDL · 50 EUR”
function sumByCurrency(list, lang) {
  const by = {};
  for (const p of list) by[p.currency] = (by[p.currency] || 0) + Number(p.amount);
  const parts = CURRENCIES.filter((c) => by[c]).map((c) => money(by[c], c, lang));
  return parts.length ? parts.join(' · ') : '0';
}

// Caută francizatul din CRM după nume (contragentul de pe contract)
function guessLead(leads, counterparty) {
  const norm = (s) => (s || '').toLowerCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2);
  const words = norm(counterparty);
  if (!words.length) return '';
  let best = null;
  let bestScore = 0;
  for (const l of leads || []) {
    const lw = norm(l.name);
    const score = lw.filter((w) => words.includes(w)).length;
    if (score > bestScore) {
      best = l;
      bestScore = score;
    }
  }
  return best && bestScore >= Math.min(2, norm(best.name).length) ? String(best.id) : '';
}

export default function PaymentsPanel({ t, lang, fmt, leads }) {
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('unpaid'); // unpaid | paid | all
  const [scanOpen, setScanOpen] = useState(false);
  const [toast, setToast] = useState('');
  const today = todayIso();

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/payments', { cache: 'no-store' }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (res?.status === 401) return (window.location.href = '/admin/login');
    if (!body?.ok) return setError(t('a_error'));
    setPayments(body.payments);
    setError('');
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const setStatus = async (id, status) => {
    const res = await fetch(`/api/admin/payments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!body?.ok) return setToast(t('a_error'));
    setPayments((ps) => ps.map((p) => (p.id === id ? body.payment : p)));
  };

  const all = payments || [];
  const unpaid = all.filter((p) => p.status === 'unpaid');
  const overdue = unpaid.filter((p) => p.due_date && p.due_date < today);
  const month = today.slice(0, 7);
  const paidThisMonth = all.filter((p) => p.status === 'paid' && p.paid_at?.slice(0, 7) === month);

  const visible = useMemo(() => {
    const list = all.filter((p) => filter === 'all' || p.status === filter);
    // Neachitate: întâi cele întârziate, apoi după termen. Achitate: cele mai recente sus.
    return list.sort((a, b) =>
      a.status !== b.status
        ? a.status === 'unpaid'
          ? -1
          : 1
        : a.status === 'paid'
          ? String(b.paid_at).localeCompare(String(a.paid_at))
          : String(a.due_date).localeCompare(String(b.due_date))
    );
  }, [all, filter]);

  const leadName = (id) => leads?.find((l) => l.id === id)?.name;

  return (
    <div className="pay">
      <div className="pay-stats">
        <div className="pay-stat">
          <span className="pay-stat-label">⬇ {t('pay_to_receive')}</span>
          <strong>{sumByCurrency(unpaid.filter((p) => p.direction === 'in'), lang)}</strong>
        </div>
        <div className="pay-stat">
          <span className="pay-stat-label">⬆ {t('pay_to_pay')}</span>
          <strong>{sumByCurrency(unpaid.filter((p) => p.direction === 'out'), lang)}</strong>
        </div>
        <div className={`pay-stat${overdue.length ? ' pay-stat-bad' : ''}`}>
          <span className="pay-stat-label">⚠ {t('pay_overdue_n', { n: overdue.length })}</span>
          <strong>{sumByCurrency(overdue, lang)}</strong>
        </div>
        <div className="pay-stat pay-stat-ok">
          <span className="pay-stat-label">✓ {t('pay_paid_month')}</span>
          <strong>{sumByCurrency(paidThisMonth, lang)}</strong>
        </div>
      </div>

      <div className="toolbar">
        <div className="tabs" role="tablist">
          {['unpaid', 'paid', 'all'].map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={`tab${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>
              {t('pay_f_' + f)}
              <span className="count">{f === 'all' ? all.length : all.filter((p) => p.status === f).length}</span>
            </button>
          ))}
        </div>
        <div className="toolbar-right pay-actions">
          <button className="btn btn-accent btn-sm" onClick={() => setScanOpen(true)}>
            📄 {t('pay_upload')}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={load} title={t('a_refresh')}>
            ↻
          </button>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {payments === null && !error && <p className="muted center">…</p>}
      {payments && visible.length === 0 && <p className="muted center empty">{t('pay_empty')}</p>}

      <ul className="pay-list">
        {visible.map((p) => {
          const late = p.status === 'unpaid' && p.due_date && p.due_date < today;
          const days = p.due_date ? daysBetween(today, p.due_date) : null;
          const soon = p.status === 'unpaid' && !late && days !== null && days <= 7;
          return (
            <li key={p.id} className={`pay-row${late ? ' late' : ''}${soon ? ' soon' : ''}${p.status === 'paid' ? ' paid' : ''}`}>
              <div className="pay-main">
                <span className="pay-who">
                  <span className={`tag pay-dir-${p.direction}`}>{p.direction === 'in' ? '⬇ ' + t('pay_dir_in_s') : '⬆ ' + t('pay_dir_out_s')}</span>
                  <strong>{p.counterparty}</strong>
                </span>
                <span className="muted small">
                  {t('pay_kind_' + p.doc_kind)}
                  {p.doc_number ? ` № ${p.doc_number}` : ''}
                  {p.doc_date ? ` · ${fmt(p.doc_date, true)}` : ''}
                  {p.lead_id && leadName(p.lead_id) ? ` · 👤 ${leadName(p.lead_id)}` : ''}
                </span>
                {p.description && <span className="pay-desc">{p.description}</span>}
              </div>
              <div className="pay-side">
                <span className="pay-amount">{money(p.amount, p.currency, lang)}</span>
                {p.status === 'paid' ? (
                  <span className="pay-due ok">
                    ✓ {t('pay_paid_on', { date: fmt(p.paid_at) })}
                    {p.paid_by ? ` · ${p.paid_by}` : ''}
                  </span>
                ) : (
                  <span className={`pay-due${late ? ' bad' : soon ? ' warn' : ''}`}>
                    📅 {fmt(p.due_date, true)} ·{' '}
                    {late ? t('pay_late_by', { n: -days }) : days === 0 ? t('pay_due_today') : t('pay_due_in', { n: days })}
                  </span>
                )}
                <span className="pay-btns">
                  <a className="btn btn-ghost btn-sm" href={`/api/admin/payments/${p.id}/document`} target="_blank" rel="noopener">
                    📄 {t('pay_original')}
                  </a>
                  {p.status === 'unpaid' ? (
                    <button className="btn btn-sm" onClick={() => setStatus(p.id, 'paid')}>
                      ✓ {t('pay_mark_paid')}
                    </button>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => setStatus(p.id, 'unpaid')}>
                      ↺ {t('pay_mark_unpaid')}
                    </button>
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {scanOpen && (
        <ScanModal
          t={t}
          leads={leads}
          onClose={() => setScanOpen(false)}
          onSaved={(payment) => {
            setPayments((ps) => [payment, ...(ps || [])]);
            setScanOpen(false);
            setFilter('unpaid');
            setToast(t('pay_saved'));
          }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// =================== Încărcare → Claude → ecran de verificare → salvare ===================
const EMPTY = {
  doc_kind: 'contract',
  direction: 'in',
  counterparty: '',
  doc_number: '',
  doc_date: '',
  description: '',
  amount: '',
  currency: 'MDL',
  due_date: '',
  lead_id: '',
};

function ScanModal({ t, leads, onClose, onSaved }) {
  const [step, setStep] = useState('pick'); // pick | reading | review | rejected | saving
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [v, setV] = useState(EMPTY);
  const [confidence, setConfidence] = useState('');
  const [errors, setErrors] = useState({});
  const [fail, setFail] = useState('');
  const [reason, setReason] = useState('');
  const inputRef = useRef(null);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && step !== 'reading' && step !== 'saving' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, step]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const reset = () => {
    setStep('pick');
    setFile(null);
    setPreview('');
    setV(EMPTY);
    setErrors({});
    setFail('');
    setReason('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const onPick = async (e) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    setFail('');
    const f = await prepareFile(raw);
    if (f.size > MAX_BYTES) return setFail(t('doc_too_big'));
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStep('reading');

    const fd = new FormData();
    fd.append('file', f);
    const res = await fetch('/api/admin/ocr', { method: 'POST', body: fd }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (body?.ok) {
      const x = body.fields;
      setV({
        ...EMPTY,
        ...Object.fromEntries(Object.entries(x).filter(([k, val]) => k in EMPTY && val !== null && val !== '')),
        amount: x.amount != null ? String(x.amount) : '',
        lead_id: guessLead(leads, x.counterparty),
      });
      setConfidence(x.confidence);
      setStep('review');
      return;
    }
    if (body?.error === 'not_document' || body?.error === 'no_data') {
      setReason(body.reason || '');
      setStep('rejected');
      return;
    }
    setStep('pick');
    setFail(t(body?.error && body.error.startsWith('doc_') ? body.error : body?.error === 'no_key' ? 'doc_no_key' : 'doc_api'));
  };

  const save = async (e) => {
    e.preventDefault();
    setStep('saving');
    setFail('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('fields', JSON.stringify(v));
    const res = await fetch('/api/admin/payments', { method: 'POST', body: fd }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (body?.ok) return onSaved(body.payment);
    setStep('review');
    if (res?.status === 422 && body?.errors) return setErrors(body.errors);
    setFail(t(body?.error?.startsWith?.('doc_') ? body.error : 'a_error'));
  };

  const field = (k, label, props = {}) => (
    <div className={`field${errors[k] ? ' has-error' : ''}`}>
      <label htmlFor={`pay-${k}`}>{label}</label>
      <input id={`pay-${k}`} value={v[k]} onChange={set(k)} {...props} />
      {errors[k] && <span className="field-error">{t(errors[k])}</span>}
    </div>
  );
  const select = (k, label, options) => (
    <div className="field">
      <label htmlFor={`pay-${k}`}>{label}</label>
      <select id={`pay-${k}`} className="search" value={v[k]} onChange={set(k)}>
        {options.map(([val, text]) => (
          <option key={val} value={val}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
  const busy = step === 'reading' || step === 'saving';
  const isPdf = file?.type === 'application/pdf';

  return (
    <div className="modal-bg" onClick={() => !busy && onClose()}>
      <div
        className={`modal scan-modal${step === 'review' || step === 'saving' ? ' wide' : ''}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>📄 {step === 'review' || step === 'saving' ? t('doc_review_title') : t('pay_upload')}</h2>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label={t('a_close')}>
            ✕
          </button>
        </div>

        {step === 'pick' && (
          <div className="scan-pick">
            <p className="muted">{t('doc_pick_hint')}</p>
            <label className="scan-drop">
              <input ref={inputRef} type="file" accept={ACCEPT} onChange={onPick} />
              <span className="scan-drop-icon">📷</span>
              <strong>{t('doc_pick_btn')}</strong>
              <span className="muted small">{t('doc_pick_types')}</span>
            </label>
            {fail && <p className="form-error">{fail}</p>}
          </div>
        )}

        {step === 'reading' && (
          <div className="scan-reading">
            {preview && !isPdf && <img src={preview} alt="" />}
            <p>
              <span className="spinner" aria-hidden /> {t('doc_reading')}
            </p>
          </div>
        )}

        {step === 'rejected' && (
          <div className="scan-rejected">
            <p className="form-error">❌ {t('doc_not_document')}</p>
            {reason && (
              <p className="muted">
                {t('doc_claude_saw')}: {reason}
              </p>
            )}
            <p className="muted small">{t('doc_nothing_saved')}</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose}>
                {t('crm_cancel')}
              </button>
              <button className="btn" onClick={reset}>
                {t('doc_try_other')}
              </button>
            </div>
          </div>
        )}

        {(step === 'review' || step === 'saving') && (
          <form className="scan-review" onSubmit={save} noValidate>
            <div className="scan-preview">
              {isPdf ? <object data={preview} type="application/pdf" aria-label="PDF" /> : <img src={preview} alt="" />}
              <span className={`conf conf-${confidence}`}>{t('doc_conf_' + (confidence || 'medium'))}</span>
            </div>
            <div className="scan-fields">
              <p className="muted small">{t('doc_review_hint')}</p>
              <div className="grid2">
                {select('doc_kind', t('pay_kind'), DOC_KINDS.map((k) => [k, t('pay_kind_' + k)]))}
                {select('direction', t('pay_dir'), DIRECTIONS.map((k) => [k, t('pay_dir_' + k)]))}
              </div>
              {field('counterparty', t('pay_counterparty'), { autoComplete: 'off' })}
              <div className="grid2">
                {field('doc_number', t('pay_doc_number'), { autoComplete: 'off' })}
                {field('doc_date', t('pay_doc_date'), { type: 'date' })}
              </div>
              <div className="grid2">
                {field('amount', t('pay_amount'), { inputMode: 'decimal', autoComplete: 'off' })}
                {select('currency', t('pay_currency'), CURRENCIES.map((c) => [c, c]))}
              </div>
              {field('due_date', t('pay_due'), { type: 'date' })}
              <div className={`field${errors.description ? ' has-error' : ''}`}>
                <label htmlFor="pay-description">{t('pay_description')}</label>
                <textarea id="pay-description" rows={2} maxLength={500} value={v.description} onChange={set('description')} />
              </div>
              {select('lead_id', t('pay_lead'), [['', '—'], ...(leads || []).map((l) => [String(l.id), `#${l.id} ${l.name}`])])}
              {fail && <p className="form-error">{fail}</p>}
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={reset} disabled={busy}>
                  {t('doc_other_file')}
                </button>
                <button type="submit" className="btn btn-accent" disabled={busy}>
                  {step === 'saving' ? t('crm_saving') : t('pay_save')}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
