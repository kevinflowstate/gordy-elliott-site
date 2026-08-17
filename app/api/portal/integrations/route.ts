import { getTerraConfig } from "@/lib/terra/client";
import { TERRA_CONSENT_VERSION } from "@/lib/terra/events";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const TERRA_PENDING_TIMEOUT_MS = 15 * 60 * 1000;

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

export async function GET() {
  const context = await getClientContext();
  if (context.error) return context.error;
  const { admin, profile } = context;

  const [connectionsRes, summariesRes] = await Promise.all([
    admin
      .from("client_wearable_connections")
      .select("id, client_id, provider, status, last_sync_at, connected_at, disconnected_at, consent_version, consented_at, created_at, updated_at")
      .eq("client_id", profile.id)
      .order("updated_at", { ascending: false }),
    admin
      .from("client_wearable_daily_summaries")
      .select("*")
      .eq("client_id", profile.id)
      .lte("summary_date", new Date().toISOString().slice(0, 10))
      .order("summary_date", { ascending: false })
      .limit(14),
  ]);

  if (connectionsRes.error) return NextResponse.json({ error: connectionsRes.error.message }, { status: 500 });
  if (summariesRes.error) return NextResponse.json({ error: summariesRes.error.message }, { status: 500 });

  const terra = getTerraConfig();
  const stalePendingBefore = Date.now() - TERRA_PENDING_TIMEOUT_MS;
  const connections = (connectionsRes.data || []).map((connection) => (
    connection.status === "pending"
      && connection.updated_at
      && new Date(connection.updated_at).getTime() < stalePendingBefore
      ? { ...connection, status: "error" as const }
      : connection
  ));
  return NextResponse.json({
    mockMode: terra.mockMode,
    available: terra.available,
    providerAvailability: { whoop: terra.whoopEnabled },
    consentAccepted: connections.some((connection) =>
      connection.consent_version === TERRA_CONSENT_VERSION && Boolean(connection.consented_at)
    ),
    connections,
    latestSummary: summariesRes.data?.[0] || null,
    summaries: summariesRes.data || [],
  });
}
