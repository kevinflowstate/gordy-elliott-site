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
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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
    .order("tracked_date", { ascending: false })
    .limit(14);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const entries = (data || []) as DailyMetric[];
  return NextResponse.json({
    today: entries.find((entry) => entry.tracked_date === todayKey()) || null,
    entries,
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
