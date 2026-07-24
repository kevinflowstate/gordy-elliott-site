import { requireAdmin } from "@/lib/admin-auth";
import {
  DEFAULT_MONITORING_PREFERENCES,
  isAttentionSignalEnabled,
  resolveClientLifecycleStatus,
  type ClientAttentionSnooze,
  type ClientMonitoringPreferences,
} from "@/lib/client-attention";
import { calendarWindowLoad, dateKeyInTimeZone, localDateKey } from "@/lib/founder-dashboard";
import {
  addDaysToKey,
  dismissalSilencesWarning,
  evaluateStormWarning,
  isoWeekKey,
  STORM_THRESHOLDS,
  type StormEventInput,
} from "@/lib/storm-warning";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CalendarEvent } from "@/lib/types";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { data: profiles, error: profilesError } = await admin
    .from("client_profiles")
    .select(`
      id, user_id, lifecycle_status, lifecycle_resumes_at,
      user:users!client_profiles_user_id_fkey(full_name, email)
    `)
    .eq("experience_mode", "founder_dashboard")
    .order("created_at", { ascending: true });
  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 });

  const clientIds = (profiles || []).map((profile) => profile.id);
  if (clientIds.length === 0) return NextResponse.json({ clients: [], generatedAt: new Date().toISOString() });

  const now = new Date();
  const todayKey = dateKeyInTimeZone(now, "Europe/London");
  const stormWindowKey = isoWeekKey(todayKey);
  const stormHistoryStartKey = addDaysToKey(todayKey, -STORM_THRESHOLDS.HISTORY_TRAILING_DAYS);
  const stormWindowEndKey = addDaysToKey(todayKey, STORM_THRESHOLDS.WINDOW_DAYS - 1);
  const today = new Date(`${todayKey}T12:00:00.000Z`);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [
    summariesRes,
    connectionsRes,
    activityRes,
    dailyMetricsRes,
    calendarRes,
    connectedCalendarRes,
    coachCalendarRes,
    monitoringRes,
    snoozesRes,
    stormCalendarRes,
    stormDismissalsRes,
  ] = await Promise.all([
    admin
      .from("client_wearable_daily_summaries")
      .select("client_id, summary_date, sleep_minutes, sleep_score, hrv_ms, resting_hr_bpm, readiness_score, recovery_status, flags, insight")
      .in("client_id", clientIds)
      .lte("summary_date", localDateKey(today))
      .order("summary_date", { ascending: false }),
    admin
      .from("client_wearable_connections")
      .select("client_id, provider, status, last_sync_at")
      .in("client_id", clientIds)
      .eq("status", "connected")
      .order("last_sync_at", { ascending: false }),
    admin
      .from("client_attention_latest_activity")
      .select("client_id, last_training, last_daily_metric, last_nutrition, last_wearable_sync")
      .in("client_id", clientIds),
    admin
      .from("client_daily_metrics")
      .select("client_id, tracked_date, energy_level, stress_level")
      .in("client_id", clientIds)
      .gte("tracked_date", localDateKey(thirtyDaysAgo))
      .lte("tracked_date", localDateKey(today))
      .order("tracked_date", { ascending: false }),
    admin
      .from("client_personal_events")
      .select("id, client_id, title, event_date, event_date_key, event_time, recurrence, recurrence_day, category, is_active, created_at")
      .in("client_id", clientIds)
      .eq("is_active", true)
      .lte("event_date_key", localDateKey(weekEnd)),
    admin
      .from("client_calendar_events")
      .select("id, client_id, title, event_date_key, event_time, provider, all_day, is_cancelled, created_at")
      .in("client_id", clientIds)
      .eq("is_cancelled", false)
      .gte("event_date_key", todayKey)
      .lte("event_date_key", localDateKey(weekEnd)),
    admin
      .from("calendar_events")
      .select("id, title, event_date, event_time, recurrence, recurrence_day, is_active, created_at")
      .eq("is_active", true)
      .lte("event_date", weekEnd.toISOString()),
    admin
      .from("client_monitoring_preferences")
      .select("client_id, monitor_login, monitor_checkins, monitor_training, monitor_daily_metrics, monitor_nutrition, monitor_wearables")
      .in("client_id", clientIds),
    admin
      .from("client_attention_snoozes")
      .select("client_id, signal, ignored, snoozed_until, reason")
      .in("client_id", clientIds),
    admin
      .from("client_calendar_events")
      .select("id, client_id, event_date_key, event_time, all_day, busy_status, is_cancelled, starts_at, ends_at")
      .in("client_id", clientIds)
      .gte("event_date_key", stormHistoryStartKey)
      .lte("event_date_key", stormWindowEndKey),
    admin
      .from("client_storm_warning_dismissals")
      .select("client_id, window_key, severity, dismissed_at")
      .in("client_id", clientIds)
      .eq("window_key", stormWindowKey),
  ]);

  const scanError = [
    summariesRes.error,
    connectionsRes.error,
    activityRes.error,
    dailyMetricsRes.error,
    calendarRes.error,
    connectedCalendarRes.error,
    coachCalendarRes.error,
    monitoringRes.error,
    snoozesRes.error,
    stormCalendarRes.error,
    stormDismissalsRes.error,
  ].find(Boolean);
  if (scanError) {
    return NextResponse.json(
      { error: scanError.message || "Capacity Scan could not be loaded." },
      { status: 500 },
    );
  }

  const firstByClient = <T extends { client_id: string }>(rows: T[] | null) => {
    const map = new Map<string, T>();
    for (const row of rows || []) if (!map.has(row.client_id)) map.set(row.client_id, row);
    return map;
  };
  const latestSummary = firstByClient(summariesRes.data);
  const latestConnection = firstByClient(connectionsRes.data);
  const latestDailyMetric = firstByClient(dailyMetricsRes.data);
  const activity = new Map((activityRes.data || []).map((row) => [row.client_id, row]));
  const personalCalendarByClient = new Map<string, CalendarEvent[]>();
  for (const event of calendarRes.data || []) {
    const events = personalCalendarByClient.get(event.client_id) || [];
    events.push({
      id: event.id,
      title: event.title,
      event_date: event.event_date_key || event.event_date,
      event_time: event.event_time,
      recurrence: event.recurrence,
      recurrence_day: event.recurrence_day ?? undefined,
      is_active: event.is_active,
      created_at: event.created_at,
      source: "client",
    });
    personalCalendarByClient.set(event.client_id, events);
  }
  for (const event of connectedCalendarRes.data || []) {
    const events = personalCalendarByClient.get(event.client_id) || [];
    events.push({
      id: event.id,
      title: event.title,
      event_date: event.event_date_key,
      event_time: event.event_time,
      recurrence: "none",
      recurrence_day: undefined,
      is_active: !event.is_cancelled,
      created_at: event.created_at,
      source: "connected",
      provider: event.provider,
      all_day: event.all_day,
    });
    personalCalendarByClient.set(event.client_id, events);
  }
  const coachCalendar = (coachCalendarRes.data || []).map((event) => ({
    ...event,
    recurrence_day: event.recurrence_day ?? undefined,
    source: "coach" as const,
  })) as CalendarEvent[];
  const monitoringByClient = new Map(
    (monitoringRes.data || []).map((row) => [row.client_id, row as ClientMonitoringPreferences]),
  );
  const snoozesByClient = new Map<string, ClientAttentionSnooze[]>();
  for (const row of snoozesRes.data || []) {
    const snoozes = snoozesByClient.get(row.client_id) || [];
    snoozes.push(row as ClientAttentionSnooze);
    snoozesByClient.set(row.client_id, snoozes);
  }

  const stormCoachEvents: StormEventInput[] = (coachCalendarRes.data || []).map((event) => ({
    id: event.id,
    source: "coach" as const,
    event_date: event.event_date,
    event_time: event.event_time || null,
    recurrence: event.recurrence,
    recurrence_day: event.recurrence_day,
  }));
  const stormEventsByClient = new Map<string, StormEventInput[]>();
  for (const event of calendarRes.data || []) {
    const events = stormEventsByClient.get(event.client_id) || [];
    events.push({
      id: event.id,
      source: "client",
      event_date: event.event_date_key || event.event_date,
      event_time: event.event_time || null,
      recurrence: event.recurrence,
      recurrence_day: event.recurrence_day,
      category: event.category || null,
    });
    stormEventsByClient.set(event.client_id, events);
  }
  for (const event of stormCalendarRes.data || []) {
    const events = stormEventsByClient.get(event.client_id) || [];
    events.push({
      id: event.id,
      source: "connected",
      event_date: event.event_date_key,
      event_time: event.event_time || null,
      recurrence: "none",
      all_day: Boolean(event.all_day),
      busy_status: event.busy_status || null,
      is_cancelled: Boolean(event.is_cancelled),
      starts_at: event.starts_at || null,
      ends_at: event.ends_at || null,
    });
    stormEventsByClient.set(event.client_id, events);
  }
  const stormDismissalByClient = new Map(
    (stormDismissalsRes.data || []).map((row) => [row.client_id, row]),
  );

  const stormLogRows: Array<Record<string, unknown>> = [];
  const clients = (profiles || []).map((profile) => {
    const user = Array.isArray(profile.user) ? profile.user[0] : profile.user;
    const latestWearableSummary = latestSummary.get(profile.id) || null;
    const summary = latestWearableSummary?.summary_date?.slice(0, 10) === todayKey
      ? latestWearableSummary
      : null;
    const connection = latestConnection.get(profile.id) || null;
    const latest = activity.get(profile.id) || null;
    const latestDaily = latestDailyMetric.get(profile.id) || null;
    const daily = latestDaily?.tracked_date?.slice(0, 10) === todayKey
      ? latestDaily
      : null;
    const calendarDays = calendarWindowLoad(
      [...coachCalendar, ...(personalCalendarByClient.get(profile.id) || [])],
      today,
    );
    const calendarTotal = calendarDays.reduce((total, day) => total + day.count, 0);
    const denseDays = calendarDays.filter((day) => day.count >= 4).length;
    const flags: Array<{ severity: "red" | "amber"; label: string }> = [];
    const energy = daily?.energy_level === null || daily?.energy_level === undefined ? null : Number(daily.energy_level);
    const stress = daily?.stress_level === null || daily?.stress_level === undefined ? null : Number(daily.stress_level);
    const effectiveLifecycle = resolveClientLifecycleStatus(
      profile.lifecycle_status,
      profile.lifecycle_resumes_at,
    );
    const monitoring = monitoringByClient.get(profile.id) || DEFAULT_MONITORING_PREFERENCES;
    const snoozes = snoozesByClient.get(profile.id) || [];

    // Same rules engine as the client dashboard, so the scan shows the same
    // warning with the same explanation.
    const stormEvaluation = evaluateStormWarning({
      events: [...stormCoachEvents, ...(stormEventsByClient.get(profile.id) || [])],
      now,
    });
    const stormDismissal = stormDismissalByClient.get(profile.id) || null;
    // A dismissal only quiets the client card while severity has not
    // escalated past it - the scan must reflect what the client actually sees.
    const stormSilenced = dismissalSilencesWarning(stormEvaluation, stormDismissal);
    if (stormEvaluation.warning && stormEvaluation.severity !== "none") {
      stormLogRows.push({
        client_id: profile.id,
        window_key: stormEvaluation.windowKey,
        window_start: stormEvaluation.windowStart,
        window_end: stormEvaluation.windowEnd,
        severity: stormEvaluation.severity,
        triggered_rules: stormEvaluation.rules.filter((rule) => rule.triggered).map((rule) => rule.id),
        evaluation: stormEvaluation,
        input_hash: stormEvaluation.inputHash,
        evaluated_at: stormEvaluation.evaluatedAt,
      });
    }

    if (effectiveLifecycle === "active") {
      if (isAttentionSignalEnabled("wearables", monitoring, snoozes)) {
        if (summary?.recovery_status === "reduce_intensity") {
          flags.push({ severity: "red", label: summary.insight || "Recovery signals suggest reducing intensity." });
        } else if (summary?.recovery_status === "watch") {
          flags.push({ severity: "amber", label: summary.insight || "Recovery signals need watching." });
        }
        if (!summary) {
          flags.push({
            severity: "amber",
            label: latestWearableSummary
              ? `Today's wearable summary is not available. Latest data is from ${latestWearableSummary.summary_date}.`
              : "No wearable summary is available.",
          });
        }
      }
      if (isAttentionSignalEnabled("daily_metrics", monitoring, snoozes)) {
        if ((stress !== null && stress >= 9) || (energy !== null && energy <= 2)) {
          flags.push({ severity: "red", label: "Latest daily check shows very high stress or very low energy." });
        } else if ((stress !== null && stress >= 7) || (energy !== null && energy <= 4)) {
          flags.push({ severity: "amber", label: "Latest daily check shows capacity pressure." });
        }
      }
      if (stormEvaluation.warning && stormEvaluation.severity !== "none") {
        flags.push({
          severity: stormEvaluation.severity === "red" ? "red" : "amber",
          label: `Storm warning${
            stormSilenced
              ? " (dismissed by client)"
              : stormDismissal
                ? ` (dismissed at ${stormDismissal.severity} - re-raised at ${stormEvaluation.severity})`
                : ""
          }: ${stormEvaluation.overallExplanation}`,
        });
      }
    }

    const status = effectiveLifecycle !== "active"
      ? "paused"
      : flags.some((flag) => flag.severity === "red")
        ? "red"
        : flags.length > 0
          ? "amber"
          : "green";

    return {
      id: profile.id,
      name: user?.full_name || "Unknown client",
      email: user?.email || "",
      lifecycle_status: effectiveLifecycle,
      status,
      flags,
      capacity: summary ? {
        date: summary.summary_date,
        readiness_score: summary.readiness_score,
        recovery_status: summary.recovery_status,
        sleep_minutes: summary.sleep_minutes,
        sleep_score: summary.sleep_score,
        hrv_ms: summary.hrv_ms,
        resting_hr_bpm: summary.resting_hr_bpm,
      } : null,
      daily: daily ? {
        date: daily.tracked_date,
        energy: daily.energy_level,
        stress: daily.stress_level,
      } : null,
      activity: latest,
      calendar: {
        total: calendarTotal,
        dense_days: denseDays,
      },
      storm: {
        warning: stormEvaluation.warning,
        severity: stormEvaluation.severity,
        window_key: stormEvaluation.windowKey,
        overall: stormEvaluation.overallExplanation,
        explanations: stormEvaluation.rules.filter((rule) => rule.triggered).map((rule) => rule.explanation),
        used_history: stormEvaluation.usedHistory,
        dismissed: Boolean(stormDismissal),
        silenced: stormSilenced,
        dismissed_severity: stormDismissal?.severity || null,
        dismissed_at: stormDismissal?.dismissed_at || null,
      },
      connection: connection ? {
        provider: connection.provider,
        last_sync_at: connection.last_sync_at,
      } : null,
    };
  }).sort((a, b) => {
    const order: Record<string, number> = { red: 0, amber: 1, green: 2, paused: 3 };
    return order[a.status] - order[b.status];
  });

  if (stormLogRows.length > 0) {
    // Audit log; deduplicated on (client_id, window_key, input_hash) so
    // repeated scans of unchanged calendars add nothing.
    const { error: stormLogError } = await admin
      .from("client_storm_warnings")
      .upsert(stormLogRows, { onConflict: "client_id,window_key,input_hash", ignoreDuplicates: true });
    if (stormLogError) {
      return NextResponse.json({ error: stormLogError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ clients, generatedAt: new Date().toISOString() });
}
