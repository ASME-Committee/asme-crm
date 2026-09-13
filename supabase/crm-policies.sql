-- ASME CRM access policies.
--
-- Run this once in the Supabase SQL Editor (the same project the website forms
-- write to). It lets signed-in CRM users READ members + enquiries and set a
-- workflow status on members, while the public website keeps INSERT-only access
-- and can still never READ anyone's data.
--
-- Safe to re-run: every statement is idempotent.

-- 1. Workflow status on memberships. Nullable: rows created by the website have
--    no status and the CRM treats null as "new".
alter table public.memberships add column if not exists status text;

-- 2. Table privileges for the signed-in (authenticated) role.
grant select, update on public.memberships to authenticated;
grant select on public.contact_messages to authenticated;

-- 3. Row-level security policies for the authenticated role. RLS is already on
--    both tables (insert-only for anon); these add read/update for signed-in
--    committee members. Drop-then-create so re-running never errors.
drop policy if exists "authenticated read memberships" on public.memberships;
create policy "authenticated read memberships"
  on public.memberships for select to authenticated using (true);

drop policy if exists "authenticated update memberships" on public.memberships;
create policy "authenticated update memberships"
  on public.memberships for update to authenticated using (true) with check (true);

drop policy if exists "authenticated read contact_messages" on public.contact_messages;
create policy "authenticated read contact_messages"
  on public.contact_messages for select to authenticated using (true);
