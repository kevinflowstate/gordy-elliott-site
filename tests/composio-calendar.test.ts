import assert from "node:assert/strict";
import test from "node:test";
import { normaliseCalendarEvents } from "../lib/composio/normalise";

test("normalises Google events without retaining descriptions or attendees", () => {
  const events = normaliseCalendarEvents("google_calendar", {
    events: [{
      source_calendar_id: "primary",
      event: {
        id: "google-1",
        summary: "Client strategy session",
        description: "Sensitive notes that must not be stored",
        attendees: [{ email: "private@example.com" }],
        start: { dateTime: "2026-07-24T09:30:00+01:00" },
        end: { dateTime: "2026-07-24T10:30:00+01:00" },
        transparency: "opaque",
        hangoutLink: "https://meet.google.com/example",
      },
    }],
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].title, "Client strategy session");
  assert.equal(events[0].event_date_key, "2026-07-24");
  assert.equal(events[0].event_time, "09:30");
  assert.equal(events[0].meeting_url, "https://meet.google.com/example");
  assert.equal("description" in events[0], false);
  assert.equal("attendees" in events[0], false);
});

test("protects private Google event titles and handles all-day dates", () => {
  const events = normaliseCalendarEvents("google_calendar", {
    data: {
      events: [{
        source_calendar_id: "private",
        event: {
          id: "google-private",
          summary: "Private appointment",
          visibility: "private",
          start: { date: "2026-07-25" },
          end: { date: "2026-07-26" },
        },
      }],
    },
  });

  assert.equal(events[0].title, "Busy");
  assert.equal(events[0].all_day, true);
  assert.equal(events[0].event_date_key, "2026-07-25");
  assert.equal(events[0].event_time, "00:00");
});

test("normalises Outlook UTC calendar view events into London time", () => {
  const events = normaliseCalendarEvents("outlook", {
    value: [{
      id: "outlook-1",
      subject: "Board meeting",
      sensitivity: "normal",
      start: { dateTime: "2026-07-24T08:00:00.0000000", timeZone: "UTC" },
      end: { dateTime: "2026-07-24T09:00:00.0000000", timeZone: "UTC" },
      showAs: "busy",
      onlineMeeting: { joinUrl: "https://teams.microsoft.com/example" },
    }],
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].event_date_key, "2026-07-24");
  assert.equal(events[0].event_time, "09:00");
  assert.equal(events[0].busy_status, "busy");
  assert.equal(events[0].meeting_url, "https://teams.microsoft.com/example");
});

test("protects personal Outlook titles", () => {
  const events = normaliseCalendarEvents("outlook", {
    data: {
      value: [{
        id: "outlook-private",
        subject: "Personal appointment",
        sensitivity: "personal",
        start: { dateTime: "2026-07-24T13:00:00Z" },
        end: { dateTime: "2026-07-24T14:00:00Z" },
      }],
    },
  });

  assert.equal(events[0].title, "Busy");
});

test("drops unsafe calendar links", () => {
  const events = normaliseCalendarEvents("outlook", {
    value: [{
      id: "outlook-unsafe-link",
      subject: "Event",
      start: { dateTime: "2026-07-24T13:00:00Z" },
      end: { dateTime: "2026-07-24T14:00:00Z" },
      onlineMeeting: { joinUrl: "javascript:alert(1)" },
    }],
  });

  assert.equal(events[0].meeting_url, null);
});
