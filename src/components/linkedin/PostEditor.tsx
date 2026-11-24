import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useCurrentAccess } from "@/lib/access-context";
import { canEdit as roleCanEdit } from "@/lib/access";
import { Button } from "@/components/ui";
import {
  POST_STATUSES,
  POST_STATUS_LABEL,
  PILLARS,
  PERSONAS,
  PRIMARY_PERSONAS,
  CTA_TYPES,
  COMMON_HASHTAGS,
  emptyDraft,
  draftFrom,
  toLocalInput,
  fromLocalInput,
  describeDbError,
  pillarStyle,
  composePostText,
  LINKEDIN_CHAR_LIMIT,
  type LinkedInPost,
  type PostDraft,
} from "@/lib/linkedin";

/**
 * Slide-over for creating or editing one LinkedIn post.
 * `post` null = new post (pre-filled with `suggestedCode`).
 */
export function PostEditor({
  post,
  suggestedCode,
  defaultScheduledAt = null,
  onClose,
  onSaved,
  onDeleted,
}: {
  post: LinkedInPost | null;
  suggestedCode: string;
  /** For a new post: pre-fill the date (e.g. from clicking a calendar day). */
  defaultScheduledAt?: string | null;
  onClose: () => void;
  onSaved: (saved: LinkedInPost) => void;
  onDeleted: (id: string) => void;
}) {
  const access = useCurrentAccess();
  // Viewers get the same panel, read-only. The database enforces this too
  // (crm_can_edit() in supabase/linkedin.sql); this just hides what would fail.
  const editable = roleCanEdit(access.role);
  const initial: PostDraft = post ? draftFrom(post) : { ...emptyDraft(), post_code: suggestedCode, scheduled_at: defaultScheduledAt };
  const [draft, setDraft] = useState<PostDraft>(initial);
  const [dateInput, setDateInput] = useState(toLocalInput(initial.scheduled_at));
  const [customTag, setCustomTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // In-panel confirmations (browser pop-ups like confirm() can be blocked).
  const [confirming, setConfirming] = useState<"delete" | "discard" | null>(null);
  const [copied, setCopied] = useState(false);

  // Close on Escape (with the same unsaved-changes check as the X button).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (confirming) setConfirming(null);
      else requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function set<K extends keyof PostDraft>(key: K, value: PostDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }
  /** Text inputs: store empty as null so the database doesn't fill with "". */
  const text = (v: string) => (v.trim() === "" ? null : v);

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  function addCustomTags() {
    const tags = customTag
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.startsWith("#") ? t : `#${t}`));
    if (tags.length) set("hashtags", Array.from(new Set([...draft.hashtags, ...tags])));
    setCustomTag("");
  }

  function requestClose() {
    if (dirty) {
      setConfirming("discard");
      return;
    }
    onClose();
  }

  async function save() {
    setError(null);
    const scheduled_at = fromLocalInput(dateInput);
    if ((draft.status === "scheduled" || draft.status === "posted") && !scheduled_at) {
      setError(`A post marked "${POST_STATUS_LABEL[draft.status]}" needs a date and time.`);
      return;
    }
    if (!draft.body.trim() && !draft.hook?.trim()) {
      setError("Add a hook or some post copy before saving.");
      return;
    }

    const row = { ...draft, scheduled_at, post_code: text(draft.post_code ?? "") };
    setSaving(true);
    const result = post
      ? await supabase.from("linkedin_posts").update(row).eq("id", post.id).select().single()
      : await supabase
          .from("linkedin_posts")
          .insert({ ...row, created_by: access.email })
          .select()
          .single();
    setSaving(false);

    if (result.error) {
      setError(describeDbError(result.error));
      return;
    }
    setDirty(false);
    onSaved(result.data as LinkedInPost);
  }

  async function remove() {
    if (!post) return;
    setError(null);
    setDeleting(true);
    // .select() returns the deleted rows. Row-level security doesn't raise an
    // error when it blocks a delete; it just deletes nothing — so check.
    const { data, error } = await supabase.from("linkedin_posts").delete().eq("id", post.id).select("id");
    setDeleting(false);
    setConfirming(null);
    if (error) {
      setError(describeDbError(error));
      return;
    }
    if (!data || data.length === 0) {
      setError(
        "Nothing was deleted: the database didn't allow it. Your role may not have delete access, or the post was already removed.",
      );
      return;
    }
    onDeleted(post.id);
  }

  /** Copy the post exactly as it should appear on LinkedIn. */
  async function copyText() {
    try {
      await navigator.clipboard.writeText(composePostText(draft.body, draft.hashtags));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setError(`Couldn't copy to the clipboard: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-ink/30" onClick={requestClose} aria-hidden />
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col bg-white shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink">
              {!editable ? "View post" : post ? "Edit post" : "New post"}
              {!editable && (
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 align-middle text-[11px] font-medium text-slate-500">
                  Read-only
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              {post
                ? `Last updated ${new Date(post.updated_at).toLocaleString("en-AU")}${
                    post.created_by ? ` · created by ${post.created_by}` : ""
                  }`
                : "Saved to the ASME content calendar"}
            </p>
          </div>
          <button
            onClick={requestClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <fieldset disabled={!editable} className="min-w-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <Field label="Status">
            <div className="flex flex-wrap gap-1.5">
              {POST_STATUSES.map((s) => (
                <Pill key={s} active={draft.status === s} onClick={() => set("status", s)}>
                  {POST_STATUS_LABEL[s]}
                </Pill>
              ))}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Scheduled for">
              <input
                type="datetime-local"
                value={dateInput}
                onChange={(e) => {
                  setDateInput(e.target.value);
                  setDirty(true);
                }}
                className={inputClass}
              />
            </Field>
            <Field label="Post code">
              <input
                value={draft.post_code ?? ""}
                onChange={(e) => set("post_code", e.target.value)}
                placeholder="ASME-2026-001"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Hook" hint="The opening line people see before “…see more”">
            <input
              value={draft.hook ?? ""}
              onChange={(e) => set("hook", text(e.target.value))}
              className={inputClass}
            />
          </Field>

          <Field label="Post copy" hint="Selected hashtags are added when you copy">
            <textarea
              value={draft.body}
              onChange={(e) => set("body", e.target.value)}
              rows={12}
              className={`${inputClass} font-[inherit] leading-relaxed`}
            />
            <CharCount length={composePostText(draft.body, draft.hashtags).length} />
          </Field>

          <Field label="Content pillar">
            <div className="flex flex-wrap gap-1.5">
              {PILLARS.map((p) => (
                <Pill key={p} active={draft.pillar === p} onClick={() => set("pillar", draft.pillar === p ? null : p)}>
                  <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ring-1 ring-white/80 ${pillarStyle(p).dot}`} />
                  {p}
                </Pill>
              ))}
            </div>
          </Field>

          <Field label="Primary persona">
            <select
              value={draft.primary_persona ?? ""}
              onChange={(e) => set("primary_persona", text(e.target.value))}
              className={inputClass}
            >
              <option value="">—</option>
              {PRIMARY_PERSONAS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Secondary personas">
            <div className="flex flex-wrap gap-1.5">
              {PERSONAS.map((p) => (
                <Pill
                  key={p}
                  active={draft.secondary_personas.includes(p)}
                  onClick={() => set("secondary_personas", toggle(draft.secondary_personas, p))}
                >
                  {p}
                </Pill>
              ))}
            </div>
          </Field>

          <Field label="Hashtags">
            <div className="flex flex-wrap gap-1.5">
              {Array.from(new Set([...COMMON_HASHTAGS, ...draft.hashtags])).map((h) => (
                <Pill key={h} active={draft.hashtags.includes(h)} onClick={() => set("hashtags", toggle(draft.hashtags, h))}>
                  {h}
                </Pill>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomTags();
                  }
                }}
                placeholder="Add another, e.g. #MedTech"
                className={inputClass}
              />
              <Button onClick={addCustomTags} disabled={!customTag.trim()}>
                Add
              </Button>
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CTA type">
              <select
                value={draft.cta_type ?? ""}
                onChange={(e) => set("cta_type", text(e.target.value))}
                className={inputClass}
              >
                <option value="">—</option>
                {CTA_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="CTA link">
              <input
                type="url"
                value={draft.cta_link ?? ""}
                onChange={(e) => set("cta_link", text(e.target.value))}
                placeholder="https://asme.org.au/join/?utm_…"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Media link" hint="Canva, Google Drive, or a direct image URL">
            <input
              type="url"
              value={draft.media_url ?? ""}
              onChange={(e) => set("media_url", text(e.target.value))}
              className={inputClass}
            />
          </Field>

          <Field label="Live LinkedIn post" hint="Paste the URL once it's published">
            <input
              type="url"
              value={draft.linkedin_url ?? ""}
              onChange={(e) => set("linkedin_url", text(e.target.value))}
              placeholder="https://www.linkedin.com/feed/update/…"
              className={inputClass}
            />
          </Field>

          <Field label="Source" hint="Where the idea or material came from">
            <input
              value={draft.source ?? ""}
              onChange={(e) => set("source", text(e.target.value))}
              className={inputClass}
            />
          </Field>

          <Field label="Notes" hint="Reviewer feedback, people to tag, reminders">
            <textarea
              value={draft.notes ?? ""}
              onChange={(e) => set("notes", text(e.target.value))}
              rows={4}
              className={inputClass}
            />
          </Field>
        </fieldset>

        <footer className="border-t border-slate-100 px-6 py-4">
          {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <span className="mr-auto text-sm text-slate-700">
                {confirming === "delete"
                  ? "Delete this post? This can't be undone."
                  : "You have unsaved changes."}
              </span>
              <Button variant="ghost" onClick={() => setConfirming(null)}>
                {confirming === "delete" ? "Keep it" : "Keep editing"}
              </Button>
              {confirming === "delete" ? (
                <button
                  onClick={remove}
                  disabled={deleting}
                  className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Discard changes
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={copyText} disabled={!composePostText(draft.body, draft.hashtags)}>
                {copied ? "Copied ✓" : "Copy post text"}
              </Button>
              {draft.linkedin_url && (
                <a
                  href={draft.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-brand-deep hover:bg-brand-wash"
                >
                  Open on LinkedIn ↗
                </a>
              )}
              {post && editable && (
                <button
                  onClick={() => setConfirming("delete")}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  Delete
                </button>
              )}
              <div className="ml-auto flex gap-2">
                {editable ? (
                  <>
                    <Button variant="ghost" onClick={requestClose}>
                      Cancel
                    </Button>
                    <Button variant="primary" onClick={save} disabled={saving}>
                      {saving ? "Saving…" : post ? "Save changes" : "Create post"}
                    </Button>
                  </>
                ) : (
                  <Button onClick={onClose}>Close</Button>
                )}
              </div>
            </div>
          )}
        </footer>
      </aside>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition ${
        active ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

/** Live length of the post against LinkedIn's limit. */
function CharCount({ length }: { length: number }) {
  const tone =
    length > LINKEDIN_CHAR_LIMIT
      ? "text-rose-600 font-medium"
      : length > LINKEDIN_CHAR_LIMIT * 0.9
        ? "text-amber-600"
        : "text-slate-400";
  return (
    <div className={`mt-1 text-right text-xs ${tone}`}>
      {length.toLocaleString("en-AU")} / {LINKEDIN_CHAR_LIMIT.toLocaleString("en-AU")}
      {length > LINKEDIN_CHAR_LIMIT && " · too long for LinkedIn"}
    </div>
  );
}
