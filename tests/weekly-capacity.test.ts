import assert from "node:assert/strict";
import test from "node:test";
import { evaluateWeeklyCapacity } from "../lib/weekly-capacity";

const now = new Date("2026-07-31T10:00:00.000Z");
const goodSleep = Array.from({ length: 20 }, (_, index) => ({
  date: `2026-07-${String(index + 1).padStart(2, "0")}`,
  sleepMinutes: 450,
  sleepScore: 78,
}));

function readyInput() {
  return {
    now,
    collectionStartedAt: "2026-06-01T10:00:00.000Z",
    calendarConnected: true,
    calendarLastSyncAt: "2026-07-31T09:00:00.000Z",
    calendarMeetingsByDay: [2, 2, 3, 2, 2, 0, 0],
    sleepSignals: goodSleep,
    activePlanSessions: 3,
    plannedSessions: 3,
  };
}

test("stays locked until the four-week collection window is complete", () => {
  const result = evaluateWeeklyCapacity({
    ...readyInput(),
    collectionStartedAt: "2026-07-10T10:00:00.000Z",
  });
  assert.equal(result.status, "collecting");
  assert.equal(result.score, null);
  assert.equal(result.daysRemaining, 7);
});

test("requires calendar, enough sleep days and an active training plan", () => {
  const result = evaluateWeeklyCapacity({
    ...readyInput(),
    calendarConnected: false,
    calendarLastSyncAt: null,
    sleepSignals: goodSleep.slice(0, 5),
    activePlanSessions: 0,
    plannedSessions: 0,
  });
  assert.equal(result.status, "setup_required");
  assert.equal(result.score, null);
  assert.deepEqual(
    result.requirements.filter((requirement) => !requirement.met).map((requirement) => requirement.id),
    ["calendar", "sleep", "training"],
  );
});

test("does not score from a stale calendar connection", () => {
  const result = evaluateWeeklyCapacity({
    ...readyInput(),
    calendarLastSyncAt: "2026-07-20T09:00:00.000Z",
  });
  assert.equal(result.status, "setup_required");
  assert.equal(result.requirements.find((requirement) => requirement.id === "calendar")?.detail, "Calendar needs a fresh sync");
});

test("does not count composite readiness when genuine sleep data is missing", () => {
  const result = evaluateWeeklyCapacity({
    ...readyInput(),
    sleepSignals: goodSleep.map((signal) => ({
      ...signal,
      sleepMinutes: null,
      sleepScore: null,
      readinessScore: 90,
    })),
  });
  assert.equal(result.status, "setup_required");
  assert.equal(result.signals.sleepDays, 0);
});

test("returns a lenient, deterministic score for a normal working week", () => {
  const first = evaluateWeeklyCapacity(readyInput());
  const second = evaluateWeeklyCapacity(readyInput());
  assert.deepEqual(second, first);
  assert.equal(first.status, "ready");
  assert.ok(first.score !== null && first.score >= 50);
  assert.match(first.message, /workable|no capacity reason/i);
});

test("one difficult signal alone cannot mark the whole week as stretched", () => {
  const result = evaluateWeeklyCapacity({
    ...readyInput(),
    calendarMeetingsByDay: [8, 8, 8, 8, 8, 3, 2],
    plannedSessions: 1,
  });
  assert.equal(result.status, "ready");
  assert.ok(result.score !== null && result.score >= 36);
  assert.notEqual(result.label, "Protect the week");
});

test("multiple high-pressure signals can recommend protecting the week", () => {
  const result = evaluateWeeklyCapacity({
    ...readyInput(),
    calendarMeetingsByDay: [8, 8, 8, 8, 8, 3, 2],
    sleepSignals: goodSleep.map((signal) => ({ ...signal, sleepMinutes: 300, sleepScore: 30 })),
    plannedSessions: 5,
  });
  assert.equal(result.status, "ready");
  assert.ok(result.score !== null && result.score < 35);
  assert.equal(result.label, "Protect the week");
});
