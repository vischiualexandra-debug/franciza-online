-- Actualizare (ДЗ №2, punctul 2): contracte și facturi recunoscute de Claude → lista de plăți.
-- Rulează o singură dată în Supabase → SQL Editor → New query → lipește → Run.

-- 1. Plăți (din contracte de franciză, facturi, acte adiționale)
create table if not exists public.payments (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  created_by     text,

  direction      text not null default 'in' check (direction in ('in', 'out')),  -- in = ne plătește francizatul; out = plătim noi
  counterparty   text not null check (char_length(counterparty) between 2 and 200),
  doc_kind       text not null default 'contract' check (doc_kind in ('contract', 'invoice', 'act', 'other')),
  doc_number     text check (char_length(doc_number) <= 60),
  doc_date       date,
  description    text check (char_length(description) <= 500),
  amount         numeric(12, 2) not null check (amount > 0),
  currency       text not null default 'MDL' check (currency in ('MDL', 'EUR', 'USD', 'RON')),
  due_date       date,

  status         text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  paid_at        timestamptz,
  paid_by        text,

  lead_id        bigint references public.leads(id) on delete set null,  -- francizatul din CRM (opțional)
  document_path  text not null,                                          -- originalul, în Storage (bucket „documents”)
  document_type  text not null
);

create index if not exists payments_status_due_idx on public.payments (status, due_date);
create index if not exists payments_lead_idx on public.payments (lead_id);

-- Ca la celelalte tabele: RLS fără politici => doar serverul (cheia secretă) are acces.
alter table public.payments enable row level security;

-- 2. Bucket privat pentru originale. Fără politici => browserul nu le poate citi direct;
--    în admin originalul se deschide printr-un link temporar, generat pe server după verificarea login-ului.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
on conflict (id) do nothing;
