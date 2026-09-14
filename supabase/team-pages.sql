-- ASME CRM — per-page sharing + invite status (run once in the Supabase SQL Editor).
-- Extends crm_team so admins can grant each member only certain pages, and so the
-- roster can show who has actually signed in ("Active") vs still invited.
-- Safe to re-run.

-- Which pages a non-admin may see. NULL = all pages (admins ignore this and see
-- everything). Values are page keys: dashboard, members, enquiries, website.
alter table public.crm_team add column if not exists pages text[];

-- Stamped the first time a member signs in, so the roster can show Active vs Invited.
alter table public.crm_team add column if not exists last_seen_at timestamptz;

-- Let a signed-in member mark themselves seen without being able to touch any
-- other column (security definer bypasses the admin-only write policy for just
-- this one field).
create or replace function public.crm_mark_seen()
returns void language sql security definer set search_path = public as $$
  update public.crm_team set last_seen_at = now()
  where lower(email) = lower(auth.jwt() ->> 'email') and active;
$$;
grant execute on function public.crm_mark_seen() to authenticated;
