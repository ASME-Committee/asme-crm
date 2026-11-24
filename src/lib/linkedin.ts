/**
 * LinkedIn content calendar — shared types, option lists and helpers.
 * The option lists mirror the "ASME LinkedIn Posts" Notion database. Pillars
 * and personas are plain text in the database (see supabase/linkedin.sql), so
 * adding one is a change here only — no SQL needed.
 */

export const POST_STATUSES = ["idea", "draft", "approved", "scheduled", "posted"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_STATUS_LABEL: Record<PostStatus, string> = {
  idea: "Idea",
  draft: "Draft",
  approved: "Approved",
  scheduled: "Scheduled",
  posted: "Posted",
};

export const POST_STATUS_STYLE: Record<PostStatus, string> = {
  idea: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  draft: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
  approved: "bg-blue-50 text-brand-deep ring-1 ring-blue-100",
  scheduled: "bg-violet-50 text-violet-700 ring-1 ring-violet-100",
  posted: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
};

export const PILLARS = [
  "Founder Spotlight",
  "Why ASME",
  "Educational Resources",
  "Events & Opportunities",
] as const;

/** Pillar colours, used for the dot in the list and the chip on the calendar. */
export const PILLAR_STYLE: Record<string, { dot: string; chip: string }> = {
  "Founder Spotlight": { dot: "bg-orange-400", chip: "bg-orange-50 text-orange-800 ring-orange-200" },
  "Why ASME": { dot: "bg-brand", chip: "bg-brand-wash text-brand-deep ring-blue-200" },
  "Educational Resources": { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  "Events & Opportunities": { dot: "bg-violet-500", chip: "bg-violet-50 text-violet-800 ring-violet-200" },
};
export const NO_PILLAR_STYLE = { dot: "bg-slate-300", chip: "bg-slate-50 text-slate-700 ring-slate-200" };
export const pillarStyle = (p: string | null) => (p && PILLAR_STYLE[p]) || NO_PILLAR_STYLE;

export const PERSONAS = [
  "Experienced clinicians contemplating the leap",
  "Early-career clinicians with an idea",
  "Clinicians who have made the leap",
  "Experienced clinician-entrepreneurs",
  "Students & trainees",
] as const;
/** Primary persona can also be "All five". */
export const PRIMARY_PERSONAS = [...PERSONAS, "All five"] as const;

export const CTA_TYPES = [
  "Membership-direct",
  "Membership-soft",
  "Event",
  "Program",
  "Soft",
  "None",
] as const;

/** Suggested hashtags (one tap to add). Any other hashtag can be typed in. */
export const COMMON_HASHTAGS = [
  "#FounderStories",
  "#WhyASME",
  "#HealthInnovation",
  "#ClinicianEntrepreneur",
  "#MedicalEntrepreneurship",
  "#HealthTech",
  "#AustralianHealthcare",
  "#ClinicianFounder",
];

export type LinkedInPost = {
  id: string;
  post_code: string | null;
  hook: string | null;
  body: string;
  status: PostStatus;
  scheduled_at: string | null;
  pillar: string | null;
  primary_persona: string | null;
  secondary_personas: string[];
  hashtags: string[];
  cta_type: string | null;
  cta_link: string | null;
  source: string | null;
  notes: string | null;
  media_url: string | null;
  linkedin_url: string | null;
  notion_page_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** The fields the editor can change. */
export type PostDraft = Omit<LinkedInPost, "id" | "notion_page_id" | "created_by" | "created_at" | "updated_at">;

/** Copy only the editable fields out of a saved post. */
export function draftFrom(p: LinkedInPost): PostDraft {
  const { id: _id, notion_page_id: _n, created_by: _c, created_at: _ca, updated_at: _u, ...draft } = p;
  return { ...draft, secondary_personas: [...draft.secondary_personas], hashtags: [...draft.hashtags] };
}

export function emptyDraft(): PostDraft {
  return {
    post_code: null,
    hook: null,
    body: "",
    status: "idea",
    scheduled_at: null,
    pillar: null,
    primary_persona: null,
    secondary_personas: [],
    hashtags: [],
    cta_type: null,
    cta_link: null,
    source: null,
    notes: null,
    media_url: null,
    linkedin_url: null,
  };
}

/**
 * Next ASME-YYYY-NNN code for the given year, one past the highest existing.
 * The database's unique constraint is the real guard: if two people create a
 * post at the same moment, the second save fails with a clear message.
 */
export function nextPostCode(posts: Pick<LinkedInPost, "post_code">[], year = new Date().getFullYear()): string {
  const prefix = `ASME-${year}-`;
  const max = posts.reduce((m, p) => {
    if (!p.post_code?.startsWith(prefix)) return m;
    const n = Number(p.post_code.slice(prefix.length));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/** ISO timestamp -> value for <input type="datetime-local"> in the viewer's timezone. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value (local time) -> ISO timestamp, or null. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatScheduled(iso: string | null): string {
  if (!iso) return "Unscheduled";
  return new Date(iso).toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** A short label for a post: its hook, else the first line of the body. */
export function postTitle(p: Pick<LinkedInPost, "hook" | "body">): string {
  const text = (p.hook?.trim() || p.body.trim().split("\n")[0] || "").trim();
  return text || "Untitled post";
}

/**
 * Turn a Supabase/Postgres error into a message a person can act on. Always
 * keeps the original text and code, so a permissions problem never looks like
 * a network problem (the lesson from the Newsletter page).
 */
export function describeDbError(err: { message: string; code?: string; details?: string | null; hint?: string | null }): string {
  const parts = [err.message];
  if (err.details) parts.push(err.details);
  if (err.hint) parts.push(`Hint: ${err.hint}`);
  let friendly = "";
  if (err.code === "42501") friendly = "You don't have permission to do that (viewers are read-only). ";
  else if (err.code === "23505" && /post_code/.test(err.message + (err.details ?? "")))
    friendly = "That post code is already in use. ";
  else if (err.code === "23514") friendly = "A value isn't allowed by the database. ";
  return `${friendly}${parts.join(" — ")}${err.code ? ` (code ${err.code})` : ""}`;
}

/** LinkedIn's maximum length for a post's text. */
export const LINKEDIN_CHAR_LIMIT = 3000;

/**
 * The text to paste into LinkedIn: the post copy, plus any selected hashtags
 * that aren't already written into it (imported Notion posts already end with
 * their hashtags, so those aren't doubled up).
 */
export function composePostText(body: string, hashtags: string[]): string {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const missing = hashtags.filter((h) => !new RegExp(`(^|\\s)${escape(h)}(?=\\s|$)`, "i").test(body));
  if (missing.length === 0) return body;
  return body.trim() ? `${body.trimEnd()}\n\n${missing.join(" ")}` : missing.join(" ");
}
