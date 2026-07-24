import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MONITORING_PREFERENCES,
  isAttentionSignalEnabled,
  resolveClientLifecycleStatus,
  type ClientAttentionSnooze,
  type ClientMonitoringPreferences,
} from "../lib/client-attention";
import { calendarWindowLoad, dateKeyInTimeZone } from "../lib/founder-dashboard";
import {
  addDaysToKey,
  dismissalSilencesWarning,
  evaluateStormWarning,
  isoWeekKey,
  STORM_THRESHOLDS,
  type StormDismissal,
  type StormEventInput,
} from "../lib/storm-warning";
import type { CalendarEvent } from "../lib/types";

/**
 * Volume evidence for the checklist acceptance "Gordy can scan 20 or more
 * clients without opening each profile".
 *
 * This exercises the pure evaluation path used by
 * app/api/admin/capacity-scan/route.ts - the storm rules engine, the attention
 * signal gates, lifecycle resolution and calendar window load - over 26
 * synthetic Founder clients in diverse states, then composes each client
 * through the same per-client mapping the route applies to its query results.
 * The route's Supabase queries and the browser rendering of the scan at
 * volume are NOT covered here.
 */

// Friday 24 July 2026 (BST). Window: Fri 24 Jul - Thu 30 Jul, ISO week 2026-W30.
const NOW = new Date("2026-07-24T09:00:00+01:00");
const TODAY_KEY = dateKeyInTimeZone(NOW, "Europe/London");
const WINDOW_KEY = isoWeekKey(TODAY_KEY);

let fixtureId = 0;
function nextId(prefix: string) {
  fixtureId += 1;
  return `${prefix}-${fixtureId}`;
}

function synced(
  dateKey: string,
  start: string,
  end: string,
  overrides: Partial<StormEventInput> = {},
): StormEventInput {
  return {
    id: nextId("synced"),
    source: "connected",
    event_date: dateKey,
    event_time: start,
    recurrence: "none",
    all_day: false,
    busy_status: "busy",
    is_cancelled: false,
    starts_at: `${dateKey}T${start}:00+01:00`,
    ends_at: `${dateKey}T${end}:00+01:00`,
    ...overrides,
  };
}

/** N meetings spread across a day with comfortable gaps between them. */
function spreadDay(dateKey: string, count: number): StormEventInput[] {
  const slots = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];
  return slots.slice(0, count).map((start) => {
    const end = `${start.slice(0, 2)}:30`;
    return synced(dateKey, start, end);
  });
}

/** Back-to-back meetings with under-15-minute gaps. */
function tightDay(dateKey: string, count: number): StormEventInput[] {
  return Array.from({ length: count }, (_, index) => {
    const startHour = String(9 + index).padStart(2, "0");
    const endHour = String(10 + index).padStart(2, "0");
    return synced(dateKey, `${startHour}:00`, `${endHour}:55`, {
      starts_at: `${dateKey}T${startHour}:00:00+01:00`,
      ends_at: `${dateKey}T${startHour}:55:00+01:00`,
    });
  }).map((event, index, all) => index === 0
    ? event
    : { ...event, starts_at: all[index - 1].ends_at?.replace(":55:", ":58:") ?? event.starts_at });
}

// ---------------------------------------------------------------------------
// Synthetic client fleet.
// ---------------------------------------------------------------------------

type WearableFixture = {
  summary_date: string;
  recovery_status: "ready" | "watch" | "reduce_intensity";
  insight: string | null;
} | null;

type ScanFixture = {
  id: string;
  name: string;
  lifecycle_status: string;
  lifecycle_resumes_at: string | null;
  stormEvents: StormEventInput[];
  calendarEvents: CalendarEvent[];
  wearable: WearableFixture;
  daily: { energy_level: number | null; stress_level: number | null } | null;
  monitoring: Partial<ClientMonitoringPreferences> | null;
  snoozes: ClientAttentionSnooze[];
  dismissal: StormDismissal | null;
};

