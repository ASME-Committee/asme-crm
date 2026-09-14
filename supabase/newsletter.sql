-- ASME CRM — newsletters (run once in the Supabase SQL Editor, after team.sql).
-- Stores each issue and its link to the Kit broadcast. Content is a jsonb block
-- array; Kit holds the sent email + stats.
-- Safe to re-run.

create table if not exists public.newsletters (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  preview_text text,
  blocks jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft', 'sent')),
  kit_broadcast_id text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.newsletters enable row level security;
grant select, insert, update, delete on public.newsletters to authenticated;

drop policy if exists "team read newsletters" on public.newsletters;
create policy "team read newsletters" on public.newsletters for select to authenticated using (public.crm_is_member());
drop policy if exists "team insert newsletters" on public.newsletters;
create policy "team insert newsletters" on public.newsletters for insert to authenticated with check (public.crm_is_member());
drop policy if exists "team update newsletters" on public.newsletters;
create policy "team update newsletters" on public.newsletters for update to authenticated using (public.crm_is_member()) with check (public.crm_is_member());
drop policy if exists "team delete newsletters" on public.newsletters;
create policy "team delete newsletters" on public.newsletters for delete to authenticated using (public.crm_is_admin());
