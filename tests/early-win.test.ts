import assert from "node:assert/strict";
import test from "node:test";
import {
  EARLY_WIN_WINDOW_DAYS,
  buildEarlyWinReading,
  buildEarlyWinView,
  earlyWinDayNumber,
  earlyWinProgress,
  improvementDirection,
  isEarlyWinMetricKey,
  isEarlyWinReviewDue,
  type EarlyWin,
} from "../lib/early-win";

const baseWin: EarlyWin = {
  id: "win-1",
  client_id: "client-1",
  metric_key: "hrv_ms",
  source: "wearable",
  display_label: "HRV",
  unit: "ms",
  starting_value: 40,
  target_value: 50,
  start_date: "2026-07-10",
  coaching_note: null,
  status: "active",
  review_outcome: null,
  reviewed_at: null,
  created_at: "2026-07-10T08:00:00.000Z",
  updated_at: "2026-07-10T08:00:00.000Z",
};

test("progress handles higher-is-better metrics and clamps at the ends", () => {
  const halfway = earlyWinProgress(40, 50, 45);
  assert.equal(halfway?.direction, "increase");
  assert.equal(halfway?.progressPercent, 50);
  assert.equal(halfway?.delta, 5);
  assert.equal(halfway?.achieved, false);

  const past = earlyWinProgress(40, 50, 52);
  assert.equal(past?.progressPercent, 100);
  assert.equal(past?.achieved, true);

  const regressed = earlyWinProgress(40, 50, 38);
  assert.equal(regressed?.progressPercent, 0);
  assert.equal(regressed?.achieved, false);
});

test("progress handles lower-is-better metrics without sign confusion", () => {
  const halfway = earlyWinProgress(70, 62, 66);
  assert.equal(halfway?.direction, "decrease");
  assert.equal(halfway?.progressPercent, 50);
  assert.equal(halfway?.delta, -4);
  assert.equal(halfway?.achieved, false);

  const reached = earlyWinProgress(70, 62, 61.5);
  assert.equal(reached?.progressPercent, 100);
  assert.equal(reached?.achieved, true);
});

test("a zero-range goal never divides by zero or fabricates a percentage", () => {
  assert.equal(improvementDirection(80, 80), "maintain");
  const holding = earlyWinProgress(80, 80, 80);
  assert.equal(holding?.progressPercent, null);
  assert.equal(holding?.achieved, true);
  const drifted = earlyWinProgress(80, 80, 82);
  assert.equal(drifted?.progressPercent, null);
  assert.equal(drifted?.achieved, false);
});

test("a missing current value yields no progress, never zero", () => {
  assert.equal(earlyWinProgress(40, 50, null), null);
  const view = buildEarlyWinView(baseWin, { value: null, date: null }, new Date("2026-07-15T12:00:00.000Z"));
  assert.equal(view.progress, null);
  assert.equal(view.reading.value, null);
  assert.equal(view.reading.stale, false);
});

test("day counting uses London civil days across the GMT to BST boundary", () => {
  // 23:30 UTC on 29 March 2026 is already 00:30 BST on 30 March in London.
  assert.equal(earlyWinDayNumber("2026-03-28", new Date("2026-03-29T23:30:00.000Z")), 3);
  assert.equal(earlyWinDayNumber("2026-03-28", new Date("2026-03-28T10:00:00.000Z")), 1);
});

test("day counting uses London civil days across the BST to GMT boundary", () => {
  // 23:30 UTC on 25 October 2026 is 23:30 GMT in London - still 25 October.
  assert.equal(earlyWinDayNumber("2026-10-24", new Date("2026-10-25T23:30:00.000Z")), 2);
  // 23:30 UTC on 24 October 2026 is 00:30 BST on 25 October in London.
  assert.equal(earlyWinDayNumber("2026-10-24", new Date("2026-10-24T23:30:00.000Z")), 2);
});

test("a future or invalid start date never reports an in-window day", () => {
  assert.equal(earlyWinDayNumber("2026-08-01", new Date("2026-07-24T12:00:00.000Z")) <= 0, true);
  assert.equal(earlyWinDayNumber("not-a-date", new Date("2026-07-24T12:00:00.000Z")), 0);
});

test("staleness starts at three days without a reading and missing data is not stale", () => {
  const now = new Date("2026-07-24T12:00:00.000Z");
  assert.equal(buildEarlyWinReading(45, "2026-07-22", now).stale, false);
  assert.equal(buildEarlyWinReading(45, "2026-07-21", now).stale, true);
  assert.equal(buildEarlyWinReading(45, "2026-07-21", now).daysSince, 3);
  assert.equal(buildEarlyWinReading(null, null, now).stale, false);
  assert.equal(buildEarlyWinReading(null, null, now).daysSince, null);
});

test("the review becomes due on day fourteen exactly", () => {
  assert.equal(EARLY_WIN_WINDOW_DAYS, 14);
  const win = { status: "active" as const, start_date: "2026-07-01" };
  assert.equal(isEarlyWinReviewDue(win, new Date("2026-07-13T12:00:00.000Z")), false);
  assert.equal(isEarlyWinReviewDue(win, new Date("2026-07-14T12:00:00.000Z")), true);
  assert.equal(isEarlyWinReviewDue(win, new Date("2026-08-02T12:00:00.000Z")), true);
});

test("a completed early win is retired: its review is never due again", () => {
  const completed = { status: "completed" as const, start_date: "2026-07-01" };
  assert.equal(isEarlyWinReviewDue(completed, new Date("2026-08-02T12:00:00.000Z")), false);
});

test("the metric allowlist accepts only supported keys", () => {
  assert.equal(isEarlyWinMetricKey("hrv_ms"), true);
  assert.equal(isEarlyWinMetricKey("weight_kg"), true);
  assert.equal(isEarlyWinMetricKey("manual"), true);
  assert.equal(isEarlyWinMetricKey("readiness_score"), false);
  assert.equal(isEarlyWinMetricKey(""), false);
  assert.equal(isEarlyWinMetricKey(null), false);
});
