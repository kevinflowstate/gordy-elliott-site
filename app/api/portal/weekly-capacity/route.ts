import { calendarEventOccursOn, dateKeyInTimeZone } from "@/lib/founder-dashboard";
import { addDaysToKey, NON_MEETING_CATEGORIES } from "@/lib/storm-warning";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CalendarEvent } from "@/lib/types";
import { evaluateWeeklyCapacity, type WeeklyCapacitySleepSignal } from "@/lib/weekly-capacity";
import { NextResponse } from "next/server";

const TIME_ZONE = "Europe/London";

function calendarDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`);
}

function asCalendarEvent(event: Record<string, unknown>, source: CalendarEvent["source"]): CalendarEvent {
  return {
    id: String(event.id),
    title: "",
    event_date: String(event.event_date_key || event.event_date),
    event_time: typeof event.event_time === "string" ? event.event_time : "09:00",
    recurrence: event.recurrence === "weekly" || event.recurrence === "biweekly" || event.recurrence === "monthly"
      ? event.recurrence
      : "none",
    recurrence_day: typeof event.recurrence_day === "number" ? event.recurrence_day : null,
    is_active: event.is_active !== false && event.is_cancelled !== true,
    all_day: event.all_day === true,
    created_at: "",
    source,
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("client_profiles")
    .select("id, start_date, created_at, experience_mode")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("weekly-capacity profile load failed:", profileError.message);
    return NextResponse.json({ error: "Weekly capacity could not be loaded" }, { status: 500 });
  }
  if (!profile) return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  if (profile.experience_mode !== "founder_dashboard") {
    return NextResponse.json({ error: "Weekly capacity is not available in this experience" }, { status: 403 });
  }

  const now = new Date();
  const todayKey = dateKeyInTimeZone(now, TIME_ZONE);
  const windowEndKey = addDaysToKey(todayKey, 6);
  const sleepStartKey = addDaysToKey(todayKey, -27);

  const [
    connectionRes,
    connectedEventsRes,
    personalEventsRes,
    coachEventsRes,
    wearableSleepRes,
    trackedSleepRes,
    activePlanRes,
  ] = await Promise.all([
    admin
      .from("client_calendar_connections")
      .select("status, last_sync_at")
      .eq("client_id", profile.id)
      .eq("status", "connected")
      .order("last_sync_at", { ascending: false, nullsFirst: false })
      .limit(1),
    admin
      .from("client_calendar_events")
      .select("id, event_date_key, event_time, all_day, busy_status, is_cancelled")
      .eq("client_id", profile.id)
      .gte("event_date_key", todayKey)
      .lte("event_date_key", windowEndKey),
    admin
      .from("client_personal_events")
      .select("id, event_date_key, event_date, event_time, recurrence, recurrence_day, category, is_active")
      .eq("client_id", profile.id)
      .eq("is_active", true)
      .or(`recurrence.neq.none,event_date_key.gte.${todayKey}`)
      .lte("event_date_key", windowEndKey),
    admin
      .from("calendar_events")
      .select("id, event_date, event_time, recurrence, recurrence_day, is_active")
      .eq("is_active", true)
      .or(`recurrence.neq.none,event_date.gte.${todayKey}T00:00:00.000Z`)
      .lte("event_date", `${windowEndKey}T23:59:59.999Z`),
    admin
      .from("client_wearable_daily_summaries")
      .select("summary_date, sleep_minutes, sleep_score")
      .eq("client_id", profile.id)
      .gte("summary_date", sleepStartKey)
      .lte("summary_date", todayKey)
      .order("summary_date", { ascending: false }),
    admin
      .from("client_daily_metrics")
      .select("tracked_date, sleep_hours")
      .eq("client_id", profile.id)
      .gte("tracked_date", sleepStartKey)
      .lte("tracked_date", todayKey)
      .order("tracked_date", { ascending: false }),
    admin
      .from("client_exercise_plans")
      .select("id")
      .eq("client_id", profile.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const queryError = [
    connectionRes.error,
    connectedEventsRes.error,
    personalEventsRes.error,
    coachEventsRes.error,
    wearableSleepRes.error,
    trackedSleepRes.error,
    activePlanRes.error,
  ].find(Boolean);
  if (queryError) {
    console.error("weekly-capacity signal load failed:", queryError.message);
    return NextResponse.json({ error: "Weekly capacity signals could not be loaded" }, { status: 500 });
  }

  const activePlanId = activePlanRes.data?.[0]?.id || null;
  const [sessionsRes, assignmentsRes] = activePlanId
    ? await Promise.all([
        admin
          .from("client_exercise_sessions")
          .select("id")
          .eq("plan_id", activePlanId),
        admin
          .from("client_training_weekly_assignments")
          .select("session_id, planned_date")
          .eq("client_id", profile.id)
          .eq("plan_id", activePlanId)
          .gte("planned_date", todayKey)
          .lte("planned_date", windowEndKey),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  if (sessionsRes.error || assignmentsRes.error) {
    console.error("weekly-capacity training load failed:", sessionsRes.error?.message || assignmentsRes.error?.message);
    return NextResponse.json({ error: "Weekly capacity training could not be loaded" }, { status: 500 });
  }

  const connectedMeetings = (connectedEventsRes.data || [])
    .filter((event) => !event.is_cancelled && !event.all_day && String(event.busy_status || "").toLowerCase() !== "free");
  const occurrenceEvents = [
    ...(personalEventsRes.data || [])
      .filter((event) => !NON_MEETING_CATEGORIES.has(String(event.category || "")))
      .map((event) => asCalendarEvent(event, "client")),
    ...(coachEventsRes.data || []).map((event) => asCalendarEvent(event, "coach")),
  ];
  const calendarMeetingsByDay = Array.from({ length: 7 }, (_, index) => {
    const dateKey = addDaysToKey(todayKey, index);
    const connectedCount = connectedMeetings.filter((event) => event.event_date_key === dateKey).length;
    const occurrenceCount = occurrenceEvents.filter((event) => calendarEventOccursOn(event, calendarDate(dateKey))).length;
    return connectedCount + occurrenceCount;
  });

  const sleepByDate = new Map<string, WeeklyCapacitySleepSignal>();
  for (const summary of wearableSleepRes.data || []) {
    const date = String(summary.summary_date).slice(0, 10);
    sleepByDate.set(date, {
      date,
      sleepMinutes: typeof summary.sleep_minutes === "number" ? summary.sleep_minutes : null,
      sleepScore: typeof summary.sleep_score === "number" ? summary.sleep_score : null,
    });
  }
  for (const metric of trackedSleepRes.data || []) {
    const date = String(metric.tracked_date).slice(0, 10);
    const existing = sleepByDate.get(date);
    const hours = typeof metric.sleep_hours === "number" ? metric.sleep_hours : Number(metric.sleep_hours);
    if ((!existing || (existing.sleepMinutes === null && existing.sleepScore === null)) && Number.isFinite(hours)) {
      sleepByDate.set(date, { date, sleepMinutes: Math.round(hours * 60), sleepScore: null });
    }
  }

  const connection = connectionRes.data?.[0] || null;
  const result = evaluateWeeklyCapacity({
    now,
    collectionStartedAt: profile.start_date || profile.created_at,
    calendarConnected: Boolean(connection),
    calendarLastSyncAt: connection?.last_sync_at || null,
    calendarMeetingsByDay,
    sleepSignals: [...sleepByDate.values()],
    activePlanSessions: sessionsRes.data?.length || 0,
    plannedSessions: assignmentsRes.data?.filter((assignment) => Boolean(assignment.planned_date)).length || 0,
  });

  return NextResponse.json(result);
}
