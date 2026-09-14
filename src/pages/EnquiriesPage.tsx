import { useEffect, useMemo, useState } from "react";
import { fetchAll } from "@/lib/db";
import type { ContactMessage } from "@/lib/types";
import { fieldText, displayValue } from "@/lib/fields";
import { submissionsToCsv, downloadCsv } from "@/lib/csv";
import { DetailDrawer } from "@/components/DetailDrawer";
import { Page, PageHeader, Button, SearchInput, ErrorBanner, EmptyRow, Card } from "@/components/ui";

export function EnquiriesPage() {
  const [rows, setRows] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ContactMessage | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await fetchAll<ContactMessage>("contact_messages", "id, created_at, data");
    if (error) setError(error.message);
    else setRows(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((m) =>
      [
        fieldText(m.data, "name"),
        fieldText(m.data, "email"),
        fieldText(m.data, "organisation"),
        fieldText(m.data, "reasons"),
        fieldText(m.data, "message"),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  return (
    <Page>
      <PageHeader
        title="Enquiries"
        subtitle={`${rows.length} contact message${rows.length === 1 ? "" : "s"}`}
        actions={
          <Button
            onClick={() =>
              downloadCsv(
                `asme-enquiries-${new Date().toISOString().slice(0, 10)}.csv`,
                submissionsToCsv(filtered.map((m) => ({ id: m.id, created_at: m.created_at, data: m.data }))),
              )
            }
          >
            Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search name, email, organisation, message…"
        />
      </div>

      {error && <ErrorBanner message={error} />}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">From</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">About</th>
                <th className="px-4 py-3 font-medium">Message</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <EmptyRow colSpan={4} text="Loading…" />
              ) : filtered.length === 0 ? (
                <EmptyRow colSpan={4} text="No enquiries match." />
              ) : (
                filtered.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => setSelected(m)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{fieldText(m.data, "name")}</div>
                      <div className="text-xs text-slate-400">{fieldText(m.data, "email")}</div>
                    </td>
                    <td className="hidden max-w-[14rem] px-4 py-3 text-slate-600 md:table-cell">
                      {displayValue(m.data.reasons)}
                    </td>
                    <td className="max-w-[22rem] truncate px-4 py-3 text-slate-600">
                      {fieldText(m.data, "message")}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && (
        <DetailDrawer
          title={fieldText(selected.data, "name")}
          subtitle={displayValue(selected.data.reasons)}
          createdAt={selected.created_at}
          data={selected.data}
          onClose={() => setSelected(null)}
        />
      )}
    </Page>
  );
}
