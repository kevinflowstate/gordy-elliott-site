import crypto from "crypto";
import { parseTerraReferenceId, verifyTerraWebhookRequest } from "@/lib/terra/client";
import {
  canApplyTerraEvent,
  classifyTerraEvent,
  normaliseTerraProvider,
  type TerraConnectionStatus,
} from "@/lib/terra/events";
import { extractTerraUser, mergeDailySummary, normaliseTerraPayloads } from "@/lib/terra/normalise";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WearableDailySummary } from "@/lib/wearable-insights";
import { NextResponse } from "next/server";

const CONNECTION_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const SUMMARY_FIELDS = "id, client_id, summary_date, providers, sleep_minutes, sleep_score, hrv_ms, resting_hr_bpm, steps, active_calories, total_calories_burned, training_load, workout_count, nutrition_calories, protein_g, carbs_g, fat_g, water_ml, readiness_score, recovery_status, flags, insight, source_payload_ids" as const;

function stableHash(payload: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function normaliseScopes(value: unknown) {
  if (Array.isArray(value)) return value.filter((scope): scope is string => typeof scope === "string");
  if (typeof value === "string") return value.split(",").map((scope) => scope.trim()).filter(Boolean);
  return [];
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyTerraWebhookRequest(request, rawBody)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const payload = (() => {
    try {
      return JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return null;
    }
  })();
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const terraUser = extractTerraUser(payload as Record<string, unknown>);
  const action = classifyTerraEvent(terraUser.eventType, terraUser.authStatus);
  if (action === "healthcheck") {
    return NextResponse.json({ ok: true, healthcheck: true });
  }
  if (action === "ignore") {
    return NextResponse.json({ ok: true, ignored: true, eventType: terraUser.eventType });
  }

  const provider = normaliseTerraProvider(terraUser.provider);
  if (!provider) {
    console.warn("Ignoring Terra webhook for an unapproved provider", { eventType: terraUser.eventType });
    return NextResponse.json({ ok: true, ignored: true, reason: "provider_not_enabled" });
  }

  const admin = createAdminClient();
  const clientId = parseTerraReferenceId(terraUser.referenceId);
  const connectionFields = "id, client_id, provider, terra_user_id, reference_id, status, connected_at, disconnected_at, last_sync_at, consented_at, scopes";
  let connection = null;
  if (clientId) {
    const result = await admin
      .from("client_wearable_connections")
      .select(connectionFields)
      .eq("client_id", clientId)
      .eq("provider", provider)
      .maybeSingle();
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    connection = result.data;
  }

  const terraUserIds = [terraUser.terraUserId, terraUser.oldTerraUserId]
    .filter((value): value is string => Boolean(value));
  for (const terraUserId of terraUserIds) {
    if (connection) break;
    const result = await admin
      .from("client_wearable_connections")
      .select(connectionFields)
      .eq("terra_user_id", terraUserId)
      .eq("provider", provider)
      .maybeSingle();
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    connection = result.data;
  }

  if (!connection || !connection.consented_at) {
    console.warn("Ignoring Terra webhook without a consented app connection", {
      eventType: terraUser.eventType,
      provider,
    });
    return NextResponse.json({ ok: true, ignored: true, reason: "connection_not_consented" });
  }
  if (!canApplyTerraEvent(action, connection.status as TerraConnectionStatus)) {
    return NextResponse.json({ ok: true, ignored: true, reason: "connection_state_rejects_event" });
  }

  const now = new Date().toISOString();
  const nowTimestamp = Date.parse(now);
  const status = action === "disconnect"
    ? "disconnected"
    : action === "error"
      ? "error"
      : "connected";
  const terraUserId = (action === "connect" || action === "data") && terraUser.terraUserId
    ? terraUser.terraUserId
    : connection.terra_user_id;
  const referenceId = terraUser.referenceId || connection.reference_id;
  const scopes = normaliseScopes(terraUser.rawUser.scopes);
  const lastSyncTimestamp = connection.last_sync_at ? Date.parse(connection.last_sync_at) : Number.NaN;
  const syncRefreshDue = action === "data" && (
    !Number.isFinite(lastSyncTimestamp)
    || nowTimestamp - lastSyncTimestamp >= CONNECTION_REFRESH_INTERVAL_MS
  );
  const connectionStateChanged = connection.status !== status
    || connection.terra_user_id !== terraUserId
    || connection.reference_id !== referenceId;
  const shouldUpdateConnection = action !== "data" || connectionStateChanged || syncRefreshDue;
  const connectionUpdate = {
    terra_user_id: terraUserId,
    reference_id: referenceId,
    status,
    connected_at: action === "connect" || action === "data" ? connection.connected_at || now : connection.connected_at,
    disconnected_at: action === "disconnect" ? now : action === "connect" ? null : connection.disconnected_at,
    last_sync_at: action === "data" ? now : connection.last_sync_at,
    scopes: scopes.length ? scopes : connection.scopes,
    raw_user: terraUser.rawUser,
    updated_at: now,
  };
  if (shouldUpdateConnection) {
    const { error: connectionError } = await admin
      .from("client_wearable_connections")
      .update(connectionUpdate)
      .eq("id", connection.id);

    if (connectionError) return NextResponse.json({ error: connectionError.message }, { status: 500 });
  }

  const payloadHash = stableHash(payload);
  const { data: insertedEvent, error: eventError } = await admin
    .from("client_wearable_events")
    .upsert({
      client_id: connection.client_id,
      connection_id: connection.id,
      terra_user_id: terraUser.terraUserId,
      provider,
      event_type: terraUser.eventType,
      payload,
      payload_hash: payloadHash,
    }, { onConflict: "payload_hash", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();

  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });

  let event = insertedEvent;
  const duplicateEvent = !event;
  if (!event) {
    const { data: existingEvent, error: existingEventError } = await admin
      .from("client_wearable_events")
      .select("id")
      .eq("payload_hash", payloadHash)
      .single();
    if (existingEventError) return NextResponse.json({ error: existingEventError.message }, { status: 500 });
    event = existingEvent;
  }

  const summaries = normaliseTerraPayloads(payload as Record<string, unknown>);
  if (!summaries.length) {
    return NextResponse.json({ ok: true, stored: true, duplicate: duplicateEvent, summaryUpdated: false });
  }

  const summaryDates = Array.from(new Set(summaries.map((summary) => summary.summary_date)));
  const { data: existingSummaries, error: existingSummaryError } = await admin
    .from("client_wearable_daily_summaries")
    .select(SUMMARY_FIELDS)
    .eq("client_id", connection.client_id)
    .in("summary_date", summaryDates);

  if (existingSummaryError) return NextResponse.json({ error: existingSummaryError.message }, { status: 500 });

  const summariesByDate = new Map(
    (existingSummaries || []).map((summary) => [summary.summary_date, summary as WearableDailySummary]),
  );
  const duplicateAlreadyApplied = duplicateEvent && summaryDates.every((date) =>
    summariesByDate.get(date)?.source_payload_ids?.includes(event.id)
  );
  if (duplicateAlreadyApplied) {
    return NextResponse.json({ ok: true, stored: true, duplicate: true, summaryUpdated: false });
  }

  for (const normalized of summaries) {
    const merged = mergeDailySummary(summariesByDate.get(normalized.summary_date) || null, normalized, event.id);
    summariesByDate.set(normalized.summary_date, {
      client_id: connection.client_id,
      summary_date: normalized.summary_date,
      ...merged,
    } as WearableDailySummary);
  }

  const rows = summaryDates.map((date) => summariesByDate.get(date));
  const { error: summaryError } = await admin
    .from("client_wearable_daily_summaries")
    .upsert(rows, { onConflict: "client_id,summary_date" });

  if (summaryError) return NextResponse.json({ error: summaryError.message }, { status: 500 });

  return NextResponse.json({ ok: true, stored: true, summaryUpdated: true, summariesUpdated: summaries.length });
}
