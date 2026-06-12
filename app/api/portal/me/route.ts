import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Used by sidebar and settings to get current user info
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = user.id;

  const { data: userData } = await admin
    .from("users")
    .select("full_name, avatar_url, role")
    .eq("id", userId)
    .maybeSingle();

  const { data: profile } = await admin
    .from("client_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: keyDates } = profile?.id
    ? await admin
        .from("client_key_dates")
        .select("id, client_id, label, date, recurring, created_at")
        .eq("client_id", profile.id)
        .order("date", { ascending: true })
    : { data: [] };

  return NextResponse.json({
    userId,
    fullName: userData?.full_name || "",
    avatarUrl: userData?.avatar_url || null,
    role: userData?.role || "client",
    profile: profile ? { ...profile, key_dates: keyDates || [] } : null,
    keyDates: keyDates || [],
    tier: (profile?.tier as string) || "coached",
  });
}
