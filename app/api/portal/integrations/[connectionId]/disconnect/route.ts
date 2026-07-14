import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Client profile not found" }, { status: 404 });

  const { connectionId } = await params;
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("client_wearable_connections")
    .update({
      status: "disconnected",
      disconnected_at: now,
      updated_at: now,
    })
    .eq("id", connectionId)
    .eq("client_id", profile.id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

  return NextResponse.json({ connection: data });
}
