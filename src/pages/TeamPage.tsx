import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  ROLES,
  ROLE_LABEL,
  ROLE_HINT,
  PAGES,
  PAGE_KEYS,
  canManageTeam,
  type Role,
  type PageKey,
} from "@/lib/access";
import { useCurrentAccess } from "@/lib/access-context";
import { Page, PageHeader, Card, Button, ErrorBanner, EmptyRow } from "@/components/ui";

type TeamMember = {
  id: string;
  email: string;
  role: Role;
  active: boolean;
  pages: PageKey[] | null;
  invited_by: string | null;
  last_seen_at: string | null;
  created_at: string;
};

/** The effective page list for a member: admins (and null rows) see all. */
function effectivePages(m: TeamMember): PageKey[] {
  if (m.role === "admin" || !m.pages) return [...PAGE_KEYS];
  return m.pages;
}

export function TeamPage({ session }: { session: Session }) {
  const access = useCurrentAccess();
  const isAdmin = canManageTeam(access.role);

  const [rows, setRows] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Invite form
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [invitePages, setInvitePages] = useState<PageKey[]>([...PAGE_KEYS]);
  const [inviting, setInviting] = useState(false);

  async function load() {
    setLoading(true);
    let res: { data: unknown[] | null; error: { message: string } | null } = await supabase
      .from("crm_team")
      .select("id, email, role, active, pages, invited_by, last_seen_at, created_at")
      .order("created_at", { ascending: true });
    // Before team-pages.sql the pages/last_seen_at columns are absent.
    if (res.error && /column .* does not exist/i.test(res.error.message)) {
      res = await supabase
        .from("crm_team")
        .select("id, email, role, active, invited_by, created_at")
        .order("created_at", { ascending: true });
    }
    if (res.error) setError(res.error.message);
    else setRows((res.data ?? []) as unknown as TeamMember[]);
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

    const pages = role === "admin" ? null : invitePages;
    const { error } = await supabase
      .from("crm_team")
      .insert({ email: clean, role, active: true, pages, invited_by: session.user.email });
    if (error) {
      setInviting(false);
      setError(error.code === "23505" ? "That email is already on the team." : error.message);
      return;
    }

    // Email them a sign-in link (Supabase mailer). If it can't send they're
    // still on the team and can request a link from the login screen.
    const redirect = window.location.origin + window.location.pathname;
    const { error: mailErr } = await supabase.auth.signInWithOtp({
      email: clean,
      options: { shouldCreateUser: true, emailRedirectTo: redirect },
    });
    setInviting(false);
    setNotice(
      mailErr
        ? `${clean} was added, but the invite email didn't send (${mailErr.message}). They can sign in via "Email me a sign-in link".`
        : `Invited ${clean} — we emailed them a sign-in link.`,
    );
    setEmail("");
    setRole("editor");
    setInvitePages([...PAGE_KEYS]);
    load();
  }

  async function patch(id: string, changes: Partial<TeamMember>) {
    setError(null);
    const prev = rows;
    setRows((r) => r.map((m) => (m.id === id ? { ...m, ...changes } : m)));
    const { error } = await supabase.from("crm_team").update(changes).eq("id", id);
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

  function togglePage(m: TeamMember, key: PageKey) {
    const current = effectivePages(m);
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    patch(m.id, { pages: next });
  }

  const selfEmail = (session.user.email ?? "").toLowerCase();
  const adminCount = useMemo(() => rows.filter((m) => m.role === "admin" && m.active).length, [rows]);

  return (
    <Page>
      <PageHeader title="Team" subtitle={isAdmin ? "Invite people and choose what they can see" : "Your CRM access"} />

      {access.setupPending && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Run <code>supabase/team.sql</code> then <code>supabase/team-pages.sql</code> in Supabase to
          enable roles, page sharing, and locked access.
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {isAdmin && (
        <Card className="mb-6 p-5">
          <h2 className="text-sm font-semibold text-ink">Invite a team member</h2>
          <p className="mt-1 text-sm text-slate-500">
            They get an emailed sign-in link (no password). Choose their role and which pages they
            can see.
          </p>
          <form onSubmit={invite} className="mt-4 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
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
                {inviting ? "Inviting…" : "Send invite"}
              </Button>
            </div>

            {/* Page sharing — admins see everything, so only offered for editor/viewer. */}
            {role !== "admin" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Pages they can see</label>
                <div className="flex flex-wrap gap-1.5">
                  {PAGES.map((p) => {
                    const on = invitePages.includes(p.key);
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() =>
                          setInvitePages((prev) =>
                            prev.includes(p.key) ? prev.filter((k) => k !== p.key) : [...prev, p.key],
                          )
                        }
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          on ? "bg-brand text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <p className="text-xs text-slate-400">
              {ROLES.map((r) => `${ROLE_LABEL[r]}: ${ROLE_HINT[r]}`).join("  ·  ")}
            </p>
          </form>
          {notice && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>
          )}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Pages</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {isAdmin && <th className="px-4 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <EmptyRow colSpan={isAdmin ? 5 : 4} text="Loading…" />
              ) : rows.length === 0 ? (
                <EmptyRow colSpan={isAdmin ? 5 : 4} text="No team members yet." />
              ) : (
                rows.map((m) => {
                  const isSelf = m.email.toLowerCase() === selfEmail;
                  const lastAdmin = m.role === "admin" && m.active && adminCount <= 1;
                  const pages = effectivePages(m);
                  return (
                    <tr key={m.id} className="align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {m.email}
                          {isSelf && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                        </div>
                        {m.invited_by && (
                          <div className="text-xs text-slate-400">invited by {m.invited_by}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isAdmin && !lastAdmin ? (
                          <select
                            value={m.role}
                            onChange={(e) => patch(m.id, { role: e.target.value as Role })}
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
                        {m.role === "admin" ? (
                          <span className="text-xs text-slate-400">All pages</span>
                        ) : isAdmin ? (
                          <div className="flex flex-wrap gap-1">
                            {PAGES.map((p) => {
                              const on = pages.includes(p.key);
                              return (
                                <button
                                  key={p.key}
                                  onClick={() => togglePage(m, p.key)}
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium transition ${
                                    on
                                      ? "bg-brand-wash text-brand-deep ring-1 ring-blue-100"
                                      : "bg-slate-50 text-slate-300 ring-1 ring-slate-200 hover:text-slate-500"
                                  }`}
                                  title={on ? `Remove ${p.label}` : `Give ${p.label}`}
                                >
                                  {p.label}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {pages.map((k) => (
                              <span
                                key={k}
                                className="rounded-full bg-brand-wash px-2 py-0.5 text-xs font-medium text-brand-deep"
                              >
                                {PAGES.find((p) => p.key === k)?.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!m.active ? (
                          <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                            Inactive
                          </span>
                        ) : m.last_seen_at ? (
                          <span
                            className="inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100"
                            title={`Last seen ${new Date(m.last_seen_at).toLocaleString()}`}
                          >
                            Active
                          </span>
                        ) : (
                          <span className="inline-block rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-100">
                            Invited
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => patch(m.id, { active: !m.active })}
                              disabled={lastAdmin}
                              className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40"
                            >
                              {m.active ? "Deactivate" : "Reactivate"}
                            </button>
                            <button
                              onClick={() => remove(m.id)}
                              disabled={lastAdmin}
                              className="text-sm font-medium text-rose-600 hover:text-rose-700 disabled:opacity-40"
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
          You have <span className="font-medium text-slate-700">{ROLE_LABEL[access.role]}</span> access.
          Ask an admin to change your role or pages.
        </p>
      )}
    </Page>
  );
}
