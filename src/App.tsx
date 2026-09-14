import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { ReactNode } from "react";
import { useAccess, canSeePage, firstAllowedPath, type PageKey } from "@/lib/access";
import { AccessContext, useCurrentAccess } from "@/lib/access-context";
import { LoginPage } from "@/auth/LoginPage";
import { AccessDenied } from "@/auth/AccessDenied";
import { Layout } from "@/components/Layout";
import { DashboardPage } from "@/pages/DashboardPage";
import { MembersPage } from "@/pages/MembersPage";
import { EnquiriesPage } from "@/pages/EnquiriesPage";
import { NewsletterPage } from "@/pages/NewsletterPage";
import { TeamPage } from "@/pages/TeamPage";
import { WebsitePage } from "@/pages/WebsitePage";

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) return <Splash />;
  if (!session) return <LoginPage />;
  return <AuthedApp session={session} />;
}

function Splash() {
  return (
    <div className="flex h-full items-center justify-center text-slate-400">Loading…</div>
  );
}

/**
 * Once signed in, resolve the user's team access before showing the CRM. A
 * signed-in user who is not on the team (crm_team) is shown Access Denied, so
 * the database RLS and the UI agree on who gets in.
 */
function AuthedApp({ session }: { session: Session }) {
  const access = useAccess(session);

  if (access.loading) return <Splash />;
  if (!access.allowed) {
    return <AccessDenied email={access.email} onSignOut={() => supabase.auth.signOut()} />;
  }

  return (
    <AccessContext.Provider value={access}>
      <HashRouter>
        <Routes>
          <Route element={<Layout session={session} />}>
            <Route index element={<IndexRedirect />} />
            <Route path="dashboard" element={<PageGuard page="dashboard"><DashboardPage /></PageGuard>} />
            <Route path="members" element={<PageGuard page="members"><MembersPage /></PageGuard>} />
            <Route path="enquiries" element={<PageGuard page="enquiries"><EnquiriesPage /></PageGuard>} />
            <Route path="newsletter" element={<PageGuard page="newsletter"><NewsletterPage /></PageGuard>} />
            <Route path="website" element={<PageGuard page="website"><WebsitePage /></PageGuard>} />
            <Route path="team" element={<AdminGuard><TeamPage session={session} /></AdminGuard>} />
            <Route path="*" element={<IndexRedirect />} />
          </Route>
        </Routes>
      </HashRouter>
    </AccessContext.Provider>
  );
}

function IndexRedirect() {
  const access = useCurrentAccess();
  return <Navigate to={firstAllowedPath(access)} replace />;
}

/** Gate a page by the member's shared-pages list; bounce to their first page. */
function PageGuard({ page, children }: { page: PageKey; children: ReactNode }) {
  const access = useCurrentAccess();
  return canSeePage(access, page) ? <>{children}</> : <Navigate to={firstAllowedPath(access)} replace />;
}

function AdminGuard({ children }: { children: ReactNode }) {
  const access = useCurrentAccess();
  return access.role === "admin" ? <>{children}</> : <Navigate to={firstAllowedPath(access)} replace />;
}
