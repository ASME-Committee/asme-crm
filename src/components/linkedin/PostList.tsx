import { useMemo, useState, type ReactNode } from "react";
import { Card, EmptyRow } from "@/components/ui";
import {
  POST_STATUSES,
  POST_STATUS_LABEL,
  POST_STATUS_STYLE,
  formatScheduled,
  pillarStyle,
  postTitle,
  type LinkedInPost,
} from "@/lib/linkedin";

type SortKey = "date" | "status" | "pillar";

/** Sortable table of posts. Unscheduled posts always sit at the bottom by date. */
export function PostList({
  posts,
  loading,
  emptyText,
  onOpen,
}: {
  posts: LinkedInPost[];
  loading: boolean;
  emptyText: string;
  onOpen: (p: LinkedInPost) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "date", asc: true });

  const sorted = useMemo(() => {
    const dir = sort.asc ? 1 : -1;
    return [...posts].sort((a, b) => {
      if (sort.key === "date") {
        if (!a.scheduled_at || !b.scheduled_at) return a.scheduled_at ? -1 : b.scheduled_at ? 1 : 0;
        return a.scheduled_at.localeCompare(b.scheduled_at) * dir;
      }
      if (sort.key === "status") return (POST_STATUSES.indexOf(a.status) - POST_STATUSES.indexOf(b.status)) * dir;
      return (a.pillar ?? "~").localeCompare(b.pillar ?? "~") * dir;
    });
  }, [posts, sort]);

  const sortBy = (key: SortKey) => setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: true }));
  const arrow = (key: SortKey) => (sort.key === key ? (sort.asc ? " ↑" : " ↓") : "");

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <SortTh onClick={() => sortBy("date")}>Scheduled{arrow("date")}</SortTh>
              <th className="px-4 py-3 font-medium">Post</th>
              <SortTh onClick={() => sortBy("pillar")} className="hidden md:table-cell">
                Pillar{arrow("pillar")}
              </SortTh>
              <SortTh onClick={() => sortBy("status")}>Status{arrow("status")}</SortTh>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <EmptyRow colSpan={4} text="Loading…" />
            ) : sorted.length === 0 ? (
              <EmptyRow colSpan={4} text={emptyText} />
            ) : (
              sorted.map((p) => (
                <tr key={p.id} onClick={() => onOpen(p)} className="cursor-pointer hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    <span className={p.scheduled_at ? "" : "italic text-slate-400"}>
                      {formatScheduled(p.scheduled_at)}
                    </span>
                  </td>
                  <td className="max-w-[28rem] px-4 py-3">
                    <div className="truncate font-medium text-slate-900">{postTitle(p)}</div>
                    <div className="text-xs text-slate-400">{p.post_code ?? "No code"}</div>
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-slate-600 md:table-cell">
                    {p.pillar ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${pillarStyle(p.pillar).dot}`} />
                        {p.pillar}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${POST_STATUS_STYLE[p.status]}`}
                    >
                      {POST_STATUS_LABEL[p.status]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SortTh({ children, onClick, className = "" }: { children: ReactNode; onClick: () => void; className?: string }) {
  return (
    <th className={`px-4 py-3 font-medium ${className}`}>
      <button onClick={onClick} className="uppercase tracking-wide hover:text-slate-800">
        {children}
      </button>
    </th>
  );
}
