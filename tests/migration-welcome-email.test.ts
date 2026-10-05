import assert from "node:assert/strict";
import test from "node:test";
import { assertEmailAccepted, buildMigrationWelcomeEmail, MIGRATION_EMAIL_LINKS } from "../lib/migration-welcome-email";

const setupUrl = "https://app.onlinegordy.com/auth/callback?token_hash=synthetic-preview-only&type=recovery&redirect=%2Fportal%2Fsettings%3Fsetup%3Dtrue";

test("migration email contains approved account, iPhone, web and feedback destinations in both formats", () => {
  const message = buildMigrationWelcomeEmail("Alex Example", setupUrl);
  assert.match(message.text, /Hi Alex,/);
  assert.match(message.text, /last week on the old app/);
  assert.match(message.text, /same email and password/);
  assert.match(message.text, /web app for workouts containing supersets or circuits/);
  for (const href of Object.values(MIGRATION_EMAIL_LINKS)) {
    assert.ok(message.text.includes(href));
    assert.ok(message.html.includes(`href="${href}"`));
  }
  assert.ok(message.text.includes(setupUrl));
  assert.ok(message.html.includes(setupUrl.replaceAll("&", "&amp;")));
});

test("recipient names cannot insert markup and blank names use a fallback", () => {
  const message = buildMigrationWelcomeEmail('<img src="x"> Example', setupUrl);
  assert.ok(!message.html.includes("<img"));
  assert.match(message.html, /&lt;img/);
  assert.match(buildMigrationWelcomeEmail("  ", setupUrl).text, /Hi there,/);
});

test("migration invitations reject an unsafe or wrong-environment setup destination", () => {
  for (const url of ["javascript:alert(1)", "https://preview.vercel.app/auth/callback", "http://app.onlinegordy.com/auth/callback"]) {
    assert.throws(() => buildMigrationWelcomeEmail("Alex", url));
  }
});

test("provider rejection and a missing email ID never count as accepted sends", () => {
  assert.throws(() => assertEmailAccepted({ data: null, error: { message: "Domain not verified" } }), /Domain not verified/);
  assert.throws(() => assertEmailAccepted({ data: null, error: null }), /not accepted/);
  assert.equal(assertEmailAccepted({ data: { id: "synthetic-id" }, error: null }), "synthetic-id");
});
