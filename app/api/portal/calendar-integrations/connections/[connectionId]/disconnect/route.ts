import { getComposioClient } from "@/lib/composio/client";
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
  const { data: connection, error } = await admin
    .from("client_calendar_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("client_id", profile.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!connection) return NextResponse.json({ error: "Calendar connection not found" }, { status: 404 });

  try {
    if (connection.composio_connected_account_id) {
      await getComposioClient().connectedAccounts.delete(connection.composio_connected_account_id);
    }
  } catch (disconnectError) {
    try {
      const remoteAccounts = await getComposioClient().connectedAccounts.list({
        userIds: [connection.composio_user_id],
        limit: 100,
      }, { signal: AbortSignal.timeout(10_000) });
      if (remoteAccounts.items.some((account) => account.id === connection.composio_connected_account_id)) {
        throw disconnectError;
      }
    } catch {
      return NextResponse.json(
        { error: "We couldn't revoke calendar access right now. Please try again." },
        { status: 502 },
      );
    }
  }

  const now = new Date().toISOString();
  const [deleteResult, updateResult] = await Promise.all([
    admin.from("client_calendar_events").delete().eq("connection_id", connectionId),
    admin
      .from("client_calendar_connections")
      .update({
        status: "disconnected",
        composio_connected_account_id: null,
        disconnected_at: now,
        last_error: null,
        updated_at: now,
      })
      .eq("id", connectionId)
      .eq("client_id", profile.id),
  ]);
  if (deleteResult.error) return NextResponse.json({ error: deleteResult.error.message }, { status: 500 });
  if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
