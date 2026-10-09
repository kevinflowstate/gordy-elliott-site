import assert from "node:assert/strict";
import test from "node:test";
import { normalizeConsultationConfig } from "@/lib/consultation-form";
import { BOARDROOM_EXCLUDED_FIELDS, buildBoardroomConsultationSummary, validateConsultationAnswers } from "@/lib/boardroom-consultation";

test("Boardroom fallback contains all eleven business sections and no health fields", () => {
  const config = normalizeConsultationConfig(null, "boardroom");
  assert.equal(config.title, "Boardroom Consultation");
  assert.equal(new Set(config.questions.map(q => q.placeholder)).size, 11);
  for (const q of config.questions) assert.equal(BOARDROOM_EXCLUDED_FIELDS.has(q.id), false);
  assert.ok(config.questions.some(q => q.id === "business_90_win"));
  assert.ok(config.questions.some(q => q.id === "business_checkin_day"));
});
test("Boardroom edits remain separate and do not reinsert disabled or removed fitness/default questions", () => {
  const config = normalizeConsultationConfig({ title: "My business form", questions: [{ id: "custom", label: "Your target", placeholder: "", type: "text", required: true }, { id: "date_of_birth", label: "DOB", placeholder: "", type: "text" }] }, "boardroom");
  assert.equal(config.title, "My business form");
  assert.deepEqual(config.questions.map(q => q.id), ["custom"]);
  assert.equal(validateConsultationAnswers(config, {}), "Your target is required");
  assert.equal(validateConsultationAnswers(config, { custom: "  " }), "Your target is required");
  assert.equal(validateConsultationAnswers(config, { custom: "More time" }), null);
});
test("fitness fallback and merged config retain previous defaults", () => {
  assert.ok(normalizeConsultationConfig(null).questions.some(q => q.id === "date_of_birth"));
  assert.ok(normalizeConsultationConfig({ questions: [] }, "shift").questions.some(q => q.id === "primary_goal"));
});
test("business summary includes real business answers without invented insights or fitness fields", () => {
  const summary = buildBoardroomConsultationSummary({ business_turnover: "£100,000", business_problems: "Admin", sex: "male", privacy_consent: true });
  assert.equal(summary.generated_by, "deterministic");
  assert.deepEqual(summary.business_profile, { business_turnover: "£100,000", business_problems: "Admin" });
});
test("enabled required answers and configured choices validated", () => {
  const config = { questions: [{ id: "day", label: "Day", placeholder: "", type: "select" as const, options: ["Monday"], required: true }, { id: "disabled", label: "Disabled", placeholder: "", type: "text" as const, required: true, enabled: false }] };
  assert.equal(validateConsultationAnswers(config, { day: "Monday" }), null);
  assert.equal(validateConsultationAnswers(config, { day: "Tuesday" }), "Choose a valid option for Day");
  assert.equal(validateConsultationAnswers(config, { day: { bad: true } }), "Invalid answer for Day");
});
