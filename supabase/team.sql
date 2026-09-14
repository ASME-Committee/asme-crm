-- ASME CRM — team management (Phase 3). Run once in the Supabase SQL Editor.
--
-- Introduces a `crm_team` allowlist that decides who can use the CRM and what
-- they can do. Access is enforced in the database (row-level security), not just
-- the UI, so a random Supabase sign-up can never read member data — only people
-- an admin has added here can.
--
-- Roles:
--   admin  — full access + manage the team (invite, change role, deactivate)
--   editor — read + set member status; read enquiries
--   viewer — read-only
--
-- Safe to re-run.

-- 1. The allowlist.
create table if not exists public.crm_team (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null default 'editor' check (role in ('admin', 'editor', 'viewer')),
  active boolean not null default true,
  invited_by text,
  created_at timestamptz not null default now()
);
alter table public.crm_team enable row level security;
grant select, insert, update, delete on public.crm_team to authenticated;

-- 2. Helper functions (security definer so they read crm_team without tripping
--    its own row-level security, and without recursion).
create or replace function public.crm_is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.crm_team
    where lower(email) = lower(auth.jwt() ->> 'email') and active
  );
$$;
create or replace function public.crm_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.crm_team
    where lower(email) = lower(auth.jwt() ->> 'email') and active and role = 'admin'
  );
$$;

-- 3. crm_team policies: any signed-in user can read the roster; only admins can
--    change it.
drop policy if exists "team read" on public.crm_team;
create policy "team read" on public.crm_team for select to authenticated using (true);
drop policy if exists "team admin insert" on public.crm_team;
create policy "team admin insert" on public.crm_team for insert to authenticated with check (public.crm_is_admin());
drop policy if exists "team admin update" on public.crm_team;
create policy "team admin update" on public.crm_team for update to authenticated using (public.crm_is_admin()) with check (public.crm_is_admin());
drop policy if exists "team admin delete" on public.crm_team;
create policy "team admin delete" on public.crm_team for delete to authenticated using (public.crm_is_admin());

-- 4. Seed the first admin. CHANGE THIS EMAIL if the first admin is someone else.
insert into public.crm_team (email, role, active, invited_by)
values ('anu.ganugapati@gmail.com', 'admin', true, 'seed')
on conflict (email) do update set role = 'admin', active = true;

-- 5. Tighten member-data access to active team members only (replaces the
--    "any authenticated user" policies from crm-policies.sql).
drop policy if exists "authenticated read memberships" on public.memberships;
drop policy if exists "team read memberships" on public.memberships;
create policy "team read memberships" on public.memberships for select to authenticated using (public.crm_is_member());

drop policy if exists "authenticated update memberships" on public.memberships;
drop policy if exists "team update memberships" on public.memberships;
create policy "team update memberships" on public.memberships for update to authenticated using (public.crm_is_member()) with check (public.crm_is_member());

drop policy if exists "authenticated read contact_messages" on public.contact_messages;
drop policy if exists "team read contact_messages" on public.contact_messages;
create policy "team read contact_messages" on public.contact_messages for select to authenticated using (public.crm_is_member());
