import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  defaultNativePushEnvironment,
  NATIVE_PUSH_APP_ID,
  normalizeApnsToken,
  normalizeNativePushEnvironment,
} from "@/lib/native-push-contract";

export const runtime = "nodejs";

function databaseFailure(operation: string, error: { message: string }) {
  console.error(`Native push ${operation} failed:`, error.message);
  return NextResponse.json({ error: "Unable to update notification settings" }, { status: 500 });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { count, error } = await admin
    .from("native_push_devices")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("app_id", NATIVE_PUSH_APP_ID)
    .is("disabled_at", null);

  if (error) return databaseFailure("status lookup", error);
  return NextResponse.json({ registered: (count || 0) > 0, deviceCount: count || 0 });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const token = normalizeApnsToken(body?.token);
  if (!token) return NextResponse.json({ error: "A valid APNs token is required" }, { status: 400 });

  // Older TestFlight builds do not include the build marker, so production remains
  // the backward-compatible fallback until all review devices are on build 2.
  const suppliedEnvironment = body?.environment;
  const normalizedEnvironment = normalizeNativePushEnvironment(suppliedEnvironment);
  if (suppliedEnvironment != null && !normalizedEnvironment) {
    return NextResponse.json({ error: "A valid APNs environment is required" }, { status: 400 });
  }
  const environment = normalizedEnvironment || defaultNativePushEnvironment();
  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin.from("native_push_devices").upsert({
    user_id: user.id,
    platform: "ios",
    token,
    app_id: NATIVE_PUSH_APP_ID,
    environment,
    last_seen_at: now,
    disabled_at: null,
    failure_count: 0,
    last_failure: null,
    updated_at: now,
  }, { onConflict: "token,app_id,environment" });

  if (error) return databaseFailure("registration", error);
  return NextResponse.json({ success: true, environment });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const token = normalizeApnsToken(body?.token);
  if (!token) return NextResponse.json({ error: "A valid APNs token is required" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("native_push_devices")
    .delete()
    .eq("user_id", user.id)
    .eq("token", token)
    .eq("app_id", NATIVE_PUSH_APP_ID);

  if (error) return databaseFailure("removal", error);
  return NextResponse.json({ success: true });
}
