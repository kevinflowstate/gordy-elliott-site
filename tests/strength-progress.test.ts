import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  buildSessionPerformance,
  buildStrengthTrackerProgress,
  buildTrainingConsistency,
  estimateOneRepMax,
  parseDurationSeconds,
  weekStartForDateKey,
} from "@/lib/strength-progress";

test("session progress totals completed work and compares equivalent sessions", () => {
  const sessions = buildSessionPerformance({
    sessions: [{ id: "session-a", name: "Lower body" }],
    summaries: [
      { session_id: "session-a", log_date: "2026-08-01", duration_seconds: 2700 },
      { session_id: "session-a", log_date: "2026-08-08", duration_seconds: 2520 },
    ],
    logs: [
      {
        exercise_id: "squat",
        exercise_name: "Goblet squat",
        session_id: "session-a",
        log_date: "2026-08-01",
        completed: true,
        sets_data: [
          { weight: "30", reps: "10", completed: true },
          { weight: "30", reps: "10", completed: true },
        ],
      },
      {
        exercise_id: "squat",
        exercise_name: "Goblet squat",
        session_id: "session-a",
        log_date: "2026-08-08",
        completed: true,
        sets_data: [
          { weight: "32.5", reps: "10", completed: true },
          { weight: "32.5", reps: "10", completed: true },
          { weight: "100", reps: "10", completed: false },
        ],
      },
    ],
  });

  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].totalTonnageKg, 650);
  assert.equal(sessions[0].completedSets, 2);
  assert.equal(sessions[0].durationSeconds, 2520);
  assert.deepEqual(sessions[0].comparison, {
    previousDate: "2026-08-01",
    tonnageChangeKg: 50,
    durationChangeSeconds: -180,
    repsChange: 0,
  });
  assert.equal(sessions[0].exercises[0].sets.length, 2);
});

test("estimated strength compares completed working sets without requiring a true max", () => {
  assert.equal(estimateOneRepMax(80, 8), 101.3);
  assert.equal(estimateOneRepMax(100, 1), 100);
  assert.equal(estimateOneRepMax(80, 13), 0);
});

test("strength progress follows the exercise across plan items and ignores incomplete or invalid sets", () => {
  const progress = buildStrengthTrackerProgress({
    id: "tracker",
    exerciseId: "exercise",
    exerciseName: "Trap Bar Deadlift",
    metricType: "load_reps",
    logs: [
      {
        exercise_id: "exercise",
        session_id: "session-a",
        log_date: "2026-07-01",
        completed: true,
        sets_data: [
          { weight: "100", reps: "5", completed: true },
          { weight: "500", reps: "5", completed: false },
        ],
      },
      {
        exercise_id: "exercise",
        session_id: "session-b",
        log_date: "2026-07-15",
        completed: true,
        sets_data: [{ weight: "105kg", reps: "6 reps", completed: true }],
      },
    ],
  });

  assert.equal(progress.currentValue, 126);
  assert.equal(progress.latestSetLabel, "105kg × 6");
  assert.equal(progress.change, 9.3);
  assert.equal(progress.points.length, 2);
  assert.equal(progress.points[1].isPersonalBest, true);
});

test("rep and duration trackers support client-specific movements", () => {
  const duration = parseDurationSeconds("1:30");
  assert.equal(duration, 90);
  assert.equal(parseDurationSeconds("2 min 15 sec"), 135);

  const reps = buildStrengthTrackerProgress({
    id: "tracker",
    exerciseId: "pullup",
    exerciseName: "Pull-up",
    metricType: "reps",
    logs: [{
      exercise_id: "pullup",
      session_id: "session",
      log_date: "2026-08-01",
      completed: true,
      sets_data: [{ reps: "9", completed: true }, { reps: "7", completed: true }],
    }],
  });
  assert.equal(reps.currentValue, 9);
  assert.equal(reps.latestSetLabel, "9 reps");
});

test("training consistency matches scheduled sessions within their week and counts real sessions once", () => {
  const consistency = buildTrainingConsistency({
    todayKey: "2026-08-04",
    assignments: [
      { session_id: "a", week_start: "2026-07-27", planned_date: "2026-07-27" },
      { session_id: "b", week_start: "2026-07-27", planned_date: "2026-07-30" },
      { session_id: "a", week_start: "2026-08-03", planned_date: "2026-08-03" },
    ],
    logs: [
      { session_id: "a", log_date: "2026-07-28", completed: true },
      { session_id: "a", log_date: "2026-07-28", completed: true },
      { session_id: "a", log_date: "2026-08-04", completed: true },
    ],
  });

  assert.equal(consistency.plannedSessions, 3);
  assert.equal(consistency.completedPlannedSessions, 2);
  assert.equal(consistency.completionRate, 67);
  assert.equal(consistency.completedSessions, 2);
  assert.equal(consistency.currentWeekCompleted, 1);
  assert.equal(consistency.activeWeekStreak, 2);
  assert.equal(weekStartForDateKey("2026-08-02"), "2026-07-27");
});

test("strength tracker migration is client-isolated, coach-controlled and capped at five", () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260804100949_add_client_strength_trackers.sql"),
    "utf8",
  );
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(migration, /client_profiles\.user_id = \(SELECT auth\.uid\(\)\)/i);
  assert.match(migration, /private\.is_admin\(\)/i);
  assert.match(migration, /REVOKE ALL[\s\S]*FROM anon, authenticated/i);
  assert.match(migration, /at most five active strength trackers/i);
});

test("session summary migration is client-isolated and bounded", () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260817110000_add_exercise_session_summaries.sql"),
    "utf8",
  );
  assert.match(migration, /UNIQUE \(client_id, session_id, log_date\)/i);
  assert.match(migration, /duration_seconds BETWEEN 0 AND 21600/i);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(migration, /client_profiles\.user_id = \(SELECT auth\.uid\(\)\)/i);
  assert.match(migration, /REVOKE ALL[\s\S]*FROM anon, authenticated/i);
});

test("strength tracker routes keep client identity server-owned and writes admin-only", () => {
  const portalRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/portal/strength-progress/route.ts"),
    "utf8",
  );
  const adminRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/admin/client-strength-trackers/route.ts"),
    "utf8",
  );

  assert.match(portalRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(portalRoute, /\.eq\("user_id", user\.id\)/);
  assert.doesNotMatch(portalRoute, /searchParams|get\("clientId"\)|client_id/);
  assert.equal((adminRoute.match(/requireAdmin\(\)/g) || []).length, 4);
  assert.match(adminRoute, /\.eq\("client_id", clientId\)/);
  assert.match(adminRoute, /Choose an exercise from this client's active plan/);
});
