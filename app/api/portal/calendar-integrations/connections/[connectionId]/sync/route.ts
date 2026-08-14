import { syncCalendarConnection } from "@/lib/composio/calendar";
import type { CalendarConnection } from "@/lib/composio/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  MANUAL_CALENDAR_SYNC_BURST_WINDOW_MS,
  manualCalendarSyncRetryAfterSeconds,
} from "@/lib/composio/calendar-sync-cooldown";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

function cooldownResponse(retryAfterSeconds: number) {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return NextResponse.json(
    {
      error: `This calendar was refreshed recently. Automatic updates run every two hours; manual refresh will be available in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

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
    .select("id, tier")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  if (profile.tier === "ai_only") {
    return NextResponse.json({ error: "Calendar is not available on this plan" }, { status: 403 });
  }

  const { connectionId } = await params;
  const { data: connection, error } = await admin
    .from("client_calendar_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("client_id", profile.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!connection) return NextResponse.json({ error: "Calendar connection not found" }, { status: 404 });

  const persistedRetryAfter = manualCalendarSyncRetryAfterSeconds(connection.last_sync_at);
  if (persistedRetryAfter > 0) return cooldownResponse(persistedRetryAfter);

  const burstLimit = rateLimit(
    `calendar-sync:${profile.id}:${connection.id}`,
    1,
    MANUAL_CALENDAR_SYNC_BURST_WINDOW_MS,
  );
  if (!burstLimit.success) {
    return cooldownResponse(Math.max(1, Math.ceil((burstLimit.resetAt - Date.now()) / 1000)));
  }

  try {
    const result = await syncCalendarConnection(admin, connection as CalendarConnection);
    return NextResponse.json(result);
  } catch (syncError) {
    const needsReconnect = syncError instanceof Error
      && syncError.message.toLowerCase().includes("reconnect");
    return NextResponse.json(
      { error: needsReconnect
        ? "This calendar needs to be reconnected."
        : "We couldn't refresh the calendar right now. Your existing events are still available." },
      { status: 502 },
    );
  }
}
