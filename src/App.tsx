import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAccess } from "@/lib/access";
import { AccessContext } from "@/lib/access-context";
import { LoginPage } from "@/auth/LoginPage";
import { AccessDenied } from "@/auth/AccessDenied";
import { Layout } from "@/components/Layout";
import { DashboardPage } from "@/pages/DashboardPage";
import { MembersPage } from "@/pages/MembersPage";
import { EnquiriesPage } from "@/pages/EnquiriesPage";
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
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="enquiries" element={<EnquiriesPage />} />
            <Route path="website" element={<WebsitePage />} />
            <Route path="team" element={<TeamPage session={session} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AccessContext.Provider>
  );
}
