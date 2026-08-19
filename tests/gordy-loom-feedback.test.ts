import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calendarEventOccursOnDate, getNextCalendarOccurrence } from "../lib/calendar-occurrence";
import { manualCalendarSyncRetryAfterSeconds } from "../lib/composio/calendar-sync-cooldown";
import { getCoachNoteOfWeek } from "../lib/coach-quotes";
import { getExerciseDemoUrl } from "../lib/exercise-demo";
import type { CalendarEvent } from "../lib/types";
import { getImmediateTodayPriority } from "../lib/today-priority";
import type { WearableDailySummary } from "../lib/wearable-insights";

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

test("today priority reacts immediately to fresh wearable and calendar pressure", () => {
  const today = new Date(2026, 7, 14, 9, 0);
  const wearable = {
    summary_date: "2026-08-14",
    recovery_status: "reduce_intensity",
  } as WearableDailySummary;
  const calendarEvents = Array.from({ length: 3 }, (_, index) => event({
    id: `event-${index}`,
    event_date: "2026-08-14",
    event_time: `${10 + index}:00`,
  }));
  const priority = getImmediateTodayPriority({ calendarEvents, wearableSummary: wearable, todayTraining: "Lower body", now: today });
  assert.equal(priority?.label, "Give today some breathing room");
  assert.equal(priority?.href, "/portal/exercise-plan");
});

test("today priority ignores stale recovery but recognises a genuinely busy calendar", () => {
  const today = new Date(2026, 7, 14, 9, 0);
  const staleWearable = {
    summary_date: "2026-08-13",
    recovery_status: "reduce_intensity",
  } as WearableDailySummary;
  const quiet = getImmediateTodayPriority({ calendarEvents: [], wearableSummary: staleWearable, todayTraining: null, now: today });
  assert.equal(quiet, null);

  const busyEvents = Array.from({ length: 5 }, (_, index) => event({
    id: `busy-${index}`,
    event_date: "2026-08-14",
    event_time: `${9 + index}:00`,
  }));
  assert.equal(calendarEventOccursOnDate(busyEvents[0], today), true);
  assert.equal(
    getImmediateTodayPriority({ calendarEvents: busyEvents, wearableSummary: null, todayTraining: null, now: today })?.label,
    "Busy day: protect the basics",
  );
});

test("manual calendar sync cooldown is persisted from the last successful sync", () => {
  const now = Date.parse("2026-08-14T12:00:00Z");
  assert.equal(manualCalendarSyncRetryAfterSeconds("2026-08-14T11:55:00Z", now), 300);
  assert.equal(manualCalendarSyncRetryAfterSeconds("2026-08-14T11:49:59Z", now), 0);
  assert.equal(manualCalendarSyncRetryAfterSeconds(null, now), 0);
});

test("manual calendar refresh is enforced on both the server and the connection UI", async () => {
  const route = await readFile(new URL("../app/api/portal/calendar-integrations/connections/[connectionId]/sync/route.ts", import.meta.url), "utf8");
  const connections = await readFile(new URL("../components/portal/CalendarConnections.tsx", import.meta.url), "utf8");
  assert.match(route, /manualCalendarSyncRetryAfterSeconds/);
  assert.match(route, /status:\s*429/);
  assert.match(route, /"Retry-After"/);
  assert.match(route, /rateLimit/);
  assert.match(connections, /syncCoolingDown/);
  assert.match(connections, /Up to date/);
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

test("latest Gordy UI wording and mobile containment are wired into the real portal", async () => {
  const home = await readFile(new URL("../app/portal/page.tsx", import.meta.url), "utf8");
  const clientDm = await readFile(new URL("../components/inbox/ClientInboxClient.tsx", import.meta.url), "utf8");
  const inboxThread = await readFile(new URL("../components/inbox/InboxThread.tsx", import.meta.url), "utf8");
  const globals = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(home, />Today<\/div>/);
  assert.doesNotMatch(home, /AT CAPACITY Today/);
  assert.match(clientDm, /portal-dm-active/);
  assert.match(clientDm, /portal-dm-page/);
  assert.match(inboxThread, /overscroll-contain/);
  assert.match(globals, /html\.portal-dm-active body/);
  assert.match(globals, /overflow:\s*hidden/);
});

test("weekly adjustments stay compact and Gordy's briefing leads with actionable live signals", async () => {
  const planner = await readFile(new URL("../app/portal/exercise-plan/page.tsx", import.meta.url), "utf8");
  const admin = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");

  assert.match(planner, /Adjust this week/);
  assert.match(planner, /snap-x/);
  assert.match(planner, /group\/session/);
  assert.match(admin, /Today&apos;s attention list/);
  assert.match(admin, /fetch\("\/api\/inbox"\)/);
  assert.match(admin, /fetch\("\/api\/admin\/capacity-scan"\)/);
  assert.match(admin, /Snooze 7d/);
  assert.ok(admin.indexOf("<ShiftOverview") < admin.indexOf("{/* Stats */}"));
});
