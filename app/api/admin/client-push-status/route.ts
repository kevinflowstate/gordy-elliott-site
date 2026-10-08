import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NATIVE_PUSH_APP_ID } from "@/lib/native-push-contract";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const clientId = new URL(request.url).searchParams.get("client_id");
  if (!clientId || !/^[0-9a-f-]{36}$/i.test(clientId)) return NextResponse.json({ error: "Valid client_id is required" }, { status: 400 });
  const admin = createAdminClient();
  const { data: client, error: clientError } = await admin.from("client_profiles").select("user_id").eq("id", clientId).maybeSingle();
  if (clientError) return NextResponse.json({ error: "Could not load this client" }, { status: 503 });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const [native, web] = await Promise.all([
    admin.from("native_push_devices").select("platform,last_seen_at,disabled_at,failure_count,last_failure").eq("user_id", client.user_id).eq("app_id", NATIVE_PUSH_APP_ID).order("last_seen_at", { ascending: false }),
    admin.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", client.user_id),
  ]);
  if (native.error || web.error) return NextResponse.json({ error: "Notification registration status is temporarily unavailable" }, { status: 503 });
  return NextResponse.json({
    devices: native.data || [],
    webSubscriptions: web.count || 0,
    receiptVerified: false,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
