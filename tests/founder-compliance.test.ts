import assert from "node:assert/strict";
import test from "node:test";
import {
  checkinAdherence,
  composeComplianceSummary,
  evaluateGuarantee,
  isGuaranteeConfigured,
  londonWeekKey,
  parseDateKey,
  recentCompleteWeekKeys,
  summariseCallAttendance,
  summariseWhatsappHelp,
  weekKeyForDateKey,
  weekKeyStartDateKey,
  type GuaranteeSettings,
} from "../lib/founder-compliance";

const unconfigured: GuaranteeSettings = {
  metric_key: null,
  comparison: null,
  threshold_type: null,
  threshold_value: null,
  remedy_text: null,
};

const emptyMetrics = {
  hrv_ms: null,
  resting_hr_bpm: null,
  sleep_minutes: null,
  sleep_score: null,
  weight_kg: null,
  body_fat_percentage: null,
  waist_cm: null,
};

test("week keys follow ISO Monday weeks across the year boundary", () => {
  assert.equal(weekKeyForDateKey("2026-07-20"), "2026-W30");
  assert.equal(weekKeyForDateKey("2026-12-29"), "2026-W53");
  assert.equal(weekKeyForDateKey("2027-01-03"), "2026-W53");
  assert.equal(weekKeyForDateKey("2027-01-04"), "2027-W01");
});

test("a late-Sunday UTC instant in summer belongs to the London Monday week", () => {
  // 23:30 UTC on Sunday 19 July is 00:30 BST on Monday 20 July.
  assert.equal(londonWeekKey(new Date("2026-07-19T23:30:00Z")), "2026-W30");
  // In winter London matches UTC, so the same wall-clock stays in the Sunday week.
  assert.equal(londonWeekKey(new Date("2026-01-11T23:30:00Z")), "2026-W02");
});

test("week keys resolve back to their Monday, including cross-year W01", () => {
  assert.equal(weekKeyStartDateKey("2026-W30"), "2026-07-20");
  assert.equal(weekKeyStartDateKey("2026-W01"), "2025-12-29");
  assert.equal(weekKeyStartDateKey("2026-W53"), "2026-12-28");
  assert.equal(weekKeyStartDateKey("not-a-week"), null);
});

test("complete weeks never include the in-progress week", () => {
  assert.deepEqual(recentCompleteWeekKeys(new Date("2026-07-22T12:00:00Z"), 4), [
    "2026-W26",
    "2026-W27",
    "2026-W28",
    "2026-W29",
  ]);
  // Early Monday morning London time: the new week has already begun.
  assert.deepEqual(recentCompleteWeekKeys(new Date("2026-07-19T23:30:00Z"), 1), ["2026-W29"]);
});

test("check-in adherence counts submitted weeks against expected weeks since start", () => {
  const result = checkinAdherence({
    startDate: "2026-06-01",
    checkins: [
      { created_at: "2026-06-29T10:00:00Z" }, // W27
      { created_at: "2026-07-08T09:00:00Z" }, // W28
      { created_at: "2026-07-20T08:00:00Z" }, // current week (W30)
    ],
    now: new Date("2026-07-22T12:00:00Z"),
  });

  assert.equal(result.window_weeks, 8);
  assert.equal(result.expected_weeks, 7); // W23 to W29; W22 predates the start
  assert.equal(result.submitted_weeks, 2);
  assert.deepEqual(result.missed_week_keys, ["2026-W23", "2026-W24", "2026-W25", "2026-W26", "2026-W29"]);
  assert.equal(result.current_week_key, "2026-W30");
  assert.equal(result.current_week_submitted, true);
});

test("a check-in filed just after midnight BST counts toward the London week", () => {
  // 23:30 UTC Sunday 29 March 2026 is 00:30 BST Monday 30 March (W14).
  const result = checkinAdherence({
    startDate: "2026-03-23",
    checkins: [{ created_at: "2026-03-29T23:30:00Z" }],
    now: new Date("2026-04-08T12:00:00Z"),
    windowWeeks: 2,
  });
  assert.equal(result.expected_weeks, 2);
  assert.equal(result.submitted_weeks, 1);
  assert.deepEqual(result.missed_week_keys, ["2026-W13"]);
});

test("a client who started this week has no expected weeks yet", () => {
  const result = checkinAdherence({
    startDate: "2026-07-21",
    checkins: [],
    now: new Date("2026-07-22T12:00:00Z"),
  });
  assert.equal(result.expected_weeks, 0);
  assert.equal(result.submitted_weeks, 0);
  assert.equal(result.current_week_submitted, false);
});

test("a missing start date is reported rather than guessed", () => {
  const result = checkinAdherence({
    startDate: null,
    checkins: [],
    now: new Date("2026-07-22T12:00:00Z"),
    windowWeeks: 4,
  });
  assert.equal(result.start_date, null);
  assert.equal(result.expected_weeks, 4);
  assert.equal(result.submitted_weeks, 0);
});

test("call attendance with no records reports zero, never a rate", () => {
  const summary = summariseCallAttendance([]);
  assert.equal(summary.recorded, 0);
  assert.equal(summary.attended, 0);
  assert.equal(summary.missed, 0);
  assert.equal("rate" in summary, false);
  assert.equal("score" in summary, false);
});

