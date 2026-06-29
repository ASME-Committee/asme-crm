-- ASME membership / CRM schema.
-- Run this in the new ASME Supabase project: SQL Editor -> paste -> Run.
-- The public website (/api/join) inserts rows here with the service_role key
-- (which bypasses RLS). The CRM dashboard reads/updates rows as an
-- authenticated user.

create table if not exists public.members (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  full_name    text not null,
  email        text not null,
  role         text,
  specialty    text,
  city         text,
  linkedin_url text,
  message      text,
  source       text default 'website',
  status       text not null default 'new'
    check (status in ('new','contacted','member','declined','paused')),
  notes        text
);

-- One application per email (case-insensitive). The website treats a
-- duplicate insert (Postgres error 23505) as a successful re-application.
create unique index if not exists members_email_unique
  on public.members (lower(email));

create index if not exists members_status_idx on public.members (status);
create index if not exists members_created_at_idx on public.members (created_at desc);

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists members_set_updated_at on public.members;
create trigger members_set_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.members enable row level security;

-- Authenticated CRM users have full read/write. Inserts from the website use
-- the service_role key and bypass RLS, so there is intentionally no anon policy.
drop policy if exists "authenticated read members"   on public.members;
drop policy if exists "authenticated update members" on public.members;
drop policy if exists "authenticated delete members" on public.members;

create policy "authenticated read members"
  on public.members for select to authenticated using (true);

create policy "authenticated update members"
  on public.members for update to authenticated using (true) with check (true);

create policy "authenticated delete members"
  on public.members for delete to authenticated using (true);
