import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { LoginPage } from "@/auth/LoginPage";
import { Layout } from "@/components/Layout";
import { DashboardPage } from "@/pages/DashboardPage";
import { MembersPage } from "@/pages/MembersPage";
import { EnquiriesPage } from "@/pages/EnquiriesPage";
import { TeamPage } from "@/pages/TeamPage";
import { WebsitePage } from "@/pages/WebsitePage";

/**
 * HashRouter (not BrowserRouter) because the CRM is a static SPA on GitHub
 * Pages, which has no server to rewrite deep links back to index.html. Hash
 * routing keeps every route working on a refresh without a 404 fallback hack.
 */
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }

  if (!session) return <LoginPage />;

  return (
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
  );
}
