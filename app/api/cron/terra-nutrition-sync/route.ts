import { dateKeyInTimeZone } from "@/lib/founder-dashboard";
import { requestTerraNutritionData } from "@/lib/terra/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_SYNC_WINDOW_MS = 60 * 60 * 1000;
const REQUEST_BATCH_SIZE = 5;
const REQUEST_LIMIT = 40;

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const staleBefore = new Date(now.getTime() - RECENT_SYNC_WINDOW_MS).toISOString();
  const { data: connections, error } = await admin
    .from("client_wearable_connections")
    .select("terra_user_id, last_sync_at")
    .eq("provider", "myfitnesspal")
    .eq("status", "connected")
    .not("consented_at", "is", null)
    .not("terra_user_id", "is", null)
    .or(`last_sync_at.is.null,last_sync_at.lt.${staleBefore}`)
    .order("last_sync_at", { ascending: true, nullsFirst: true })
    .limit(REQUEST_LIMIT);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const startDate = dateKeyInTimeZone(new Date(now.getTime() - DAY_MS), "Europe/London");
  const endDate = dateKeyInTimeZone(now, "Europe/London");

  let accepted = 0;
  let failed = 0;
  const pending = connections || [];
  for (let index = 0; index < pending.length; index += REQUEST_BATCH_SIZE) {
    const batch = pending.slice(index, index + REQUEST_BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map((connection) => (
      requestTerraNutritionData(connection.terra_user_id!, startDate, endDate)
    )));
    accepted += settled.filter((result) => result.status === "fulfilled").length;
    failed += settled.filter((result) => result.status === "rejected").length;
  }

  if (failed) console.error("Some scheduled MyFitnessPal refresh requests failed", { failed });

  return NextResponse.json({
    ok: failed === 0,
    attempted: pending.length,
    accepted,
    failed,
    startDate,
    endDate,
  }, { status: failed && accepted === 0 ? 502 : 200 });
}
