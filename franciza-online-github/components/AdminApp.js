'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n, LangSwitcher } from './I18n';
import { STAGES, NOTES_MAX } from '@/lib/form';
import { optionLabel } from '@/lib/i18n';
import { sourceText, sourceLabels } from '@/lib/source';
import TeamPanel, { MeModal } from './TeamPanel';
import PaymentsPanel from './PaymentsPanel';

const LOCALES = { ro: 'ro-RO', ru: 'ru-RU', en: 'en-GB' };

export default function AdminApp({ me }) {
  const { t, lang } = useI18n();
  const isAdminRole = me?.role === 'admin';
  const [view, setView] = useState('leads'); // leads | payments | team
  const [pendingCount, setPendingCount] = useState(0);
  const [meOpen, setMeOpen] = useState(false);

  // Linkul din Telegram (/admin?tab=team) deschide direct „Echipa”
  useEffect(() => {
    if (isAdminRole && new URLSearchParams(window.location.search).get('tab') === 'team') setView('team');
  }, [isAdminRole]);

  // Câte cereri de acces așteaptă (pentru bulina de pe fila „Echipa”)
  const loadPending = useCallback(async () => {
    if (!isAdminRole) return;
    const res = await fetch('/api/admin/users', { cache: 'no-store' }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (body?.ok) setPendingCount(body.users.filter((u) => u.status === 'pending').length);
  }, [isAdminRole]);
  useEffect(() => {
    loadPending();
    const id = setInterval(loadPending, 60000);
    return () => clearInterval(id);
  }, [loadPending]);
  const [leads, setLeads] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [srcFilter, setSrcFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const srcLabels = useMemo(() => sourceLabels(t), [t]);
  const srcText = (l) => (l.source ? sourceText(l.source, l.utm, srcLabels) : '—');
  const [toast, setToast] = useState('');

  // fmt(iso) → „18.11.2026, 15:32”; fmt('2026-11-30', true) → „30.11.2026” (doar data, fără fus orar)
  const fmt = useCallback(
    (iso, dateOnly = false) => {
      if (!iso) return '—';
      if (dateOnly && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        const [y, m, d] = iso.split('-').map(Number);
        return new Intl.DateTimeFormat(LOCALES[lang], { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(y, m - 1, d));
      }
      return new Intl.DateTimeFormat(LOCALES[lang], {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        ...(dateOnly ? {} : { hour: '2-digit', minute: '2-digit' }),
      }).format(new Date(iso));
    },
    [lang]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/leads', { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/admin/login';
        return;
      }
      const body = await res.json();
      if (!body.ok) throw new Error();
      setLeads(body.leads);
      setError('');
    } catch {
      setError(t('a_error'));
    }
  }, [t]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  // Pâlnie (tablă pe etape) sau listă; ținem minte alegerea în browser.
  const [mode, setMode] = useState('board');
  useEffect(() => {
    try {
      const m = localStorage.getItem('crm_mode');
      if (m === 'board' || m === 'list') setMode(m);
    } catch {}
  }, []);
  const pickMode = (m) => {
    setMode(m);
    try {
      localStorage.setItem('crm_mode', m);
    } catch {}
  };
  const [addOpen, setAddOpen] = useState(false);

  const counts = useMemo(() => {
    const c = { all: leads?.length || 0 };
    for (const l of leads || []) c[l.stage] = (c[l.stage] || 0) + 1;
    return c;
  }, [leads]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (leads || []).filter(
      (l) =>
        (mode === 'board' || filter === 'all' || l.stage === filter) &&
        (srcFilter === 'all' || (l.source || 'none') === srcFilter) &&
        (!q || [l.name, l.phone, l.email, l.city, l.experience, l.comment, l.notes].some((v) => v?.toLowerCase().includes(q)))
    );
  }, [leads, filter, query, srcFilter, mode]);

  // Sursele care există efectiv în cereri, cu numărul lor (pentru filtru)
  const sources = useMemo(() => {
    const c = {};
    for (const l of leads || []) {
      const k = l.source || 'none';
      c[k] = (c[k] || 0) + 1;
    }
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  const open = leads?.find((l) => l.id === openId) || null;

  // PATCH către server; actualizăm cardul imediat și revenim dacă serverul refuză.
  const patchLead = async (id, patch) => {
    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const res = await fetch(`/api/admin/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok || !body?.ok) {
      setLeads(prev);
      setToast(t('a_error'));
      return false;
    }
    setLeads((ls) => ls.map((l) => (l.id === id ? body.lead : l)));
    setHistoryTick((n) => n + 1);
    return true;
  };
  const setStage = (id, stage) => {
    const l = leads?.find((x) => x.id === id);
    if (l && l.stage !== stage) patchLead(id, { stage });
  };
  // Se schimbă după fiecare modificare, ca fișa deschisă să-și reîncarce istoricul.
  const [historyTick, setHistoryTick] = useState(0);

  const onAdded = (lead) => {
    setLeads((ls) => [lead, ...(ls || [])]);
    setAddOpen(false);
    setToast(t('crm_added'));
    setOpenId(lead.id);
  };

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  };

  const testTelegram = async () => {
    const res = await fetch('/api/admin/telegram-test', { method: 'POST' }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setToast(body?.ok ? t('a_tg_ok') : t('a_tg_fail') + (body?.error || (body?.skipped ? 'not configured' : '?')));
  };

  return (
    <div className="admin">
      <header className="admin-top">
        <div className="wrap admin-top-in">
          <h1 className="admin-brand">
            <img src="/img/logo.png" alt="Panda Tour" width="80" height="41" />
            <span>{t('a_title')}</span>
          </h1>
          <div className="admin-actions">
            <LangSwitcher />
            {isAdminRole && (
              <button className="btn btn-ghost btn-sm" onClick={testTelegram}>
                {t('a_tg_test')}
              </button>
            )}
            <button className="btn btn-ghost btn-sm me-btn" onClick={() => setMeOpen(true)} title={t('a_me')}>
              <span className="me-avatar" aria-hidden>
                {(me?.name || '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="me-name">{me?.name}</span>
            </button>
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              {t('a_logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="wrap admin-main">
        <nav className="view-tabs" aria-label="Admin">
          <button className={view === 'leads' ? 'on' : ''} onClick={() => setView('leads')}>
            📋 {t('a_tab_leads')}
          </button>
          <button className={view === 'payments' ? 'on' : ''} onClick={() => setView('payments')}>
            💳 {t('a_tab_payments')}
          </button>
          {isAdminRole && (
            <button className={view === 'team' ? 'on' : ''} onClick={() => setView('team')}>
              👥 {t('a_tab_team')}
              {pendingCount > 0 && <span className="pending-dot">{pendingCount}</span>}
            </button>
          )}
        </nav>

        {view === 'team' && isAdminRole ? (
          <TeamPanel me={me} fmt={fmt} onChanged={loadPending} />
        ) : view === 'payments' ? (
          <PaymentsPanel t={t} lang={lang} fmt={fmt} leads={leads} />
        ) : (
        <>
        <div className="toolbar">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={mode === 'board'} className={`tab${mode === 'board' ? ' on' : ''}`} onClick={() => pickMode('board')}>
              🗂 {t('crm_board')}
            </button>
            <button role="tab" aria-selected={mode === 'list'} className={`tab${mode === 'list' ? ' on' : ''}`} onClick={() => pickMode('list')}>
              ☰ {t('crm_list')}
            </button>
            <button className="btn btn-accent btn-sm" onClick={() => setAddOpen(true)}>
              ＋ {t('crm_add')}
            </button>
          </div>
          <div className="toolbar-right">
            <select
              className="search src-select"
              value={srcFilter}
              onChange={(e) => setSrcFilter(e.target.value)}
              aria-label={t('a_source')}
            >
              <option value="all">🎯 {t('a_all_sources')}</option>
              {sources.map(([k, n]) => (
                <option key={k} value={k}>
                  {k === 'none' ? '—' : srcLabels[k] || k} ({n})
                </option>
              ))}
            </select>
            <input
              className="search"
              type="search"
              placeholder={t('a_search')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn btn-ghost btn-sm" onClick={load} title={t('a_refresh')}>
              ↻
            </button>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}
        {leads === null && !error && <p className="muted center">…</p>}

        {leads && mode === 'board' && (
          <Board leads={visible} t={t} fmt={fmt} onOpen={setOpenId} onMove={setStage} />
        )}

        {leads && mode === 'list' && (
          <>
            <div className="tabs stage-tabs" role="tablist">
              {['all', ...STAGES].map((s) => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={filter === s}
                  className={`tab${filter === s ? ' on' : ''}`}
                  onClick={() => setFilter(s)}
                >
                  {s !== 'all' && <i className={`dot stg-dot-${s}`} />}
                  {s === 'all' ? t('crm_all_stages') : t('stg_' + s)}
                  <span className="count">{counts[s] || 0}</span>
                </button>
              ))}
            </div>
            {visible.length === 0 && <p className="muted center empty">{t('a_empty')}</p>}
            <ul className="lead-list">
              {visible.map((l) => (
                <li key={l.id}>
                  <button className={`lead-row stg-${l.stage}`} onClick={() => setOpenId(l.id)}>
                    <span className="lead-main">
                      <span className="lead-name">
                        <span className="lead-id">#{l.id}</span> {l.name}
                      </span>
                      <span className="lead-phone">
                        {[l.phone, l.city && `📍 ${l.city}`, l.age && t('a_years', { n: l.age })].filter(Boolean).join(' · ')}
                      </span>
                      <span className="lead-tags">
                        <span className={`tag org-${l.origin}`}>{originIcon(l.origin)} {t('org_' + (l.origin || 'site'))}</span>
                        {l.budget && <span className="tag">💶 {optionLabel(t, 'budget', l.budget)}</span>}
                        {l.start_when && <span className="tag">🚀 {optionLabel(t, 'start_when', l.start_when)}</span>}
                        {l.exp_tourism != null && <span className={`tag ${l.exp_tourism ? 'tag-yes' : 'tag-no'}`}>✈ {l.exp_tourism ? '✓' : '✗'}</span>}
                        {l.exp_sales != null && <span className={`tag ${l.exp_sales ? 'tag-yes' : 'tag-no'}`}>🤝 {l.exp_sales ? '✓' : '✗'}</span>}
                        {l.source && <span className="tag tag-src">🎯 {srcText(l)}</span>}
                      </span>
                    </span>
                    <span className="lead-meta">
                      <span className={`badge stg-badge-${l.stage}`}>{t('stg_' + l.stage)}</span>
                      <time dateTime={l.created_at}>{fmt(l.created_at)}</time>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        </>
        )}
      </main>

      {meOpen && <MeModal me={me} onClose={() => setMeOpen(false)} />}

      {open && (
        <LeadModal
          lead={open}
          fmt={fmt}
          t={t}
          source={srcText(open)}
          historyTick={historyTick}
          onClose={() => setOpenId(null)}
          onStage={setStage}
          onNotes={(notes) => patchLead(open.id, { notes })}
        />
      )}
      {addOpen && <AddLeadModal t={t} onClose={() => setAddOpen(false)} onAdded={onAdded} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

const ORIGIN_ICONS = { site: '🌐', manual: '✍️', telegram: '✈️', document: '📄' };
const originIcon = (o) => ORIGIN_ICONS[o] || '🌐';

// Câte zile stă cardul pe etapa curentă (de la ultima mutare)
const daysSince = (iso) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : null);

// ======================= Tabla pe etape (pâlnia) =======================
// Cardurile se trag cu mouse-ul în altă coloană; pe telefon se deschide cardul și se alege etapa.
function Board({ leads, t, fmt, onOpen, onMove }) {
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);
  const byStage = useMemo(() => {
    const m = Object.fromEntries(STAGES.map((s) => [s, []]));
    for (const l of leads) (m[l.stage] || m[STAGES[0]]).push(l);
    return m;
  }, [leads]);

  return (
    <>
      <p className="muted small board-hint">{t('crm_drag_hint')}</p>
      <div className="board">
        {STAGES.map((stage) => (
          <section
            key={stage}
            className={`board-col stg-col-${stage}${over === stage ? ' over' : ''}`}
            onDragOver={(e) => {
              if (dragId == null) return;
              e.preventDefault();
              setOver(stage);
            }}
            onDragLeave={() => setOver((o) => (o === stage ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId != null) onMove(dragId, stage);
              setDragId(null);
              setOver(null);
            }}
          >
            <h3 className="board-head">
              <i className={`dot stg-dot-${stage}`} />
              {t('stg_' + stage)}
              <span className="count">{byStage[stage].length}</span>
            </h3>
            <div className="board-cards">
              {byStage[stage].length === 0 && <p className="board-empty">{t('crm_col_empty')}</p>}
              {byStage[stage].map((l) => {
                const days = daysSince(l.updated_at || l.created_at);
                return (
                  <button
                    key={l.id}
                    className={`board-card${dragId === l.id ? ' dragging' : ''}`}
                    draggable
                    onDragStart={(e) => {
                      setDragId(l.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOver(null);
                    }}
                    onClick={() => onOpen(l.id)}
                  >
                    <span className="lead-name">{l.name}</span>
                    {l.phone && <span className="lead-phone">{l.phone}</span>}
                    {l.city && <span className="lead-phone">📍 {l.city}</span>}
                    <span className="lead-tags">
                      <span className={`tag org-${l.origin}`}>{originIcon(l.origin)} {t('org_' + (l.origin || 'site'))}</span>
                    </span>
                    <span className="board-meta">
                      <time dateTime={l.created_at}>{fmt(l.created_at)}</time>
                      {days != null && <span>⏱ {days}d</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

// ======================= Fișa clientului =======================
function LeadModal({ lead, fmt, t, source, historyTick, onClose, onStage, onNotes }) {
  const utm = lead.utm || {};
  const utmRows = [
    ['utm_source', utm.utm_source],
    ['utm_medium', utm.utm_medium],
    ['utm_campaign', utm.utm_campaign],
    ['utm_content', utm.utm_content],
    ['utm_term', utm.utm_term],
    ['referrer', utm.ref],
    ['landing', utm.landing],
    ['app', utm.app],
    ['click id', utm.click],
  ].filter(([, val]) => val);
  const tel = lead.phone ? lead.phone.replace(/[^\d+]/g, '') : '';

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Istoricul trecerilor între etape (se reîncarcă după fiecare mutare)
  const [history, setHistory] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/leads/${lead.id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((b) => alive && setHistory(b.ok ? b.history : []))
      .catch(() => alive && setHistory([]));
    return () => {
      alive = false;
    };
  }, [lead.id, historyTick]);

  // Notițe
  const [notes, setNotes] = useState(lead.notes || '');
  const [notesState, setNotesState] = useState('idle'); // idle | saving | saved
  useEffect(() => {
    setNotes(lead.notes || '');
    setNotesState('idle');
  }, [lead.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const notesDirty = notes.trim() !== (lead.notes || '').trim();
  const saveNotes = async () => {
    setNotesState('saving');
    const ok = await onNotes(notes.trim());
    setNotesState(ok ? 'saved' : 'idle');
  };

  const stageName = (s) => (s ? t('stg_' + s) : '');

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal crm-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>
            <span className="lead-id">#{lead.id}</span> {lead.name}
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('a_close')}>
            ✕
          </button>
        </div>
        <p className="crm-sub">
          <span className={`tag org-${lead.origin}`}>
            {originIcon(lead.origin)} {t('crm_origin')}: {t('org_' + (lead.origin || 'site'))}
          </span>
          <span className="muted small">
            {t('a_created')}: {fmt(lead.created_at)}
          </span>
        </p>

        <div className="status-pick stage-pick">
          <span className="status-label">{t('crm_stage')}</span>
          <div className="stage-btns">
            {STAGES.map((s) => (
              <button
                key={s}
                className={`status-btn stage-btn stg-btn-${s}${lead.stage === s ? ' on' : ''}`}
                aria-pressed={lead.stage === s}
                onClick={() => onStage(lead.id, s)}
              >
                {t('stg_' + s)}
              </button>
            ))}
          </div>
        </div>

        <div className="field crm-notes">
          <label htmlFor="crm-notes">{t('crm_notes')}</label>
          <textarea
            id="crm-notes"
            rows={3}
            maxLength={NOTES_MAX}
            placeholder={t('crm_notes_ph')}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setNotesState('idle');
            }}
          />
          <div className="crm-notes-actions">
            {notesState === 'saved' && !notesDirty && <span className="ok-text">✓ {t('crm_saved')}</span>}
            <button className="btn btn-sm" disabled={!notesDirty || notesState === 'saving'} onClick={saveNotes}>
              {notesState === 'saving' ? t('crm_saving') : t('crm_save')}
            </button>
          </div>
        </div>

        <h3 className="crm-h">🕓 {t('crm_history')}</h3>
        {history === null ? (
          <p className="muted small">…</p>
        ) : (
          <ol className="history">
            {[...history].reverse().map((h) => (
              <li key={h.id}>
                <span className="history-what">
                  {h.from_stage
                    ? t('crm_hist_moved', { from: stageName(h.from_stage), to: stageName(h.to_stage) })
                    : t('crm_hist_created', { to: stageName(h.to_stage) })}
                </span>
                <span className="muted small">
                  {fmt(h.created_at)} · {h.by_name ? t('crm_by', { name: h.by_name }) : t('crm_auto')}
                </span>
              </li>
            ))}
          </ol>
        )}

        <dl className="details">
          {lead.phone && (
            <>
              <dt>{t('q_phone')}</dt>
              <dd>
                <a href={`tel:${tel}`}>{lead.phone}</a>
              </dd>
            </>
          )}
          {lead.email && (
            <>
              <dt>{t('q_email')}</dt>
              <dd>
                <a href={`mailto:${lead.email}`}>{lead.email}</a>
              </dd>
            </>
          )}
          {lead.city && (
            <>
              <dt>{t('q_city')}</dt>
              <dd>{lead.city}</dd>
            </>
          )}
          {lead.age != null && (
            <>
              <dt>{t('q_age')}</dt>
              <dd>{lead.age}</dd>
            </>
          )}
          {lead.exp_tourism != null && (
            <>
              <dt>{t('q_exp_tourism')}</dt>
              <dd>{lead.exp_tourism ? '✅ ' + t('yes') : '❌ ' + t('no')}</dd>
            </>
          )}
          {lead.exp_sales != null && (
            <>
              <dt>{t('q_exp_sales')}</dt>
              <dd>{lead.exp_sales ? '✅ ' + t('yes') : '❌ ' + t('no')}</dd>
            </>
          )}
          {lead.experience && (
            <>
              <dt>{t('q_experience')}</dt>
              <dd className="pre">{lead.experience}</dd>
            </>
          )}
          {[
            ['attraction', 'q_attraction'],
            ['hours', 'q_hours'],
            ['budget', 'q_budget'],
            ['budget_source', 'q_budget_source'],
            ['start_when', 'q_start_when'],
          ]
            .filter(([f]) => lead[f])
            .map(([f, q]) => (
              <div key={f} className="details-pair">
                <dt>{t(q)}</dt>
                <dd>{optionLabel(t, f, lead[f])}</dd>
              </div>
            ))}
          {lead.comment && (
            <>
              <dt>{t('q_comment')}</dt>
              <dd className="pre">{lead.comment}</dd>
            </>
          )}
          {lead.updated_at && (
            <>
              <dt>{t('a_updated')}</dt>
              <dd>
                {fmt(lead.updated_at)}
                {lead.updated_by ? ` · ${t('a_updated_by')}: ${lead.updated_by}` : ''}
              </dd>
            </>
          )}
          {lead.lang && (
            <>
              <dt>{t('a_lang')}</dt>
              <dd>{lead.lang.toUpperCase()}</dd>
            </>
          )}
          {lead.source && (
            <>
              <dt>{t('a_source')}</dt>
              <dd>🎯 {source}</dd>
            </>
          )}
          {utmRows.length > 0 && (
            <>
              <dt>{t('a_utm')}</dt>
              <dd className="utm">
                {utmRows.map(([k, val]) => (
                  <span key={k}>
                    <code>{k}</code> {val}
                  </span>
                ))}
              </dd>
            </>
          )}
        </dl>

        <div className="modal-actions">
          {tel && (
            <a className="btn" href={`tel:${tel}`}>
              📞 {t('a_call')}
            </a>
          )}
          {lead.email && (
            <a className="btn btn-ghost" href={`mailto:${lead.email}`}>
              ✉️ {t('a_write')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ======================= Client adăugat manual =======================
function AddLeadModal({ t, onClose, onAdded }) {
  const [v, setV] = useState({ name: '', phone: '', email: '', city: '', stage: STAGES[0], notes: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFail('');
    const res = await fetch('/api/admin/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(v),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    if (res?.status === 422 && body?.errors) return setErrors(body.errors);
    if (!res?.ok || !body?.ok) return setFail(t('a_error'));
    onAdded(body.lead);
  };

  const field = (k, label, props = {}) => (
    <div className={`field${errors[k] ? ' has-error' : ''}`}>
      <label htmlFor={`add-${k}`}>{label}</label>
      <input id={`add-${k}`} value={v[k]} onChange={set(k)} {...props} />
      {errors[k] && <span className="field-error">{t(errors[k])}</span>}
    </div>
  );

  return (
    <div className="modal-bg" onClick={onClose}>
      <form className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
        <div className="modal-head">
          <h2>✍️ {t('crm_new_title')}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('a_close')}>
            ✕
          </button>
        </div>
        {field('name', t('crm_name'), { autoFocus: true, autoComplete: 'off' })}
        {field('phone', t('crm_phone'), { type: 'tel', placeholder: '069 123 456', autoComplete: 'off' })}
        {field('email', t('crm_email'), { type: 'email', autoComplete: 'off' })}
        {field('city', t('crm_city'), { autoComplete: 'off' })}
        <div className="field">
          <label htmlFor="add-stage">{t('crm_stage')}</label>
          <select id="add-stage" className="search" value={v.stage} onChange={set('stage')}>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {t('stg_' + s)}
              </option>
            ))}
          </select>
        </div>
        <div className={`field${errors.notes ? ' has-error' : ''}`}>
          <label htmlFor="add-notes">{t('crm_notes')}</label>
          <textarea id="add-notes" rows={3} maxLength={NOTES_MAX} placeholder={t('crm_notes_ph')} value={v.notes} onChange={set('notes')} />
        </div>
        {fail && <p className="form-error">{fail}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('crm_cancel')}
          </button>
          <button type="submit" className="btn btn-accent" disabled={busy}>
            {busy ? t('crm_saving') : t('crm_add')}
          </button>
        </div>
      </form>
    </div>
  );
}
