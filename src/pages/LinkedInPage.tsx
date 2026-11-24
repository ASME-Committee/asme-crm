import { useEffect, useMemo, useState } from "react";
import { fetchAll } from "@/lib/db";
import { canEdit } from "@/lib/access";
import { useCurrentAccess } from "@/lib/access-context";
import { Page, PageHeader, Button, SearchInput, ErrorBanner } from "@/components/ui";
import { PostEditor } from "@/components/linkedin/PostEditor";
import { PostList } from "@/components/linkedin/PostList";
import { MonthCalendar } from "@/components/linkedin/MonthCalendar";
import {
  POST_STATUSES,
  POST_STATUS_LABEL,
  describeDbError,
  nextPostCode,
  type LinkedInPost,
  type PostStatus,
} from "@/lib/linkedin";

type View = "month" | "list";
const VIEW_KEY = "asme-crm.linkedin.view";

/** Remembered per browser; falls back to Month if storage is unavailable. */
function loadView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "month";
  } catch {
    return "month";
  }
}

/** What the editor is showing: closed, a new post (optionally on a date), or an existing post. */
type Editing = { post: LinkedInPost | null; date?: string } | null;

/** ASME LinkedIn content calendar. */
export function LinkedInPage() {
  const access = useCurrentAccess();
  const editable = canEdit(access.role);
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PostStatus | "all">("all");
  const [view, setView] = useState<View>(loadView);
  const [month, setMonth] = useState(() => new Date());
  const [editing, setEditing] = useState<Editing>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await fetchAll<LinkedInPost>("linkedin_posts", "*");
    // Show the real database message, never a generic "not connected".
    if (error) setError(`Couldn't load posts: ${describeDbError(error)}`);
    else setPosts(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function changeView(v: View) {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* private window etc. — the toggle still works for this visit */
    }
  }

  function onSaved(saved: LinkedInPost) {
    setPosts((ps) => {
      const i = ps.findIndex((p) => p.id === saved.id);
      return i === -1 ? [...ps, saved] : ps.map((p) => (p.id === saved.id ? saved : p));
    });
    // Follow a newly scheduled post to its month, so it doesn't vanish from view.
    if (saved.scheduled_at) setMonth(new Date(saved.scheduled_at));
    setEditing(null);
  }

  function onDeleted(id: string) {
    setPosts((ps) => ps.filter((p) => p.id !== id));
    setEditing(null);
  }

  function newOnDay(day: Date) {
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0);
    setEditing({ post: null, date: at.toISOString() });
  }

  // Search and status filter apply to both views.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return [p.post_code, p.hook, p.body, p.pillar, p.notes, p.source, ...p.hashtags]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [posts, query, statusFilter]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(POST_STATUSES.map((s) => [s, 0])) as Record<PostStatus, number>;
    posts.forEach((p) => c[p.status]++);
    return c;
  }, [posts]);

  return (
    <Page>
      <PageHeader
        title="LinkedIn"
        subtitle={`${posts.length} post${posts.length === 1 ? "" : "s"} · ${counts.scheduled} scheduled · ${counts.posted} posted`}
        actions={
          <>
            <div className="flex rounded-lg border border-slate-300 bg-white p-0.5" role="tablist">
              {(["month", "list"] as const).map((v) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => changeView(v)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    view === v ? "bg-brand-wash text-brand-deep" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {v === "month" ? "Month" : "List"}
                </button>
              ))}
            </div>
            {editable && (
              <Button variant="primary" onClick={() => setEditing({ post: null })}>
                New post
              </Button>
            )}
          </>
        }
      />

      {error && <ErrorBanner message={error} />}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Search hook, copy, code, hashtags…" />
        <div className="flex flex-wrap gap-1">
          {(["all", ...POST_STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === s ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s === "all" ? "All" : POST_STATUS_LABEL[s]}
              <span className="ml-1 opacity-70">{s === "all" ? posts.length : counts[s]}</span>
            </button>
          ))}
        </div>
      </div>

      {view === "month" ? (
        <MonthCalendar
          posts={shown}
          month={month}
          onMonthChange={setMonth}
          onOpen={(p) => setEditing({ post: p })}
          onNewOnDay={editable ? newOnDay : undefined}
        />
      ) : (
        <PostList
          posts={shown}
          loading={loading}
          emptyText={posts.length === 0 ? editable ? "No posts yet. Click “New post” to add one." : "No posts yet." : "No posts match."}
          onOpen={(p) => setEditing({ post: p })}
        />
      )}

      {editing && (
        <PostEditor
          key={editing.post?.id ?? `new-${editing.date ?? ""}`}
          post={editing.post}
          suggestedCode={nextPostCode(posts)}
          defaultScheduledAt={editing.date ?? null}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
    </Page>
  );
}
