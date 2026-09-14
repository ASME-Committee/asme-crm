// analytics-ga4 — pull live GA4 website metrics for the CRM Website page.
//
// Pure server-to-server (no user OAuth): a Google service account with Viewer
// access to the GA4 property. This function holds the SA key as a Supabase
// secret and never exposes it to the browser.
//
// Auth chain:
//   1. Read the service-account JSON from GA4_SA_KEY.
//   2. Mint an RS256 JWT asserting the SA + analytics.readonly scope.
//   3. Exchange it at oauth2.googleapis.com/token for an access token.
//   4. Call the GA4 Data API runReport for the last 30 days.
//
// The caller must be a signed-in CRM user (any valid Supabase JWT); we don't
// return any CRM data, only aggregate site traffic.
//
// Deploy:
//   supabase functions deploy analytics-ga4 --project-ref <ref>
//   supabase secrets set GA4_PROPERTY_ID=<numeric id> GA4_SA_KEY="$(cat sa.json)"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GA4_PROPERTY_ID = Deno.env.get("GA4_PROPERTY_ID") ?? "";
const GA4_SA_KEY = Deno.env.get("GA4_SA_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ── base64url ──────────────────────────────────────────────────────────
function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

async function accessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claim = b64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/analytics.readonly",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const signingInput = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput)),
  );
  const jwt = `${signingInput}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token as string;
}

type RunReport = {
  dateRanges?: { startDate: string; endDate: string }[];
  dimensions?: { name: string }[];
  metrics?: { name: string }[];
  orderBys?: unknown[];
  limit?: number;
};

async function runReport(token: string, body: RunReport) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`GA4 runReport failed: ${res.status} ${await res.text()}`);
  return res.json();
}

const rows = (r: { rows?: unknown[] }) => (r.rows ?? []) as { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    // Require a signed-in CRM user.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: "Not authenticated" }, 401);

    if (!GA4_PROPERTY_ID || !GA4_SA_KEY) {
      return json({ error: "GA4 not configured (set GA4_PROPERTY_ID and GA4_SA_KEY)." }, 400);
    }

    const sa = JSON.parse(GA4_SA_KEY);
    const token = await accessToken(sa);
    const range = [{ startDate: "30daysAgo", endDate: "today" }];

    const [totals, series, pages, sources] = await Promise.all([
      runReport(token, {
        dateRanges: range,
        metrics: [
          { name: "screenPageViews" },
          { name: "totalUsers" },
          { name: "sessions" },
          { name: "engagementRate" },
        ],
      }),
      runReport(token, {
        dateRanges: range,
        dimensions: [{ name: "date" }],
        metrics: [{ name: "totalUsers" }, { name: "screenPageViews" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }),
      runReport(token, {
        dateRanges: range,
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 10,
      }),
      runReport(token, {
        dateRanges: range,
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 8,
      }),
    ]);

    const t = rows(totals)[0]?.metricValues ?? [];
    return json({
      totals: {
        pageViews: Number(t[0]?.value ?? 0),
        users: Number(t[1]?.value ?? 0),
        sessions: Number(t[2]?.value ?? 0),
        engagementRate: Number(t[3]?.value ?? 0),
      },
      timeseries: rows(series).map((r) => ({
        date: r.dimensionValues[0].value, // YYYYMMDD
        users: Number(r.metricValues[0].value),
        views: Number(r.metricValues[1].value),
      })),
      topPages: rows(pages).map((r) => ({
        path: r.dimensionValues[0].value,
        views: Number(r.metricValues[0].value),
      })),
      topSources: rows(sources).map((r) => ({
        source: r.dimensionValues[0].value,
        sessions: Number(r.metricValues[0].value),
      })),
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
