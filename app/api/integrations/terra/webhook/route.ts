import crypto from "crypto";
import { parseTerraReferenceId, verifyTerraWebhookRequest } from "@/lib/terra/client";
import { extractTerraUser, mergeDailySummary, normaliseTerraPayload } from "@/lib/terra/normalise";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WearableDailySummary } from "@/lib/wearable-insights";
import { NextResponse } from "next/server";

function stableHash(payload: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function POST(request: Request) {
  if (!verifyTerraWebhookRequest(request)) {
    return NextResponse.json({ error: "Invalid webhook token" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
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
  const { data: connection, error: connectionError } = await admin
    .from("client_wearable_connections")
    .upsert({
      client_id: clientId,
      provider: terraUser.provider,
      terra_user_id: terraUser.terraUserId,
      reference_id: referenceId,
      status: terraUser.eventType === "deauth" || terraUser.eventType === "disconnect" ? "disconnected" : "connected",
      connected_at: now,
      disconnected_at: terraUser.eventType === "deauth" || terraUser.eventType === "disconnect" ? now : null,
      last_sync_at: now,
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

  const normalized = normaliseTerraPayload(payload as Record<string, unknown>);
  if (!normalized) {
    return NextResponse.json({ ok: true, stored: true, summaryUpdated: false });
  }

  const { data: existing } = await admin
    .from("client_wearable_daily_summaries")
    .select("*")
    .eq("client_id", clientId)
    .eq("summary_date", normalized.summary_date)
    .maybeSingle();

  const merged = mergeDailySummary((existing || null) as WearableDailySummary | null, normalized, event.id);
  const { error: summaryError } = await admin
    .from("client_wearable_daily_summaries")
    .upsert({
      client_id: clientId,
      summary_date: normalized.summary_date,
      ...merged,
    }, { onConflict: "client_id,summary_date" });

  if (summaryError) return NextResponse.json({ error: summaryError.message }, { status: 500 });

  return NextResponse.json({ ok: true, stored: true, summaryUpdated: true });
}
