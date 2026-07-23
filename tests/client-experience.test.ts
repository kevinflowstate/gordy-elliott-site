import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CLIENT_EXPERIENCE,
  isClientExperienceMode,
  isFounderExperience,
  isFounderRestrictedPath,
  normalizeClientExperienceMode,
} from "../lib/client-experience";

test("existing and invalid profiles default to the current AI coaching experience", () => {
  assert.equal(DEFAULT_CLIENT_EXPERIENCE, "ai_coaching");
  assert.equal(normalizeClientExperienceMode(undefined), "ai_coaching");
  assert.equal(normalizeClientExperienceMode("unexpected"), "ai_coaching");
});

test("only the two supported experience modes are accepted", () => {
  assert.equal(isClientExperienceMode("ai_coaching"), true);
  assert.equal(isClientExperienceMode("founder_dashboard"), true);
  assert.equal(isClientExperienceMode("founder"), false);
  assert.equal(isClientExperienceMode(null), false);
});

test("founder mode is explicit and never inferred from tier", () => {
  assert.equal(isFounderExperience("founder_dashboard"), true);
  assert.equal(isFounderExperience("ai_coaching"), false);
  assert.equal(isFounderExperience("vip"), false);
});

test("founder mode restricts client AI and DM routes only", () => {
  assert.equal(isFounderRestrictedPath("/portal/ai"), true);
  assert.equal(isFounderRestrictedPath("/portal/ai/history"), true);
  assert.equal(isFounderRestrictedPath("/portal/inbox"), true);
  assert.equal(isFounderRestrictedPath("/api/portal/ai"), true);
  assert.equal(isFounderRestrictedPath("/api/inbox/send"), true);
  assert.equal(isFounderRestrictedPath("/portal/daily-tracker"), false);
  assert.equal(isFounderRestrictedPath("/admin/ai"), false);
  assert.equal(isFounderRestrictedPath("/api/admin/inbox"), false);
});
