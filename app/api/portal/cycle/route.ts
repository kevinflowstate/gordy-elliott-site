import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api-errors";
import {
  getCyclePhase,
  getCyclePrompt,
  isCycleEligible,
  toDateKey,
  type CycleEntry,
  type CyclePromptEvent,
  type CycleSettings,
  type DailyReadinessMetric,
} from "@/lib/cycle-tracking";
import { NextResponse } from "next/server";

const flowValues = new Set(["none", "spotting", "light", "medium", "heavy"]);
const trainingImpactValues = new Set(["none", "scaled", "skipped"]);

function toDateString(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function toInteger(value: unknown, min: number, max: number) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function toText(value: unknown, maxLength = 1000) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function normaliseSymptoms(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim().slice(0, 80) : ""))
    .filter(Boolean)
    .slice(0, 12);
}

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("client_profiles")
    .select("id, user_id, sex, cycle_tracking_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return { error: dbError(error, "Couldn't load cycle tracking. Try again.") };
  if (!profile) return { error: NextResponse.json({ error: "Client profile not found" }, { status: 404 }) };

  return { admin, profile };
}

async function loadCycleData(admin: ReturnType<typeof createAdminClient>, clientId: string) {
  const todayKey = toDateKey();
  const startKey = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [settingsRes, entriesRes, metricsRes, eventsRes] = await Promise.all([
    admin
      .from("client_cycle_settings")
      .select("last_period_start, average_cycle_length, average_period_length")
      .eq("client_id", clientId)
      .maybeSingle(),
    admin
      .from("client_cycle_entries")
      .select("id, tracked_date, flow, symptoms, pain_level, energy_level, training_impact, unusual_symptoms, notes, created_at, updated_at")
      .eq("client_id", clientId)
      .order("tracked_date", { ascending: false })
      .limit(45),
    admin
      .from("client_daily_metrics")
      .select("tracked_date, sleep_hours, water_liters, energy_level, stress_level, nutrition_score, training_completed")
      .eq("client_id", clientId)
      .gte("tracked_date", startKey)
      .order("tracked_date", { ascending: false })
      .limit(45),
    admin
      .from("client_cycle_prompt_events")
      .select("event_key, prompt_kind, phase, shown_on")
      .eq("client_id", clientId)
      .gte("shown_on", startKey)
      .order("shown_on", { ascending: false }),
  ]);

  if (settingsRes.error && settingsRes.error.code !== "PGRST116") throw settingsRes.error;
  if (entriesRes.error) throw entriesRes.error;
  if (metricsRes.error) throw metricsRes.error;
  if (eventsRes.error) throw eventsRes.error;

  const settings = (settingsRes.data || null) as CycleSettings | null;
  const entries = (entriesRes.data || []) as Array<CycleEntry & { id: string; created_at: string; updated_at: string }>;
  const dailyMetrics = (metricsRes.data || []) as DailyReadinessMetric[];
  const promptEvents = (eventsRes.data || []) as CyclePromptEvent[];
  const todayEntry = entries.find((entry) => entry.tracked_date === todayKey) || null;
  const todayMetric = dailyMetrics.find((metric) => metric.tracked_date === todayKey) || null;
  const phaseInfo = getCyclePhase(settings, todayKey);
  let prompt = getCyclePrompt({ phaseInfo, todayMetric, todayEntry, promptEvents, todayKey });

  if (prompt) {
    const { error } = await admin
      .from("client_cycle_prompt_events")
      .upsert({
        client_id: clientId,
        event_key: prompt.eventKey,
        prompt_kind: prompt.kind,
        phase: prompt.phase || null,
        shown_on: todayKey,
      }, { onConflict: "client_id,event_key", ignoreDuplicates: true });

    if (error) throw error;

    prompt = {
      ...prompt,
      eventKey: prompt.eventKey,
    };
  }

  return {
    settings,
    entries,
    dailyMetrics,
    phaseInfo,
    prompt,
    todayKey,
  };
}

export async function GET() {
  const context = await getContext();
  if (context.error) return context.error;
  const { admin, profile } = context;

  if (!isCycleEligible(profile)) {
    return NextResponse.json({
      eligible: false,
      sex: profile.sex,
      cycleTrackingEnabled: profile.cycle_tracking_enabled,
    });
  }

  try {
    const data = await loadCycleData(admin, profile.id);
    return NextResponse.json({ eligible: true, ...data });
  } catch (error) {
    return dbError(error, "Couldn't load cycle tracking. Try again.");
  }
}

export async function POST(request: Request) {
  const context = await getContext();
  if (context.error) return context.error;
  const { admin, profile } = context;

  if (!isCycleEligible(profile)) {
    return NextResponse.json({ error: "Cycle tracking is not enabled for this account" }, { status: 403 });
  }

  const body = await request.json();
  const now = new Date().toISOString();

  try {
    if (body.settings && typeof body.settings === "object") {
      const averageCycleLength = toInteger(body.settings.average_cycle_length, 21, 45) ?? 28;
      const averagePeriodLength = toInteger(body.settings.average_period_length, 2, 10) ?? 5;

      const { error } = await admin
        .from("client_cycle_settings")
        .upsert({
          client_id: profile.id,
          last_period_start: toDateString(body.settings.last_period_start),
          average_cycle_length: averageCycleLength,
          average_period_length: averagePeriodLength,
          updated_at: now,
        }, { onConflict: "client_id" });

      if (error) throw error;
    }

    if (body.entry && typeof body.entry === "object") {
      const trackedDate = toDateString(body.entry.tracked_date) || toDateKey();
      const flow = flowValues.has(body.entry.flow) ? body.entry.flow : "none";
      const trainingImpact = trainingImpactValues.has(body.entry.training_impact) ? body.entry.training_impact : "none";

      const { error } = await admin
        .from("client_cycle_entries")
        .upsert({
          client_id: profile.id,
          tracked_date: trackedDate,
          flow,
          symptoms: normaliseSymptoms(body.entry.symptoms),
          pain_level: toInteger(body.entry.pain_level, 0, 10),
          energy_level: toInteger(body.entry.energy_level, 1, 10),
          training_impact: trainingImpact,
          unusual_symptoms: Boolean(body.entry.unusual_symptoms),
          notes: toText(body.entry.notes),
          updated_at: now,
        }, { onConflict: "client_id,tracked_date" });

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return dbError(error, "Couldn't save cycle tracking. Try again.");
  }
}
