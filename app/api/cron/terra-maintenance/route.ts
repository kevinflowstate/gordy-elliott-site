import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const DEFAULT_RETENTION_DAYS = 90;
const BATCH_SIZE = 500;
const MAX_BATCHES = 20;

function getRetentionDays() {
  const configured = Number(process.env.TERRA_RAW_EVENT_RETENTION_DAYS || DEFAULT_RETENTION_DAYS);
  if (!Number.isInteger(configured) || configured < 7 || configured > 365) {
    return DEFAULT_RETENTION_DAYS;
  }
  return configured;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const retentionDays = getRetentionDays();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  let deleted = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const { data: expired, error: selectError } = await admin
      .from("client_wearable_events")
      .select("id")
      .lt("received_at", cutoff)
      .order("received_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });
    if (!expired?.length) break;

    const { error: deleteError } = await admin
      .from("client_wearable_events")
      .delete()
      .in("id", expired.map((event) => event.id));
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    deleted += expired.length;
    if (expired.length < BATCH_SIZE) break;
  }

  const staleBefore = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const [errorsResult, staleResult] = await Promise.all([
    admin
      .from("client_wearable_connections")
      .select("id", { count: "exact", head: true })
      .eq("status", "error"),
    admin
      .from("client_wearable_connections")
      .select("id", { count: "exact", head: true })
      .eq("status", "connected")
      .or(`last_sync_at.is.null,last_sync_at.lt.${staleBefore}`),
  ]);

  if (errorsResult.error || staleResult.error) {
    return NextResponse.json(
      { error: errorsResult.error?.message || staleResult.error?.message },
      { status: 500 },
    );
  }

  const report = {
    ok: true,
    retentionDays,
    cutoff,
    rawEventsDeleted: deleted,
    connectionsInError: errorsResult.count || 0,
    connectedButStale: staleResult.count || 0,
  };
  if (report.connectionsInError || report.connectedButStale) {
    console.warn("Terra maintenance found connections needing attention", report);
  }
  return NextResponse.json(report);
}