const MONITOR_ALL: ClientMonitoringPreferences = {
  monitor_login: true,
  monitor_checkins: true,
  monitor_training: true,
  monitor_daily_metrics: true,
  monitor_nutrition: true,
  monitor_wearables: true,
};

function coachEvent(dateKey: string, time: string): CalendarEvent {
  return {
    id: nextId("cal"),
    title: "Coach block",
    event_date: dateKey,
    event_time: time,
    recurrence: "none",
    is_active: true,
    created_at: "",
    source: "coach",
  };
}

function fixture(overrides: Partial<ScanFixture> & { name: string }): ScanFixture {
  return {
    id: nextId("client"),
    lifecycle_status: "active",
    lifecycle_resumes_at: null,
    stormEvents: [],
    calendarEvents: [],
    wearable: null,
    daily: null,
    monitoring: null,
    snoozes: [],
    dismissal: null,
    ...overrides,
  };
}

function buildFleet(): ScanFixture[] {
  const fleet: ScanFixture[] = [];

  // 1-4: dense calendars at different storm severities.
  fleet.push(fixture({
    name: "Dense amber",
    stormEvents: [...spreadDay(addDaysToKey(TODAY_KEY, 3), 4), ...spreadDay(addDaysToKey(TODAY_KEY, 4), 4)],
  }));
  fleet.push(fixture({
    name: "Dense red",
    stormEvents: [0, 1, 3, 4].flatMap((offset) => spreadDay(addDaysToKey(TODAY_KEY, offset), 4)),
  }));
  fleet.push(fixture({
    name: "Heavy single day",
    stormEvents: spreadDay(addDaysToKey(TODAY_KEY, 2), 7),
  }));
  fleet.push(fixture({
    name: "Consecutive busy run",
    stormEvents: [0, 1, 2, 3, 4, 5].flatMap((offset) => spreadDay(addDaysToKey(TODAY_KEY, offset), 3)),
  }));

  // 5: tight gaps.
  fleet.push(fixture({
    name: "Tight gaps",
    stormEvents: [...tightDay(addDaysToKey(TODAY_KEY, 1), 4), ...tightDay(addDaysToKey(TODAY_KEY, 2), 4)],
  }));

  // 6-8: sparse calendars, no storm.
  for (let index = 0; index < 3; index++) {
    fleet.push(fixture({
      name: `Sparse ${index + 1}`,
      stormEvents: spreadDay(addDaysToKey(TODAY_KEY, index + 1), 1),
      calendarEvents: [coachEvent(addDaysToKey(TODAY_KEY, index + 1), "10:00")],
    }));
  }

  // 9-10: no calendar at all.
  fleet.push(fixture({ name: "Empty calendar 1" }));
  fleet.push(fixture({ name: "Empty calendar 2" }));

  // 11: current wearable summary asking to reduce intensity.
  fleet.push(fixture({
    name: "Reduce intensity",
    wearable: { summary_date: TODAY_KEY, recovery_status: "reduce_intensity", insight: "HRV is well below baseline." },
    monitoring: MONITOR_ALL,
  }));
  // 12: current wearable summary on watch, with no insight text.
  fleet.push(fixture({
    name: "Watch without insight",
    wearable: { summary_date: TODAY_KEY, recovery_status: "watch", insight: null },
    monitoring: MONITOR_ALL,
  }));
  // 13: stale wearable summary (three days old).
  fleet.push(fixture({
    name: "Stale wearable",
    wearable: { summary_date: addDaysToKey(TODAY_KEY, -3), recovery_status: "ready", insight: null },
    monitoring: MONITOR_ALL,
  }));
  // 14: wearables monitored but no summary ever.
  fleet.push(fixture({ name: "Missing wearable", monitoring: MONITOR_ALL }));
  // 15: wearables missing but monitoring disabled (route default preferences).
  fleet.push(fixture({ name: "Wearables unmonitored", monitoring: null }));
  // 16: wearables monitored but snoozed.
  fleet.push(fixture({
    name: "Wearables snoozed",
    monitoring: MONITOR_ALL,
    snoozes: [{ signal: "wearables", ignored: true, snoozed_until: null }],
  }));

  // 17-19: lifecycle variants.
  fleet.push(fixture({ name: "Paused", lifecycle_status: "paused" }));
  fleet.push(fixture({
    name: "Frozen until next month",
    lifecycle_status: "access_frozen",
    lifecycle_resumes_at: "2026-08-15T00:00:00Z",
    stormEvents: [0, 1, 3, 4].flatMap((offset) => spreadDay(addDaysToKey(TODAY_KEY, offset), 4)),
  }));
  fleet.push(fixture({
    name: "Pause lapsed",
    lifecycle_status: "paused",
    lifecycle_resumes_at: "2026-07-20T00:00:00Z",
  }));

  // 20-21: dismissed storms - same severity, and an escalation past the dismissal.
  fleet.push(fixture({
    name: "Dismissed amber storm",
    stormEvents: [...spreadDay(addDaysToKey(TODAY_KEY, 3), 4), ...spreadDay(addDaysToKey(TODAY_KEY, 4), 4)],
    dismissal: { window_key: WINDOW_KEY, severity: "amber", dismissed_at: "2026-07-23T08:00:00Z" },
  }));
  fleet.push(fixture({
    name: "Escalated past dismissal",
    stormEvents: [0, 1, 3, 4].flatMap((offset) => spreadDay(addDaysToKey(TODAY_KEY, offset), 4)),
    dismissal: { window_key: WINDOW_KEY, severity: "amber", dismissed_at: "2026-07-23T08:00:00Z" },
  }));

  // 22-25: daily-metric pressure at both thresholds, plus null-safe values.
  // Only daily metrics are monitored so the wearable gate stays out of the way.
  const dailyOnly: Partial<ClientMonitoringPreferences> = { monitor_daily_metrics: true };
  fleet.push(fixture({
    name: "Very high stress",
    daily: { energy_level: 6, stress_level: 9 },
    monitoring: dailyOnly,
  }));
  fleet.push(fixture({
    name: "Very low energy",
    daily: { energy_level: 2, stress_level: null },
    monitoring: dailyOnly,
  }));
  fleet.push(fixture({
    name: "Moderate pressure",
    daily: { energy_level: 4, stress_level: 7 },
    monitoring: dailyOnly,
  }));
  fleet.push(fixture({
    name: "Daily nulls",
    daily: { energy_level: null, stress_level: null },
    monitoring: dailyOnly,
  }));

  // 26: everything at once - storm, poor recovery, stress, dense calendar.
  fleet.push(fixture({
    name: "Compound pressure",
    stormEvents: [0, 1, 2, 3, 4, 5].flatMap((offset) => spreadDay(addDaysToKey(TODAY_KEY, offset), 4)),
    calendarEvents: [coachEvent(TODAY_KEY, "09:00"), coachEvent(addDaysToKey(TODAY_KEY, 1), "11:00")],
    wearable: { summary_date: TODAY_KEY, recovery_status: "reduce_intensity", insight: null },
    daily: { energy_level: 1, stress_level: 10 },
    monitoring: MONITOR_ALL,
  }));

  return fleet;
}

