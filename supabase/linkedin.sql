-- ASME CRM — LinkedIn content calendar (run once in the Supabase SQL Editor,
-- after team.sql). One row per ASME LinkedIn post: its copy, schedule, status
-- and tagging. Plan-and-track only — nothing here publishes to LinkedIn.
-- Safe to re-run.

-- 1. Helper: may the signed-in user edit? (admins and editors, not viewers).
--    Same shape as crm_is_member()/crm_is_admin() in team.sql.
create or replace function public.crm_can_edit()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.crm_team
    where lower(email) = lower(auth.jwt() ->> 'email') and active
      and role in ('admin', 'editor')
  );
$$;

-- 2. The posts table.
create table if not exists public.linkedin_posts (
  id uuid primary key default gen_random_uuid(),
  post_code text unique,                       -- e.g. ASME-2026-073
  hook text,                                   -- opening line
  body text not null default '',               -- full post copy
  status text not null default 'idea'
    check (status in ('idea', 'draft', 'approved', 'scheduled', 'posted')),
  scheduled_at timestamptz,                    -- null = unscheduled backlog
  -- Pillar and personas are plain text (validated by the page) so a new
  -- pillar is a code change, not a database migration.
  pillar text,
  primary_persona text,
  secondary_personas text[] not null default '{}',
  hashtags text[] not null default '{}',
  cta_type text,
  cta_link text,
  source text,                                 -- where the idea came from
  notes text,                                  -- reviewer notes, people to tag
  media_url text,                              -- link to the visual
  linkedin_url text,                           -- the live post, once it's up
  notion_page_id text unique,                  -- set by the one-off Notion import
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists linkedin_posts_scheduled_at_idx
  on public.linkedin_posts (scheduled_at);

-- 3. Keep updated_at current on every edit.
create or replace function public.linkedin_posts_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists linkedin_posts_touch on public.linkedin_posts;
create trigger linkedin_posts_touch before update on public.linkedin_posts
  for each row execute function public.linkedin_posts_touch();

-- 4. Row-level security: team reads; editors and admins add, edit and delete.
alter table public.linkedin_posts enable row level security;
grant select, insert, update, delete on public.linkedin_posts to authenticated;

drop policy if exists "team read linkedin_posts" on public.linkedin_posts;
create policy "team read linkedin_posts" on public.linkedin_posts
  for select to authenticated using (public.crm_is_member());
drop policy if exists "editors insert linkedin_posts" on public.linkedin_posts;
create policy "editors insert linkedin_posts" on public.linkedin_posts
  for insert to authenticated with check (public.crm_can_edit());
drop policy if exists "editors update linkedin_posts" on public.linkedin_posts;
create policy "editors update linkedin_posts" on public.linkedin_posts
  for update to authenticated using (public.crm_can_edit()) with check (public.crm_can_edit());
drop policy if exists "admins delete linkedin_posts" on public.linkedin_posts;  -- earlier admin-only version
drop policy if exists "editors delete linkedin_posts" on public.linkedin_posts;
create policy "editors delete linkedin_posts" on public.linkedin_posts
  for delete to authenticated using (public.crm_can_edit());
