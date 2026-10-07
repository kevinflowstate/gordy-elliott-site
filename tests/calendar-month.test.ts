import assert from "node:assert/strict";
import test from "node:test";
import type { CalendarEvent } from "../lib/types";
import { getCalendarMonthDates } from "../lib/calendar-month";

const event: CalendarEvent = {
  id: "personal-event", title: "Training", event_date: "2026-10-07", event_time: "09:00",
  recurrence: "none", is_active: true, created_at: "2026-10-07T08:00:00Z", source: "client",
};

function days(input: CalendarEvent, year = 2026, month = 9) {
  return getCalendarMonthDates(input, year, month).map((date) => date.getDate());
}

test("month calendar shows real one-off dates, excludes inactive events and stays in the viewed month", () => {
  assert.deepEqual(days(event), [7]);
  assert.deepEqual(days({ ...event, is_active: false }), []);
  assert.deepEqual(days(event, 2026, 10), []);
  assert.deepEqual(days({ ...event, event_date: "invalid" }), []);
});

test("month calendar preserves weekly and biweekly dates across BST ending", () => {
  const previousZone = process.env.TZ;
  process.env.TZ = "Europe/London";
  try {
    assert.deepEqual(days({ ...event, recurrence: "weekly" }), [7, 14, 21, 28]);
    assert.deepEqual(days({ ...event, recurrence: "biweekly" }), [7, 21]);
    assert.deepEqual(days({ ...event, event_date: "2026-10-04", recurrence: "biweekly" }), [4, 18]);
    assert.deepEqual(days({ ...event, event_date: "2026-10-04", recurrence: "biweekly" }, 2026, 10), [1, 15, 29]);
  } finally {
    if (previousZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousZone;
  }
});

test("monthly events retain the original day and never spill a short month into the next", () => {
  const monthly = { ...event, event_date: "2026-01-31", recurrence: "monthly" as const };
  assert.deepEqual(days(monthly, 2026, 1), []);
  assert.deepEqual(days(monthly, 2026, 2), [31]);
  assert.deepEqual(days({ ...monthly, event_date: "2026-10-31" }), [31]);
  assert.deepEqual(days({ ...event, event_date: "2026-10-14", recurrence: "weekly" }), [14, 21, 28]);
});

test("date-only one-off events keep their calendar day outside UTC", () => {
  const previousZone = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    assert.deepEqual(days({ ...event, event_date: "2026-10-01", all_day: true }), [1]);
  } finally {
    if (previousZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousZone;
  }
});
