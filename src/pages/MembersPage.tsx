import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  STATUSES,
  STATUS_LABEL,
  STATUS_STYLE,
  type Member,
  type Status,
} from "@/lib/types";
import { MemberDrawer } from "@/components/MemberDrawer";

function toCsv(rows: Member[]): string {
  const cols: (keyof Member)[] = [
    "created_at", "full_name", "email", "role", "specialty",
    "city", "linkedin_url", "status", "source", "message", "notes",
  ];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = cols.join(",");
  const lines = rows.map((r) => cols.map((c) => esc(r[c])).join(","));
  return [header, ...lines].join("\n");
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function MembersPage({ session }: { session: Session }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [selected, setSelected] = useState<Member | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setMembers((data ?? []) as Member[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (!q) return true;
      return [m.full_name, m.email, m.role, m.specialty, m.city]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [members, query, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: members.length };
    for (const s of STATUSES) c[s] = 0;
    for (const m of members) c[m.status] = (c[m.status] ?? 0) + 1;
    return c;
  }, [members]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">ASME Members</h1>
          <p className="text-sm text-slate-500">{members.length} total applications</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => download(`asme-members-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(filtered))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </button>
          <span className="hidden text-sm text-slate-400 sm:inline">{session.user.email}</span>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, specialty, city…"
          className="min-w-[16rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <div className="flex flex-wrap gap-1">
          {(["all", ...STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === s
                  ? "bg-ink text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {s === "all" ? "All" : STATUS_LABEL[s]} ({counts[s] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Specialty / stage</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">City</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Applied</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No members match.</td></tr>
            ) : (
              filtered.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => setSelected(m)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{m.full_name}</div>
                    <div className="text-xs text-slate-400">{m.email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{m.role ?? "—"}</td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{m.specialty ?? "—"}</td>
                  <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">{m.city ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[m.status]}`}>
                      {STATUS_LABEL[m.status]}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <MemberDrawer
          member={selected}
          onClose={() => setSelected(null)}
          onSaved={(m) => {
            setMembers((prev) => prev.map((x) => (x.id === m.id ? m : x)));
            setSelected(m);
          }}
          onDeleted={(id) => {
            setMembers((prev) => prev.filter((x) => x.id !== id));
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
