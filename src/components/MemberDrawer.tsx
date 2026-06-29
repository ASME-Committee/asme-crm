import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { STATUSES, STATUS_LABEL, type Member, type Status } from "@/lib/types";

type Props = {
  member: Member;
  onClose: () => void;
  onSaved: (m: Member) => void;
  onDeleted: (id: string) => void;
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm text-slate-800">{value}</div>
    </div>
  );
}

export function MemberDrawer({ member, onClose, onSaved, onDeleted }: Props) {
  const [status, setStatus] = useState<Status>(member.status);
  const [notes, setNotes] = useState(member.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(member.status);
    setNotes(member.notes ?? "");
    setError(null);
  }, [member]);

  const dirty = status !== member.status || (notes ?? "") !== (member.notes ?? "");

  async function save() {
    setSaving(true);
    setError(null);
    const { data, error } = await supabase
      .from("members")
      .update({ status, notes: notes || null })
      .eq("id", member.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved(data as Member);
  }

  async function remove() {
    if (!confirm(`Delete ${member.full_name}? This cannot be undone.`)) return;
    setSaving(true);
    const { error } = await supabase.from("members").delete().eq("id", member.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onDeleted(member.id);
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <aside className="relative z-50 flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">{member.full_name}</h2>
            <a href={`mailto:${member.email}`} className="text-sm text-brand hover:underline">
              {member.email}
            </a>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            ✕
          </button>
        </div>

        <div className="space-y-4 p-5">
          <Field label="Role" value={member.role} />
          <Field label="Specialty / stage" value={member.specialty} />
          <Field label="City / State" value={member.city} />
          <Field
            label="LinkedIn"
            value={
              member.linkedin_url ? (
                <a href={member.linkedin_url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                  {member.linkedin_url}
                </a>
              ) : null
            }
          />
          <Field label="Message" value={member.message ? <span className="whitespace-pre-wrap">{member.message}</span> : null} />
          <Field label="Source" value={member.source} />
          <Field label="Applied" value={new Date(member.created_at).toLocaleString()} />

          <div className="border-t border-slate-200 pt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Internal notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Private notes for the committee…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-200 p-5">
          <button
            onClick={remove}
            disabled={saving}
            className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </aside>
    </div>
  );
}
