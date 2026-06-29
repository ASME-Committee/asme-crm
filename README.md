# ASME CRM

Internal members CRM for the Australian Society for Medical Entrepreneurship &
Innovation. Reads the membership applications submitted through the website's
"Join the community" form (which writes to the same Supabase `members` table).

- **Stack:** Vite + React + TypeScript + Tailwind, Supabase (Postgres + Auth).
- **Hosting:** Vercel.
- **Auth:** Supabase email/password. Create committee accounts in the Supabase
  dashboard under Authentication → Users (there is no public sign-up).

## One-time setup

1. **Create the Supabase project** (new ASME account/org), then run
   [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor.
2. **Create login accounts**: Supabase dashboard → Authentication → Users → Add user
   (set "Auto Confirm" so they can sign in immediately).
3. **Env vars** — copy `.env.example` to `.env` and fill in:
   - `VITE_SUPABASE_URL` — Project URL (Settings → API)
   - `VITE_SUPABASE_ANON_KEY` — anon public key (Settings → API)
4. The website repo (`asme-site`) needs `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` set so its `/api/join` route can insert rows.

## Develop

```bash
npm install
npm run dev
```

## Deploy (Vercel)

Import this repo in Vercel (framework preset: Vite). Add the two `VITE_…`
env vars in Project Settings → Environment Variables. `vercel.json` already
configures the build and SPA rewrites.

## Data flow

```
website "Join" form  ──POST /api/join──▶  Supabase members table  ◀──reads/edits──  this CRM
   (asme-site, Next.js)   service_role key                            anon key + Auth
```
