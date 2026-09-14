import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { fetchAll } from "@/lib/db";
import type { Membership } from "@/lib/types";
import { fieldText, usageValues } from "@/lib/fields";
import { Page, PageHeader, StatCard, Card, ErrorBanner } from "@/components/ui";

const BRAND = "#1F63EF";

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function topCounts(values: string[], limit = 6) {
  const c = new Map<string, number>();
  for (const v of values) {
    const key = v && v !== "—" ? v : "Not given";
    c.set(key, (c.get(key) ?? 0) + 1);
  }
  return [...c.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

export function DashboardPage() {
  const [members, setMembers] = useState<Membership[]>([]);
  const [enquiryCount, setEnquiryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [m, e] = await Promise.all([
        fetchAll<Membership>("memberships", "id, created_at, status, data"),
        supabase.from("contact_messages").select("id", { count: "exact", head: true }),
      ]);
      if (m.error) setError(m.error.message);
      else setMembers(m.data ?? []);
      if (!e.error && typeof e.count === "number") setEnquiryCount(e.count);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const newThisMonth = members.filter((m) => monthKey(m.created_at) === thisMonth).length;
    const confirmed = members.filter((m) => m.status === "member").length;
    return { total: members.length, newThisMonth, confirmed };
  }, [members]);

  const byMonth = useMemo(() => {
    const c = new Map<string, number>();
    for (const m of members) c.set(monthKey(m.created_at), (c.get(monthKey(m.created_at)) ?? 0) + 1);
    return [...c.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8)
      .map(([key, count]) => ({ name: monthLabel(key), count }));
  }, [members]);

  const byState = useMemo(
    () => topCounts(members.map((m) => fieldText(m.data, "based"))),
    [members],
  );
  // "Select all that apply", so a member counts toward each option they picked.
  const byUsage = useMemo(
    () => topCounts(members.flatMap((m) => usageValues(m.data)), 8),
    [members],
  );

  return (
    <Page>
      <PageHeader title="Dashboard" subtitle="Society at a glance" />

      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total members" value={loading ? "…" : stats.total} />
        <StatCard label="New this month" value={loading ? "…" : stats.newThisMonth} />
        <StatCard label="Confirmed members" value={loading ? "…" : stats.confirmed} hint="Status = Member" />
        <StatCard label="Enquiries" value={loading ? "…" : enquiryCount} />
      </div>

      <div className="mt-6">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">New applications by month</h2>
          <ChartBox data={byMonth} />
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">By location</h2>
          <ChartBox data={byState} layout="vertical" />
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink">How members use their clinical degree</h2>
          <p className="mb-4 mt-0.5 text-xs text-slate-400">Select all that apply — members can count in more than one.</p>
          <ChartBox data={byUsage} layout="vertical" />
        </Card>
      </div>
    </Page>
  );
}

function ChartBox({
  data,
  layout = "horizontal",
}: {
  data: { name: string; count: number }[];
  layout?: "horizontal" | "vertical";
}) {
  if (data.length === 0) {
    return <div className="py-12 text-center text-sm text-slate-400">No data yet.</div>;
  }
  return (
    <div style={{ width: "100%", height: layout === "vertical" ? Math.max(140, data.length * 40) : 260 }}>
      <ResponsiveContainer>
        {layout === "vertical" ? (
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid horizontal={false} stroke="#eef2f7" />
            <XAxis type="number" allowDecimals={false} stroke="#94a3b8" fontSize={12} />
            <YAxis type="category" dataKey="name" width={130} stroke="#94a3b8" fontSize={12} />
            <Tooltip cursor={{ fill: "#f1f5f9" }} />
            <Bar dataKey="count" fill={BRAND} radius={[0, 4, 4, 0]} />
          </BarChart>
        ) : (
          <BarChart data={data} margin={{ left: -16, right: 8 }}>
            <CartesianGrid vertical={false} stroke="#eef2f7" />
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
            <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={12} />
            <Tooltip cursor={{ fill: "#f1f5f9" }} />
            <Bar dataKey="count" fill={BRAND} radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
