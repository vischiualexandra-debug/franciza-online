-- Actualizare (11.11.2026): de unde a venit candidatul.
-- Rulează o singură dată în Supabase → SQL Editor, dacă tabelul `leads` exista deja.

alter table public.leads add column if not exists source text;   -- facebook / instagram / tiktok / google / telegram / viber / youtube / direct / other
alter table public.leads add column if not exists utm jsonb;     -- utm_source, utm_medium, utm_campaign, utm_content, utm_term, ref, landing, app, click

create index if not exists leads_source_idx on public.leads (source);
