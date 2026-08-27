import { dateKeyInTimeZone } from "@/lib/founder-dashboard";
import { requestTerraData, type TerraDataType } from "@/lib/terra/client";
import { normaliseTerraProvider, type TerraLaunchProvider } from "@/lib/terra/events";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const DAY_MS = 24 * 60 * 60 * 1000;
const BACKFILL_DAYS = 7;
const MYFITNESSPAL_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

const DATA_TYPES_BY_PROVIDER: Record<TerraLaunchProvider, readonly TerraDataType[]> = {
  garmin: ["daily", "sleep", "activity"],
  oura: ["daily", "sleep", "activity"],
  fitbit: ["daily", "sleep", "activity"],
  whoop: ["daily", "sleep", "activity"],
  myfitnesspal: ["nutrition"],
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const requestedProviderValue = new URL(request.url).searchParams.get("provider");
  const requestedProvider = normaliseTerraProvider(requestedProviderValue);
  if (requestedProviderValue !== null && !requestedProvider) {
    return NextResponse.json({ error: "Unsupported health provider." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Client profile not found" }, { status: 404 });

  let connectionsQuery = admin
    .from("client_wearable_connections")
    .select("id, provider, terra_user_id, status, consented_at, updated_at")
    .eq("client_id", profile.id)
    .eq("status", "connected")
    .not("terra_user_id", "is", null);
  if (requestedProvider) connectionsQuery = connectionsQuery.eq("provider", requestedProvider);
  const { data: connections, error } = await connectionsQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const connected = (connections || []).flatMap((connection) => {
    const provider = normaliseTerraProvider(connection.provider);
    return connection.consented_at && connection.terra_user_id && provider
      ? [{ ...connection, provider }]
      : [];
  });
  if (!connected.length) return NextResponse.json({ error: "No health app is connected." }, { status: 409 });

  if (requestedProvider === "myfitnesspal") {
    const connection = connected[0];
    const now = new Date();
    const lastRequest = connection.updated_at ? Date.parse(connection.updated_at) : Number.NaN;
    if (Number.isFinite(lastRequest) && now.getTime() - lastRequest < MYFITNESSPAL_REFRESH_COOLDOWN_MS) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((MYFITNESSPAL_REFRESH_COOLDOWN_MS - (now.getTime() - lastRequest)) / 1000),
      );
      return NextResponse.json(
        { error: "A MyFitnessPal refresh was already requested. Check again in a few minutes.", retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }

    const cutoff = new Date(now.getTime() - MYFITNESSPAL_REFRESH_COOLDOWN_MS).toISOString();
    const { data: claimed, error: claimError } = await admin
      .from("client_wearable_connections")
      .update({ updated_at: now.toISOString() })
      .eq("id", connection.id)
      .or(`updated_at.is.null,updated_at.lt.${cutoff}`)
      .select("id")
      .maybeSingle();
    if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });
    if (!claimed) {
      return NextResponse.json(
        { error: "A MyFitnessPal refresh was already requested. Check again in a few minutes.", retryAfterSeconds: 300 },
        { status: 429, headers: { "Retry-After": "300" } },
      );
    }
  }

  const now = new Date();
  const startDate = dateKeyInTimeZone(new Date(now.getTime() - (BACKFILL_DAYS - 1) * DAY_MS), "Europe/London");
  // Terra treats end_date as exclusive. Request through tomorrow so today's
  // in-progress health and nutrition data is included.
  const endDate = dateKeyInTimeZone(new Date(now.getTime() + DAY_MS), "Europe/London");

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
