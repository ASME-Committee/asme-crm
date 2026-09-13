/**
 * The CRM reads the same Supabase tables the public website writes to:
 *   - `memberships`      — the /join membership applications
 *   - `contact_messages` — the /contact enquiry form
 *
 * Both store every form field in a single `data` jsonb column, so the schema
 * never has to change when the forms gain a field. The CRM renders that jsonb
 * generically (see lib/fields.ts) and only pins down the handful of columns it
 * shows in list views.
 */

/** Free-form submission payload: the form's field names mapped to their values.
 *  Values are usually strings; multi-selects (uses, contributions, reasons) are
 *  string arrays. */
export type SubmissionData = Record<string, unknown>;

/** Workflow status the committee sets on a membership from inside the CRM.
 *  Stored in a `status` column added to the memberships table (see
 *  supabase/crm-policies.sql). Rows created by the website have no status yet,
 *  which we treat as "new". */
export const MEMBER_STATUSES = [
  "new",
  "contacted",
  "member",
  "paused",
  "declined",
] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  new: "New",
  contacted: "Contacted",
  member: "Member",
  paused: "Paused",
  declined: "Declined",
};

export const MEMBER_STATUS_STYLE: Record<MemberStatus, string> = {
  new: "bg-blue-50 text-brand-deep ring-1 ring-blue-100",
  contacted: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
  member: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
  paused: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  declined: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
};

export type Membership = {
  id: string;
  created_at: string;
  status: MemberStatus | null;
  data: SubmissionData;
};

export type ContactMessage = {
  id: string;
  created_at: string;
  data: SubmissionData;
};
