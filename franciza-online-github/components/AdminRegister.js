'use client';

import { useState } from 'react';
import { useI18n } from './I18n';
import LiquidShell, { LxField, LxSubmit } from './LiquidShell';
import { validateAccount } from '@/lib/users';

export default function AdminRegister() {
  const { t } = useI18n();
  const [v, setV] = useState({ name: '', email: '', password: '', password2: '' });
  const [website, setWebsite] = useState(''); // capcană pentru boți
  const [errors, setErrors] = useState({});
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const show = useState(false);

  const set = (k) => (val) => {
    setV((p) => ({ ...p, [k]: val }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (state === 'sending') return;
    const res0 = validateAccount(v);
    const errs = { ...res0.errors };
    if (!errs.password && v.password !== v.password2) errs.password2 = 'err_pw_match';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setState('sending');
    const res = await fetch('/api/admin/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: v.name, email: v.email, password: v.password, website }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    if (res?.status === 422 && body?.errors) {
      setErrors(body.errors);
      setState('idle');
      return;
    }
    setState(res?.ok ? 'done' : 'error');
  };

  const err = (k) => (errors[k] ? t(errors[k]) : '');

  return (
    <LiquidShell
      kicker={t('reg_kicker')}
      title1={t('reg_title1')}
      title2={t('reg_title2')}
      sub={state === 'done' ? null : t('reg_sub')}
    >
      {state === 'done' ? (
        <div className="lx-done" role="status">
          <div className="lx-done-icon" aria-hidden>
            ✓
          </div>
          <h2>{t('reg_ok_title')}</h2>
          <p>{t('reg_ok_text')}</p>
          <a className="lx-link-btn" href="/admin/login">
            {t('reg_login')} →
          </a>
        </div>
      ) : (
        <>
          <form onSubmit={submit} noValidate>
            <LxField id="name" label={t('reg_name')} autoComplete="name" autoFocus value={v.name} onChange={set('name')} error={err('name')} />
            <LxField id="email" type="email" label={t('a_email')} autoComplete="email" placeholder={t('a_email_ph')} value={v.email} onChange={set('email')} error={err('email')} />
            <LxField id="password" type="password" label={t('reg_password')} autoComplete="new-password" value={v.password} onChange={set('password')} error={err('password')} eye={show} />
            <LxField id="password2" type="password" label={t('reg_password2')} autoComplete="new-password" value={v.password2} onChange={set('password2')} error={err('password2')} eye={show} />
            <input className="hp" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden />
            {state === 'error' && (
              <p className="lx-msg" role="alert">
                {t('a_error')}
              </p>
            )}
            <LxSubmit disabled={state === 'sending'}>{state === 'sending' ? '…' : `${t('reg_submit')} →`}</LxSubmit>
          </form>
          <p className="lx-alt">
            {t('reg_have')} <a href="/admin/login">{t('reg_login')} →</a>
          </p>
        </>
      )}
    </LiquidShell>
  );
}
