import assert from "node:assert/strict";
import test from "node:test";
import { dashboardWorkoutWeek, dashboardSavedWorkouts, dashboardWeightHistory } from "@/lib/admin-dashboard";

const now = new Date("2026-10-09T11:00:00Z");
const summary = (session_id: string, log_date: string, completed_sets = 5) => ({ session_id, log_date, completed_sets, completed_at: `${log_date}T12:00:00Z` });

test("five exercises in each of two finished workouts count as two workouts, not ten", () => {
  const logs = ["a", "b"].flatMap((session_id) => Array.from({ length: 5 }, () => ({ session_id, log_date: "2026-10-08", completed: true })));
  assert.deepEqual(dashboardWorkoutWeek(logs, [summary("a", "2026-10-08"), summary("b", "2026-10-08")], now), { completed: 2, partial: 0, start: "2026-10-05", today: "2026-10-09" });
});

test("repeated session on different days counts twice; retries count once; partial and orphan rows do not imply finish", () => {
  const logs = [{ session_id: "partial", log_date: "2026-10-09", completed: true }, { session_id: "partial", log_date: "2026-10-09", completed: true }, { session_id: null, log_date: "2026-10-09", completed: true }, { session_id: "draft", log_date: "2026-10-09", completed: false }];
  const result = dashboardWorkoutWeek(logs, [summary("a", "2026-10-07"), summary("a", "2026-10-07"), summary("a", "2026-10-08"), summary("empty", "2026-10-09", 0), { ...summary("unfinished", "2026-10-09"), completed_at: null }], now);
  assert.equal(result.completed, 2);
  assert.equal(result.partial, 1);
});

test("calendar-week bounds exclude last Sunday and future logs", () => {
  const result = dashboardWorkoutWeek([], [summary("old", "2026-10-04"), summary("new", "2026-10-05"), summary("today", "2026-10-09"), summary("future", "2026-10-10")], now);
  assert.equal(result.completed, 2);
});

test("Monday is resolved in UK time even when the UTC clock still says Sunday", () => {
  const result = dashboardWorkoutWeek([], [summary("old", "2026-10-04"), summary("new", "2026-10-05")], new Date("2026-10-04T23:30:00Z"));
  assert.equal(result.start, "2026-10-05");
  assert.equal(result.today, "2026-10-05");
  assert.equal(result.completed, 1);
});

test("weight detail preserves all dated records in chronological order and excludes invalid answers", () => {
  const history = dashboardWeightHistory([
    { id: "recent", created_at: "2026-10-09T12:00:00Z", responses: { weight: "81.5 kg" } },
    { id: "legacy", created_at: "2026-09-01T12:00:00Z", responses: { current_weight: "83" } },
    { id: "invalid", created_at: "2026-10-08T12:00:00Z", responses: { weight: "80ish" } },
    { id: "blank", created_at: "2026-10-08T12:00:00Z", responses: { weight: " " } },
    { id: "zero", created_at: "2026-10-08T12:00:00Z", responses: { weight: "0" } },
  ]);
  assert.deepEqual(history.map(({ id, value }) => ({ id, value })), [{ id: "legacy", value: 83 }, { id: "recent", value: 81.5 }]);
});


test("a saved workout with blank numeric results still counts completed set flags, but empty saves do not", () => {
  const logs = [
    { session_id: "bodyweight", log_date: "2026-10-09", completed: true },
    { session_id: "empty", log_date: "2026-10-09", completed: false },
  ];
  const summaries = [summary("bodyweight", "2026-10-09", 0), summary("empty", "2026-10-09", 0)];
  assert.deepEqual(dashboardSavedWorkouts(logs, summaries).map((workout) => workout.session_id), ["bodyweight"]);
  assert.equal(dashboardWorkoutWeek(logs, summaries, now).completed, 1);
  assert.equal(dashboardWorkoutWeek(logs, summaries, now).partial, 0);
});
