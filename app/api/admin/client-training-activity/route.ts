import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Coach read-only view of client-entered activity and rest days (most recent 60). */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId || !UUID.test(clientId)) return NextResponse.json({ error: "Choose a client." }, { status: 400 });
  const { data, error } = await createAdminClient()
    .from("client_manual_training_activity")
    .select("*")
    .eq("client_id", clientId)
    .order("activity_date", { ascending: false })
    .limit(60);
  if (error) return NextResponse.json({ error: "Couldn't load manually recorded activity." }, { status: 500 });
  return NextResponse.json({ activities: data || [] });
}
