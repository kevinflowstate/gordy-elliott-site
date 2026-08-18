import { dateKeyInTimeZone } from "@/lib/founder-dashboard";
import { requestTerraData, type TerraDataType } from "@/lib/terra/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const DAY_MS = 24 * 60 * 60 * 1000;
const BACKFILL_DAYS = 7;

const DATA_TYPES_BY_PROVIDER: Record<string, TerraDataType[]> = {
  garmin: ["daily", "sleep", "activity"],
  oura: ["daily", "sleep", "activity"],
  fitbit: ["daily", "sleep", "activity"],
  whoop: ["daily", "sleep", "activity"],
  myfitnesspal: ["nutrition"],
};

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Client profile not found" }, { status: 404 });

  const { data: connections, error } = await admin
    .from("client_wearable_connections")
    .select("provider, terra_user_id, status, consented_at")
    .eq("client_id", profile.id)
    .eq("status", "connected")
    .not("terra_user_id", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const connected = (connections || []).filter((connection) => (
    connection.consented_at
    && connection.terra_user_id
    && DATA_TYPES_BY_PROVIDER[connection.provider]
  ));
  if (!connected.length) return NextResponse.json({ error: "No health app is connected." }, { status: 409 });

  const now = new Date();
  const startDate = dateKeyInTimeZone(new Date(now.getTime() - (BACKFILL_DAYS - 1) * DAY_MS), "Europe/London");
  const endDate = dateKeyInTimeZone(now, "Europe/London");

  const requests = connected.flatMap((connection) => (
    DATA_TYPES_BY_PROVIDER[connection.provider].map((dataType) => ({ connection, dataType }))
  ));
  const settled = await Promise.allSettled(requests.map(({ connection, dataType }) => (
    requestTerraData(dataType, connection.terra_user_id!, startDate, endDate)
  )));
  const results = settled.map((result, index) => ({
    provider: requests[index].connection.provider,
    dataType: requests[index].dataType,
    accepted: result.status === "fulfilled",
  }));
  const accepted = results.filter((result) => result.accepted);
  const failed = results.filter((result) => !result.accepted);

  if (failed.length) {
    console.error("Some Terra health sync requests failed", { failed });
  }
  if (!accepted.length) {
    return NextResponse.json({ error: "Connected health data could not be requested yet.", results }, { status: 502 });
  }

  return NextResponse.json({
    accepted: true,
    partial: failed.length > 0,
    startDate,
    endDate,
    results,
  }, { status: 202 });
}
