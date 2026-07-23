import {
  createCalendarCallbackToken,
  getCalendarProviderConfig,
  getComposioClient,
  getComposioUserId,
} from "@/lib/composio/client";
import { syncCalendarConnection } from "@/lib/composio/calendar";
import { isCalendarProvider, type CalendarConnection } from "@/lib/composio/types";
import { getSiteUrl } from "@/lib/site-url";
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

function callbackOrigin(request: Request) {
  return process.env.NODE_ENV === "production"
    ? getSiteUrl()
    : new URL(request.url).origin;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerValue } = await params;
  if (!isCalendarProvider(providerValue)) {
    return NextResponse.json({ error: "Unsupported calendar provider" }, { status: 400 });
  }

  const context = await getClientContext();
  if (context.error) return context.error;
  const { admin, profile } = context;

  const config = getCalendarProviderConfig(providerValue);
  if (!config.authConfigId) {
    return NextResponse.json(
      { error: providerValue === "google_calendar"
        ? "Google Calendar is prepared but still needs its Google OAuth credentials."
        : "This calendar connection is not configured yet." },
      { status: 503 },
    );
  }

  const composio = getComposioClient();
  const composioUserId = getComposioUserId(profile.id);
  const now = new Date().toISOString();
  let remoteConnectionVerified = false;

  try {
    const existingRemote = await composio.connectedAccounts.list({
      userIds: [composioUserId],
      authConfigIds: [config.authConfigId],
      statuses: ["ACTIVE"],
      limit: 10,
    }, { signal: AbortSignal.timeout(10_000) });
    const activeRemote = existingRemote.items[0];
    if (activeRemote) {
      remoteConnectionVerified = true;
      const { data: connection, error } = await admin
        .from("client_calendar_connections")
        .upsert({
          client_id: profile.id,
          provider: providerValue,
          composio_user_id: composioUserId,
          composio_connected_account_id: activeRemote.id,
          composio_auth_config_id: config.authConfigId,
          status: "connected",
          connected_at: now,
          disconnected_at: null,
          last_error: null,
          updated_at: now,
        }, { onConflict: "client_id,provider" })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      await syncCalendarConnection(admin, connection as CalendarConnection);
      return NextResponse.json({ connected: true });
    }

    const { data: connection, error } = await admin
      .from("client_calendar_connections")
      .upsert({
        client_id: profile.id,
        provider: providerValue,
        composio_user_id: composioUserId,
        composio_auth_config_id: config.authConfigId,
        composio_connected_account_id: null,
        status: "connecting",
        last_error: null,
        disconnected_at: null,
        updated_at: now,
      }, { onConflict: "client_id,provider" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const token = createCalendarCallbackToken(connection.id);
    const callbackUrl = new URL("/api/portal/calendar-integrations/callback", callbackOrigin(request));
    callbackUrl.searchParams.set("connection", connection.id);
    callbackUrl.searchParams.set("token", token);

    const link = await composio.connectedAccounts.link(composioUserId, config.authConfigId, {
      callbackUrl: callbackUrl.toString(),
    }, { signal: AbortSignal.timeout(15_000) });
    if (!link.redirectUrl) {
      throw new Error("Composio did not return an authorization URL.");
    }
    const redirectUrl = new URL(link.redirectUrl);
    if (redirectUrl.protocol !== "https:") {
      throw new Error("Composio returned an invalid authorization URL.");
    }
    const { error: updateError } = await admin
      .from("client_calendar_connections")
      .update({
        composio_connected_account_id: link.id,
        status: "connecting",
        updated_at: now,
      })
      .eq("id", connection.id)
      .eq("client_id", profile.id);
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ redirectUrl: redirectUrl.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar connection could not be started.";
    await admin
      .from("client_calendar_connections")
      .update({
        status: remoteConnectionVerified ? "connected" : "error",
        last_error: message.slice(0, 500),
        updated_at: now,
      })
      .eq("client_id", profile.id)
      .eq("provider", providerValue);
    return NextResponse.json(
      { error: remoteConnectionVerified
        ? "The calendar is connected, but its latest events could not be refreshed. Try Sync now in a moment."
        : "We couldn't open the secure calendar connection. Please try again." },
      { status: 502 },
    );
  }
}
