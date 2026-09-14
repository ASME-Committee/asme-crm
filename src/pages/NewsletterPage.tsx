import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchAll } from "@/lib/db";
import type { Membership } from "@/lib/types";
import { memberName, fieldText } from "@/lib/fields";
import {
  BLOCK_LABEL,
  emptyBlock,
  renderEmail,
  type Block,
  type BlockType,
} from "@/lib/newsletter";
import { Page, PageHeader, Card, Button, StatCard, ErrorBanner } from "@/components/ui";

type Issue = {
  id: string;
  subject: string;
  preview_text: string | null;
  blocks: Block[];
  status: "draft" | "sent";
  kit_broadcast_id: string | null;
  created_at: string;
  sent_at: string | null;
};

const BLOCK_TYPES: BlockType[] = ["heading", "text", "button", "image"];

async function kit(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("kit-api", { body });
  if (error) throw new Error("kit-api not reachable (is the function deployed?)");
  if (data?.error) throw new Error(data.error);
  return data;
}

export function NewsletterPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [counts, setCounts] = useState<{ total: number; tagged: number } | null>(null);
  const [kitReady, setKitReady] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Composer state
  const [id, setId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [preview, setPreview] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([emptyBlock("text")]);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function loadIssues() {
    const { data, error } = await supabase
      .from("newsletters")
      .select("id, subject, preview_text, blocks, status, kit_broadcast_id, created_at, sent_at")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setIssues((data ?? []) as Issue[]);
  }

  useEffect(() => {
    loadIssues();
    kit({ action: "count" })
      .then((d) => {
        setCounts({ total: d.total, tagged: d.tagged });
        setKitReady(true);
      })
      .catch(() => setKitReady(false));
  }, []);

  const html = useMemo(() => renderEmail(subject || "Subject line", blocks), [subject, blocks]);

  function resetComposer() {
    setId(null);
    setSubject("");
    setPreview("");
    setBlocks([emptyBlock("text")]);
    setNotice(null);
  }
  function editIssue(i: Issue) {
    setId(i.id);
    setSubject(i.subject);
    setPreview(i.preview_text ?? "");
    setBlocks(i.blocks?.length ? i.blocks : [emptyBlock("text")]);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateBlock(idx: number, patch: Partial<Block>) {
    setBlocks((bs) => bs.map((b, i) => (i === idx ? ({ ...b, ...patch } as Block) : b)));
  }
  function moveBlock(idx: number, dir: -1 | 1) {
    setBlocks((bs) => {
      const next = [...bs];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return bs;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  async function save(): Promise<string | null> {
    setError(null);
    if (!subject.trim()) {
      setError("Add a subject line first.");
      return null;
    }
    setBusy(true);
    const row = { subject, preview_text: preview, blocks, updated_at: new Date().toISOString() };
    const res = id
      ? await supabase.from("newsletters").update(row).eq("id", id).select("id").single()
      : await supabase.from("newsletters").insert(row).select("id").single();
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return null;
    }
    setId(res.data.id);
    setNotice("Saved.");
    loadIssues();
    return res.data.id;
  }

  async function createKitDraft() {
    try {
      setBusy(true);
      await save();
      const d = await kit({ action: "send", mode: "draft", subject, preview_text: preview, html });
      if (id) await supabase.from("newsletters").update({ kit_broadcast_id: d.kit_broadcast_id }).eq("id", id);
      setBusy(false);
      window.open(d.kit_url, "_blank");
      setNotice("Draft created in Kit — opening it to review and send.");
      loadIssues();
    } catch (e) {
      setBusy(false);
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  async function sendNow() {
    if (!confirm(`Send "${subject}" to your ${counts?.tagged ?? "newsletter"} subscribers? It queues in Kit in 5 minutes.`))
      return;
    try {
      setBusy(true);
      const savedId = (await save()) ?? id;
      const d = await kit({ action: "send", mode: "send", subject, preview_text: preview, html });
      if (savedId)
        await supabase
          .from("newsletters")
          .update({ status: "sent", kit_broadcast_id: d.kit_broadcast_id, sent_at: new Date().toISOString() })
          .eq("id", savedId);
      setBusy(false);
      setNotice("Queued in Kit. It sends in ~5 minutes (cancelable in Kit until then).");
      resetComposer();
      loadIssues();
    } catch (e) {
      setBusy(false);
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  async function syncMembers() {
    if (!confirm("Add all current members to Kit as newsletter subscribers?")) return;
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const { data } = await fetchAll<Membership>("memberships", "id, data");
      const subs = (data ?? [])
        .map((m) => ({ email: fieldText(m.data, "email"), first_name: memberName(m.data) }))
        .filter((s) => s.email && s.email.includes("@") && s.email !== "—");
      let done = 0;
      for (let i = 0; i < subs.length; i += 50) {
        const batch = subs.slice(i, i + 50);
        await kit({ action: "subscribe_many", subscribers: batch });
        done += batch.length;
        setNotice(`Syncing to Kit… ${done}/${subs.length}`);
      }
      const c = await kit({ action: "count" });
      setCounts({ total: c.total, tagged: c.tagged });
      setNotice(`Synced ${subs.length} members to Kit.`);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setSyncing(false);
    }
  }

  if (kitReady === false) {
    return (
      <Page>
        <PageHeader title="Newsletter" subtitle="Compose and send via Kit" />
        <Card className="p-8 text-center">
          <h2 className="text-lg font-semibold text-ink">Kit isn't connected yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Deploy the <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">kit-api</code> function
            and set <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">KIT_API_KEY</code>, then
            reload. Until then you can't compose here.
          </p>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Newsletter"
        subtitle="Compose and send to your members via Kit"
        actions={
          <Button onClick={syncMembers} disabled={syncing || kitReady === null}>
            {syncing ? "Syncing…" : "Sync members to Kit"}
          </Button>
        }
      />

      {error && <ErrorBanner message={error} />}
      {notice && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{notice}</p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Kit subscribers" value={counts ? counts.total.toLocaleString() : "…"} />
        <StatCard label="Newsletter audience" value={counts ? counts.tagged.toLocaleString() : "…"} hint="Tagged 'newsletter'" />
        <StatCard label="Issues" value={issues.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Composer */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">{id ? "Edit issue" : "New issue"}</h2>
            {id && (
              <button onClick={resetComposer} className="text-xs font-medium text-slate-500 hover:text-slate-700">
                Start new
              </button>
            )}
          </div>

          <label className="mb-1 block text-xs font-medium text-slate-600">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What's this issue about?"
            className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <label className="mb-1 block text-xs font-medium text-slate-600">Preview text</label>
          <input
            value={preview}
            onChange={(e) => setPreview(e.target.value)}
            placeholder="The teaser shown in the inbox"
            className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />

          <div className="space-y-3">
            {blocks.map((b, idx) => (
              <div key={idx} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {BLOCK_LABEL[b.type]}
                  </span>
                  <div className="flex gap-1.5 text-xs text-slate-400">
                    <button onClick={() => moveBlock(idx, -1)} className="hover:text-slate-700">↑</button>
                    <button onClick={() => moveBlock(idx, 1)} className="hover:text-slate-700">↓</button>
                    <button onClick={() => setBlocks((bs) => bs.filter((_, i) => i !== idx))} className="hover:text-rose-600">✕</button>
                  </div>
                </div>
                {b.type === "text" ? (
                  <textarea
                    value={b.text}
                    onChange={(e) => updateBlock(idx, { text: e.target.value })}
                    rows={3}
                    className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                  />
                ) : b.type === "heading" ? (
                  <input
                    value={b.text}
                    onChange={(e) => updateBlock(idx, { text: e.target.value })}
                    className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm font-semibold"
                  />
                ) : b.type === "button" ? (
                  <div className="flex gap-2">
                    <input value={b.text} onChange={(e) => updateBlock(idx, { text: e.target.value })} placeholder="Label" className="w-1/3 rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
                    <input value={b.url} onChange={(e) => updateBlock(idx, { url: e.target.value })} placeholder="https://…" className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
                  </div>
                ) : (
                  <input value={b.url} onChange={(e) => updateBlock(idx, { url: e.target.value })} placeholder="Image URL" className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {BLOCK_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setBlocks((bs) => [...bs, emptyBlock(t)])}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                + {BLOCK_LABEL[t]}
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <Button onClick={save} disabled={busy}>Save draft</Button>
            <Button onClick={createKitDraft} disabled={busy}>Create Kit draft</Button>
            <Button onClick={sendNow} variant="primary" disabled={busy}>Send now</Button>
          </div>
        </Card>

        {/* Preview */}
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Preview
          </div>
          <iframe title="preview" srcDoc={html} className="h-[560px] w-full border-0" />
        </Card>
      </div>

      {/* Past issues */}
      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-ink">Issues</div>
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-slate-100">
            {issues.length === 0 ? (
              <tr><td className="px-5 py-8 text-center text-slate-400">No issues yet.</td></tr>
            ) : (
              issues.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <button onClick={() => editIssue(i)} className="font-medium text-slate-900 hover:text-brand-deep">
                      {i.subject}
                    </button>
                    <div className="text-xs text-slate-400">
                      {i.status === "sent" ? `Sent ${i.sent_at ? new Date(i.sent_at).toLocaleDateString() : ""}` : "Draft"}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {i.kit_broadcast_id && (
                      <a
                        href={`https://app.kit.com/campaigns/${i.kit_broadcast_id}/reports`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-brand-deep hover:underline"
                      >
                        View in Kit
                      </a>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </Page>
  );
}
