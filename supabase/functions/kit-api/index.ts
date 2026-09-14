// kit-api — server-side wrapper for the Kit (ConvertKit) v4 API.
//
// Holds the secret KIT_API_KEY (never in the browser). The CRM Newsletter tab
// calls this with the signed-in user's JWT. Everything targets a single
// "newsletter" tag as the audience.
//
// Deploy:
//   supabase functions deploy kit-api --project-ref <ref>
//   supabase secrets set KIT_API_KEY=<v4 key> --project-ref <ref>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const KIT_API_KEY = (Deno.env.get("KIT_API_KEY") ?? "").trim();
const KIT_TAG_NAME = Deno.env.get("KIT_NEWSLETTER_TAG_NAME") ?? "newsletter";

const KIT_BASE = "https://api.kit.com/v4";

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

async function kit(path: string, init: RequestInit = {}) {
  const res = await fetch(`${KIT_BASE}${path}`, {
    ...init,
    headers: {
      "X-Kit-Api-Key": KIT_API_KEY,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`Kit ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return data;
}

// Find-or-create the newsletter tag, return its id.
let cachedTagId: number | null = null;
async function newsletterTagId(): Promise<number> {
  if (cachedTagId) return cachedTagId;
  const tags = await kit("/tags");
  const found = (tags.tags ?? []).find(
    (t: { name: string }) => t.name.toLowerCase() === KIT_TAG_NAME.toLowerCase(),
  );
  if (found) return (cachedTagId = found.id);
  const created = await kit("/tags", { method: "POST", body: JSON.stringify({ name: KIT_TAG_NAME }) });
  return (cachedTagId = created.tag.id);
}

async function subscribe(email: string, firstName?: string) {
  await kit("/subscribers", {
    method: "POST",
    body: JSON.stringify({ email_address: email, first_name: firstName ?? null }),
  });
  const tagId = await newsletterTagId();
  await kit(`/tags/${tagId}/subscribers`, {
    method: "POST",
    body: JSON.stringify({ email_address: email }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!KIT_API_KEY) return json({ error: "Kit not configured (set KIT_API_KEY)." }, 400);

    // Require a signed-in CRM user.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: "Not authenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    switch (action) {
      case "count": {
        const total = await kit("/subscribers?include_total_count=true&per_page=1");
        const tagId = await newsletterTagId();
        const tagged = await kit(`/tags/${tagId}/subscribers?include_total_count=true&per_page=1`);
        return json({
          total: total.pagination?.total_count ?? 0,
          tagged: tagged.pagination?.total_count ?? 0,
        });
      }

      case "subscribe": {
        await subscribe(body.email, body.first_name);
        return json({ ok: true });
      }

      case "subscribe_many": {
        // Small batches only (edge function time budget); the client pages this.
        const list = (body.subscribers ?? []) as { email: string; first_name?: string }[];
        let ok = 0;
        for (const s of list) {
          try {
            await subscribe(s.email, s.first_name);
            ok++;
          } catch {
            /* skip individual failures (dupes, invalid) */
          }
        }
        return json({ ok, of: list.length });
      }

      case "send": {
        // mode: "draft" (create in Kit, don't schedule) | "send" (schedule now+5m)
        const mode = body.mode as "draft" | "send";
        const tagId = await newsletterTagId();
        const payload: Record<string, unknown> = {
          subject: body.subject,
          preview_text: body.preview_text ?? "",
          content: body.html,
          description: body.subject,
          public: false,
          subscriber_filter: [{ all: [{ type: "tag", ids: [tagId] }] }],
          send_at: mode === "send" ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null,
        };
        const created = await kit("/broadcasts", { method: "POST", body: JSON.stringify(payload) });
        const id = created.broadcast.id;
        return json({
          kit_broadcast_id: id,
          kit_url: `https://app.kit.com/campaigns/${id}/draft`,
          mode,
        });
      }

      case "stats": {
        const stats = await kit(`/broadcasts/${body.kit_broadcast_id}/stats`);
        return json({ stats: stats.broadcast?.stats ?? stats.stats ?? {} });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
