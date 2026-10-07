import { generateTerraWidgetSession, getTerraConfig, getTerraReferenceId } from "@/lib/terra/client";
import { normaliseTerraProvider, matchesTerraConnectionAttempt, TERRA_CONSENT_VERSION } from "@/lib/terra/events";
import { createMockWearableSummary } from "@/lib/wearable-mock";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function getClientContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return { error: NextResponse.json({ error: "Client profile not found" }, { status: 404 }) };
  return { admin, profile };
}

export async function POST(request: Request) {
  const context = await getClientContext();
  if (context.error) return context.error;
  const { admin, profile } = context;

  const body = await request.json().catch(() => ({}));
  const provider = normaliseTerraProvider(body.provider);
  if (!provider) {
    return NextResponse.json({ error: "That connected app is not available." }, { status: 400 });
  }
  if (provider === "whoop" && !getTerraConfig().whoopEnabled) {
    return NextResponse.json({ error: "WHOOP is awaiting final provider setup and testing." }, { status: 400 });
  }
  if (body.consent !== true) {
    return NextResponse.json(
      { error: "Confirm the health-data notice before connecting an app." },
      { status: 400 },
    );
  }

  const { data: existingConnection, error: existingConnectionError } = await admin
    .from("client_wearable_connections")
    .select("status")
    .eq("client_id", profile.id)
    .eq("provider", provider)
    .maybeSingle();
  if (existingConnectionError) {
    return NextResponse.json({ error: existingConnectionError.message }, { status: 500 });
  }
  if (existingConnection?.status === "connected") {
    return NextResponse.json({ error: "This app is already connected." }, { status: 409 });
  }

  const now = new Date().toISOString();
  let session;
  try {
    session = await generateTerraWidgetSession(profile.id, provider, {
      nativeReturn: body.native === true,
      attemptStartedAt: now,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Terra connection could not be started" },
      { status: 500 },
    );
  }

  if (session.mock) {
    const referenceId = getTerraReferenceId(profile.id);
    const terraUserId = `mock-${provider}-${profile.id}`;
    const { data: connection, error: connectionError } = await admin
      .from("client_wearable_connections")
      .upsert({
        client_id: profile.id,
        provider,
        terra_user_id: terraUserId,
        reference_id: referenceId,
        status: "connected",
        connected_at: now,
        disconnected_at: null,
        last_sync_at: now,
        consent_version: TERRA_CONSENT_VERSION,
        consented_at: now,
        raw_user: { mock: true, provider, terra_user_id: terraUserId },
        updated_at: now,
      }, { onConflict: "client_id,provider" })
      .select("*")
      .single();

    if (connectionError) return NextResponse.json({ error: connectionError.message }, { status: 500 });

    const summary = createMockWearableSummary(provider);
    const { error: summaryError } = await admin
      .from("client_wearable_daily_summaries")
      .upsert({
        client_id: profile.id,
        ...summary,
        updated_at: now,
      }, { onConflict: "client_id,summary_date" });

    if (summaryError) return NextResponse.json({ error: summaryError.message }, { status: 500 });

    return NextResponse.json({
      ...session,
      connection,
      message: "Preview data connected. Terra credentials are not configured yet.",
    });
  }

  const { error: pendingConnectionError } = await admin
    .from("client_wearable_connections")
    .upsert({
      client_id: profile.id,
      provider,
      reference_id: getTerraReferenceId(profile.id),
      status: "pending",
      connected_at: null,
      consent_version: TERRA_CONSENT_VERSION,
      consented_at: now,
      disconnected_at: null,
      updated_at: now,
    }, { onConflict: "client_id,provider" });

  if (pendingConnectionError) {
    return NextResponse.json({ error: pendingConnectionError.message }, { status: 500 });
  }

  return NextResponse.json({ ...session, attemptStartedAt: now });
}

export async function PATCH(request: Request) {
  const context = await getClientContext();
  if (context.error) return context.error;
  const { admin, profile } = context;

  const body = await request.json().catch(() => ({}));
  const provider = normaliseTerraProvider(body.provider);
  if (!provider) {
    return NextResponse.json({ error: "That connected app is not available." }, { status: 400 });
  }

  const { data: connection, error: connectionError } = await admin
    .from("client_wearable_connections")
    .select("consented_at")
    .eq("client_id", profile.id)
    .eq("provider", provider)
    .maybeSingle();
  if (connectionError) return NextResponse.json({ error: connectionError.message }, { status: 500 });
  if (!connection || !matchesTerraConnectionAttempt(connection.consented_at, body.attempt)) {
    return NextResponse.json({ ok: false, staleAttempt: true }, { status: 409 });
  }

  const { error } = await admin
    .from("client_wearable_connections")
    .update({
      status: "error",
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", profile.id)
    .eq("provider", provider)
    .eq("consented_at", connection.consented_at)
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
