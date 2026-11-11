'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from './I18n';
import {
  validateLead, EMPTY_FORM, OPTIONS, ALLOW_OTHER, OTHER, LIMITS, FIELD_ORDER, STEPS, stepOf,
  PHONE_COUNTRIES, PHONE_OTHER, formatLocal,
} from '@/lib/form';
import { readSource } from '@/lib/source';
import { SITE } from '@/lib/site';

export default function LeadForm() {
  const { t, lang } = useI18n();
  const [v, setV] = useState(EMPTY_FORM);
  const [website, setWebsite] = useState(''); // capcană pentru boți
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [step, setStep] = useState(0);
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const [sentPhone, setSentPhone] = useState('');
  const topRef = useRef(null);
  const firstRender = useRef(true);

  // La schimbarea pasului: urcăm la începutul formularului și punem focus pe primul câmp.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const first = STEPS[step].fields[0];
    setTimeout(() => {
      document.querySelector(`[data-field="${first}"] input, [data-field="${first}"] textarea`)?.focus({ preventScroll: true });
    }, 350);
  }, [step]);

  const update = (name, value) => {
    const next = { ...v, [name]: value };
    setV(next);
    setErrors(validateLead(next).errors);
  };
  const touch = (name) => setTouched((p) => ({ ...p, [name]: true }));
  const err = (k) => (touched[k] && errors[k] ? t(errors[k]) : '');

  const focusField = (field) => {
    const el = document.querySelector(`[data-field="${field}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.querySelector('input, textarea')?.focus({ preventScroll: true });
  };

  // Verifică doar câmpurile pasului curent; true dacă se poate merge mai departe.
  const checkStep = (i) => {
    const res = validateLead(v);
    setErrors(res.errors);
    setTouched((p) => ({ ...p, ...Object.fromEntries(STEPS[i].fields.map((k) => [k, true])) }));
    const first = STEPS[i].fields.find((k) => res.errors[k]);
    if (first) {
      setTimeout(() => focusField(first), 0);
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (checkStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (state === 'sending') return;
    if (step < STEPS.length - 1) return goNext(); // Enter pe pașii 1–2 = „Înainte”

    const res0 = validateLead(v);
    setErrors(res0.errors);
    setTouched(Object.fromEntries(FIELD_ORDER.map((k) => [k, true])));
    if (!res0.ok) {
      const first = FIELD_ORDER.find((k) => res0.errors[k]);
      const s = stepOf(first);
      if (s !== step) setStep(s);
      else focusField(first);
      return;
    }
    setState('sending');
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...v, website, lang, source: readSource() }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 422 && body.errors) {
        setErrors(body.errors);
        const first = FIELD_ORDER.find((k) => body.errors[k]);
        if (first) setStep(stepOf(first));
        setState('idle');
        return;
      }
      if (!res.ok || !body.ok) throw new Error('server');
      setSentPhone(res0.data.phone);
      setV(EMPTY_FORM);
      setTouched({});
      setErrors({});
      setStep(0);
      setState('done');
      document.getElementById('form')?.scrollIntoView({ behavior: 'smooth' });
    } catch {
      setState('error');
    }
  };

  if (state === 'done') {
    return (
      <div className="form-card success" role="status" aria-live="polite">
        <div className="success-icon" aria-hidden>
          ✓
        </div>
        <h3>{t('ok_title')}</h3>
        <p>{t('ok_text', { phone: sentPhone })}</p>
        <button type="button" className="btn btn-ghost" onClick={() => setState('idle')}>
          {t('ok_again')}
        </button>
      </div>
    );
  }

  const text = (name, props = {}) => (
    <Field name={name} label={t('q_' + name)} error={err(name)} hint={props.hint}>
      <input
        id={name}
        name={name}
        value={v[name]}
        onChange={(e) => update(name, e.target.value)}
        onBlur={() => touch(name)}
        placeholder={t('q_' + name + '_ph')}
        aria-invalid={!!err(name)}
        {...props.input}
      />
    </Field>
  );

  const choice = (name, options, labelFor) => (
    <Choice
      name={name}
      label={t('q_' + name)}
      error={err(name)}
      options={options.map((o) => ({ value: o, label: labelFor(o) }))}
      value={v[name]}
      onChange={(val) => {
        update(name, val);
        touch(name);
      }}
      other={
        ALLOW_OTHER.includes(name)
          ? {
              label: t('other'),
              placeholder: t('other_ph'),
              value: v[name + '_other'],
              onChange: (txt) => {
                const next = { ...v, [name]: OTHER, [name + '_other']: txt };
                setV(next);
                setErrors(validateLead(next).errors);
              },
            }
          : null
      }
    />
  );

  const sending = state === 'sending';
  const last = step === STEPS.length - 1;
  const stepHasError = STEPS[step].fields.some((k) => touched[k] && errors[k]);

  return (
    <form className="form-card" onSubmit={onSubmit} noValidate ref={topRef}>
      {/* Progres */}
      <div className="progress" aria-label={t('step_of', { n: step + 1, total: STEPS.length })}>
        <div className="progress-head">
          <span className="progress-step">{t('step_of', { n: step + 1, total: STEPS.length })}</span>
          <span className="form-required">{t('form_required')}</span>
        </div>
        <ol className="progress-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className={i < step ? 'done' : i === step ? 'on' : ''}>
              <span className="progress-dot">{i < step ? '✓' : i + 1}</span>
              <span className="progress-label">{t(s.title)}</span>
            </li>
          ))}
        </ol>
        <div className="progress-bar">
          <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      {step === 0 && (
        <fieldset>
          <legend>{t('sec_contact')}</legend>
          {text('name', { input: { autoComplete: 'name', maxLength: LIMITS.nameMax } })}
          <div className="row2">
            <Field name="phone" label={t('q_phone')} error={err('phone')}>
              <div className="phone-group">
                <select
                  className="phone-cc"
                  aria-label={t('phone_prefix')}
                  value={v.phone_cc}
                  onChange={(e) => update('phone_cc', e.target.value)}
                >
                  {PHONE_COUNTRIES.map((c) => (
                    <option key={c.cc} value={c.cc}>
                      {c.flag} {c.cc}
                    </option>
                  ))}
                  <option value={PHONE_OTHER}>🌍 {t('phone_other')}</option>
                </select>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete={v.phone_cc === PHONE_OTHER ? 'tel' : 'tel-national'}
                  maxLength={25}
                  placeholder={
                    PHONE_COUNTRIES.find((c) => c.cc === v.phone_cc)?.example || t('q_phone_other_ph')
                  }
                  value={v.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  onBlur={() => {
                    touch('phone');
                    const pretty = formatLocal(v.phone_cc, v.phone);
                    if (pretty !== v.phone) update('phone', pretty);
                  }}
                  aria-invalid={!!err('phone')}
                />
              </div>
            </Field>
            {text('email', { input: { type: 'email', inputMode: 'email', autoComplete: 'email', maxLength: 120 } })}
          </div>
          <div className="row2">
            {text('city', { input: { autoComplete: 'address-level2', maxLength: LIMITS.cityMax } })}
            {text('age', {
              hint: t('q_age_hint'),
              input: { inputMode: 'numeric', maxLength: 2, placeholder: '30', pattern: '[0-9]*' },
            })}
          </div>
        </fieldset>
      )}

      {step === 1 && (
        <fieldset>
          <legend>{t('sec_profile')}</legend>
          {choice('exp_tourism', ['yes', 'no'], (o) => t(o))}
          {choice('exp_sales', ['yes', 'no'], (o) => t(o))}
          <Field name="experience" label={t('q_experience')} error={err('experience')}>
            <textarea
              id="experience"
              name="experience"
              rows={4}
              maxLength={LIMITS.experienceMax}
              value={v.experience}
              onChange={(e) => update('experience', e.target.value)}
              onBlur={() => touch('experience')}
              placeholder={t('q_experience_ph')}
              aria-invalid={!!err('experience')}
            />
          </Field>
          {choice('attraction', OPTIONS.attraction, (o) => t('o_attraction_' + o))}
        </fieldset>
      )}

      {step === 2 && (
        <fieldset>
          <legend>{t('sec_plans')}</legend>
          {choice('hours', OPTIONS.hours, (o) => t('o_hours_' + o))}
          {choice('budget', OPTIONS.budget, (o) => t('o_budget_' + o))}
          {choice('budget_source', OPTIONS.budget_source, (o) => t('o_budget_source_' + o))}
          {choice('start_when', OPTIONS.start_when, (o) => t('o_start_when_' + o))}
          <Field name="comment" label={t('q_comment')} error={err('comment')} optional>
            <textarea
              id="comment"
              name="comment"
              rows={3}
              maxLength={LIMITS.commentMax}
              value={v.comment}
              onChange={(e) => update('comment', e.target.value)}
              onBlur={() => touch('comment')}
              placeholder={t('q_comment_ph')}
            />
          </Field>

          <div className={`consent${err('consent') ? ' has-error' : ''}`} data-field="consent">
            <label>
              <input
                type="checkbox"
                checked={v.consent}
                onChange={(e) => {
                  update('consent', e.target.checked);
                  touch('consent');
                }}
              />
              <span>
                {t('q_consent')}{' '}
                <a href={SITE.privacyUrl} target="_blank" rel="noopener">
                  {t('q_consent_link')}
                </a>{' '}
                *
              </span>
            </label>
            {err('consent') && <span className="field-error">{err('consent')}</span>}
          </div>
        </fieldset>
      )}

      <input
        className="hp"
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        aria-hidden
      />

      {state === 'error' && (
        <p className="form-error" role="alert">
          {t('err_server')}
        </p>
      )}
      {stepHasError && state !== 'error' && <p className="form-hint-error">{t('f_fix')}</p>}

      <div className="form-nav">
        {step > 0 && (
          <button type="button" className="btn btn-ghost btn-lg" onClick={goBack} disabled={sending}>
            {t('back')}
          </button>
        )}
        {last ? (
          <button type="submit" className="btn btn-lg btn-accent form-nav-main" disabled={sending}>
            {sending ? t('f_sending') : t('f_submit')}
          </button>
        ) : (
          // type="submit" ca Enter să treacă la pasul următor (onSubmit apelează goNext)
          <button type="submit" className="btn btn-lg btn-accent form-nav-main">
            {t('next')}
          </button>
        )}
      </div>
    </form>
  );
}

function Field({ name, label, error, hint, optional, children }) {
  return (
    <div className={`field${error ? ' has-error' : ''}`} data-field={name}>
      <label htmlFor={name}>
        {label}
        {!optional && ' *'}
      </label>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

function Choice({ name, label, error, options, value, onChange, other }) {
  const isOther = value === OTHER;
  return (
    <fieldset className={`field choice${error ? ' has-error' : ''}`} data-field={name}>
      <legend>{label} *</legend>
      <div className="pills" role="radiogroup">
        {options.map((o) => (
          <label key={o.value} className={`pill${value === o.value ? ' on' : ''}`}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
        {other && (
          <label className={`pill${isOther ? ' on' : ''}`}>
            <input type="radio" name={name} value={OTHER} checked={isOther} onChange={() => onChange(OTHER)} />
            <span>{other.label}</span>
          </label>
        )}
      </div>
      {other && isOther && (
        <input
          className="other-input"
          autoFocus
          maxLength={LIMITS.otherMax}
          placeholder={other.placeholder}
          value={other.value}
          onChange={(e) => other.onChange(e.target.value)}
          aria-label={other.label}
        />
      )}
      {error && <span className="field-error">{error}</span>}
    </fieldset>
  );
}
