import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  MEMBER_STATUSES,
  MEMBER_STATUS_LABEL,
  MEMBER_STATUS_STYLE,
  type Membership,
  type MemberStatus,
} from "@/lib/types";
import { memberName, fieldText } from "@/lib/fields";
import { submissionsToCsv, downloadCsv } from "@/lib/csv";
import { canEdit } from "@/lib/access";
import { useCurrentAccess } from "@/lib/access-context";
import { DetailDrawer } from "@/components/DetailDrawer";
import { Page, PageHeader, Button, SearchInput, ErrorBanner, EmptyRow, Card } from "@/components/ui";

const statusOf = (m: Membership): MemberStatus => m.status ?? "new";

export function MembersPage() {
  const access = useCurrentAccess();
  const editable = canEdit(access.role);
  const [rows, setRows] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<MemberStatus | "all">("all");
  const [selected, setSelected] = useState<Membership | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("memberships")
      .select("id, created_at, status, data")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setRows((data ?? []) as Membership[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((m) => {
      if (statusFilter !== "all" && statusOf(m) !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        memberName(m.data),
        fieldText(m.data, "email"),
        fieldText(m.data, "clinicalProfession"),
        fieldText(m.data, "medicalSpeciality"),
        fieldText(m.data, "based"),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const s of MEMBER_STATUSES) c[s] = 0;
    for (const m of rows) c[statusOf(m)] = (c[statusOf(m)] ?? 0) + 1;
    return c;
  }, [rows]);

  return (
    <Page>
      <PageHeader
        title="Members"
        subtitle={`${rows.length} membership application${rows.length === 1 ? "" : "s"}`}
        actions={
          <Button
            onClick={() =>
              downloadCsv(
                `asme-members-${new Date().toISOString().slice(0, 10)}.csv`,
                submissionsToCsv(
                  filtered.map((m) => ({ id: m.id, created_at: m.created_at, status: statusOf(m), data: m.data })),
                ),
              )
            }
          >
            Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search name, email, profession, location…"
        />
        <div className="flex flex-wrap gap-1">
          {(["all", ...MEMBER_STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === s
                  ? "bg-ink text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {s === "all" ? "All" : MEMBER_STATUS_LABEL[s]} ({counts[s] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Profession</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Based</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Applied</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <EmptyRow colSpan={5} text="Loading…" />
              ) : filtered.length === 0 ? (
                <EmptyRow colSpan={5} text="No members match." />
              ) : (
                filtered.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => setSelected(m)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{memberName(m.data)}</div>
                      <div className="text-xs text-slate-400">{fieldText(m.data, "email")}</div>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                      {fieldText(m.data, "clinicalProfession")}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">
                      {fieldText(m.data, "based")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${MEMBER_STATUS_STYLE[statusOf(m)]}`}
                      >
                        {MEMBER_STATUS_LABEL[statusOf(m)]}
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
      </Card>

      {selected && (
        <DetailDrawer
          title={memberName(selected.data)}
          subtitle={fieldText(selected.data, "clinicalProfession")}
          createdAt={selected.created_at}
          data={selected.data}
          memberId={selected.id}
          status={statusOf(selected)}
          canEditStatus={editable}
          onClose={() => setSelected(null)}
          onStatusSaved={(next) => {
            setRows((prev) =>
              prev.map((x) => (x.id === selected.id ? { ...x, status: next } : x)),
            );
            setSelected((prev) => (prev ? { ...prev, status: next } : prev));
          }}
        />
      )}
    </Page>
  );
}
