import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { ROLES, ROLE_LABEL, ROLE_HINT, canManageTeam, type Role } from "@/lib/access";
import { useCurrentAccess } from "@/lib/access-context";
import { Page, PageHeader, Card, Button, ErrorBanner, EmptyRow } from "@/components/ui";

type TeamMember = {
  id: string;
  email: string;
  role: Role;
  active: boolean;
  invited_by: string | null;
  created_at: string;
};

export function TeamPage({ session }: { session: Session }) {
  const access = useCurrentAccess();
  const isAdmin = canManageTeam(access.role);

  const [rows, setRows] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [inviting, setInviting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("crm_team")
      .select("id, email, role, active, invited_by, created_at")
      .order("created_at", { ascending: true });
    if (error) setError(error.message);
    else setRows((data ?? []) as TeamMember[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    setError(null);
    setNotice(null);
    setInviting(true);

    // 1. Add them to the allowlist (this is what grants access).
    const { error } = await supabase
      .from("crm_team")
      .insert({ email: clean, role, active: true, invited_by: session.user.email });
    if (error) {
      setInviting(false);
      setError(error.code === "23505" ? "That email is already on the team." : error.message);
      return;
    }

    // 2. Email them a sign-in link so they can set up access without a password.
    //    If the mail can't send (e.g. Supabase email rate limit), they're still
    //    on the team and can request a link themselves from the login screen.
    const redirect = window.location.origin + window.location.pathname;
    const { error: mailErr } = await supabase.auth.signInWithOtp({
      email: clean,
      options: { shouldCreateUser: true, emailRedirectTo: redirect },
    });
    setInviting(false);
    setNotice(
      mailErr
        ? `${clean} was added, but the invite email didn't send (${mailErr.message}). They can still sign in via "Email me a sign-in link".`
        : `Invited ${clean} — we emailed them a sign-in link.`,
    );

    setEmail("");
    setRole("editor");
    load();
  }

  async function updateMember(id: string, patch: Partial<Pick<TeamMember, "role" | "active">>) {
    setError(null);
    const prev = rows;
    setRows((r) => r.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    const { error } = await supabase.from("crm_team").update(patch).eq("id", id);
    if (error) {
      setError(error.message);
      setRows(prev);
    }
  }

  async function remove(id: string) {
    setError(null);
    const prev = rows;
    setRows((r) => r.filter((m) => m.id !== id));
    const { error } = await supabase.from("crm_team").delete().eq("id", id);
    if (error) {
      setError(error.message);
      setRows(prev);
    }
  }

  const selfEmail = (session.user.email ?? "").toLowerCase();
  const adminCount = useMemo(
    () => rows.filter((m) => m.role === "admin" && m.active).length,
    [rows],
  );

  return (
    <Page>
      <PageHeader
        title="Team"
        subtitle={isAdmin ? "Manage who can access the ASME CRM" : "Your CRM access"}
      />

      {access.setupPending && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Team setup isn't complete yet. Run <code>supabase/team.sql</code> in Supabase to enable
          roles and lock access to the team list below.
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {isAdmin && (
        <Card className="mb-6 p-5">
          <h2 className="text-sm font-semibold text-ink">Invite a team member</h2>
          <p className="mt-1 text-sm text-slate-500">
            Add their email and role. We email them a secure sign-in link so they can set up access
            with no password. They can also request a link themselves from the login screen.
          </p>
          <form onSubmit={invite} className="mt-4 flex flex-wrap items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full min-w-[14rem] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="primary" disabled={inviting}>
              {inviting ? "Adding…" : "Add member"}
            </Button>
          </form>
          <p className="mt-3 text-xs text-slate-400">
            {ROLES.map((r) => `${ROLE_LABEL[r]}: ${ROLE_HINT[r]}`).join("  ·  ")}
          </p>
          {notice && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {notice}
            </p>
          )}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {isAdmin && <th className="px-4 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <EmptyRow colSpan={isAdmin ? 4 : 3} text="Loading…" />
              ) : rows.length === 0 ? (
                <EmptyRow colSpan={isAdmin ? 4 : 3} text="No team members yet." />
              ) : (
                rows.map((m) => {
                  const isSelf = m.email.toLowerCase() === selfEmail;
                  const lastAdmin = m.role === "admin" && m.active && adminCount <= 1;
                  return (
                    <tr key={m.id}>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900">{m.email}</span>
                        {isSelf && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isAdmin && !lastAdmin ? (
                          <select
                            value={m.role}
                            onChange={(e) => updateMember(m.id, { role: e.target.value as Role })}
                            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABEL[r]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-slate-600">{ROLE_LABEL[m.role]}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            m.active
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                              : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                          }`}
                        >
                          {m.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateMember(m.id, { active: !m.active })}
                              disabled={lastAdmin}
                              className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40"
                              title={lastAdmin ? "Can't deactivate the last admin" : ""}
                            >
                              {m.active ? "Deactivate" : "Reactivate"}
                            </button>
                            <button
                              onClick={() => remove(m.id)}
                              disabled={lastAdmin}
                              className="text-sm font-medium text-rose-600 hover:text-rose-700 disabled:opacity-40"
                              title={lastAdmin ? "Can't remove the last admin" : ""}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {!isAdmin && (
        <p className="mt-4 text-sm text-slate-500">
          You have <span className="font-medium text-slate-700">{ROLE_LABEL[access.role]}</span>{" "}
          access. Ask an admin to change roles or invite others.
        </p>
      )}
    </Page>
  );
}
