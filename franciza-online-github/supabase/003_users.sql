-- Actualizare (11.11.2026): conturi pentru echipă + cine a schimbat statusul unei cereri.
-- Rulează o singură dată în Supabase → SQL Editor.

create table if not exists public.admin_users (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  email          text not null unique check (char_length(email) between 5 and 120),
  name           text not null check (char_length(name) between 2 and 80),
  password_hash  text not null,                                   -- scrypt, niciodată parola în clar
  role           text not null default 'member' check (role in ('admin', 'member')),
  status         text not null default 'pending' check (status in ('pending', 'active', 'disabled')),
  approved_by    text,
  last_login     timestamptz
);

-- La fel ca la cereri: RLS fără politici => doar serverul (cheia secretă) are acces.
alter table public.admin_users enable row level security;

alter table public.leads add column if not exists updated_by text;
