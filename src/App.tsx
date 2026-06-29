import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { LoginPage } from "@/auth/LoginPage";
import { MembersPage } from "@/pages/MembersPage";

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
  return <MembersPage session={session} />;
}
