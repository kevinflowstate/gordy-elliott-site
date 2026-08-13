import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getNextCalendarOccurrence } from "../lib/calendar-occurrence";
import { getCoachNoteOfWeek } from "../lib/coach-quotes";
import { getExerciseDemoUrl } from "../lib/exercise-demo";
import type { CalendarEvent } from "../lib/types";

function event(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: "event-1",
    title: "Test event",
    event_date: "2026-08-13",
    event_time: "17:00",
    recurrence: "none",
    is_active: true,
    created_at: "2026-08-01T12:00:00Z",
    ...overrides,
  };
}

test("calendar occurrence respects a one-off event's actual time", () => {
  const before = getNextCalendarOccurrence(event({}), new Date(2026, 7, 13, 16, 0));
  const after = getNextCalendarOccurrence(event({}), new Date(2026, 7, 13, 18, 0));
  assert.equal(before?.getHours(), 17);
  assert.equal(after, null);
});

test("calendar occurrence handles monthly and all-day recurrence", () => {
  const monthly = getNextCalendarOccurrence(
    event({ event_date: "2026-07-15", recurrence: "monthly", event_time: "09:30" }),
    new Date(2026, 7, 13, 12, 0),
  );
  assert.equal(monthly?.getDate(), 15);
  assert.equal(monthly?.getHours(), 9);

  const allDay = getNextCalendarOccurrence(
    event({ all_day: true, recurrence: "weekly", recurrence_day: 4 }),
    new Date(2026, 7, 13, 18, 0),
  );
  assert.equal(allDay?.getDate(), 13);
});

test("coach message stays stable throughout a week", () => {
  assert.deepEqual(getCoachNoteOfWeek(new Date(2026, 7, 10)), getCoachNoteOfWeek(new Date(2026, 7, 16)));
  assert.notDeepEqual(getCoachNoteOfWeek(new Date(2026, 7, 10)), getCoachNoteOfWeek(new Date(2026, 7, 17)));
});

test("exercise demo accepts web links and rejects missing or unsafe values", () => {
  assert.equal(getExerciseDemoUrl("https://example.com/demo"), "https://example.com/demo");
  assert.equal(getExerciseDemoUrl("javascript:alert(1)"), null);
  assert.equal(getExerciseDemoUrl(null), null);
  assert.equal(getExerciseDemoUrl(null, "Back Squat"), "https://musclewiki.com/exercise/barbell-squat");
});

test("workout UI no longer sends missing demos to a generic exercise library", async () => {
  const runner = await readFile(new URL("../components/portal/AtCapacityWorkoutRunner.tsx", import.meta.url), "utf8");
  const plan = await readFile(new URL("../app/portal/exercise-plan/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(runner, /musclewiki\.com\/exercises\?search/);
  assert.doesNotMatch(plan, /musclewiki\.com\/exercises\?search/);
  assert.match(runner, /Exercise demo not yet available/);
});

test("photo comparison starts with an explicit two-photo selection", async () => {
  const gallery = await readFile(new URL("../components/portal/PhotoGallery.tsx", import.meta.url), "utf8");
  assert.match(gallery, /Choose two check-ins/);
  assert.match(gallery, /Back to gallery/);
  assert.doesNotMatch(gallery, /setCompareA\(dates\[0\]\)/);
});
