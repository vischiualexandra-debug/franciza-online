'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { dict, LANGS } from '@/lib/i18n';

const Ctx = createContext(null);
const KEY = 'lang';

function detect() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && dict[saved]) return saved;
  } catch {}
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'ro';
  const short = nav.slice(0, 2).toLowerCase();
  return dict[short] ? short : 'ro';
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState('ro');

  useEffect(() => {
    setLangState(detect());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {}
  }, []);

  const t = useCallback(
    (k, vars) => {
      let s = dict[lang]?.[k] ?? dict.ro[k] ?? k;
      if (vars) for (const [name, v] of Object.entries(vars)) s = s.replace(`{${name}}`, v);
      return s;
    },
    [lang]
  );

  // tx: valori care nu sunt text (ex. lista FAQ)
  const tx = useCallback((k) => dict[lang]?.[k] ?? dict.ro[k], [lang]);

  return <Ctx.Provider value={{ lang, setLang, t, tx }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}

export function LangSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <div className="lang" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          className={l.code === lang ? 'on' : ''}
          aria-pressed={l.code === lang}
          onClick={() => setLang(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
