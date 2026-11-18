-- Actualizare (ДЗ №2, punctul 1): CRM cu pâlnie de vânzări + istoricul etapelor.
-- Rulează o singură dată în Supabase → SQL Editor → New query → lipește → Run.
-- Datele existente rămân; cererile vechi primesc etapa după statusul lor.

-- 1. Etapa din pâlnie, de unde a intrat clientul (Site / Manual / Telegram / Document) și notițe
alter table public.leads add column if not exists stage text not null default 'cereri';
alter table public.leads add column if not exists origin text not null default 'site';
alter table public.leads add column if not exists notes text;
alter table public.leads add column if not exists telegram_id bigint;   -- pentru Mini App (punctul 3–4)

alter table public.leads drop constraint if exists leads_stage_check;
alter table public.leads add constraint leads_stage_check
  check (stage in ('cereri', 'discutie', 'interviu', 'inregistrat', 'training', 'francizat', 'respins'));

alter table public.leads drop constraint if exists leads_origin_check;
alter table public.leads add constraint leads_origin_check
  check (origin in ('site', 'manual', 'telegram', 'document'));

alter table public.leads drop constraint if exists leads_notes_check;
alter table public.leads add constraint leads_notes_check check (char_length(notes) <= 5000);

-- Cererile vechi: statusul de până acum → etapa
update public.leads set stage = case status
  when 'in_progress' then 'discutie'
  when 'closed'      then 'respins'
  else 'cereri' end
where stage = 'cereri' and status <> 'new';

create index if not exists leads_stage_idx on public.leads (stage);

-- 2. Un client adăugat manual (după un apel sau o întâlnire) are de obicei doar nume și telefon,
--    deci restul întrebărilor din formular devin opționale în baza de date.
--    Formularul de pe site le cere în continuare pe toate (verificarea din lib/form.js).
alter table public.leads alter column email         drop not null;
alter table public.leads alter column city          drop not null;
alter table public.leads alter column age           drop not null;
alter table public.leads alter column hours         drop not null;
alter table public.leads alter column exp_tourism   drop not null;
alter table public.leads alter column exp_sales     drop not null;
alter table public.leads alter column experience    drop not null;
alter table public.leads alter column attraction    drop not null;
alter table public.leads alter column budget        drop not null;
alter table public.leads alter column budget_source drop not null;
alter table public.leads alter column start_when    drop not null;

-- 3. Istoricul: crearea cererii și fiecare trecere între etape, cu data și cine a făcut-o
create table if not exists public.lead_history (
  id          bigint generated always as identity primary key,
  lead_id     bigint not null references public.leads(id) on delete cascade,
  created_at  timestamptz not null default now(),
  from_stage  text,            -- null = cererea tocmai a fost creată
  to_stage    text not null,
  by_name     text             -- cine a mutat-o (null = automat, de pe site / din Telegram)
);

create index if not exists lead_history_lead_idx on public.lead_history (lead_id, created_at);

-- Cererile vechi primesc istoric: crearea (cu data reală) și, dacă nu mai sunt în „Cereri”, mutarea
with missing as (
  select l.* from public.leads l
  where not exists (select 1 from public.lead_history h where h.lead_id = l.id)
), created as (
  insert into public.lead_history (lead_id, created_at, from_stage, to_stage)
  select id, created_at, null, 'cereri' from missing
  returning 1
)
insert into public.lead_history (lead_id, created_at, from_stage, to_stage, by_name)
select id, coalesce(updated_at, created_at), 'cereri', stage, updated_by
from missing
where stage <> 'cereri';

-- La fel ca la celelalte tabele: RLS fără politici => doar serverul (cheia secretă) are acces.
alter table public.lead_history enable row level security;
