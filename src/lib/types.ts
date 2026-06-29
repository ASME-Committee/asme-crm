export const STATUSES = [
  "new",
  "contacted",
  "member",
  "declined",
  "paused",
] as const;

export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  new: "New",
  contacted: "Contacted",
  member: "Member",
  declined: "Declined",
  paused: "Paused",
};

export const STATUS_STYLE: Record<Status, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-amber-100 text-amber-800",
  member: "bg-emerald-100 text-emerald-800",
  declined: "bg-slate-200 text-slate-600",
  paused: "bg-purple-100 text-purple-800",
};

export type Member = {
  id: string;
  created_at: string;
  updated_at: string;
  full_name: string;
  email: string;
  role: string | null;
  specialty: string | null;
  city: string | null;
  linkedin_url: string | null;
  message: string | null;
  source: string | null;
  status: Status;
  notes: string | null;
};
