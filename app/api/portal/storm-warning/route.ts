import {
  addDaysToKey,
  dateKeyInTimeZone,
  dismissalSilencesWarning,
  evaluateStormWarning,
  STORM_THRESHOLDS,
  type StormDismissal,
  type StormEventInput,
  type StormWarningEvaluation,
} from "@/lib/storm-warning";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function getFounderContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("client_profiles")
    .select("id, experience_mode")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("storm-warning profile load failed:", profileError.message);
    return { error: NextResponse.json({ error: "Storm warnings could not be loaded" }, { status: 500 }) };
  }
  if (!profile) return { error: NextResponse.json({ error: "Client profile not found" }, { status: 404 }) };
  if (profile.experience_mode !== "founder_dashboard") {
    return { error: NextResponse.json({ error: "Storm warnings are not available in this experience" }, { status: 403 }) };
  }
  return { admin, profile };
}

async function loadStormEvents(admin: SupabaseClient, clientId: string, now: Date) {
  const todayKey = dateKeyInTimeZone(now, "Europe/London");
  const historyStartKey = addDaysToKey(todayKey, -STORM_THRESHOLDS.HISTORY_TRAILING_DAYS);
  const windowEndKey = addDaysToKey(todayKey, STORM_THRESHOLDS.WINDOW_DAYS - 1);

  const [coachRes, personalRes, connectedRes] = await Promise.all([
    admin
      .from("calendar_events")
      .select("id, event_date, event_time, recurrence, recurrence_day, is_active")
      .eq("is_active", true)
      .lte("event_date", `${windowEndKey}T23:59:59.999Z`),
    admin
      .from("client_personal_events")
      .select("id, event_date_key, event_date, event_time, recurrence, recurrence_day, category, is_active")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .lte("event_date_key", windowEndKey),
    admin
      .from("client_calendar_events")
      .select("id, event_date_key, event_time, all_day, busy_status, is_cancelled, starts_at, ends_at")
      .eq("client_id", clientId)
      .gte("event_date_key", historyStartKey)
      .lte("event_date_key", windowEndKey),
  ]);

  const loadError = [coachRes.error, personalRes.error, connectedRes.error].find(Boolean);
  if (loadError) return { loadError };

  const events: StormEventInput[] = [
    ...(coachRes.data || []).map((event) => ({
      id: event.id as string,
      source: "coach" as const,
      event_date: event.event_date as string,
      event_time: (event.event_time as string) || null,
      recurrence: event.recurrence,
      recurrence_day: event.recurrence_day,
    })),
    ...(personalRes.data || []).map((event) => ({
      id: event.id as string,
      source: "client" as const,
      event_date: (event.event_date_key as string) || (event.event_date as string),
      event_time: (event.event_time as string) || null,
      recurrence: event.recurrence,
      recurrence_day: event.recurrence_day,
      category: (event.category as string) || null,
    })),
    ...(connectedRes.data || []).map((event) => ({
      id: event.id as string,
      source: "connected" as const,
      event_date: event.event_date_key as string,
      event_time: (event.event_time as string) || null,
      recurrence: "none" as const,
      all_day: Boolean(event.all_day),
      busy_status: (event.busy_status as string) || null,
      is_cancelled: Boolean(event.is_cancelled),
      starts_at: (event.starts_at as string) || null,
      ends_at: (event.ends_at as string) || null,
    })),
  ];
  return { events };
}

/**
 * Calendar edits change the input hash, so a client could otherwise mint
 * unbounded audit rows for one window by toggling an event between states.
 */
const MAX_LOGGED_WARNINGS_PER_WINDOW = 30;

