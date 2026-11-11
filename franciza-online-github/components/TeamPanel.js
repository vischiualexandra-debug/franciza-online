'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from './I18n';
import { validateAccount } from '@/lib/users';

// Fila „Echipa” (doar pentru administratori): cereri de acces, membri, adăugare cont.
export default function TeamPanel({ me, fmt, onChanged }) {
  const { t } = useI18n();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);
  const [pwFor, setPwFor] = useState(null);
  const [pwValue, setPwValue] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/users', { cache: 'no-store' }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (body?.ok) {
      setUsers(body.users);
      setError('');
    } else setError(t('a_error'));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const errText = (code) =>
    code === 'self' ? t('team_err_self') : code === 'last_admin' ? t('team_err_last') : code === 'err_pw_short' ? t('err_pw_short') : t('a_error');

  const patch = async (id, data) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (body?.ok) {
      setToast(t('team_saved'));
      await load();
      onChanged?.();
      return true;
    }
    setToast(errText(body?.error));
    return false;
  };

  const remove = async (id) => {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setConfirmDel(null);
    if (body?.ok) {
      setToast(t('team_saved'));
      await load();
      onChanged?.();
    } else setToast(errText(body?.error));
  };

  if (!users) return <p className="muted center">{error || '…'}</p>;

  const pending = users.filter((u) => u.status === 'pending');
  const others = users.filter((u) => u.status !== 'pending');

  return (
    <div className="team">
      {/* Cereri de acces */}
      <section className="team-block">
        <h2>
          {t('team_pending')} {pending.length > 0 && <span className="pending-dot">{pending.length}</span>}
        </h2>
        {pending.length === 0 ? (
          <p className="muted">{t('team_none_pending')}</p>
        ) : (
          <ul className="user-list">
            {pending.map((u) => (
              <li key={u.id} className="user-row pending">
                <div className="user-main">
                  <strong>{u.name}</strong>
                  <span className="muted">{u.email}</span>
                  <span className="muted small">
                    {t('team_requested')}: {fmt(u.created_at)}
                  </span>
                </div>
                <div className="user-actions">
                  <button className="btn btn-sm btn-accent" onClick={() => patch(u.id, { status: 'active' })}>
                    ✓ {t('team_approve')}
                  </button>
                  {confirmDel === u.id ? (
                    <button className="btn btn-sm btn-danger" onClick={() => remove(u.id)}>
                      {t('team_sure')}
                    </button>
                  ) : (
                    <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDel(u.id)}>
                      ✕ {t('team_reject')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Membrii echipei */}
      <section className="team-block">
        <h2>{t('team_members')}</h2>
        <p className="muted small">{t('team_role_hint')}</p>
        <ul className="user-list">
          {others.map((u) => {
            const self = u.id === me.id;
            return (
              <li key={u.id} className={`user-row${u.status === 'disabled' ? ' disabled' : ''}`}>
                <div className="user-main">
                  <strong>
                    {u.name} {self && <span className="you">({t('team_you')})</span>}
                  </strong>
                  <span className="muted">{u.email}</span>
                  <span className="muted small">
                    {t('team_last_login')}: {u.last_login ? fmt(u.last_login) : t('team_never')}
                  </span>
                </div>
                <div className="user-actions">
                  <span className={`badge ub-${u.status}`}>{t('team_status_' + u.status)}</span>
                  <select
                    className="search role-select"
                    value={u.role}
                    disabled={self}
                    onChange={(e) => patch(u.id, { role: e.target.value })}
                    aria-label="Rol"
                  >
                    <option value="admin">{t('team_role_admin')}</option>
                    <option value="member">{t('team_role_member')}</option>
                  </select>
                  {!self && (
                    <>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => patch(u.id, { status: u.status === 'active' ? 'disabled' : 'active' })}
                      >
                        {u.status === 'active' ? t('team_disable') : t('team_enable')}
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => {
                          setPwFor(pwFor === u.id ? null : u.id);
                          setPwValue('');
                        }}
                      >
                        🔑
                      </button>
                      {confirmDel === u.id ? (
                        <button className="btn btn-sm btn-danger" onClick={() => remove(u.id)}>
                          {t('team_sure')}
                        </button>
                      ) : (
                        <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDel(u.id)} title={t('team_delete')}>
                          🗑
                        </button>
                      )}
                    </>
                  )}
                </div>
                {pwFor === u.id && (
                  <form
                    className="pw-inline"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (await patch(u.id, { password: pwValue })) setPwFor(null);
                    }}
                  >
                    <input
                      className="search"
                      type="text"
                      autoComplete="new-password"
                      placeholder={t('team_new_pw')}
                      value={pwValue}
                      onChange={(e) => setPwValue(e.target.value)}
                      minLength={8}
                      autoFocus
                    />
                    <button className="btn btn-sm" disabled={pwValue.length < 8}>
                      {t('team_set_pw')}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <AddMember onAdded={load} setToast={setToast} />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function AddMember({ onAdded, setToast }) {
  const { t } = useI18n();
  const [v, setV] = useState({ name: '', email: '', password: '', role: 'member' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const r = validateAccount(v);
    setErrors(r.errors);
    if (!r.ok) return;
    setBusy(true);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(v),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    if (body?.ok) {
      setV({ name: '', email: '', password: '', role: 'member' });
      setToast(t('team_saved'));
      onAdded();
    } else if (body?.errors) setErrors(body.errors);
    else setToast(t('a_error'));
  };

  const err = (k) => (errors[k] ? <span className="field-error">{t(errors[k])}</span> : null);

  return (
    <section className="team-block">
      <h2>{t('team_add')}</h2>
      <p className="muted small">{t('team_add_hint')}</p>
      <form className="add-member" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="m-name">{t('reg_name')}</label>
          <input id="m-name" value={v.name} onChange={set('name')} autoComplete="off" />
          {err('name')}
        </div>
        <div className="field">
          <label htmlFor="m-email">{t('a_email')}</label>
          <input id="m-email" type="email" value={v.email} onChange={set('email')} autoComplete="off" />
          {err('email')}
        </div>
        <div className="field">
          <label htmlFor="m-pw">{t('a_password')}</label>
          <input id="m-pw" type="text" value={v.password} onChange={set('password')} autoComplete="new-password" />
          {err('password')}
        </div>
        <div className="field">
          <label htmlFor="m-role">Rol</label>
          <select id="m-role" className="search" value={v.role} onChange={set('role')}>
            <option value="member">{t('team_role_member')}</option>
            <option value="admin">{t('team_role_admin')}</option>
          </select>
        </div>
        <button className="btn" disabled={busy}>
          {busy ? '…' : t('team_add_btn')}
        </button>
      </form>
    </section>
  );
}

// Fereastra „Contul meu” — schimbarea propriei parole
export function MeModal({ me, onClose }) {
  const { t } = useI18n();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (next.length < 8) return setMsg({ ok: false, text: t('err_pw_short') });
    setBusy(true);
    const res = await fetch('/api/admin/me', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current, next }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    if (body?.ok) {
      setMsg({ ok: true, text: t('me_saved') });
      setCurrent('');
      setNext('');
    } else setMsg({ ok: false, text: body?.error ? t(body.error) : t('a_error') });
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal me-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>👤 {me.name}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('a_close')}>
            ✕
          </button>
        </div>
        <p className="muted">
          {me.email} · {t(me.role === 'admin' ? 'team_role_admin' : 'team_role_member')}
        </p>
        <form onSubmit={submit}>
          <h3>{t('me_change_pw')}</h3>
          <div className="field">
            <label htmlFor="me-cur">{t('me_current')}</label>
            <input id="me-cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="me-new">{t('me_new')}</label>
            <input id="me-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          {msg && <p className={msg.ok ? 'ok-msg' : 'form-error'}>{msg.text}</p>}
          <button className="btn btn-block" disabled={busy || !current || !next}>
            {busy ? '…' : t('me_save')}
          </button>
        </form>
      </div>
    </div>
  );
}
