import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { Page, PageHeader, StatCard, Card, Button, ErrorBanner } from "@/components/ui";

const BRAND = "#1F63EF";

type Ga4Data = {
  totals: { pageViews: number; users: number; sessions: number; engagementRate: number };
  timeseries: { date: string; users: number; views: number }[];
  topPages: { path: string; views: number }[];
  topSources: { source: string; sessions: number }[];
  updatedAt: string;
};

function fmtDate(yyyymmdd: string) {
  const d = new Date(
    Number(yyyymmdd.slice(0, 4)),
    Number(yyyymmdd.slice(4, 6)) - 1,
    Number(yyyymmdd.slice(6, 8)),
  );
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function WebsitePage() {
  const [data, setData] = useState<Ga4Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    const { data: res, error } = await supabase.functions.invoke<Ga4Data & { error?: string }>(
      "analytics-ga4",
      { body: {} },
    );
    setLoading(false);
    if (error) {
      // The function isn't deployed yet, or returned a non-2xx.
      setNotConfigured(true);
      return;
    }
    if (res?.error) {
      if (/not configured/i.test(res.error)) setNotConfigured(true);
      else setError(res.error);
      return;
    }
    setData(res as Ga4Data);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Page>
      <PageHeader
        title="Website"
        subtitle="Traffic on asme.org.au — last 30 days"
        actions={
          data ? (
            <Button onClick={load} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
          ) : undefined
        }
      />

      {error && <ErrorBanner message={error} />}

      {loading && !data ? (
        <Card className="p-10 text-center text-sm text-slate-400">Loading analytics…</Card>
      ) : notConfigured ? (
        <NotConfigured />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Page views" value={data.totals.pageViews.toLocaleString()} />
            <StatCard label="Visitors" value={data.totals.users.toLocaleString()} />
            <StatCard label="Sessions" value={data.totals.sessions.toLocaleString()} />
            <StatCard
              label="Engagement rate"
              value={`${Math.round(data.totals.engagementRate * 100)}%`}
            />
          </div>

          <Card className="mt-6 p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink">Visitors &amp; page views</h2>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <AreaChart data={data.timeseries.map((d) => ({ ...d, label: fmtDate(d.date) }))}>
                  <defs>
                    <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BRAND} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} minTickGap={24} />
                  <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={12} />
                  <Tooltip />
                  <Area type="monotone" dataKey="users" name="Visitors" stroke={BRAND} fill="url(#ga)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <TopList title="Top pages" rows={data.topPages.map((p) => ({ label: p.path, value: p.views }))} unit="views" />
            <TopList title="Top sources" rows={data.topSources.map((s) => ({ label: s.source, value: s.sessions }))} unit="sessions" />
          </div>

          <p className="mt-4 text-xs text-slate-400">
            Updated {new Date(data.updatedAt).toLocaleString()} · Google Analytics (G-PGLKJQPWH5)
          </p>
        </>
      ) : null}
    </Page>
  );
}

function TopList({ title, rows, unit }: { title: string; rows: { label: string; value: number }[]; unit: string }) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">No data.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="truncate text-slate-700">{r.label}</span>
              <span className="shrink-0 text-slate-400">
                {r.value.toLocaleString()} {unit}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function NotConfigured() {
  return (
    <Card className="p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-wash text-brand-deep">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      </div>
      <h2 className="mt-4 text-lg font-semibold text-ink">Analytics not connected yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Once the <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">analytics-ga4</code> function
        is deployed with a Google service account, your live traffic appears here. Until then, the full
        reports are in Google Analytics.
      </p>
      <div className="mt-5">
        <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer">
          <Button variant="primary">Open Google Analytics</Button>
        </a>
      </div>
    </Card>
  );
}
