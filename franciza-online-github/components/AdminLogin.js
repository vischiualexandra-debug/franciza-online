'use client';

import { useState } from 'react';
import { useI18n } from './I18n';
import LiquidShell, { LxField, LxSubmit } from './LiquidShell';

export default function AdminLogin() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const show = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password || busy) return;
    setBusy(true);
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);
    if (res?.ok) {
      window.location.href = '/admin';
      return;
    }
    const body = await res?.json().catch(() => ({}));
    setBusy(false);
    setError(
      body?.error === 'pending' ? t('login_pending')
        : body?.error === 'disabled' ? t('login_disabled')
          : body?.error === 'server' || !res ? t('a_error')
            : t('login_wrong')
    );
  };

  return (
    <LiquidShell kicker={t('login_kicker')} title1={t('login_title1')} title2={t('login_title2')} sub={t('login_sub')}>
      <form onSubmit={submit} noValidate>
        <LxField
          id="email"
          type="email"
          label={t('a_email')}
          autoComplete="username"
          autoFocus
          placeholder={t('a_email_ph')}
          value={email}
          onChange={(v) => {
            setEmail(v);
            if (error) setError('');
          }}
        />
        <LxField
          id="password"
          type="password"
          label={t('a_password')}
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(v) => {
            setPassword(v);
            if (error) setError('');
          }}
          error={error}
          eye={show}
        />
        <LxSubmit disabled={busy || !email || !password}>{busy ? '…' : `${t('a_enter')} →`}</LxSubmit>
      </form>
      <p className="lx-alt">
        {t('login_no_account')} <a href="/admin/register">{t('login_request')} →</a>
      </p>
    </LiquidShell>
  );
}
