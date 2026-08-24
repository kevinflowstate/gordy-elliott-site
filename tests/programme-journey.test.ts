import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { MINIMUM_NATIVE_VOICE_BUILD, nativeBuildSupportsVoiceNotes } from "../lib/native-voice";
import { isProgrammeType, legacyProfileForProgramme, monthStartKey, normalizeProgrammeType, parseProgrammeAudiences, programmeConfig } from "../lib/programmes";

const programmeMigrationUrl = new URL("../supabase/migrations/20260824100000_programme_journey.sql", import.meta.url);
const audioMigrationUrl = new URL("../supabase/migrations/20260824101000_inbox_voice_notes.sql", import.meta.url);
const adminClientRouteUrl = new URL("../app/api/admin/clients/[id]/route.ts", import.meta.url);
const portalAIRouteUrl = new URL("../app/api/portal/ai/route.ts", import.meta.url);

test("only the three coaching programmes are accepted", () => {
  assert.equal(isProgrammeType("capacity"), true);
  assert.equal(isProgrammeType("shift"), true);
  assert.equal(isProgrammeType("in_person"), true);
  assert.equal(isProgrammeType("vip"), false);
  assert.equal(isProgrammeType(null), false);
  assert.equal(normalizeProgrammeType("shift"), "shift");
  assert.equal(normalizeProgrammeType("legacy"), "capacity");
  assert.deepEqual(parseProgrammeAudiences(["shift", "capacity", "shift"]), ["shift", "capacity"]);
  assert.equal(parseProgrammeAudiences([]), null);
  assert.equal(parseProgrammeAudiences(["shift", "vip"]), null);
});

test("programme entitlements match Gordy's commercial rules", () => {
  assert.equal(programmeConfig.capacity.callCount, 2);
  assert.equal(programmeConfig.shift.callCount, 1);
  assert.equal(programmeConfig.in_person.callCount, 1);
  assert.equal(programmeConfig.shift.documentsEnabled, false);
  assert.equal(programmeConfig.shift.aiMonthlyLimit, 30);
  assert.equal(programmeConfig.capacity.aiMonthlyLimit, null);
  assert.equal(legacyProfileForProgramme("capacity").experience_mode, "founder_dashboard");
});

test("monthly confirmations use a calendar-month key", () => {
  assert.equal(monthStartKey(new Date(2026, 7, 24, 12, 0, 0)), "2026-08-01");
  assert.equal(monthStartKey(new Date("2026-03-31T23:30:00.000Z")), "2026-04-01");
});

test("programme migration enforces onboarding, calls, audience and atomic AI limits", async () => {
  const migration = await readFile(programmeMigrationUrl, "utf8");
  assert.match(migration, /Preserve the intent of the legacy tiers/);
  assert.match(migration, /WHEN experience_mode = 'founder_dashboard' OR tier = 'vip' THEN 'capacity'/);
  assert.match(migration, /WHEN tier = 'premium' THEN 'in_person'/);
  assert.match(migration, /ELSE 'shift'/);
  assert.match(migration, /programme_type IN \('capacity', 'shift', 'in_person'\)/);
  assert.match(migration, /onboarding_status IN \('invited', 'consultation_complete', 'active', 'paused'\)/);
  assert.match(migration, /UNIQUE \(client_id, month_start, call_slot\)/);
  assert.match(migration, /CURRENT_TIMESTAMP AT TIME ZONE 'Europe\/London'/);
  assert.match(migration, /programme_audiences <@ ARRAY\['capacity', 'shift', 'in_person'\]/);
  assert.match(migration, /increment_client_ai_monthly_usage/);
  assert.match(migration, /GRANT EXECUTE .* TO service_role/);
  assert.match(migration, /programme_type IN \('capacity', 'in_person'\)/);
});

test("voice notes are private, bounded and content-valid", async () => {
  const migration = await readFile(audioMigrationUrl, "utf8");
  assert.match(migration.replace(/\n/g, " "), /'inbox-audio'.*false/);
  assert.match(migration, /audio_size_bytes BETWEEN 1 AND 15728640/);
  assert.match(migration, /audio_duration_seconds BETWEEN 1 AND 180/);
  assert.doesNotMatch(migration, /CREATE POLICY "Clients can (?:upload|read) own inbox audio"/);
  assert.doesNotMatch(migration, /public\s*=\s*true/i);
});

test("voice recording is gated to native builds containing the microphone permission", () => {
  assert.equal(MINIMUM_NATIVE_VOICE_BUILD, 9);
  assert.equal(nativeBuildSupportsVoiceNotes("8"), false);
  assert.equal(nativeBuildSupportsVoiceNotes("9"), true);
  assert.equal(nativeBuildSupportsVoiceNotes(10), true);
  assert.equal(nativeBuildSupportsVoiceNotes(undefined), false);
  assert.equal(nativeBuildSupportsVoiceNotes("invalid"), false);
});

test("client activation is ordered, audited and idempotent", async () => {
  const route = await readFile(adminClientRouteUrl, "utf8");
  assert.match(route, /consultation must be completed before this client can go live/);
  assert.match(route, /updates\.activated_by = auth\.userId/);
  assert.match(route, /currentProfile\.onboarding_status !== "active"/);
});

test("SHIFT AI reserves usage only after context assembly and releases failed replies", async () => {
  const route = await readFile(portalAIRouteUrl, "utf8");
  assert.ok(route.indexOf("const messages =") < route.indexOf("await claimProgrammeAIInteraction"));
  assert.match(route, /releaseProgrammeAIInteraction/);
  assert.match(route, /MONTHLY_AI_LIMIT/);
});
