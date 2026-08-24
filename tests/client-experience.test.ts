import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CLIENT_EXPERIENCE,
  isClientExperienceMode,
  isFounderExperience,
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
