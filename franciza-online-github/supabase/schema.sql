-- Rulează o singură dată în Supabase: SQL Editor → New query → lipește → Run.
-- Cereri de la persoanele interesate de Franciza Online Panda Tour.

create table if not exists public.leads (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz,
  status         text not null default 'new'
                 check (status in ('new', 'in_progress', 'closed')),  -- новая / в работе / закрыта

  name           text not null check (char_length(name) between 3 and 80),
  phone          text not null check (char_length(phone) between 7 and 30),
  email          text not null check (char_length(email) between 5 and 120),
  city           text not null check (char_length(city) between 2 and 80),
  age            smallint not null check (age between 16 and 99),
  hours          text not null,          -- '3-4' | '7-8' | text propriu
  exp_tourism    boolean not null,
  exp_sales      boolean not null,
  experience     text not null check (char_length(experience) between 10 and 2000),
  attraction     text not null check (attraction in ('tourism', 'flexible', 'income', 'brand')),
  budget         text not null check (budget in ('under_500', '500_1000', '1000_5000', 'over_5000')),
  budget_source  text not null,          -- 'savings' | 'family' | 'credit' | text propriu
  start_when     text not null,          -- 'now' | 'month' | '2_3_months' | text propriu
  comment        text check (char_length(comment) <= 1000),
  lang           text check (lang in ('ro', 'ru', 'en')),
  source         text,                   -- facebook / instagram / tiktok / google / … / direct / other
  utm            jsonb                   -- utm_*, ref, landing, app, click
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_source_idx on public.leads (source);

-- Securitate: RLS pornit și FĂRĂ politici => cheile publice (anon / publishable)
-- nu pot citi și nici scrie nimic. Doar serverul site-ului (cu cheia secretă din Vercel) are acces.
alter table public.leads enable row level security;
