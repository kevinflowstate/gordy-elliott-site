import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCalendarProviderConfig,
  getComposioClient,
  getComposioUserId,
} from "./client";
import { normaliseCalendarEvents } from "./normalise";
import type { CalendarConnection, CalendarProvider } from "./types";

const SYNC_DAYS = 8;
const OUTLOOK_SELECT = [
  "id",
  "subject",
  "start",
  "end",
  "isAllDay",
  "isCancelled",
  "showAs",
  "onlineMeeting",
  "onlineMeetingUrl",
  "webLink",
  "sensitivity",
];

function londonDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function londonMidnightUtc(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12));
  const offsetName = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    timeZoneName: "shortOffset",
  }).formatToParts(noonUtc).find((part) => part.type === "timeZoneName")?.value || "GMT";
  const match = offsetName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const offsetMinutes = match
    ? (match[1] === "+" ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3] || 0))
    : 0;
  return new Date(Date.UTC(year, month - 1, day) - offsetMinutes * 60_000);
}

function syncWindow(now = new Date()) {
  const startKey = londonDateKey(now);
  const start = londonMidnightUtc(startKey);
  const endKeyDate = new Date(`${startKey}T12:00:00.000Z`);
  endKeyDate.setUTCDate(endKeyDate.getUTCDate() + SYNC_DAYS);
  const end = londonMidnightUtc(endKeyDate.toISOString().slice(0, 10));
  return { start, end };
}

async function executeCalendarRead(
  provider: CalendarProvider,
  connection: CalendarConnection,
  start: Date,
  end: Date,
) {
  const composio = getComposioClient();
  const config = getCalendarProviderConfig(provider);
  const common = {
    userId: getComposioUserId(connection.client_id),
    connectedAccountId: connection.composio_connected_account_id || undefined,
    version: config.version,
  };

  if (provider === "outlook") {
    return composio.tools.execute(config.tool, {
      ...common,
      arguments: {
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        timezone: "UTC",
        top: 999,
        select: OUTLOOK_SELECT,
      },
    }, { signal: AbortSignal.timeout(25_000) });
  }

  return composio.tools.execute(config.tool, {
    ...common,
    arguments: {
      time_min: start.toISOString(),
      time_max: end.toISOString(),
      single_events: true,
      show_deleted: false,
      response_detail: "full",
      max_results_per_calendar: 250,
    },
  }, { signal: AbortSignal.timeout(25_000) });
}

export async function syncCalendarConnection(
  admin: SupabaseClient,
  connection: CalendarConnection,
  now = new Date(),
) {
  if (!connection.composio_connected_account_id) {
    throw new Error("The calendar connection is incomplete. Reconnect it and try again.");
  }

  const composio = getComposioClient();
  const remote = await composio.connectedAccounts.get(
    connection.composio_connected_account_id,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (remote.status !== "ACTIVE") {
    await admin
      .from("client_calendar_connections")
      .update({
        status: "needs_reauth",
        last_error: remote.statusReason || "Calendar authorization needs attention.",
        updated_at: now.toISOString(),
      })
      .eq("id", connection.id);
    throw new Error("This calendar needs to be reconnected.");
  }

  const { start, end } = syncWindow(now);
  let result;
  try {
    result = await executeCalendarRead(connection.provider, connection, start, end);
  } catch (error) {
    await admin
      .from("client_calendar_connections")
      .update({
        status: connection.status === "connected" ? "connected" : "error",
        last_error: error instanceof Error ? error.message.slice(0, 500) : "Calendar sync failed.",
        updated_at: now.toISOString(),
      })
      .eq("id", connection.id);
    throw error;
  }

  if (!result.successful || result.error) {
    const message = result.error || "Calendar sync failed.";
    await admin
      .from("client_calendar_connections")
      .update({
        status: connection.status === "connected" ? "connected" : "error",
        last_error: message.slice(0, 500),
        updated_at: now.toISOString(),
      })
      .eq("id", connection.id);
    throw new Error(message);
  }

  const events = normaliseCalendarEvents(connection.provider, result.data)
    .filter((event) => !event.is_cancelled);
  const syncedAt = now.toISOString();

  if (events.length > 0) {
    const { error: upsertError } = await admin
      .from("client_calendar_events")
      .upsert(events.map((event) => ({
        ...event,
        client_id: connection.client_id,
        connection_id: connection.id,
        synced_at: syncedAt,
        updated_at: syncedAt,
      })), { onConflict: "connection_id,external_event_key" });
    if (upsertError) throw new Error(upsertError.message);
  }

  let staleDelete = admin
    .from("client_calendar_events")
    .delete()
    .eq("connection_id", connection.id)
    .gte("starts_at", start.toISOString())
    .lt("starts_at", end.toISOString());
  if (events.length > 0) {
    staleDelete = staleDelete.neq("synced_at", syncedAt);
  }
  const { error: staleError } = await staleDelete;
  if (staleError) throw new Error(staleError.message);

  const { error: connectionError } = await admin
    .from("client_calendar_connections")
    .update({
      status: "connected",
      last_sync_at: syncedAt,
      last_error: null,
      connected_at: connection.connected_at || syncedAt,
      disconnected_at: null,
      updated_at: syncedAt,
    })
    .eq("id", connection.id);
  if (connectionError) throw new Error(connectionError.message);

  return {
    eventCount: events.length,
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
    syncedAt,
  };
}