async function logWarning(admin: SupabaseClient, clientId: string, evaluation: StormWarningEvaluation) {
  if (!evaluation.warning || evaluation.severity === "none") return null;
  const { count, error: countError } = await admin
    .from("client_storm_warnings")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("window_key", evaluation.windowKey);
  if (countError) return countError;
  if ((count ?? 0) >= MAX_LOGGED_WARNINGS_PER_WINDOW) return null;
  // ignoreDuplicates makes repeated evaluations of the same window and inputs
  // a no-op instead of a fresh audit row.
  const { error } = await admin
    .from("client_storm_warnings")
    .upsert({
      client_id: clientId,
      window_key: evaluation.windowKey,
      window_start: evaluation.windowStart,
      window_end: evaluation.windowEnd,
      severity: evaluation.severity,
      triggered_rules: evaluation.rules.filter((rule) => rule.triggered).map((rule) => rule.id),
      evaluation,
      input_hash: evaluation.inputHash,
      evaluated_at: evaluation.evaluatedAt,
    }, { onConflict: "client_id,window_key,input_hash", ignoreDuplicates: true });
  return error;
}

async function loadDismissal(admin: SupabaseClient, clientId: string, windowKey: string) {
  const { data } = await admin
    .from("client_storm_warning_dismissals")
    .select("window_key, severity, dismissed_at")
    .eq("client_id", clientId)
    .eq("window_key", windowKey)
    .maybeSingle();
  return (data as StormDismissal | null) || null;
}

export async function GET() {
  const ctx = await getFounderContext();
  if (ctx.error) return ctx.error;
  const { admin, profile } = ctx;

  const now = new Date();
  const { events, loadError } = await loadStormEvents(admin, profile.id, now);
  if (loadError || !events) {
    console.error("storm-warning event load failed:", loadError?.message);
    return NextResponse.json({ error: "Calendar data could not be loaded" }, { status: 500 });
  }

  const evaluation = evaluateStormWarning({ events, now });
  const logError = await logWarning(admin, profile.id, evaluation);
  if (logError) {
    console.error("storm-warning log write failed:", logError.message);
    return NextResponse.json({ error: "The storm warning could not be recorded" }, { status: 500 });
  }

  const dismissed = await loadDismissal(admin, profile.id, evaluation.windowKey);
  return NextResponse.json({
    evaluation,
    dismissed,
    silenced: dismissalSilencesWarning(evaluation, dismissed),
  });
}

export async function POST() {
  const ctx = await getFounderContext();
  if (ctx.error) return ctx.error;
  const { admin, profile } = ctx;

  const now = new Date();
  const { events, loadError } = await loadStormEvents(admin, profile.id, now);
  if (loadError || !events) {
    console.error("storm-warning event load failed:", loadError?.message);
    return NextResponse.json({ error: "Calendar data could not be loaded" }, { status: 500 });
  }

  // Dismissals are validated against a fresh server-side evaluation, never
  // against client-supplied state.
  const evaluation = evaluateStormWarning({ events, now });
  if (!evaluation.warning || evaluation.severity === "none") {
    return NextResponse.json({ error: "There is no active storm warning to dismiss" }, { status: 400 });
  }
  const logError = await logWarning(admin, profile.id, evaluation);
  if (logError) {
    console.error("storm-warning log write failed:", logError.message);
    return NextResponse.json({ error: "The storm warning could not be recorded" }, { status: 500 });
  }

  const dismissedAt = now.toISOString();
  const { error } = await admin
    .from("client_storm_warning_dismissals")
    .upsert({
      client_id: profile.id,
      window_key: evaluation.windowKey,
      severity: evaluation.severity,
      dismissed_at: dismissedAt,
    }, { onConflict: "client_id,window_key" });
  if (error) {
    console.error("storm-warning dismissal write failed:", error.message);
    return NextResponse.json({ error: "The dismissal could not be saved" }, { status: 500 });
  }

  const dismissed: StormDismissal = {
    window_key: evaluation.windowKey,
    severity: evaluation.severity,
    dismissed_at: dismissedAt,
  };
  return NextResponse.json({
    evaluation,
    dismissed,
    silenced: dismissalSilencesWarning(evaluation, dismissed),
  });
}
