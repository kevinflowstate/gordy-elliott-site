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

  const { data: logs, error } = await admin
    .from("client_exercise_logs")
    .select("*")
    .eq("client_id", clientId)
    .gte("log_date", fromDate)
    .order("log_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: logs || [] });
}
