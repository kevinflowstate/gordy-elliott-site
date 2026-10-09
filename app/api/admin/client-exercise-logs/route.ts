import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// GET: Fetch exercise logs for a client (recent 7 days or by date range)
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });

  const admin = createAdminClient();

  // Default: last 7 days
  const fromDate = searchParams.get("from") || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  })();

  const toDate = searchParams.get("to") || (() => {
    return new Date().toISOString().split("T")[0];
  })();

  let query = admin
    .from("client_exercise_logs")
    .select("*")
    .eq("client_id", clientId)
    .gte("log_date", fromDate)
    .order("log_date", { ascending: false });

  if (toDate) {
    query = query.lte("log_date", toDate);
  }

  const { data: logs, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (searchParams.get("summaries") === "1") {
    const { data: summaries, error: summaryError } = await admin
      .from("client_exercise_session_summaries")
      .select("session_id, log_date, completed_at, completed_sets")
      .eq("client_id", clientId)
      .gte("log_date", fromDate)
      .lte("log_date", toDate)
      .order("log_date", { ascending: false });
    if (summaryError) return NextResponse.json({ error: "Could not load workout summaries" }, { status: 500 });
    return NextResponse.json({ logs: logs || [], summaries: summaries || [] });
  }
  return NextResponse.json({ logs: logs || [] });
}
