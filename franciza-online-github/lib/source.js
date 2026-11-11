// De unde a venit candidatul: reclamă / rețea socială / Google / direct.
// Funcțiile pure de aici rulează și în browser, și pe server.

const KEY = 'lead_source';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const CLICK_IDS = { fbclid: 'facebook', gclid: 'google', gbraid: 'google', wbraid: 'google', ttclid: 'tiktok' };

export const CHANNELS = ['facebook', 'instagram', 'tiktok', 'google', 'telegram', 'viber', 'youtube', 'direct', 'other'];

// ---------- browser: salvăm sursa la prima intrare pe site ----------
export function captureSource() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const data = {};
    for (const k of UTM_KEYS) {
      const v = url.searchParams.get(k);
      if (v) data[k] = v;
    }
    for (const k of Object.keys(CLICK_IDS)) if (url.searchParams.get(k)) data.click = k;
    const ref = document.referrer;
    if (ref && !ref.startsWith(window.location.origin)) data.ref = ref;
    const app = appFromUserAgent(navigator.userAgent);
    if (app) data.app = app;

    // Păstrăm ultima sursă „reală”; o intrare directă nu o suprascrie pe cea din reclamă.
    if (Object.keys(data).length) {
      data.landing = url.pathname + url.search;
      data.at = new Date().toISOString();
      localStorage.setItem(KEY, JSON.stringify(data));
    }
  } catch {}
}

export function readSource() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

function appFromUserAgent(ua = '') {
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return 'facebook';
  if (/musical_ly|TikTok|BytedanceWebview/i.test(ua)) return 'tiktok';
  if (/Viber/i.test(ua)) return 'viber';
  return null;
}

// ---------- server: curățăm datele venite din browser ----------
export function cleanSource(input) {
  if (!input || typeof input !== 'object') return null;
  const out = {};
  for (const k of [...UTM_KEYS, 'ref', 'landing', 'app', 'click']) {
    const v = input[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 300);
  }
  if (out.click && !CLICK_IDS[out.click]) delete out.click;
  if (out.app && !['instagram', 'facebook', 'tiktok', 'viber'].includes(out.app)) delete out.app;
  return Object.keys(out).length ? out : null;
}

// ---------- canal + dacă e reclamă ----------
function channelFromText(s = '') {
  const v = s.toLowerCase();
  if (/insta|^ig$|^ig[_-]/.test(v)) return 'instagram';
  if (/facebook|^fb$|^fb[_-]|^meta/.test(v)) return 'facebook';
  if (/tiktok|^tt$/.test(v)) return 'tiktok';
  if (/google|gads|adwords/.test(v)) return 'google';
  if (/telegram|^tg$|t\.me/.test(v)) return 'telegram';
  if (/viber/.test(v)) return 'viber';
  if (/youtube|youtu\.be/.test(v)) return 'youtube';
  return null;
}

export function detectChannel(utm) {
  if (!utm) return { channel: 'direct', paid: false };
  const medium = (utm.utm_medium || '').toLowerCase();
  // gclid / ttclid apar doar la reclame; fbclid îl pune Facebook și pe postările obișnuite.
  const paid = ['gclid', 'gbraid', 'wbraid', 'ttclid'].includes(utm.click) || /cpc|ppc|paid|ads?$|cpm|sponsored/.test(medium);
  let channel = null;
  if (utm.utm_source) channel = channelFromText(utm.utm_source) || 'other';
  if (!channel && utm.click) channel = CLICK_IDS[utm.click];
  if (!channel && utm.app) channel = utm.app;
  if (!channel && utm.ref) {
    try {
      channel = channelFromText(new URL(utm.ref).hostname) || 'other';
    } catch {
      channel = 'other';
    }
  }
  return { channel: channel || 'direct', paid };
}

// Etichetele traduse pentru sourceText(), dintr-o funcție t() de traducere.
export function sourceLabels(t) {
  return {
    ...Object.fromEntries(CHANNELS.map((c) => [c, t('src_' + c)])),
    paid: t('src_paid'),
    campaign: t('src_campaign'),
  };
}

// Text scurt pentru oameni: „Facebook (reclamă) · campania vara2026”
export function sourceText(source, utm, labels = {}) {
  const name = labels[source] || source || '—';
  const { paid } = detectChannel(utm);
  let s = name + (paid ? ` (${labels.paid || 'reclamă'})` : '');
  if (utm?.utm_campaign) s += ` · ${labels.campaign || 'campania'} ${utm.utm_campaign}`;
  if (source === 'other' && utm?.ref) {
    try {
      s += ` · ${new URL(utm.ref).hostname}`;
    } catch {}
  } else if (source === 'other' && utm?.utm_source) s += ` · ${utm.utm_source}`;
  return s;
}
