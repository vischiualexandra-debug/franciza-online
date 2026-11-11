'use client';

import { useEffect, useState } from 'react';
import { useI18n } from './I18n';
import { SITE } from '@/lib/site';

// Butoane de chat (Telegram / Viber) + bara „Aplică” fixă jos pe telefon.
// Bara se ascunde cât timp e vizibil hero-ul sau formularul (acolo butonul există deja).
export default function FloatingActions() {
  const { t } = useI18n();
  const [hideBar, setHideBar] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const targets = [document.querySelector('.hero'), document.getElementById('form'), document.querySelector('.footer')].filter(Boolean);
    if (!targets.length || !('IntersectionObserver' in window)) {
      setHideBar(false);
      return;
    }
    const visible = new Set();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target);
          else visible.delete(e.target);
        }
        setHideBar(visible.size > 0);
      },
      { threshold: 0.15 }
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <>
      {/* Chat: buton rotund, se deschide în Telegram / Viber */}
      <div className={`chat-fab${open ? ' open' : ''}${hideBar ? '' : ' with-bar'}`}>
        {open && (
          <div className="chat-menu" role="menu">
            <p>{t('chat_title')}</p>
            <a href={SITE.chat.telegram} target="_blank" rel="noopener" className="chat-link tg" role="menuitem">
              <TelegramIcon /> Telegram
            </a>
            <a href={SITE.chat.viber} target="_blank" rel="noopener" className="chat-link vb" role="menuitem">
              <ViberIcon /> Viber
            </a>
          </div>
        )}
        <button
          type="button"
          className="chat-toggle"
          aria-expanded={open}
          aria-label={t('chat_title')}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <span aria-hidden>✕</span> : <ChatIcon />}
        </button>
      </div>

      {/* Bara fixă de jos — doar pe telefon (vezi CSS) */}
      <div className={`sticky-apply${hideBar ? ' hidden' : ''}`} aria-hidden={hideBar}>
        <a href="#form" className="btn btn-accent btn-block" tabIndex={hideBar ? -1 : 0}>
          {t('sticky_apply')} →
        </a>
      </div>
    </>
  );
}

function ChatIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5v-8Z"
        fill="currentColor"
      />
      <circle cx="8.5" cy="9.5" r="1.2" fill="#0b87bd" />
      <circle cx="12" cy="9.5" r="1.2" fill="#0b87bd" />
      <circle cx="15.5" cy="9.5" r="1.2" fill="#0b87bd" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#29a9eb" />
      <path
        d="M5.4 11.7 16.9 7.3c.53-.2 1 .13.83.93l-1.96 9.23c-.15.66-.54.82-1.09.51l-3-2.21-1.45 1.4c-.16.16-.3.29-.6.29l.21-3.06 5.57-5.03c.24-.21-.05-.33-.38-.12l-6.88 4.33-2.96-.92c-.65-.2-.66-.65.13-.96Z"
        fill="#fff"
      />
    </svg>
  );
}

function ViberIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#7360f2" />
      <path
        d="M9.2 7.1c-.3-.3-.8-.3-1.1 0l-.7.7c-.6.6-.7 1.6-.2 2.6 1.3 2.6 3.4 4.7 6 6 .9.5 2 .4 2.6-.2l.7-.7c.3-.3.3-.8 0-1.1l-1.6-1.4c-.3-.3-.8-.3-1.1 0l-.6.6c-1.3-.6-2.4-1.7-3-3l.6-.6c.3-.3.3-.8 0-1.1L9.2 7.1Z"
        fill="#fff"
      />
    </svg>
  );
}
