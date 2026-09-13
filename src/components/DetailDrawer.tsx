import { useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  MEMBER_STATUSES,
  MEMBER_STATUS_LABEL,
  type MemberStatus,
  type SubmissionData,
} from "@/lib/types";
import { orderedEntries, labelFor, displayValue } from "@/lib/fields";

/**
 * Slide-over showing every field of one submission. Used for both members and
 * enquiries. When `memberId` is provided, the committee can set a workflow
 * status and it is saved back to the memberships row.
 */
export function DetailDrawer({
  title,
  subtitle,
  createdAt,
  data,
  memberId,
  status,
  onClose,
  onStatusSaved,
}: {
  title: string;
  subtitle?: string;
  createdAt: string;
  data: SubmissionData;
  memberId?: string;
  status?: MemberStatus | null;
  onClose: () => void;
  onStatusSaved?: (status: MemberStatus) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<MemberStatus>(status ?? "new");

  async function changeStatus(next: MemberStatus) {
    if (!memberId) return;
    setError(null);
    setSaving(true);
    setCurrent(next);
    const { error } = await supabase
      .from("memberships")
      .update({ status: next })
      .eq("id", memberId);
    setSaving(false);
    if (error) {
      setError(error.message);
      setCurrent(status ?? "new");
      return;
    }
    onStatusSaved?.(next);
  }

  const entries = orderedEntries(data);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-ink/30"
        onClick={onClose}
        aria-hidden
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-ink">{title}</h2>
            {subtitle && <p className="truncate text-sm text-slate-500">{subtitle}</p>}
            <p className="mt-1 text-xs text-slate-400">
              Submitted {new Date(createdAt).toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {memberId && (
          <div className="border-b border-slate-100 px-6 py-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Status
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MEMBER_STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={saving}
                  onClick={() => changeStatus(s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
                    current === s
                      ? "bg-brand text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {MEMBER_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <dl className="space-y-4">
            {entries.map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {labelFor(key)}
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-800">
                  {key === "email" ? (
                    <a
                      href={`mailto:${String(value)}`}
                      className="text-brand-deep hover:underline"
                    >
                      {displayValue(value)}
                    </a>
                  ) : (
                    displayValue(value)
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>
    </div>
  );
}
