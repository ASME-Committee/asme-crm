import type { SubmissionData } from "./types";

/**
 * Human labels for the form field names stored in the `data` jsonb. Keys mirror
 * the `name=` attributes on the website forms (JoinForm / ContactForm). Any key
 * not listed here still renders in the detail view, just with a de-camelCased
 * fallback label, so a new form field is never hidden.
 */
export const FIELD_LABELS: Record<string, string> = {
  // Membership (JoinForm)
  firstName: "First name",
  familyName: "Family name",
  email: "Email",
  based: "Based",
  gender: "Gender",
  age: "Age range",
  clinicalProfession: "Clinical profession",
  medicalSpeciality: "Medical speciality",
  currentUse: "How they'd use ASME",
  uses: "Interested in",
  contribute: "Willing to contribute",
  contributions: "Can contribute",
  contributeOther: "Other contribution",
  howFound: "How they found ASME",
  // Contact (ContactForm)
  name: "Name",
  organisation: "Organisation",
  message: "Message",
  reasons: "Enquiry about",
};

/** The order fields appear in the detail view. Anything not listed follows,
 *  in insertion order. */
const FIELD_ORDER = [
  "firstName",
  "familyName",
  "name",
  "email",
  "organisation",
  "based",
  "clinicalProfession",
  "medicalSpeciality",
  "gender",
  "age",
  "reasons",
  "currentUse",
  "uses",
  "contribute",
  "contributions",
  "contributeOther",
  "message",
  "howFound",
];

export function labelFor(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  // Fallback: split camelCase / snake_case into words.
  const spaced = key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Render any jsonb value as display text. Arrays become comma lists; booleans
 *  become Yes/No; objects are JSON-stringified as a last resort. */
export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Ordered [key, value] pairs for a submission, for the detail view. Skips the
 *  `created_at` the forms echo into `data`, since the row already has one. */
export function orderedEntries(data: SubmissionData): [string, unknown][] {
  const keys = Object.keys(data).filter((k) => k !== "created_at");
  keys.sort((a, b) => {
    const ia = FIELD_ORDER.indexOf(a);
    const ib = FIELD_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return keys.map((k) => [k, data[k]]);
}

/** Best-effort full name from a membership payload. */
export function memberName(data: SubmissionData): string {
  const first = (data.firstName as string) ?? "";
  const family = (data.familyName as string) ?? "";
  const full = `${first} ${family}`.trim();
  if (full) return full;
  return (data.name as string) ?? (data.email as string) ?? "Unknown";
}

export function fieldText(data: SubmissionData, key: string): string {
  return displayValue(data[key]);
}
