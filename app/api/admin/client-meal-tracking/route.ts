import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// GET: Fetch meal tracking records for a client for a date range
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
    const d = new Date();
    return d.toISOString().split("T")[0];
  })();

  const { data: tracking, error } = await admin
    .from("client_meal_tracking")
    .select("*")
    .eq("client_id", clientId)
    .gte("tracked_date", fromDate)
    .lte("tracked_date", toDate)
    .order("tracked_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tracking: tracking || [] });
}
