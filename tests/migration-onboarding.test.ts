import assert from "node:assert/strict";
import test from "node:test";
import { assertMigrationRetryWindow, previewMigrationEmail, validateLiveMigrationClient, validateMigrationCohort } from "../lib/migration-onboarding";

function client(index = 0) {
  const email = `person${index}@example.com`;
  return {
    id: `profile-${index}`, user_id: `user-${index}`,
    user: { id: `user-${index}`, email, role: "client", full_name: "Alex Example" },
    auth_email: previewMigrationEmail(email), last_sign_in_at: null,
    metadata: { role: "client", app_name: "gordy-elliott-portal", preview_import_frozen: true },
  };
}
function live(snapshot = client()) {
  return {
    profile: { id: snapshot.id, user_id: snapshot.user_id, lifecycle_status: "access_frozen", onboarding_status: "invited", user: snapshot.user },
    auth: { id: snapshot.user_id, email: snapshot.auth_email, last_sign_in_at: null as string | null, user_metadata: { ...snapshot.metadata } as Record<string, unknown> },
  };
}

test("cohort must be exactly 54 unique verified frozen import identities", () => {
  const cohort = Array.from({ length: 54 }, (_, index) => client(index));
  assert.doesNotThrow(() => validateMigrationCohort(cohort));
  assert.throws(() => validateMigrationCohort(cohort.slice(1)), /54/);
  assert.throws(() => validateMigrationCohort([...cohort.slice(1), cohort[1]]), /duplicate/);
  const bad = structuredClone(cohort);
  bad[0].user.role = "admin";
  assert.throws(() => validateMigrationCohort(bad), /unverified/);
  bad[0] = client(); bad[0].metadata.preview_import_frozen = false;
  assert.throws(() => validateMigrationCohort(bad), /unverified/);
});

test("live identity binding rejects changed email, cross-account profile, or wrong metadata", () => {
  const snapshot = client();
  const current = live(snapshot);
  assert.equal(validateLiveMigrationClient(snapshot, current.profile, current.auth), "frozen");
  assert.throws(() => validateLiveMigrationClient(snapshot, { ...current.profile, user_id: "someone-else" }, current.auth), /identity/);
  assert.throws(() => validateLiveMigrationClient(snapshot, current.profile, { ...current.auth, id: "someone-else" }), /identity/);
  assert.throws(() => validateLiveMigrationClient(snapshot, current.profile, { ...current.auth, user_metadata: { ...current.auth.user_metadata, app_name: "another-app" } }), /identity/);
});

test("an imported client with active profile but frozen auth is eligible only before first sign-in", () => {
  const snapshot = client(); const current = live(snapshot);
  current.profile.lifecycle_status = "active";
  assert.equal(validateLiveMigrationClient(snapshot, current.profile, current.auth), "frozen");
  current.auth.last_sign_in_at = "2026-10-05T12:00:00Z";
  assert.throws(() => validateLiveMigrationClient(snapshot, current.profile, current.auth), /already signed in/);
});

test("auth promotion can resume while the profile remains frozen", () => {
  const snapshot = client(); const current = live(snapshot);
  current.auth.email = snapshot.user.email;
  current.auth.user_metadata.preview_activation_pending = true;
  assert.equal(validateLiveMigrationClient(snapshot, current.profile, current.auth), "pending");
});

test("fully activated client requires campaign ledger evidence and active onboarding", () => {
  const snapshot = client(); const current = live(snapshot);
  current.auth.email = snapshot.user.email;
  current.auth.user_metadata.preview_import_frozen = false;
  current.auth.user_metadata.preview_activation_pending = false;
  current.profile.lifecycle_status = "active"; current.profile.onboarding_status = "active";
  assert.throws(() => validateLiveMigrationClient(snapshot, current.profile, current.auth), /not a frozen/);
  assert.equal(validateLiveMigrationClient(snapshot, current.profile, current.auth, { activationStartedAt: "2026-10-05T12:00:00Z" }), "activated");
  current.profile.onboarding_status = "invited";
  assert.throws(() => validateLiveMigrationClient(snapshot, current.profile, current.auth, { activationStartedAt: "2026-10-05T12:00:00Z" }), /not a frozen/);
});

test("uncertain sends cannot retry after provider deduplication expires", () => {
  const started = Date.parse("2026-10-05T12:00:00Z");
  const entry = { status: "unknown_or_rejected", sendStartedAt: new Date(started).toISOString() };
  assert.doesNotThrow(() => assertMigrationRetryWindow(entry, started + 1000));
  assert.throws(() => assertMigrationRetryWindow(entry, started + 23 * 60 * 60 * 1000), /manual review/);
  assert.throws(() => assertMigrationRetryWindow({ ...entry, sendStartedAt: "invalid" }, started), /manual review/);
  assert.doesNotThrow(() => assertMigrationRetryWindow({ ...entry, status: "accepted" }, started + 48 * 60 * 60 * 1000));
});
