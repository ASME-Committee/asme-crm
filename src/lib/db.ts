import { supabase } from "./supabase";

/**
 * Fetch every row of a table, paging past Supabase's per-request row cap
 * (1000 by default). Without this a table with >1000 rows silently truncates —
 * e.g. the dashboard showing "1000 members" when there are more.
 */
export async function fetchAll<T>(
  table: string,
  columns: string,
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const PAGE = 1000;
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) return { data: null, error };
    const batch = (data ?? []) as T[];
    all.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return { data: all, error: null };
}
