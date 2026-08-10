import { getTerraReferenceId, getTerraUsersByReferenceId } from "@/lib/terra/client";
import {
  normaliseTerraProvider,
  normaliseTerraScopes,
  TERRA_CONSENT_VERSION,
} from "@/lib/terra/events";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const PUBLIC_CONNECTION_FIELDS = "id, client_id, provider, status, last_sync_at, connected_at, disconnected_at, consent_version, consented_at, created_at, updated_at";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const provider = normaliseTerraProvider(body.provider);
  if (!provider) return NextResponse.json({ error: "That connected app is not available." }, { status: 400 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Client profile not found" }, { status: 404 });

  const { data: connection, error: connectionError } = await admin
    .from("client_wearable_connections")
    .select(PUBLIC_CONNECTION_FIELDS)
    .eq("client_id", profile.id)
    .eq("provider", provider)
    .maybeSingle();
  if (connectionError) return NextResponse.json({ error: connectionError.message }, { status: 500 });
  if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  if (connection.consent_version !== TERRA_CONSENT_VERSION || !connection.consented_at) {
    return NextResponse.json({ error: "Health-data consent is required before connecting." }, { status: 400 });
  }
  if (connection.status === "disconnected") {
    return NextResponse.json({ connection, reconciled: false });
  }
  if (connection.status === "connected") {
    return NextResponse.json({ connection, reconciled: false });
  }

  try {
    const referenceId = getTerraReferenceId(profile.id);
    const users = await getTerraUsersByReferenceId(referenceId);
    const terraUser = users.find((candidate) => (
      candidate.active !== false && normaliseTerraProvider(candidate.provider) === provider
    ));
    if (!terraUser) return NextResponse.json({ connection, reconciled: false });

    const now = new Date().toISOString();
    const scopes = normaliseTerraScopes(terraUser.scopes);
    const { data: updated, error: updateError } = await admin
      .from("client_wearable_connections")
      .update({
        terra_user_id: terraUser.user_id,
        reference_id: referenceId,
        status: "connected",
        connected_at: connection.connected_at || now,
        disconnected_at: null,
        ...(scopes.length ? { scopes } : {}),
        raw_user: terraUser,
        updated_at: now,
      })
      .eq("id", connection.id)
      .eq("client_id", profile.id)
      .in("status", ["pending", "error"])
      .select(PUBLIC_CONNECTION_FIELDS)
      .maybeSingle();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ connection: updated || connection, reconciled: Boolean(updated) });
  } catch {
    return NextResponse.json(
      { connection, reconciled: false, retryable: true },
      { status: 202 },
    );
  }
}
