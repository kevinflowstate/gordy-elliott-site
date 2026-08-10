import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  createCalendarCallbackToken,
  verifyCalendarCallbackToken,
} from "../lib/composio/callback-token";
import { normaliseCalendarEvents } from "../lib/composio/normalise";

test("calendar callback tokens bind connection, return mode, signature and expiry", () => {
  const originalSecret = process.env.COMPOSIO_CALLBACK_SECRET;
  process.env.COMPOSIO_CALLBACK_SECRET = "calendar-test-secret";

  try {
    const issuedAt = Date.UTC(2026, 7, 10, 9, 0, 0);
    const webToken = createCalendarCallbackToken("connection-1", false, issuedAt);
    const nativeToken = createCalendarCallbackToken("connection-1", true, issuedAt);

    assert.equal(verifyCalendarCallbackToken("connection-1", webToken, false, issuedAt), true);
    assert.equal(verifyCalendarCallbackToken("connection-1", nativeToken, true, issuedAt), true);
    assert.equal(verifyCalendarCallbackToken("connection-2", webToken, false, issuedAt), false);
    assert.equal(verifyCalendarCallbackToken("connection-1", webToken, true, issuedAt), false);
    assert.equal(verifyCalendarCallbackToken("connection-1", `${webToken}tampered`, false, issuedAt), false);
    assert.equal(verifyCalendarCallbackToken("connection-1", webToken, false, issuedAt + 15 * 60 * 1000 + 1), false);
  } finally {
    if (originalSecret === undefined) delete process.env.COMPOSIO_CALLBACK_SECRET;
    else process.env.COMPOSIO_CALLBACK_SECRET = originalSecret;
  }
});

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

test("calendar OAuth uses a signed native return and the installed app browser", () => {
  const connectRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/portal/calendar-integrations/providers/[provider]/connect/route.ts"),
    "utf8",
  );
  const callbackRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/portal/calendar-integrations/callback/route.ts"),
    "utf8",
  );
  const connectionsPanel = fs.readFileSync(
    path.join(process.cwd(), "components/portal/CalendarConnections.tsx"),
    "utf8",
  );
  const returnPage = fs.readFileSync(
    path.join(process.cwd(), "app/calendar-connection-return/page.tsx"),
    "utf8",
  );
  const middleware = fs.readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8");

  assert.match(connectRoute, /body\.native === true/);
  assert.match(connectRoute, /body\.consentVersion !== CALENDAR_CONSENT_VERSION/);
  assert.match(connectRoute, /consented_at: now/);
  assert.match(connectRoute, /createCalendarCallbackToken\(connection\.id, nativeReturn\)/);
  assert.match(connectRoute, /callbackUrl\.searchParams\.set\("native", "1"\)/);
  assert.match(callbackRoute, /verifyCalendarCallbackToken\(connectionId, token, nativeReturn\)/);
  assert.match(callbackRoute, /"\/calendar-connection-return"/);
  assert.match(connectionsPanel, /Browser\.open\(\{ url: payload\.redirectUrl \}\)/);
  assert.match(connectionsPanel, /Connect your calendar to sync AT CAPACITY with your week/);
  assert.match(connectionsPanel, /role="dialog"/);
  assert.match(connectionsPanel, /consent_version === CALENDAR_CONSENT_VERSION/);
  assert.doesNotMatch(connectionsPanel, /Before you connect Google Calendar/);
  assert.match(returnPage, /shiftcoaching:\/\/portal\/calendar/);
  assert.match(middleware, /isSignedCalendarOAuthCallback/);
  assert.match(middleware, /!isSignedCalendarOAuthCallback && path\.startsWith\('\/api\/portal'\)/);
});
