import assert from "node:assert/strict";
import test from "node:test";
import {
  addDaysToKey,
  dismissalSilencesWarning,
  evaluateStormWarning,
  formatDayLabel,
  isoWeekKey,
  STORM_THRESHOLDS,
  type StormEventInput,
  type StormWarningEvaluation,
} from "../lib/storm-warning";

// Friday 24 July 2026 (BST). Window: Fri 24 Jul - Thu 30 Jul, ISO week 2026-W30.
const NOW = new Date("2026-07-24T09:00:00+01:00");

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

function manual(
  dateKey: string,
  time: string,
  overrides: Partial<StormEventInput> = {},
): StormEventInput {
  return {
    id: nextId("manual"),
    source: "client",
    event_date: dateKey,
    event_time: time,
    recurrence: "none",
    category: "custom",
    is_active: true,
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

function rule(evaluation: StormWarningEvaluation, id: string) {
  const found = evaluation.rules.find((candidate) => candidate.id === id);
  assert.ok(found, `rule ${id} missing from evaluation`);
  return found;
}

// ---------------------------------------------------------------------------
// Meeting density
// ---------------------------------------------------------------------------

test("four meetings on exactly two days triggers the density rule with an exact explanation", () => {
  const events = [...spreadDay("2026-07-27", 4), ...spreadDay("2026-07-28", 4)];
  const evaluation = evaluateStormWarning({ events, now: NOW });

  assert.equal(evaluation.warning, true);
  assert.equal(evaluation.severity, "amber");
  assert.equal(evaluation.windowKey, "2026-W30");
  assert.equal(evaluation.windowStart, "2026-07-24");
  assert.equal(evaluation.windowEnd, "2026-07-30");
  const density = rule(evaluation, "meeting_density");
  assert.equal(density.triggered, true);
  assert.equal(density.severity, "amber");
  assert.equal(
    density.explanation,
    "4+ meetings on 2 of the next 7 days (Mon 27 Jul, Tue 28 Jul)",
  );
  assert.match(evaluation.overallExplanation, /One pressure signal for the week ahead/);
  assert.match(evaluation.overallExplanation, /not enough history yet/);
});

test("three meetings a day stays under the density threshold", () => {
  const events = [
    ...spreadDay("2026-07-27", 3),
    ...spreadDay("2026-07-28", 3),
    ...spreadDay("2026-07-29", 3),
  ];
  const evaluation = evaluateStormWarning({ events, now: NOW });
  assert.equal(rule(evaluation, "meeting_density").triggered, false);
  assert.equal(evaluation.warning, false);
  assert.equal(evaluation.severity, "none");
});

test("four dense days escalates density to red", () => {
  const events = ["2026-07-24", "2026-07-25", "2026-07-27", "2026-07-28"]
    .flatMap((day) => spreadDay(day, 4));
  const evaluation = evaluateStormWarning({ events, now: NOW });
  const density = rule(evaluation, "meeting_density");
  assert.equal(density.triggered, true);
  assert.equal(density.severity, "red");
  assert.equal(evaluation.severity, "red");
});

test("a single seven-meeting day is red on its own", () => {
  const events = spreadDay("2026-07-27", 7);
  const evaluation = evaluateStormWarning({ events, now: NOW });
  const density = rule(evaluation, "meeting_density");
  assert.equal(density.triggered, true);
  assert.equal(density.severity, "red");
  assert.match(density.explanation, /7 meetings on Mon 27 Jul alone/);
});

// ---------------------------------------------------------------------------
// Consecutive busy days
// ---------------------------------------------------------------------------

test("four consecutive three-meeting days triggers the consecutive rule", () => {
  const events = ["2026-07-24", "2026-07-25", "2026-07-26", "2026-07-27"]
    .flatMap((day) => spreadDay(day, 3));
  const evaluation = evaluateStormWarning({ events, now: NOW });
  const consecutive = rule(evaluation, "consecutive_busy_days");
  assert.equal(consecutive.triggered, true);
  assert.equal(consecutive.severity, "amber");
  assert.equal(
    consecutive.explanation,
    "3+ meetings every day for 4 days running (Fri 24 Jul - Mon 27 Jul)",
  );
});

test("a rest day breaks the consecutive run", () => {
  const events = ["2026-07-24", "2026-07-25", "2026-07-27", "2026-07-28"]
    .flatMap((day) => spreadDay(day, 3));
  const evaluation = evaluateStormWarning({ events, now: NOW });
  assert.equal(rule(evaluation, "consecutive_busy_days").triggered, false);
});

test("six consecutive busy days escalates to red", () => {
  const events = ["2026-07-24", "2026-07-25", "2026-07-26", "2026-07-27", "2026-07-28", "2026-07-29"]
    .flatMap((day) => spreadDay(day, 3));
  const evaluation = evaluateStormWarning({ events, now: NOW });
  const consecutive = rule(evaluation, "consecutive_busy_days");
  assert.equal(consecutive.triggered, true);
  assert.equal(consecutive.severity, "red");
});

// ---------------------------------------------------------------------------
// Early starts
// ---------------------------------------------------------------------------

test("starts at 07:29 on three days triggers the early-start rule; 07:30 does not count", () => {
  const early = [
    synced("2026-07-24", "07:29", "08:00"),
    synced("2026-07-25", "07:29", "08:00"),
    synced("2026-07-26", "07:29", "08:00"),
  ];
  const evaluation = evaluateStormWarning({ events: early, now: NOW });
  const earlyRule = rule(evaluation, "early_starts");
  assert.equal(earlyRule.triggered, true);
  assert.equal(earlyRule.severity, "amber");
  assert.match(earlyRule.explanation, /Starts before 07:30 on 3 of the next 7 days/);

  const boundary = [
    synced("2026-07-24", "07:30", "08:00"),
    synced("2026-07-25", "07:30", "08:00"),
    synced("2026-07-26", "07:30", "08:00"),
  ];
  const boundaryEvaluation = evaluateStormWarning({ events: boundary, now: NOW });
  assert.equal(rule(boundaryEvaluation, "early_starts").triggered, false);
});

test("two early days stays under the early-start threshold", () => {
  const events = [
    synced("2026-07-24", "07:00", "08:00"),
    synced("2026-07-25", "07:00", "08:00"),
  ];
  const evaluation = evaluateStormWarning({ events, now: NOW });
  assert.equal(rule(evaluation, "early_starts").triggered, false);
});

// ---------------------------------------------------------------------------
// Insufficient gaps
// ---------------------------------------------------------------------------

test("three ten-minute turnarounds trigger the gap rule; fifteen-minute gaps do not", () => {
  const tight = [
    synced("2026-07-27", "09:00", "09:30"),
    synced("2026-07-27", "09:40", "10:10"),
    synced("2026-07-27", "10:20", "10:50"),
    synced("2026-07-27", "11:00", "11:30"),
  ];
  const evaluation = evaluateStormWarning({ events: tight, now: NOW });
  const gaps = rule(evaluation, "insufficient_gaps");
  assert.equal(gaps.evaluated, true);
  assert.equal(gaps.triggered, true);
  assert.equal(gaps.severity, "amber");
  assert.match(gaps.explanation, /Less than 15 minutes between back-to-back meetings 3 times/);

  const spaced = [
    synced("2026-07-27", "09:00", "09:30"),
    synced("2026-07-27", "09:45", "10:15"),
    synced("2026-07-27", "10:30", "11:00"),
    synced("2026-07-27", "11:15", "11:45"),
  ];
  const spacedEvaluation = evaluateStormWarning({ events: spaced, now: NOW });
  assert.equal(rule(spacedEvaluation, "insufficient_gaps").triggered, false);
});

test("gap rule is skipped honestly when stacked days have no end times", () => {
  const events = [
    manual("2026-07-27", "09:00"),
    manual("2026-07-27", "09:30"),
    manual("2026-07-28", "14:00"),
    manual("2026-07-28", "14:30"),
  ];
  const evaluation = evaluateStormWarning({ events, now: NOW });
  const gaps = rule(evaluation, "insufficient_gaps");
  assert.equal(gaps.evaluated, false);
  assert.equal(gaps.triggered, false);
  assert.match(gaps.explanation, /connected-calendar end times/);
});

// ---------------------------------------------------------------------------
// All-day, cancelled, free and non-meeting events
// ---------------------------------------------------------------------------

test("all-day, cancelled and free events never count as meetings", () => {
  const events = [
    ...spreadDay("2026-07-27", 4).map((event) => ({ ...event, all_day: true })),
    ...spreadDay("2026-07-28", 4).map((event) => ({ ...event, is_cancelled: true })),
    ...spreadDay("2026-07-29", 4).map((event) => ({ ...event, busy_status: "free" })),
  ];
  const evaluation = evaluateStormWarning({ events, now: NOW });
  assert.equal(evaluation.warning, false);
  assert.equal(evaluation.inputSnapshot.windowMeetings, 0);
  const monday = evaluation.inputSnapshot.days.find((day) => day.date === "2026-07-27");
  assert.equal(monday?.allDayEvents, 4);
  assert.equal(monday?.meetings, 0);
});

test("birthday, anniversary and reminder events mark the date without counting as meetings", () => {
  const events = [
    ...["09:00", "10:00", "11:00", "12:00"].map((time) => manual("2026-07-27", time, { category: "birthday" })),
    ...["09:00", "10:00", "11:00", "12:00"].map((time) => manual("2026-07-28", time, { category: "reminder" })),
  ];
  const evaluation = evaluateStormWarning({ events, now: NOW });
  assert.equal(evaluation.warning, false);
  assert.equal(evaluation.inputSnapshot.windowMeetings, 0);
});

// ---------------------------------------------------------------------------
// Travel
// ---------------------------------------------------------------------------

test("client-marked travel plus a ten-meeting week triggers the travel rule at the boundary", () => {
  const base = [
    ...spreadDay("2026-07-24", 2),
    ...spreadDay("2026-07-25", 2),
    ...spreadDay("2026-07-26", 2),
    ...spreadDay("2026-07-28", 2),
    ...spreadDay("2026-07-29", 1),
  ];
  const travel = manual("2026-07-27", "09:00", { category: "travel" });
  const evaluation = evaluateStormWarning({ events: [...base, travel], now: NOW });
  const travelRule = rule(evaluation, "travel_load");
  assert.equal(travelRule.triggered, true);
  assert.equal(travelRule.severity, "amber");
  assert.equal(
    travelRule.explanation,
    "Travel is scheduled on Mon 27 Jul alongside 10 meetings this week",
  );

  const lighter = evaluateStormWarning({ events: [...base.slice(0, 8), travel], now: NOW });
  assert.equal(rule(lighter, "travel_load").triggered, false);
});

test("synced events carry no travel signal, so a heavy synced week alone never fires the travel rule", () => {
  const events = ["2026-07-24", "2026-07-25", "2026-07-26", "2026-07-27"]
    .flatMap((day) => spreadDay(day, 3));
  const evaluation = evaluateStormWarning({ events, now: NOW });
  const travelRule = rule(evaluation, "travel_load");
  assert.equal(travelRule.triggered, false);
  assert.deepEqual(travelRule.inputs.travelDays, []);
});

// ---------------------------------------------------------------------------
// History comparison and sparse-history honesty
// ---------------------------------------------------------------------------

function historyDays(count: number): StormEventInput[] {
  return Array.from({ length: count }, (_, index) =>
    synced(addDaysToKey("2026-07-23", -index), "10:00", "10:30"));
}

const busyWindow = ["2026-07-24", "2026-07-25", "2026-07-26", "2026-07-27", "2026-07-28", "2026-07-29"]
  .flatMap((day) => spreadDay(day, 2));

test("with 14 distinct history days the pattern rule compares against the recent average", () => {
  const evaluation = evaluateStormWarning({
    events: [...historyDays(14), ...busyWindow],
    now: NOW,
  });
  assert.equal(evaluation.usedHistory, true);
  assert.equal(evaluation.historyDistinctDays, 14);
  const pattern = rule(evaluation, "above_recent_pattern");
  assert.equal(pattern.evaluated, true);
  assert.equal(pattern.triggered, true);
  assert.equal(
    pattern.explanation,
    "The next 7 days hold 12 meetings against a recent average of 3.5 a week",
  );
  assert.doesNotMatch(evaluation.overallExplanation, /not enough history/);
});

test("with 13 distinct history days the pattern rule is skipped and the explanation says so", () => {
  const evaluation = evaluateStormWarning({
    events: [...historyDays(13), ...busyWindow],
    now: NOW,
  });
  assert.equal(evaluation.usedHistory, false);
  const pattern = rule(evaluation, "above_recent_pattern");
  assert.equal(pattern.evaluated, false);
  assert.equal(pattern.triggered, false);
  assert.match(pattern.explanation, /Pattern comparison was skipped/);
  assert.equal(evaluation.warning, false);
  assert.match(evaluation.overallExplanation, /not enough history yet/);
});

test("a week in line with a genuinely busy recent pattern does not fire the pattern rule", () => {
  const denseHistory = Array.from({ length: 28 }, (_, index) => {
    const day = addDaysToKey("2026-07-23", -index);
    return [synced(day, "09:00", "09:30"), synced(day, "11:00", "11:30"), synced(day, "13:00", "13:30"), synced(day, "15:00", "15:30")];
  }).flat();
  const evaluation = evaluateStormWarning({
    events: [...denseHistory, ...busyWindow],
    now: NOW,
  });
  assert.equal(evaluation.usedHistory, true);
  assert.equal(rule(evaluation, "above_recent_pattern").triggered, false);
});

// ---------------------------------------------------------------------------
// Time zones, DST and recurrence
// ---------------------------------------------------------------------------

test("the window iterates seven distinct London days across the spring DST boundary", () => {
  const springNow = new Date("2026-03-27T12:00:00Z");
  const weeklyEarly: StormEventInput = {
    id: "weekly-early",
    source: "client",
    event_date: "2026-03-02",
    event_time: "06:45",
    recurrence: "weekly",
    recurrence_day: 1,
    is_active: true,
  };
  const evaluation = evaluateStormWarning({ events: [weeklyEarly], now: springNow });
  assert.equal(evaluation.windowStart, "2026-03-27");
  assert.equal(evaluation.windowEnd, "2026-04-02");
  assert.deepEqual(
    evaluation.inputSnapshot.days.map((day) => day.date),
    ["2026-03-27", "2026-03-28", "2026-03-29", "2026-03-30", "2026-03-31", "2026-04-01", "2026-04-02"],
  );
  const monday = evaluation.inputSnapshot.days.find((day) => day.date === "2026-03-30");
  assert.equal(monday?.meetings, 1);
  assert.equal(monday?.earliestStart, "06:45");
});

test("biweekly events keep their cadence across the spring DST change", () => {
  const biweekly: StormEventInput = {
    id: "biweekly-1",
    source: "client",
    event_date: "2026-03-22",
    event_time: "16:00",
    recurrence: "biweekly",
    recurrence_day: 0,
    is_active: true,
  };
  const acrossChange = evaluateStormWarning({ events: [biweekly], now: new Date("2026-03-27T12:00:00Z") });
  const offSunday = acrossChange.inputSnapshot.days.find((day) => day.date === "2026-03-29");
  assert.equal(offSunday?.meetings, 0);

  const followingWeek = evaluateStormWarning({ events: [biweekly], now: new Date("2026-04-03T12:00:00Z") });
  const onSunday = followingWeek.inputSnapshot.days.find((day) => day.date === "2026-04-05");
  assert.equal(onSunday?.meetings, 1);
});

test("monthly events recur on the same day of the month inside the window", () => {
  const monthly: StormEventInput = {
    id: "monthly-1",
    source: "client",
    event_date: "2026-06-28",
    event_time: "10:00",
    recurrence: "monthly",
    is_active: true,
  };
  const evaluation = evaluateStormWarning({ events: [monthly], now: NOW });
  const reviewDay = evaluation.inputSnapshot.days.find((day) => day.date === "2026-07-28");
  assert.equal(reviewDay?.meetings, 1);
});

test("weekly events survive the autumn DST boundary", () => {
  const weekly: StormEventInput = {
    id: "weekly-autumn",
    source: "client",
    event_date: "2026-10-04",
    event_time: "09:00",
    recurrence: "weekly",
    recurrence_day: 0,
    is_active: true,
  };
  const evaluation = evaluateStormWarning({ events: [weekly], now: new Date("2026-10-23T12:00:00+01:00") });
  assert.equal(evaluation.windowEnd, "2026-10-29");
  const clocksChangeSunday = evaluation.inputSnapshot.days.find((day) => day.date === "2026-10-25");
  assert.equal(clocksChangeSunday?.meetings, 1);
});

test("date-key helpers are machine-timezone independent", () => {
  assert.equal(addDaysToKey("2026-03-28", 2), "2026-03-30");
  assert.equal(addDaysToKey("2026-01-01", -1), "2025-12-31");
  assert.equal(formatDayLabel("2026-07-27"), "Mon 27 Jul");
  assert.equal(isoWeekKey("2026-07-20"), "2026-W30");
  assert.equal(isoWeekKey("2026-07-26"), "2026-W30");
  assert.equal(isoWeekKey("2026-07-27"), "2026-W31");
  assert.equal(isoWeekKey("2027-01-01"), "2026-W53");
});

// ---------------------------------------------------------------------------
// Severity stacking
// ---------------------------------------------------------------------------

test("three amber signals stacking escalates the overall severity to red", () => {
  const events = [
    ...spreadDay("2026-07-27", 4),
    ...spreadDay("2026-07-28", 4),
    synced("2026-07-24", "07:15", "07:45"),
    synced("2026-07-25", "07:15", "07:45"),
    synced("2026-07-26", "07:15", "07:45"),
    manual("2026-07-29", "09:00", { category: "travel" }),
  ];
  const evaluation = evaluateStormWarning({ events, now: NOW });
  const triggered = evaluation.rules.filter((candidate) => candidate.triggered);
  assert.equal(triggered.length, 3);
  assert.ok(triggered.every((candidate) => candidate.severity === "amber"));
  assert.equal(evaluation.severity, "red");
});

// ---------------------------------------------------------------------------
// Dismissal windowing
// ---------------------------------------------------------------------------

test("a dismissal silences the same window at the same or lower severity only", () => {
  const amber = evaluateStormWarning({
    events: [...spreadDay("2026-07-27", 4), ...spreadDay("2026-07-28", 4)],
    now: NOW,
  });
  assert.equal(amber.severity, "amber");
  assert.equal(dismissalSilencesWarning(amber, { window_key: "2026-W30", severity: "amber" }), true);
  assert.equal(dismissalSilencesWarning(amber, { window_key: "2026-W30", severity: "red" }), true);
  assert.equal(dismissalSilencesWarning(amber, { window_key: "2026-W29", severity: "amber" }), false);
  assert.equal(dismissalSilencesWarning(amber, null), false);

  const red = evaluateStormWarning({
    events: ["2026-07-24", "2026-07-25", "2026-07-27", "2026-07-28"].flatMap((day) => spreadDay(day, 4)),
    now: NOW,
  });
  assert.equal(red.severity, "red");
  assert.equal(dismissalSilencesWarning(red, { window_key: "2026-W30", severity: "amber" }), false);
  assert.equal(dismissalSilencesWarning(red, { window_key: "2026-W30", severity: "red" }), true);

  const quiet = evaluateStormWarning({ events: [], now: NOW });
  assert.equal(quiet.warning, false);
  assert.equal(dismissalSilencesWarning(quiet, { window_key: "2026-W30", severity: "red" }), false);
});

test("the same window key holds for every day of the ISO week, then rolls over", () => {
  const events = [...spreadDay("2026-07-27", 4), ...spreadDay("2026-07-28", 4)];
  const friday = evaluateStormWarning({ events, now: NOW });
  const sunday = evaluateStormWarning({ events, now: new Date("2026-07-26T09:00:00+01:00") });
  const nextMonday = evaluateStormWarning({ events, now: new Date("2026-07-27T09:00:00+01:00") });
  assert.equal(friday.windowKey, "2026-W30");
  assert.equal(sunday.windowKey, "2026-W30");
  assert.equal(nextMonday.windowKey, "2026-W31");
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

test("the input hash is stable for identical inputs and changes when the calendar changes", () => {
  const events = [...spreadDay("2026-07-27", 4), ...spreadDay("2026-07-28", 4)];
  const morning = evaluateStormWarning({ events, now: NOW });
  const evening = evaluateStormWarning({ events, now: new Date("2026-07-24T21:00:00+01:00") });
  assert.equal(morning.inputHash, evening.inputHash);
  assert.notEqual(morning.evaluatedAt, evening.evaluatedAt);

  const heavier = evaluateStormWarning({
    events: [...events, synced("2026-07-29", "09:00", "09:30")],
    now: NOW,
  });
  assert.notEqual(morning.inputHash, heavier.inputHash);
});

test("thresholds stay wired into the snapshot for auditability", () => {
  const evaluation = evaluateStormWarning({ events: [], now: NOW });
  assert.equal(evaluation.inputSnapshot.thresholds.DENSE_DAY_MEETINGS, STORM_THRESHOLDS.DENSE_DAY_MEETINGS);
  assert.equal(evaluation.inputSnapshot.history.trailingDays, STORM_THRESHOLDS.HISTORY_TRAILING_DAYS);
});
