'use client';

import { useEffect, useRef } from 'react';
import { useI18n, LangSwitcher } from './I18n';

// Fundalul „lichid” Panda Tour pentru paginile de intrare / cerere acces:
// poza de pe pandatur.md + picături albastre/verzi care se unesc, cu paralaxă la mouse.

// Valori fixe (nu aleatoare), ca serverul și browserul să deseneze la fel.
const BLOBS = [
  { size: 320, left: 8, top: 12, delay: -2, dur: 22, color: 'b' },
  { size: 260, left: 62, top: 8, delay: -9, dur: 26, color: 'g' },
  { size: 220, left: 72, top: 58, delay: -5, dur: 19, color: 'b' },
  { size: 300, left: 18, top: 62, delay: -14, dur: 28, color: 'g' },
  { size: 180, left: 44, top: 36, delay: -7, dur: 17, color: 'w' },
  { size: 200, left: 85, top: 30, delay: -11, dur: 24, color: 'b' },
];

export default function LiquidShell({ kicker, title1, title2, sub, children }) {
  const { t } = useI18n();
  const blobRefs = useRef([]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const onMove = (e) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = e.clientX / window.innerWidth - 0.5;
        const y = e.clientY / window.innerHeight - 0.5;
        blobRefs.current.forEach((el, i) => {
          if (el) el.style.translate = `${x * (i + 1) * 14}px ${y * (i + 1) * 14}px`;
        });
      });
    };
    document.addEventListener('mousemove', onMove);
    return () => {
      document.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <main className="lx">
      <svg className="lx-svg" aria-hidden>
        <defs>
          <filter id="pt-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <div className="lx-photo" aria-hidden />
      <div className="lx-stage" aria-hidden>
        {BLOBS.map((b, i) => (
          <div
            key={i}
            ref={(el) => (blobRefs.current[i] = el)}
            className={`lx-blob lx-${b.color}`}
            style={{
              width: b.size,
              height: b.size,
              left: `${b.left}%`,
              top: `${b.top}%`,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.dur}s`,
            }}
          />
        ))}
      </div>

      <div className="lx-top">
        <a href="/" className="lx-back">
          ← {t('a_back_site')}
        </a>
        <LangSwitcher />
      </div>

      <section className="lx-card">
        <img className="lx-logo" src="/img/logo.png" alt="Panda Tour" width="132" height="67" />
        <header className="lx-head">
          <span className="lx-kicker">{kicker}</span>
          <h1>
            {title1}
            <br />
            <span>{title2}</span>
          </h1>
          {sub && <p>{sub}</p>}
        </header>
        {children}
      </section>

      <p className="lx-foot">© {new Date().getFullYear()} PANDA TUR S.R.L.</p>
    </main>
  );
}

// Câmp de formular în stilul paginii (linie luminoasă jos, ochi pentru parole)
export function LxField({ id, label, type = 'text', value, onChange, error, autoFocus, autoComplete, placeholder, eye }) {
  const { t } = useI18n();
  const [show, setShow] = eye || [false, null];
  return (
    <div className={`lx-field${error ? ' lx-err' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="lx-input">
        <input
          id={id}
          type={type === 'password' && show ? 'text' : type}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          className={eye ? 'with-eye' : ''}
        />
        {eye && (
          <button
            type="button"
            className="lx-eye"
            onClick={() => setShow(!show)}
            aria-label={show ? t('a_hide') : t('a_show')}
            title={show ? t('a_hide') : t('a_show')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {show && <path d="M3 3l18 18" />}
            </svg>
          </button>
        )}
        <span className="lx-glow" aria-hidden />
      </div>
      {error && (
        <span className="lx-msg" id={`${id}-err`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function LxSubmit({ children, disabled }) {
  return (
    <div className="lx-submit">
      <span className="lx-drop" aria-hidden />
      <button type="submit" className="lx-btn" disabled={disabled}>
        {children}
      </button>
    </div>
  );
}
