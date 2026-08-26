import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type DailyMetric = {
  id: string;
  tracked_date: string;
  sleep_hours: number | null;
  water_liters: number | null;
  energy_level: number | null;
  stress_level: number | null;
  nutrition_score: number | null;
  training_completed: boolean;
  notes: string | null;
};

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Could not resolve today's coaching date");
  return `${year}-${month}-${day}`;
}

function toNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toScale(value: unknown) {
  const parsed = toNumber(value);
  if (parsed === null) return null;
  return Math.max(1, Math.min(10, Math.round(parsed)));
}

async function getClientProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return { error: NextResponse.json({ error: "Client profile not found" }, { status: 404 }) };

  return { admin, profile };
}

export async function GET() {
  const context = await getClientProfile();
  if (context.error) return context.error;
  const { admin, profile } = context;

  const { data, error } = await admin
    .from("client_daily_metrics")
    .select("*")
    .eq("client_id", profile.id)
    .lte("tracked_date", todayKey())
    .order("tracked_date", { ascending: false })
    .limit(14);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: wearableSummaries, error: wearableError } = await admin
    .from("client_wearable_daily_summaries")
    .select("*")
    .eq("client_id", profile.id)
    .lte("summary_date", todayKey())
    .order("summary_date", { ascending: false })
    .limit(14);

  if (wearableError) return NextResponse.json({ error: wearableError.message }, { status: 500 });

  const { data: completedSessions, error: completedSessionsError } = await admin
    .from("client_exercise_session_summaries")
    .select("log_date")
    .eq("client_id", profile.id)
    .lte("log_date", todayKey())
    .order("log_date", { ascending: false })
    .limit(50);

  if (completedSessionsError) return NextResponse.json({ error: completedSessionsError.message }, { status: 500 });

  const trainingDates = [...new Set((completedSessions || []).map((session) => session.log_date))];
  const completedTrainingDates = new Set(trainingDates);
  const entries = ((data || []) as DailyMetric[]).map((entry) => ({
    ...entry,
    training_completed: entry.training_completed || completedTrainingDates.has(entry.tracked_date),
  }));
  return NextResponse.json({
    today: entries.find((entry) => entry.tracked_date === todayKey()) || null,
    entries,
    trainingDates,
    wearableSummary: (wearableSummaries || []).find((entry) => entry.summary_date === todayKey()) || wearableSummaries?.[0] || null,
    wearableSummaries: wearableSummaries || [],
  });
}

export async function POST(request: Request) {
  const context = await getClientProfile();
  if (context.error) return context.error;
  const { admin, profile } = context;
  const body = await request.json();
  const trackedDate = typeof body.tracked_date === "string" && body.tracked_date ? body.tracked_date : todayKey();

  const payload = {
    client_id: profile.id,
    tracked_date: trackedDate,
    sleep_hours: toNumber(body.sleep_hours),
    water_liters: toNumber(body.water_liters),
    energy_level: toScale(body.energy_level),
    stress_level: toScale(body.stress_level),
    nutrition_score: toScale(body.nutrition_score),
    training_completed: Boolean(body.training_completed),
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("client_daily_metrics")
    .upsert(payload, { onConflict: "client_id,tracked_date" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ metric: data });
}
