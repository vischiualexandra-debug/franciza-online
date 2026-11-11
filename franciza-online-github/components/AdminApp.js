'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n, LangSwitcher } from './I18n';
import { STATUSES } from '@/lib/form';
import { optionLabel } from '@/lib/i18n';
import { sourceText, sourceLabels } from '@/lib/source';
import TeamPanel, { MeModal } from './TeamPanel';

const LOCALES = { ro: 'ro-RO', ru: 'ru-RU', en: 'en-GB' };

export default function AdminApp({ me }) {
  const { t, lang } = useI18n();
  const isAdminRole = me?.role === 'admin';
  const [view, setView] = useState('leads'); // leads | team
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

  const fmt = useCallback(
    (iso) =>
      iso
        ? new Intl.DateTimeFormat(LOCALES[lang], {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(iso))
        : '—',
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

  const counts = useMemo(() => {
    const c = { all: leads?.length || 0, new: 0, in_progress: 0, closed: 0 };
    for (const l of leads || []) c[l.status] = (c[l.status] || 0) + 1;
    return c;
  }, [leads]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (leads || []).filter(
      (l) =>
        (filter === 'all' || l.status === filter) &&
        (srcFilter === 'all' || (l.source || 'none') === srcFilter) &&
        (!q || [l.name, l.phone, l.email, l.city, l.experience, l.comment].some((v) => v?.toLowerCase().includes(q)))
    );
  }, [leads, filter, query, srcFilter]);

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

  const setStatus = async (id, status) => {
    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    const res = await fetch(`/api/admin/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok || !body?.ok) {
      setLeads(prev);
      setToast(t('a_error'));
      return;
    }
    setLeads((ls) => ls.map((l) => (l.id === id ? body.lead : l)));
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
        {isAdminRole && (
          <nav className="view-tabs" aria-label="Admin">
            <button className={view === 'leads' ? 'on' : ''} onClick={() => setView('leads')}>
              📋 {t('a_tab_leads')}
            </button>
            <button className={view === 'team' ? 'on' : ''} onClick={() => setView('team')}>
              👥 {t('a_tab_team')}
              {pendingCount > 0 && <span className="pending-dot">{pendingCount}</span>}
            </button>
          </nav>
        )}

        {view === 'team' && isAdminRole ? (
          <TeamPanel me={me} fmt={fmt} onChanged={loadPending} />
        ) : (
        <>
        <div className="toolbar">
          <div className="tabs" role="tablist">
            {['all', ...STATUSES].map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={filter === s}
                className={`tab${filter === s ? ' on' : ''}`}
                onClick={() => setFilter(s)}
              >
                {s !== 'all' && <i className={`dot dot-${s}`} />}
                {s === 'all' ? t('a_all') : t('st_' + s)}
                <span className="count">{counts[s] || 0}</span>
              </button>
            ))}
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
        {leads && visible.length === 0 && <p className="muted center empty">{t('a_empty')}</p>}

        <ul className="lead-list">
          {visible.map((l) => (
            <li key={l.id}>
              <button className={`lead-row st-${l.status}`} onClick={() => setOpenId(l.id)}>
                <span className="lead-main">
                  <span className="lead-name">
                    <span className="lead-id">#{l.id}</span> {l.name}
                  </span>
                  <span className="lead-phone">
                    {l.phone} · 📍 {l.city} · {t('a_years', { n: l.age })}
                  </span>
                  <span className="lead-tags">
                    <span className="tag">💶 {optionLabel(t, 'budget', l.budget)}</span>
                    <span className="tag">🚀 {optionLabel(t, 'start_when', l.start_when)}</span>
                    <span className={`tag ${l.exp_tourism ? 'tag-yes' : 'tag-no'}`}>✈ {l.exp_tourism ? '✓' : '✗'}</span>
                    <span className={`tag ${l.exp_sales ? 'tag-yes' : 'tag-no'}`}>🤝 {l.exp_sales ? '✓' : '✗'}</span>
                    {l.source && <span className="tag tag-src">🎯 {srcText(l)}</span>}
                  </span>
                </span>
                <span className="lead-meta">
                  <span className={`badge badge-${l.status}`}>{t('st_' + l.status)}</span>
                  <time dateTime={l.created_at}>{fmt(l.created_at)}</time>
                </span>
              </button>
            </li>
          ))}
        </ul>
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
          onClose={() => setOpenId(null)}
          onStatus={setStatus}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function LeadModal({ lead, fmt, t, source, onClose, onStatus }) {
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
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>
            <span className="lead-id">#{lead.id}</span> {lead.name}
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('a_close')}>
            ✕
          </button>
        </div>

        <dl className="details">
          <dt>{t('q_phone')}</dt>
          <dd>
            <a href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`}>{lead.phone}</a>
          </dd>
          <dt>{t('q_email')}</dt>
          <dd>
            <a href={`mailto:${lead.email}`}>{lead.email}</a>
          </dd>
          <dt>{t('q_city')}</dt>
          <dd>{lead.city}</dd>
          <dt>{t('q_age')}</dt>
          <dd>{lead.age}</dd>
          <dt>{t('q_exp_tourism')}</dt>
          <dd>{lead.exp_tourism ? '✅ ' + t('yes') : '❌ ' + t('no')}</dd>
          <dt>{t('q_exp_sales')}</dt>
          <dd>{lead.exp_sales ? '✅ ' + t('yes') : '❌ ' + t('no')}</dd>
          <dt>{t('q_experience')}</dt>
          <dd className="pre">{lead.experience}</dd>
          <dt>{t('q_attraction')}</dt>
          <dd>{optionLabel(t, 'attraction', lead.attraction)}</dd>
          <dt>{t('q_hours')}</dt>
          <dd>{optionLabel(t, 'hours', lead.hours)}</dd>
          <dt>{t('q_budget')}</dt>
          <dd>{optionLabel(t, 'budget', lead.budget)}</dd>
          <dt>{t('q_budget_source')}</dt>
          <dd>{optionLabel(t, 'budget_source', lead.budget_source)}</dd>
          <dt>{t('q_start_when')}</dt>
          <dd>{optionLabel(t, 'start_when', lead.start_when)}</dd>
          {lead.comment && (
            <>
              <dt>{t('q_comment')}</dt>
              <dd className="pre">{lead.comment}</dd>
            </>
          )}
          <dt>{t('a_created')}</dt>
          <dd>{fmt(lead.created_at)}</dd>
          {lead.updated_at && (
            <>
              <dt>{t('a_updated')}</dt>
              <dd>
                {fmt(lead.updated_at)}
                {lead.updated_by ? ` · ${t('a_updated_by')}: ${lead.updated_by}` : ''}
              </dd>
            </>
          )}
          <dt>{t('a_lang')}</dt>
          <dd>{(lead.lang || '—').toUpperCase()}</dd>
          <dt>{t('a_source')}</dt>
          <dd>🎯 {source}</dd>
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

        <div className="status-pick">
          <span className="status-label">{t('a_status')}</span>
          <div className="status-btns">
            {STATUSES.map((s) => (
              <button
                key={s}
                className={`status-btn sb-${s}${lead.status === s ? ' on' : ''}`}
                aria-pressed={lead.status === s}
                onClick={() => lead.status !== s && onStatus(lead.id, s)}
              >
                {t('st_' + s)}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <a className="btn" href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`}>
            📞 {t('a_call')}
          </a>
          <a className="btn btn-ghost" href={`mailto:${lead.email}`}>
            ✉️ {t('a_write')}
          </a>
        </div>
      </div>
    </div>
  );
}
