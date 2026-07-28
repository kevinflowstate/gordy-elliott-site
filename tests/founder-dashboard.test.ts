import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarEventOccursOn,
  calendarWindowLoad,
  dateKeyInTimeZone,
  isCurrentWearableSummary,
} from "../lib/founder-dashboard";
import type { CalendarEvent } from "../lib/types";

const coachEvent: CalendarEvent = {
  id: "event-1",
  title: "Strategy call",
  description: null,
  event_date: "2026-07-23T09:00:00+00:00",
  event_time: "09:00",
  recurrence: "none",
  recurrence_day: null,
  category: "custom",
  is_active: true,
  created_at: "2026-07-01T09:00:00+00:00",
};

test("coach calendar timestamps count on their calendar date", () => {
  assert.equal(calendarEventOccursOn(coachEvent, new Date("2026-07-23T12:00:00")), true);
  assert.equal(calendarEventOccursOn(coachEvent, new Date("2026-07-24T12:00:00")), false);
});

test("wearable capacity is current only for today's local date", () => {
  const now = new Date("2026-07-23T18:00:00");
  assert.equal(isCurrentWearableSummary("2026-07-23", now), true);
  assert.equal(isCurrentWearableSummary("2026-07-22", now), false);
});

test("the coaching date follows Europe London across the BST midnight boundary", () => {
  const boundary = new Date("2026-07-31T23:30:00.000Z");
  assert.equal(dateKeyInTimeZone(boundary, "Europe/London"), "2026-08-01");
  assert.equal(dateKeyInTimeZone(boundary, "UTC"), "2026-07-31");
});

test("biweekly events include their first afternoon occurrence and survive DST changes", () => {
  const recurring = {
    ...coachEvent,
    event_date: "2026-03-22T16:00:00+00:00",
    event_time: "16:00",
    recurrence: "biweekly" as const,
    recurrence_day: 0,
  };

  assert.equal(calendarEventOccursOn(recurring, new Date("2026-03-22T12:00:00")), true);
  assert.equal(calendarEventOccursOn(recurring, new Date("2026-04-05T12:00:00")), true);
  assert.equal(calendarEventOccursOn(recurring, new Date("2026-03-29T12:00:00")), false);
});

test("calendar windows expand recurring events that began before the window", () => {
  const recurring = {
    ...coachEvent,
    event_date: "2026-07-02T09:00:00+01:00",
    recurrence: "weekly" as const,
    recurrence_day: 4,
  };
  const load = calendarWindowLoad([recurring], new Date("2026-07-23T12:00:00"), 7);
  assert.equal(load[0].count, 1);
  assert.equal(load.reduce((total, day) => total + day.count, 0), 1);
});

test("biweekly cadence starts on the configured weekday when it differs from the start date", () => {
  const recurring = {
    ...coachEvent,
    event_date: "2026-07-22T09:00:00+01:00",
    recurrence: "biweekly" as const,
    recurrence_day: 1,
  };

  assert.equal(calendarEventOccursOn(recurring, new Date("2026-07-27T12:00:00")), true);
  assert.equal(calendarEventOccursOn(recurring, new Date("2026-08-03T12:00:00")), false);
  assert.equal(calendarEventOccursOn(recurring, new Date("2026-08-10T12:00:00")), true);
});
