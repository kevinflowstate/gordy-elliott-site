import type { SupabaseClient } from "@supabase/supabase-js";

/** Stable ordering and bounded ID batches avoid both PostgREST's row cap and URL limits. */
export async function loadTemplateRows<T extends { id: string } = { id: string }>(admin: SupabaseClient, table: string, select: string,
  filter?: { column: string; ids: string[] }) {
  const rows: T[] = [];
  const ids = filter ? [...new Set(filter.ids)] : null;
  const batches = ids ? Array.from({ length: Math.ceil(ids.length / 20) }, (_, i) => ids.slice(i * 20, i * 20 + 20)) : [null];
  for (const batch of batches) {
    for (let from = 0; ; from += 500) {
      let query = admin.from(table).select(select).order("id", { ascending: true }).range(from, from + 499);
      if (filter && batch) query = query.in(filter.column, batch);
      else query = query.eq("is_active", true);
      const { data, error } = await query;
      // Never hand the editor a partial plan after a failed page.
      if (error || !data) return { data: null, error: error || new Error("Missing template data") };
      rows.push(...data as unknown as T[]);
      if (data.length < 500) break;
    }
  }
  return { data: rows, error: null };
}

export const TEMPLATE_LOAD_VERSION = 2;
