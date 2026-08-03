import { deauthenticateTerraUser } from "@/lib/terra/client";
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
  const { data: connection, error: connectionError } = await admin
    .from("client_wearable_connections")
    .select("id, client_id, status, terra_user_id, raw_user")
    .eq("id", connectionId)
    .eq("client_id", profile.id)
    .maybeSingle();

  if (connectionError) return NextResponse.json({ error: connectionError.message }, { status: 500 });
  if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  if (connection.status === "disconnected") {
    return NextResponse.json({ connection, alreadyDisconnected: true });
  }

  const isMock = connection.raw_user && typeof connection.raw_user === "object"
    && "mock" in connection.raw_user && connection.raw_user.mock === true;
  if (connection.terra_user_id && !isMock) {
    try {
      await deauthenticateTerraUser(connection.terra_user_id);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Terra could not disconnect this account." },
        { status: 502 },
      );
    }
  }

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
  if (!data) return NextResponse.json({ error: "Connection changed while it was being disconnected." }, { status: 409 });

  return NextResponse.json({ connection: data });
}
