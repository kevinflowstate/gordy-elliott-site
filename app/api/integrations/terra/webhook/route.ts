import crypto from "crypto";
import { parseTerraReferenceId, verifyTerraWebhookRequest } from "@/lib/terra/client";
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

  const admin = createAdminClient();
  const terraUser = extractTerraUser(payload as Record<string, unknown>);
  let clientId = parseTerraReferenceId(terraUser.referenceId);

  if (!clientId && terraUser.terraUserId) {
    const { data: connection } = await admin
      .from("client_wearable_connections")
      .select("client_id")
      .eq("terra_user_id", terraUser.terraUserId)
      .maybeSingle();
    clientId = connection?.client_id || null;
  }

  if (!clientId) {
    return NextResponse.json({ error: "Unable to resolve Terra user to a client" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const referenceId = terraUser.referenceId || `client:${clientId}`;
  const disconnected = ["deauth", "disconnect", "revoked"].includes(terraUser.eventType.toLowerCase());
  const failedAuth = terraUser.eventType.toLowerCase() === "auth" && terraUser.authStatus !== "success";
  const { data: existingConnection } = await admin
    .from("client_wearable_connections")
    .select("connected_at")
    .eq("client_id", clientId)
    .eq("provider", terraUser.provider)
    .maybeSingle();
  const { data: connection, error: connectionError } = await admin
    .from("client_wearable_connections")
    .upsert({
      client_id: clientId,
      provider: terraUser.provider,
      terra_user_id: terraUser.terraUserId,
      reference_id: referenceId,
      status: disconnected ? "disconnected" : failedAuth ? "error" : "connected",
      connected_at: existingConnection?.connected_at || (!disconnected && !failedAuth ? now : null),
      disconnected_at: disconnected ? now : null,
      last_sync_at: now,
      scopes: normaliseScopes(terraUser.rawUser.scopes),
      raw_user: terraUser.rawUser,
      updated_at: now,
    }, { onConflict: "client_id,provider" })
    .select("*")
    .single();

  if (connectionError) return NextResponse.json({ error: connectionError.message }, { status: 500 });

  const payloadHash = stableHash(payload);
  const { data: event, error: eventError } = await admin
    .from("client_wearable_events")
    .upsert({
      client_id: clientId,
      connection_id: connection.id,
      terra_user_id: terraUser.terraUserId,
      provider: terraUser.provider,
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
    .eq("client_id", clientId)
    .in("summary_date", summaryDates);

  if (existingSummaryError) return NextResponse.json({ error: existingSummaryError.message }, { status: 500 });

  const summariesByDate = new Map(
    (existingSummaries || []).map((summary) => [summary.summary_date, summary as WearableDailySummary]),
  );
  for (const normalized of summaries) {
    const merged = mergeDailySummary(summariesByDate.get(normalized.summary_date) || null, normalized, event.id);
    summariesByDate.set(normalized.summary_date, {
      client_id: clientId,
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
