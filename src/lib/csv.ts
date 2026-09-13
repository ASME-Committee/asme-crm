import type { SubmissionData } from "./types";
import { displayValue, labelFor } from "./fields";

/** Escape one CSV cell (RFC 4180). */
function esc(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Flatten a set of jsonb submissions into a CSV. Columns are the union of every
 * field seen across the rows (so no submission loses a field), plus the row's
 * id/created_at/status. Column order follows the labels helper.
 */
export function submissionsToCsv(
  rows: { id: string; created_at: string; status?: string | null; data: SubmissionData }[],
): string {
  const fieldKeys = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r.data)) {
      if (k !== "created_at") fieldKeys.add(k);
    }
  }
  const keys = [...fieldKeys];
  const hasStatus = rows.some((r) => "status" in r);

  const header = [
    "Submitted",
    ...(hasStatus ? ["Status"] : []),
    ...keys.map(labelFor),
  ];
  const lines = rows.map((r) =>
    [
      new Date(r.created_at).toISOString(),
      ...(hasStatus ? [r.status ?? "new"] : []),
      ...keys.map((k) => displayValue(r.data[k])),
    ]
      .map(esc)
      .join(","),
  );
  return [header.map(esc).join(","), ...lines].join("\n");
}

export function downloadCsv(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
