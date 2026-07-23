import {
  getCalendarProviderConfig,
  getComposioClient,
  verifyCalendarCallbackToken,
} from "@/lib/composio/client";
import { syncCalendarConnection } from "@/lib/composio/calendar";
import type { CalendarConnection } from "@/lib/composio/types";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function calendarRedirect(request: Request, status: "connected" | "error", provider?: string) {
  const origin = process.env.NODE_ENV === "production" ? getSiteUrl() : new URL(request.url).origin;
  const url = new URL("/portal/calendar", origin);
  url.searchParams.set("calendar", status);
  if (provider) url.searchParams.set("provider", provider);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const connectionId = url.searchParams.get("connection") || "";
  const token = url.searchParams.get("token") || "";
  const callbackStatus = url.searchParams.get("status");
  const callbackAccountId = url.searchParams.get("connected_account_id");

  if (!connectionId || !token || !verifyCalendarCallbackToken(connectionId, token)) {
    return calendarRedirect(request, "error");
  }

  const admin = createAdminClient();
  const { data: connection, error } = await admin
    .from("client_calendar_connections")
    .select("*")
    .eq("id", connectionId)
    .maybeSingle();
  if (error || !connection) return calendarRedirect(request, "error");

  const provider = connection.provider;
  if (callbackStatus !== "success" || !callbackAccountId) {
    await admin
      .from("client_calendar_connections")
      .update({
        status: "error",
        last_error: "Calendar authorization was cancelled or failed.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId);
    return calendarRedirect(request, "error", provider);
  }
  if (
    connection.composio_connected_account_id
    && connection.composio_connected_account_id !== callbackAccountId
  ) {
    return calendarRedirect(request, "error", provider);
  }

  try {
    const composio = getComposioClient();
    const providerConfig = getCalendarProviderConfig(provider);
    const remoteAccounts = await composio.connectedAccounts.list({
      userIds: [connection.composio_user_id],
      authConfigIds: providerConfig.authConfigId ? [providerConfig.authConfigId] : undefined,
      statuses: ["ACTIVE"],
      limit: 10,
    }, { signal: AbortSignal.timeout(10_000) });
    const remote = remoteAccounts.items.find((account) => account.id === callbackAccountId);
    if (!remote || remote.toolkit.slug !== providerConfig.toolkit) {
      throw new Error("The connected calendar could not be verified.");
    }

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("client_calendar_connections")
      .update({
        composio_connected_account_id: callbackAccountId,
        status: "connected",
        connected_at: now,
        disconnected_at: null,
        last_error: null,
        updated_at: now,
      })
      .eq("id", connectionId);
    if (updateError) throw new Error(updateError.message);

    await syncCalendarConnection(admin, {
      ...connection,
      composio_connected_account_id: callbackAccountId,
      status: "connected",
      connected_at: now,
      disconnected_at: null,
      updated_at: now,
    } as CalendarConnection);
    return calendarRedirect(request, "connected", provider);
  } catch (syncError) {
    await admin
      .from("client_calendar_connections")
      .update({
        status: "connected",
        last_error: syncError instanceof Error ? syncError.message.slice(0, 500) : "Calendar sync failed.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId);
    return calendarRedirect(request, "error", provider);
  }
}
