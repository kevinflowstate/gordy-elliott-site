import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("app/api/cron/checkin-reminder/route.ts", "utf8");

test("weekly check-in cron keeps push reminders and sends no email", () => {
  assert.match(route, /sendPushToUser\(client\.id/);
  assert.match(route, /resolveClientLifecycleStatus\(profile\.lifecycle_status/);
  assert.doesNotMatch(route, /sendCheckinReminderEmail|getUserById|emailSent/);
});

test("weekly check-in push still requires the configured check-in day", () => {
  assert.match(route, /checkinReminderDay\(profile/);
  assert.match(route, /!dueByUser\.get\(client\.id\)/);
  assert.match(route, /checkedInClientIds\.has\(clientId\)/);
});
