import { getComposioConfig } from "@/lib/composio/client";
import { calendarProviderLabel, type CalendarProvider } from "@/lib/composio/types";
import { dateKeyInTimeZone } from "@/lib/founder-dashboard";
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
    .select("id, tier")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return { error: NextResponse.json({ error: "Client profile not found" }, { status: 404 }) };
  if (profile.tier === "ai_only") {
    return { error: NextResponse.json({ error: "Calendar is not available on this plan" }, { status: 403 }) };
  }
  return { admin, profile };
}

export async function GET() {
  const context = await getClientContext();
  if (context.error) return context.error;
  const { admin, profile } = context;

  const today = dateKeyInTimeZone(new Date(), "Europe/London");
  const end = new Date(`${today}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 8);

  const [connectionsResult, eventsResult] = await Promise.all([
    admin
      .from("client_calendar_connections")
      .select("id, provider, status, last_sync_at, connected_at, disconnected_at, created_at, updated_at")
      .eq("client_id", profile.id)
      .order("updated_at", { ascending: false }),
    admin
      .from("client_calendar_events")
      .select("connection_id")
      .eq("client_id", profile.id)
      .eq("is_cancelled", false)
      .gte("event_date_key", today)
      .lt("event_date_key", end.toISOString().slice(0, 10)),
  ]);

  if (connectionsResult.error) {
    return NextResponse.json({ error: connectionsResult.error.message }, { status: 500 });
  }
  if (eventsResult.error) {
    return NextResponse.json({ error: eventsResult.error.message }, { status: 500 });
  }

  const eventCounts = new Map<string, number>();
  for (const event of eventsResult.data || []) {
    eventCounts.set(event.connection_id, (eventCounts.get(event.connection_id) || 0) + 1);
  }

  const config = getComposioConfig();
  const providers = (Object.keys(config.providers) as CalendarProvider[]).map((provider) => ({
    provider,
    label: calendarProviderLabel(provider),
    configured: config.providers[provider].configured,
  }));

  return NextResponse.json({
    available: config.available,
    providers,
    connections: (connectionsResult.data || []).map((connection) => ({
      ...connection,
      event_count: eventCounts.get(connection.id) || 0,
    })),
  });
}
