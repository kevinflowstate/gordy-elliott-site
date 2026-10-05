import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPPORT_STATUSES } from "@/lib/support-contract";
export const SUPPORT_REPORT_FIELDS =
  "id,reference,name,email,area,description,expected,impact,device,page,status,priority,owner,internal_notes,resolution,image_path,created_at,updated_at";
export async function listSupportQueuePage(
  admin: SupabaseClient,
  filter: string,
  page: number,
) {
  if (
    !["Open", "All", ...SUPPORT_STATUSES].includes(filter) ||
    !Number.isSafeInteger(page) ||
    page < 0 ||
    page > 100000
  )
    throw new Error("Invalid queue view.");
  let query = admin
    .from("support_reports")
    .select(SUPPORT_REPORT_FIELDS, { count: "exact" });
  if (filter === "Open")
    query = query.not("status", "in", "(Resolved,Duplicate)");
  else if (filter !== "All") query = query.eq("status", filter);
  return query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(page * 50, page * 50 + 49);
}
