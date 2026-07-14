import { generateTerraWidgetSession, getTerraReferenceId } from "@/lib/terra/client";
import { createMockWearableSummary, MOCK_WEARABLE_PROVIDERS, type MockWearableProvider } from "@/lib/wearable-mock";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function isMockProvider(value: unknown): value is MockWearableProvider {
  return typeof value === "string" && (MOCK_WEARABLE_PROVIDERS as readonly string[]).includes(value);
}

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
  const provider = isMockProvider(body.provider) ? body.provider : "garmin";
  let session;
  try {
    session = await generateTerraWidgetSession(profile.id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Terra connection could not be started" },
      { status: 500 },
    );
  }

  if (session.mock) {
    const now = new Date().toISOString();
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

  return NextResponse.json(session);
}
