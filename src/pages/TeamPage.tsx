import type { Session } from "@supabase/supabase-js";
import { Page, PageHeader, Card } from "@/components/ui";

/**
 * Phase 3 will add in-app team management (invite committee members, set roles
 * and per-section permissions) via a Supabase Edge Function using the service
 * key — the same RBAC pattern as the StatDoctor CRM. Until then, accounts are
 * created in the Supabase dashboard, and everyone who can sign in has full
 * access.
 */
export function TeamPage({ session }: { session: Session }) {
  return (
    <Page>
      <PageHeader title="Team" subtitle="Who can access the ASME CRM" />

      <Card className="mb-6 p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Signed in as
        </div>
        <div className="mt-1 text-sm font-medium text-ink">{session.user.email}</div>
      </Card>

      <Card className="p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-wash text-brand-deep">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-ink">Invite-based team management — coming in Phase 3</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Roles and in-app invites are next. For now, add a committee member by creating them in the
          Supabase dashboard: <span className="font-medium text-slate-700">Authentication → Users → Add user</span>,
          then share the CRM link. Anyone with an account has full access.
        </p>
      </Card>
    </Page>
  );
}
