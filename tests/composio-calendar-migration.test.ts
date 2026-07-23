import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260723153000_add_composio_calendar_integrations.sql",
  import.meta.url,
);

test("calendar tables are tenant-bound and clients receive read-only grants", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /client_profiles\.user_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(migration, /GRANT SELECT ON public\.client_calendar_connections TO authenticated/);
  assert.match(migration, /GRANT SELECT ON public\.client_calendar_events TO authenticated/);
  assert.doesNotMatch(migration, /GRANT (?:INSERT|UPDATE|DELETE).*client_calendar/);
});

test("calendar storage excludes raw payloads, descriptions, and attendees", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.doesNotMatch(migration, /\bpayload\b/i);
  assert.doesNotMatch(migration, /\bdescription\b/i);
  assert.doesNotMatch(migration, /\battendees\b/i);
  assert.match(migration, /UNIQUE\(connection_id, external_event_key\)/);
});