test("call attendance tallies by type and ignores unknown types", () => {
  const summary = summariseCallAttendance([
    { call_type: "coaching_call", attended: true },
    { call_type: "coaching_call", attended: false },
    { call_type: "strategy_call", attended: true },
    { call_type: "made_up_call", attended: true },
  ]);
  assert.equal(summary.recorded, 3);
  assert.equal(summary.attended, 2);
  assert.equal(summary.missed, 1);
  assert.deepEqual(summary.by_type.coaching_call, { recorded: 2, attended: 1 });
  assert.deepEqual(summary.by_type.strategy_call, { recorded: 1, attended: 1 });
});

test("whatsapp help counts recorded weeks in the window and states the current week separately", () => {
  const summary = summariseWhatsappHelp(
    [
      { week_key: "2026-W28", helped: true },
      { week_key: "2026-W29", helped: false },
      { week_key: "2026-W30", helped: true }, // current, in progress
      { week_key: "2026-W12", helped: true }, // outside the window
    ],
    new Date("2026-07-22T12:00:00Z"),
  );
  assert.equal(summary.weeks_recorded, 2);
  assert.equal(summary.weeks_helped, 1);
  assert.equal(summary.current_week_recorded, true);
  assert.equal(summary.current_week_helped, true);
});

test("an unrecorded current week reads as unknown, not as no help", () => {
  const summary = summariseWhatsappHelp([], new Date("2026-07-22T12:00:00Z"));
  assert.equal(summary.weeks_recorded, 0);
  assert.equal(summary.current_week_recorded, false);
  assert.equal(summary.current_week_helped, null);
});

test("the composed summary is plain facts with a stated generation time", () => {
  const now = new Date("2026-07-22T12:00:00Z");
  const summary = composeComplianceSummary({
    startDate: "2026-06-01",
    checkins: [],
    callRecords: [],
    whatsappRecords: [],
    now,
  });
  assert.equal(summary.generated_at, now.toISOString());
  assert.deepEqual(Object.keys(summary).sort(), [
    "calls",
    "checkins",
    "generated_at",
    "whatsapp",
    "window_weeks",
  ]);
});

test("an unconfigured or partially configured guarantee is never evaluated", () => {
  assert.equal(evaluateGuarantee(null, emptyMetrics, emptyMetrics), null);
  assert.equal(evaluateGuarantee(unconfigured, emptyMetrics, emptyMetrics), null);
  assert.equal(
    evaluateGuarantee(
      { ...unconfigured, metric_key: "hrv_ms", comparison: "increase_at_least" },
      emptyMetrics,
      emptyMetrics,
    ),
    null,
  );
  assert.equal(isGuaranteeConfigured(unconfigured), false);
});

test("a configured absolute guarantee evaluates against the measured delta", () => {
  const settings: GuaranteeSettings = {
    metric_key: "hrv_ms",
    comparison: "increase_at_least",
    threshold_type: "absolute",
    threshold_value: 5,
    remedy_text: null,
  };
  const met = evaluateGuarantee(settings, { ...emptyMetrics, hrv_ms: 40 }, { ...emptyMetrics, hrv_ms: 46 });
  assert.equal(met?.met, true);
  assert.equal(met?.delta, 6);

  const notMet = evaluateGuarantee(settings, { ...emptyMetrics, hrv_ms: 40 }, { ...emptyMetrics, hrv_ms: 43 });
  assert.equal(notMet?.met, false);
  assert.match(notMet?.reason || "", /required increase of at least 5/);
});

test("a percent decrease guarantee evaluates against the percentage change", () => {
  const settings: GuaranteeSettings = {
    metric_key: "weight_kg",
    comparison: "decrease_at_least",
    threshold_type: "percent",
    threshold_value: 5,
    remedy_text: "One further month of coaching at no cost.",
  };
  const result = evaluateGuarantee(settings, { ...emptyMetrics, weight_kg: 100 }, { ...emptyMetrics, weight_kg: 94 });
  assert.equal(result?.met, true);
  assert.equal(result?.change_percent, -6);
  assert.equal(result?.remedy_text, "One further month of coaching at no cost.");
});

test("missing metric data yields no verdict, never a fail", () => {
  const settings: GuaranteeSettings = {
    metric_key: "hrv_ms",
    comparison: "increase_at_least",
    threshold_type: "absolute",
    threshold_value: 5,
    remedy_text: null,
  };
  const missingCurrent = evaluateGuarantee(settings, { ...emptyMetrics, hrv_ms: 40 }, emptyMetrics);
  assert.equal(missingCurrent?.met, null);
  assert.match(missingCurrent?.reason || "", /comparison period has no value/);

  const missingBaseline = evaluateGuarantee(settings, emptyMetrics, { ...emptyMetrics, hrv_ms: 40 });
  assert.equal(missingBaseline?.met, null);
  assert.match(missingBaseline?.reason || "", /locked baseline has no value/);
});

test("a percentage guarantee cannot be measured from a zero baseline", () => {
  const settings: GuaranteeSettings = {
    metric_key: "sleep_score",
    comparison: "increase_at_least",
    threshold_type: "percent",
    threshold_value: 10,
    remedy_text: null,
  };
  const result = evaluateGuarantee(settings, { ...emptyMetrics, sleep_score: 0 }, { ...emptyMetrics, sleep_score: 10 });
  assert.equal(result?.met, null);
  assert.match(result?.reason || "", /baseline value of zero/);
});

test("date keys must be real calendar dates", () => {
  assert.equal(parseDateKey("2026-02-28"), "2026-02-28");
  assert.equal(parseDateKey("2026-02-31"), null);
  assert.equal(parseDateKey("2026-13-01"), null);
  assert.equal(parseDateKey("not-a-date"), null);
  assert.equal(parseDateKey(20260228), null);
});
