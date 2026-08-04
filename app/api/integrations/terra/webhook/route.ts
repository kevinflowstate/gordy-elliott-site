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
  const connectionFields = "id, client_id, provider, terra_user_id, reference_id, status, connected_at, disconnected_at, last_sync_at, consented_at";
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
  const status = action === "disconnect"
    ? "disconnected"
    : action === "error"
      ? "error"
      : "connected";
  const connectionUpdate = {
    terra_user_id: (action === "connect" || action === "data") && terraUser.terraUserId
      ? terraUser.terraUserId
      : connection.terra_user_id,
    reference_id: terraUser.referenceId || connection.reference_id,
    status,
    connected_at: action === "connect" || action === "data" ? connection.connected_at || now : connection.connected_at,
    disconnected_at: action === "disconnect" ? now : action === "connect" ? null : connection.disconnected_at,
    last_sync_at: action === "data" ? now : connection.last_sync_at,
    scopes: normaliseScopes(terraUser.rawUser.scopes),
    raw_user: terraUser.rawUser,
    updated_at: now,
  };
  const { data: updatedConnection, error: connectionError } = await admin
    .from("client_wearable_connections")
    .update(connectionUpdate)
    .eq("id", connection.id)
    .select("*")
    .single();

  if (connectionError) return NextResponse.json({ error: connectionError.message }, { status: 500 });

  const payloadHash = stableHash(payload);
  const { data: event, error: eventError } = await admin
    .from("client_wearable_events")
    .upsert({
      client_id: connection.client_id,
      connection_id: updatedConnection.id,
      terra_user_id: terraUser.terraUserId,
      provider,
      event_type: terraUser.eventType,
      payload,
      payload_hash: payloadHash,
    }, { onConflict: "payload_hash" })
    .select("*")
    .single();

  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });

  const summaries = normaliseTerraPayloads(payload as Record<string, unknown>);
  if (!summaries.length) {
    return NextResponse.json({ ok: true, stored: true, summaryUpdated: false });
  }

  const summaryDates = Array.from(new Set(summaries.map((summary) => summary.summary_date)));
  const { data: existingSummaries, error: existingSummaryError } = await admin
    .from("client_wearable_daily_summaries")
    .select("*")
    .eq("client_id", connection.client_id)
    .in("summary_date", summaryDates);

  if (existingSummaryError) return NextResponse.json({ error: existingSummaryError.message }, { status: 500 });

  const summariesByDate = new Map(
    (existingSummaries || []).map((summary) => [summary.summary_date, summary as WearableDailySummary]),
  );
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