// ---------------------------------------------------------------------------
// The same per-client composition the capacity-scan route applies.
// ---------------------------------------------------------------------------

type ScanFlag = { severity: "red" | "amber"; label: string };

function composeScanClient(client: ScanFixture) {
  const stormEvaluation = evaluateStormWarning({ events: client.stormEvents, now: NOW });
  const effectiveLifecycle = resolveClientLifecycleStatus(
    client.lifecycle_status,
    client.lifecycle_resumes_at,
    NOW.getTime(),
  );
  const monitoring = client.monitoring || DEFAULT_MONITORING_PREFERENCES;
  const summary = client.wearable?.summary_date === TODAY_KEY ? client.wearable : null;
  const daily = client.daily;
  const energy = daily?.energy_level === null || daily?.energy_level === undefined ? null : Number(daily.energy_level);
  const stress = daily?.stress_level === null || daily?.stress_level === undefined ? null : Number(daily.stress_level);
  const calendarDays = calendarWindowLoad(client.calendarEvents, new Date(`${TODAY_KEY}T12:00:00.000Z`));

  const flags: ScanFlag[] = [];
  if (effectiveLifecycle === "active") {
    if (isAttentionSignalEnabled("wearables", monitoring, client.snoozes, NOW.getTime())) {
      if (summary?.recovery_status === "reduce_intensity") {
        flags.push({ severity: "red", label: summary.insight || "Recovery signals suggest reducing intensity." });
      } else if (summary?.recovery_status === "watch") {
        flags.push({ severity: "amber", label: summary.insight || "Recovery signals need watching." });
      }
      if (!summary) {
        flags.push({
          severity: "amber",
          label: client.wearable
            ? `Today's wearable summary is not available. Latest data is from ${client.wearable.summary_date}.`
            : "No wearable summary is available.",
        });
      }
    }
    if (isAttentionSignalEnabled("daily_metrics", monitoring, client.snoozes, NOW.getTime())) {
      if ((stress !== null && stress >= 9) || (energy !== null && energy <= 2)) {
        flags.push({ severity: "red", label: "Latest daily check shows very high stress or very low energy." });
      } else if ((stress !== null && stress >= 7) || (energy !== null && energy <= 4)) {
        flags.push({ severity: "amber", label: "Latest daily check shows capacity pressure." });
      }
    }
    if (stormEvaluation.warning && stormEvaluation.severity !== "none") {
      flags.push({
        severity: stormEvaluation.severity === "red" ? "red" : "amber",
        label: `Storm warning${client.dismissal ? " (dismissed by client)" : ""}: ${stormEvaluation.overallExplanation}`,
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
    id: client.id,
    name: client.name,
    lifecycle_status: effectiveLifecycle,
    status,
    flags,
    calendar: {
      total: calendarDays.reduce((total, day) => total + day.count, 0),
      dense_days: calendarDays.filter((day) => day.count >= 4).length,
    },
    storm: {
      warning: stormEvaluation.warning,
      severity: stormEvaluation.severity,
      window_key: stormEvaluation.windowKey,
      overall: stormEvaluation.overallExplanation,
      explanations: stormEvaluation.rules.filter((rule) => rule.triggered).map((rule) => rule.explanation),
      used_history: stormEvaluation.usedHistory,
      dismissed: Boolean(client.dismissal),
      dismissed_at: client.dismissal?.dismissed_at || null,
    },
    evaluation: stormEvaluation,
  };
}

const fleet = buildFleet();
const scanned = fleet.map((client) => composeScanClient(client));
const byName = new Map(scanned.map((client) => [client.name, client]));

function scan(name: string) {
  const found = byName.get(name);
  assert.ok(found, `fixture ${name} missing from the fleet`);
  return found;
}

// ---------------------------------------------------------------------------
// Volume assertions.
// ---------------------------------------------------------------------------

test("the fleet holds well over 20 clients and every one evaluates without throwing", () => {
  assert.ok(fleet.length >= 25, `expected 25+ clients, got ${fleet.length}`);
  assert.equal(scanned.length, fleet.length);
});

test("every client carries the full scan payload shape", () => {
  for (const client of scanned) {
    assert.equal(typeof client.id, "string");
    assert.ok(["red", "amber", "green", "paused"].includes(client.status), `${client.name}: status ${client.status}`);
    assert.ok(Array.isArray(client.flags));
    assert.equal(typeof client.calendar.total, "number");
    assert.equal(typeof client.calendar.dense_days, "number");
    assert.ok(Number.isFinite(client.calendar.total));
    assert.equal(client.storm.window_key, WINDOW_KEY);
    assert.ok(["none", "amber", "red"].includes(client.storm.severity));
    assert.equal(typeof client.storm.overall, "string");
    assert.ok(client.storm.overall.length > 0, `${client.name}: empty overall explanation`);
    assert.equal(typeof client.storm.dismissed, "boolean");
  }
});

test("every flag and every triggered storm rule carries a non-empty explanation", () => {
  for (const client of scanned) {
    for (const flag of client.flags) {
      assert.ok(["red", "amber"].includes(flag.severity), `${client.name}: flag severity ${flag.severity}`);
      assert.ok(flag.label.trim().length > 0, `${client.name}: empty flag label`);
    }
    if (client.storm.warning) {
      assert.ok(client.storm.explanations.length > 0, `${client.name}: warning with no explanations`);
      for (const explanation of client.storm.explanations) {
        assert.ok(explanation.trim().length > 0, `${client.name}: empty storm explanation`);
      }
    }
    for (const rule of client.evaluation.rules) {
      assert.ok(rule.explanation.trim().length > 0, `${client.name}: rule ${rule.id} has no explanation`);
    }
  }
});

test("status composition follows the traffic-light rules exactly", () => {
  for (const client of scanned) {
    if (client.lifecycle_status !== "active") {
      assert.equal(client.status, "paused", client.name);
      assert.equal(client.flags.length, 0, `${client.name}: paused clients carry no flags`);
    } else if (client.flags.some((flag) => flag.severity === "red")) {
      assert.equal(client.status, "red", client.name);
    } else if (client.flags.length > 0) {
      assert.equal(client.status, "amber", client.name);
    } else {
      assert.equal(client.status, "green", client.name);
    }
  }
});

test("dense, heavy, consecutive and tight-gap calendars each trigger their storm at the right severity", () => {
  assert.equal(scan("Dense amber").storm.severity, "amber");
  assert.equal(scan("Dense red").storm.severity, "red");
  assert.equal(scan("Heavy single day").storm.severity, "red");
  assert.equal(scan("Consecutive busy run").storm.severity, "red");
  const tight = scan("Tight gaps");
  assert.ok(tight.evaluation.rules.some((rule) => rule.id === "insufficient_gaps" && rule.triggered));
});

test("sparse and empty calendars stay green with no storm", () => {
  for (const name of ["Sparse 1", "Sparse 2", "Sparse 3", "Empty calendar 1", "Empty calendar 2"]) {
    const client = scan(name);
    assert.equal(client.storm.warning, false, name);
    assert.equal(client.status, "green", name);
  }
  assert.equal(scan("Sparse 1").calendar.total, 1);
});

test("wearable states map to honest flags: current red, current amber, stale, missing, unmonitored, snoozed", () => {
  const reduce = scan("Reduce intensity");
  assert.equal(reduce.status, "red");
  assert.equal(reduce.flags[0].label, "HRV is well below baseline.");

  const watch = scan("Watch without insight");
  assert.equal(watch.status, "amber");
  assert.equal(watch.flags[0].label, "Recovery signals need watching.");

  const stale = scan("Stale wearable");
  assert.equal(stale.status, "amber");
  assert.match(stale.flags[0].label, /Latest data is from 2026-07-21/);

  const missing = scan("Missing wearable");
  assert.equal(missing.status, "amber");
  assert.equal(missing.flags[0].label, "No wearable summary is available.");

  assert.equal(scan("Wearables unmonitored").flags.length, 0);
  assert.equal(scan("Wearables snoozed").flags.length, 0);
});

test("daily metric thresholds produce red at 9+ stress or 2- energy, amber at 7+ stress or 4- energy, and ignore nulls", () => {
  assert.equal(scan("Very high stress").status, "red");
  assert.equal(scan("Very low energy").status, "red");
  assert.equal(scan("Moderate pressure").status, "amber");
  assert.equal(scan("Daily nulls").flags.length, 0);
});

test("paused and frozen clients scan as paused with no flags even under storm-level calendars", () => {
  assert.equal(scan("Paused").status, "paused");
  const frozen = scan("Frozen until next month");
  assert.equal(frozen.status, "paused");
  assert.equal(frozen.flags.length, 0);
  // The evaluation itself still runs and stays coherent for the paused client.
  assert.equal(frozen.storm.severity, "red");
  // A lapsed pause resolves back to active.
  assert.equal(scan("Pause lapsed").lifecycle_status, "active");
  assert.equal(scan("Pause lapsed").status, "green");
});

test("dismissed state maps through to the scan and to client-side silencing correctly", () => {
  const dismissed = scan("Dismissed amber storm");
  assert.equal(dismissed.storm.dismissed, true);
  assert.equal(dismissed.storm.dismissed_at, "2026-07-23T08:00:00Z");
  assert.match(dismissed.flags.find((flag) => flag.label.startsWith("Storm warning"))?.label || "", /\(dismissed by client\)/);
  // Same window, same severity: the client card stays quiet.
  assert.equal(
    dismissalSilencesWarning(dismissed.evaluation, { window_key: WINDOW_KEY, severity: "amber" }),
    true,
  );

  const escalated = scan("Escalated past dismissal");
  assert.equal(escalated.storm.severity, "red");
  // The scan still shows the dismissal record...
  assert.equal(escalated.storm.dismissed, true);
  // ...but the client card re-raises because red outranks the dismissed amber.
  assert.equal(
    dismissalSilencesWarning(escalated.evaluation, { window_key: WINDOW_KEY, severity: "amber" }),
    false,
  );
  // A new week also re-raises.
  assert.equal(
    dismissalSilencesWarning(escalated.evaluation, { window_key: "2026-W29", severity: "red" }),
    false,
  );
});

test("compound pressure surfaces every signal at once without losing any explanation", () => {
  const compound = scan("Compound pressure");
  assert.equal(compound.status, "red");
  assert.ok(compound.flags.length >= 3, `expected wearable, daily and storm flags, got ${compound.flags.length}`);
  assert.equal(compound.storm.severity, "red");
  assert.equal(compound.calendar.total, 2);
  for (const flag of compound.flags) assert.ok(flag.label.trim().length > 0);
});

test("the scan sort order puts red before amber before green before paused", () => {
  const order: Record<string, number> = { red: 0, amber: 1, green: 2, paused: 3 };
  const sorted = [...scanned].sort((a, b) => order[a.status] - order[b.status]);
  for (let index = 1; index < sorted.length; index++) {
    assert.ok(order[sorted[index - 1].status] <= order[sorted[index].status]);
  }
  assert.equal(sorted[0].status, "red");
  assert.equal(sorted[sorted.length - 1].status, "paused");
});

test("evaluation is deterministic at volume: recomposing the fleet reproduces every input hash", () => {
  const rerun = fleet.map((client) => composeScanClient(client));
  for (let index = 0; index < scanned.length; index++) {
    assert.equal(rerun[index].evaluation.inputHash, scanned[index].evaluation.inputHash, scanned[index].name);
    assert.deepEqual(rerun[index].flags, scanned[index].flags, scanned[index].name);
  }
});

test("history stays honest at volume: no fixture has enough stored history for pattern comparison", () => {
  for (const client of scanned) {
    if (client.evaluation.historyDistinctDays < STORM_THRESHOLDS.HISTORY_MIN_DISTINCT_DAYS) {
      assert.equal(client.storm.used_history, false, client.name);
      const pattern = client.evaluation.rules.find((rule) => rule.id === "above_recent_pattern");
      assert.ok(pattern && pattern.evaluated === false, `${client.name}: pattern rule should be skipped`);
    }
  }
});
