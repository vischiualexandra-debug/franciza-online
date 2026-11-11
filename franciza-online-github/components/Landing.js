'use client';

import { useEffect } from 'react';
import { useI18n, LangSwitcher } from './I18n';
import LeadForm from './LeadForm';
import FloatingActions from './FloatingActions';
import { SITE, TESTIMONIALS } from '@/lib/site';
import { captureSource } from '@/lib/source';

export default function Landing() {
  const { t, tx, lang } = useI18n();

  // Reținem de unde a venit omul (reclamă, rețea socială, Google…)
  useEffect(() => {
    captureSource();
  }, []);
  const years = new Date().getFullYear() - SITE.since;

  const stats = [
    { n: t('st_years', { years }), l: t('st_years_t', { since: SITE.since }) },
    { n: SITE.branches, l: t('st_branches_t') },
    { n: SITE.franchisesMd, l: t('st_md_t') },
    { n: SITE.franchisesRo, l: t('st_ro_t') },
    { n: SITE.officesUa, l: t('st_ua_t') },
  ];
  const fit = [
    { i: '🎂', k: 'fit1' },
    { i: '✈️', k: 'fit2' },
    { i: '🏡', k: 'fit3' },
    { i: '💶', k: 'fit4' },
  ];
  const get = [
    { i: '🎓', k: 'get1' },
    { i: '🗓️', k: 'get2' },
    { i: '📊', k: 'get3' },
    { i: '🤝', k: 'get4' },
  ];
  const income = ['inc1', 'inc2', 'inc3'];
  const steps = ['step1', 'step2', 'step3', 'step4', 'step5'];
  const faq = tx('faq') || [];

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-in">
          <a href="#top" className="logo" aria-label={SITE.product}>
            <img src="/img/logo.png" alt="Panda Tour" width="120" height="61" />
          </a>
          <nav className="nav">
            <a href="#fit">{t('nav_fit')}</a>
            <a href="#get">{t('nav_get')}</a>
            <a href="#income">{t('nav_income')}</a>
            <a href="#compare">{t('nav_compare')}</a>
            <a href="#steps">{t('nav_steps')}</a>
            <a href="#faq">{t('nav_faq')}</a>
          </nav>
          <div className="topbar-right">
            <LangSwitcher />
            <a href="#form" className="btn btn-sm topbar-cta">
              {t('cta')}
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        {/* HERO */}
        <section className="hero">
          <div className="wrap">
            <div className="hero-in">
              <p className="kicker">{t('hero_kicker')}</p>
              <h1>{t('hero_title')}</h1>
              <p className="hero-sub">{t('hero_sub')}</p>
              <div className="hero-actions">
                <a href="#form" className="btn btn-lg btn-accent">
                  {t('hero_cta')} →
                </a>
                <span className="hero-note">{t('hero_note')}</span>
              </div>
            </div>
          </div>
        </section>

        {/* CIFRE */}
        <section className="stats-band" aria-label="Panda Tour">
          <div className="wrap stats">
            {stats.map((s) => (
              <div key={s.l} className="stat">
                <strong>{s.n}</strong>
                <span>{s.l}</span>
              </div>
            ))}
          </div>
        </section>

        {/* CUI I SE POTRIVEȘTE */}
        <section id="fit" className="section">
          <div className="wrap">
            <h2>{t('fit_title')}</h2>
            <p className="section-sub">{t('fit_sub')}</p>
            <div className="grid4">
              {fit.map((f) => (
                <article key={f.k} className="card">
                  <div className="card-icon" aria-hidden>
                    {f.i}
                  </div>
                  <h3>{t(f.k + '_t')}</h3>
                  <p>{t(f.k + '_d')}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* CE PRIMEȘTI */}
        <section id="get" className="section section-alt">
          <div className="wrap split">
            <div className="split-img" aria-hidden>
              <img src="/img/greece.jpg" alt="" loading="lazy" />
              <img src="/img/egypt.jpg" alt="" loading="lazy" />
            </div>
            <div>
              <h2>{t('get_title')}</h2>
              <ul className="feature-list">
                {get.map((g) => (
                  <li key={g.k}>
                    <span className="feature-icon" aria-hidden>
                      {g.i}
                    </span>
                    <div>
                      <h3>{t(g.k + '_t')}</h3>
                      <p>{t(g.k + '_d')}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* VENIT */}
        <section id="income" className="section">
          <div className="wrap">
            <h2>{t('inc_title')}</h2>
            <div className="no-risk">
              <span className="no-risk-icon" aria-hidden>
                🛡️
              </span>
              <div>
                <strong>{t('inc_badge')}</strong>
                <p>{t('inc_sub')}</p>
              </div>
            </div>
            <ol className="flow">
              {income.map((k, i) => (
                <li key={k} className="flow-item">
                  <span className="flow-num">{i + 1}</span>
                  <h3>{t(k + '_t')}</h3>
                  <p>{t(k + '_d')}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* COMPARAȚIE */}
        <section id="compare" className="section section-alt">
          <div className="wrap">
            <h2>{t('cmp_title')}</h2>
            <p className="section-sub">{t('cmp_sub')}</p>
            <div className="cmp-wrap">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col" className="cmp-corner" />
                    {(tx('cmp_cols') || []).map((c, i) => (
                      <th key={c} scope="col" className={i === 0 ? 'cmp-hl' : ''}>
                        {i === 0 && <span className="cmp-best">⭐ {t('cmp_best')}</span>}
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(tx('cmp_rows') || []).map((r) => (
                    <tr key={r.label}>
                      <th scope="row">{r.label}</th>
                      {r.v.map(([text, mark], i) => (
                        <td key={i} className={i === 0 ? 'cmp-hl' : ''} data-col={(tx('cmp_cols') || [])[i]}>
                          <span className={`cmp-mark cmp-${mark}`} aria-hidden>
                            {mark === 'y' ? '✓' : mark === 'n' ? '✕' : '•'}
                          </span>
                          {text}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* PAȘI */}
        <section id="steps" className="section section-dark">
          <div className="wrap">
            <h2>{t('steps_title')}</h2>
            <ol className="steps">
              {steps.map((k, i) => (
                <li key={k}>
                  <span className="step-num">{i + 1}</span>
                  <h3>{t(k + '_t')}</h3>
                  <p>{t(k + '_d')}</p>
                </li>
              ))}
            </ol>
            <div className="center">
              <a href="#form" className="btn btn-lg btn-accent">
                {t('hero_cta')} →
              </a>
            </div>
          </div>
        </section>

        {/* RECENZII — apar doar dacă sunt adăugate în lib/site.js */}
        {TESTIMONIALS.length > 0 && (
          <section className="section section-alt">
            <div className="wrap">
              <h2>{t('rev_title')}</h2>
              <div className="grid3">
                {TESTIMONIALS.map((r) => (
                  <figure key={r.name} className="card review">
                    <blockquote>“{r.text[lang] || r.text.ro}”</blockquote>
                    <figcaption>
                      <strong>{r.name}</strong> · {r.city}
                      {r.since ? ` · ${r.since}` : ''}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        <section id="faq" className="section">
          <div className="wrap narrow">
            <h2>{t('faq_title')}</h2>
            <div className="faq">
              {faq.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* FORMULAR */}
        <section id="form" className="section section-alt">
          <div className="wrap narrow">
            <div className="form-intro">
              <h2>{t('form_title')}</h2>
              <p>{t('form_sub')}</p>
            </div>
            <LeadForm />
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap footer-in">
          <div>
            <img className="footer-logo" src="/img/logo.png" alt="Panda Tour" width="120" height="61" />
            <p className="muted">{SITE.product}</p>
            <a href={SITE.website} target="_blank" rel="noopener">
              {t('footer_site')} ↗
            </a>
          </div>
          <div className="footer-col">
            <h4>{t('footer_contacts')}</h4>
            <a href={`tel:${SITE.phone.replace(/\s/g, '')}`}>📞 {SITE.phone}</a>
            <a href={`mailto:${SITE.email}`}>✉️ {SITE.email}</a>
            <span>📍 {SITE.address}</span>
          </div>
          <div className="footer-col">
            <h4>{t('footer_follow')}</h4>
            <a href={SITE.social.telegram} target="_blank" rel="noopener">Telegram</a>
            <a href={SITE.social.instagram} target="_blank" rel="noopener">Instagram</a>
            <a href={SITE.social.facebook} target="_blank" rel="noopener">Facebook</a>
            <a href={SITE.social.tiktok} target="_blank" rel="noopener">TikTok</a>
          </div>
        </div>
        <div className="wrap footer-bottom">
          © {new Date().getFullYear()} {SITE.legalName}. {t('footer_rights')}
        </div>
      </footer>

      <FloatingActions />
    </>
  );
}
