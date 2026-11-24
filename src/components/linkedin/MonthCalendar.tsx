import { useMemo } from "react";
import { Card } from "@/components/ui";
import {
  PILLARS,
  POST_STATUS_LABEL,
  POST_STATUS_STYLE,
  pillarStyle,
  postTitle,
  NO_PILLAR_STYLE,
  type LinkedInPost,
} from "@/lib/linkedin";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "YYYY-MM-DD" for a Date, in the viewer's local timezone. */
function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function timeLabel(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })
    .replace(" ", "")
    .toLowerCase();
}

/**
 * Month view: a Monday-first grid on tablet/desktop, a day-by-day agenda on
 * phones, and the unscheduled backlog underneath.
 * `month` is any date inside the month to show.
 */
export function MonthCalendar({
  posts,
  month,
  onMonthChange,
  onOpen,
  onNewOnDay,
}: {
  posts: LinkedInPost[];
  month: Date;
  onMonthChange: (d: Date) => void;
  onOpen: (p: LinkedInPost) => void;
  /** Start a new post on this day (9:00am local). Omit to hide the + buttons. */
  onNewOnDay?: (day: Date) => void;
}) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const todayKey = dayKey(new Date());

  // Every day cell shown: from the Monday on/before the 1st to fill whole weeks.
  const cells = useMemo(() => {
    const first = new Date(year, monthIndex, 1);
    const offset = (first.getDay() + 6) % 7; // 0 = Monday
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const total = Math.ceil((offset + daysInMonth) / 7) * 7;
    return Array.from({ length: total }, (_, i) => new Date(year, monthIndex, 1 - offset + i));
  }, [year, monthIndex]);

  // Posts grouped by local day, each day sorted by time.
  const byDay = useMemo(() => {
    const map = new Map<string, LinkedInPost[]>();
    for (const p of posts) {
      if (!p.scheduled_at) continue;
      const k = dayKey(new Date(p.scheduled_at));
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    map.forEach((list) => list.sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!)));
    return map;
  }, [posts]);

  const backlog = posts.filter((p) => !p.scheduled_at);
  const inMonth = (d: Date) => d.getMonth() === monthIndex;
  const monthDaysWithPosts = cells.filter((d) => inMonth(d) && byDay.has(dayKey(d)));
  const shift = (n: number) => onMonthChange(new Date(year, monthIndex + n, 1));

  return (
    <div className="space-y-4">
      <div className="min-w-0">
        {/* Month navigation */}
        <div className="mb-3 flex items-center gap-2">
          <h2 className="mr-auto text-lg font-semibold text-ink">
            {month.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
          </h2>
          <NavButton onClick={() => shift(-1)} label="Previous month">‹</NavButton>
          <button
            onClick={() => onMonthChange(new Date())}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Today
          </button>
          <NavButton onClick={() => shift(1)} label="Next month">›</NavButton>
        </div>

        {/* Grid: tablet and up */}
        <Card className="hidden overflow-hidden md:block">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              const k = dayKey(d);
              const dayPosts = byDay.get(k) ?? [];
              return (
                <div
                  key={k}
                  className={`group min-h-[6.5rem] border-slate-100 p-1.5 ${i % 7 !== 6 ? "border-r" : ""} ${
                    i < cells.length - 7 ? "border-b" : ""
                  } ${inMonth(d) ? "bg-white" : "bg-slate-50/70"}`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs ${
                        k === todayKey
                          ? "bg-brand font-semibold text-white"
                          : inMonth(d)
                            ? "text-slate-700"
                            : "text-slate-300"
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    {onNewOnDay && (
                      <button
                        onClick={() => onNewOnDay(d)}
                        className="rounded px-1.5 text-sm leading-5 text-slate-400 opacity-0 hover:bg-slate-100 hover:text-brand focus:opacity-100 group-hover:opacity-100"
                        aria-label={`New post on ${d.toLocaleDateString("en-AU")}`}
                        title="New post on this day"
                      >
                        +
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayPosts.map((p) => (
                      <PostChip key={p.id} post={p} onClick={() => onOpen(p)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Agenda: phones */}
        <Card className="divide-y divide-slate-100 md:hidden">
          {monthDaysWithPosts.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">Nothing scheduled this month.</p>
          ) : (
            monthDaysWithPosts.map((d) => (
              <div key={dayKey(d)} className="px-4 py-3">
                <div
                  className={`mb-1.5 text-xs font-medium uppercase tracking-wide ${
                    dayKey(d) === todayKey ? "text-brand" : "text-slate-500"
                  }`}
                >
                  {d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                </div>
                <div className="space-y-1">
                  {byDay.get(dayKey(d))!.map((p) => (
                    <PostChip key={p.id} post={p} onClick={() => onOpen(p)} />
                  ))}
                </div>
              </div>
            ))
          )}
        </Card>

        {/* Pillar legend */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {PILLARS.map((p) => (
            <span key={p} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${pillarStyle(p).dot}`} />
              {p}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${NO_PILLAR_STYLE.dot}`} />
            No pillar
          </span>
          <span className="inline-flex items-center gap-1.5">✓ Posted</span>
        </div>
      </div>

      {/* Unscheduled backlog */}
      <Card>
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-ink">Unscheduled</h3>
          <p className="text-xs text-slate-400">
            {backlog.length} post{backlog.length === 1 ? "" : "s"} without a date
          </p>
        </div>
        {backlog.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-slate-400">Everything has a date.</p>
        ) : (
          <ul className="grid max-h-[24rem] overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {backlog.map((p) => (
              <li key={p.id} className="border-b border-slate-100">
                <button onClick={() => onOpen(p)} className="w-full px-4 py-2.5 text-left hover:bg-slate-50">
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${pillarStyle(p.pillar).dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-800">{postTitle(p)}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                        <span
                          className={`rounded-full px-2 py-px text-[11px] font-medium ${POST_STATUS_STYLE[p.status]}`}
                        >
                          {POST_STATUS_LABEL[p.status]}
                        </span>
                        {p.post_code}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** One post on the calendar: time + title, coloured by pillar. */
function PostChip({ post, onClick }: { post: LinkedInPost; onClick: () => void }) {
  const posted = post.status === "posted";
  return (
    <button
      onClick={onClick}
      title={`${postTitle(post)}\n${POST_STATUS_LABEL[post.status]}${post.post_code ? ` · ${post.post_code}` : ""}`}
      className={`block w-full rounded-md px-1.5 py-1 text-left text-[11px] leading-tight ring-1 transition hover:brightness-95 ${
        pillarStyle(post.pillar).chip
      } ${posted ? "opacity-60" : ""}`}
    >
      <span className="block font-semibold">
        {posted ? "✓ " : ""}
        {timeLabel(post.scheduled_at!)}
      </span>
      <span className="line-clamp-2 break-words">{postTitle(post)}</span>
    </button>
  );
}

function NavButton({ onClick, label, children }: { onClick: () => void; label: string; children: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="h-8 w-8 rounded-lg border border-slate-300 bg-white text-lg leading-none text-slate-600 hover:bg-slate-50"
    >
      {children}
    </button>
  );
}
