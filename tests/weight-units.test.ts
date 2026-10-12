import assert from "node:assert/strict";
import test from "node:test";
import { checkinConfigForWeightUnit, convertWeightInput, weightToKg, weightFromKg, isWeightUnit } from "../lib/weight-units";
import { buildFallbackCheckinConfig } from "../lib/checkin-form";
import { dashboardWeightHistory } from "../lib/admin-dashboard";
test("kg/lb round trips keep one canonical weight; changing input units converts the value", () => {
  assert.equal(weightToKg(100, "lb"), 45.359237);
  assert.ok(Math.abs(weightFromKg(weightToKg(180, "lb"), "lb") - 180) < 0.00001);
  assert.equal(convertWeightInput("80", "kg", "lb"), "176.4");
  assert.equal(convertWeightInput("", "kg", "lb"), "");
  assert.equal(isWeightUnit("stone"), false);
});
test("unit preference makes a new config without reinterpreting the saved snapshot", () => {
  const original = buildFallbackCheckinConfig();
  const pounds = checkinConfigForWeightUnit(original, "lb");
  assert.equal(pounds.progress_tracking?.find(m => m.id === "weight")?.unit, "lb");
  assert.equal(original.progress_tracking?.find(m => m.id === "weight")?.unit, "kg");
  const business = buildFallbackCheckinConfig("boardroom");
  assert.equal(checkinConfigForWeightUnit(business, "lb"), business);
});
test("coach trend normalizes explicitly labelled pounds and leaves legacy kg values unchanged", () => {
  const history = dashboardWeightHistory([
    { id: "old", created_at: "2026-10-01T12:00:00Z", responses: { weight: "80" } },
    { id: "new", created_at: "2026-10-08T12:00:00Z", responses: { weight: "176.3698097", weight_unit: "lb" } },
  ]);
  assert.equal(history[0].value, 80);
  assert.ok(Math.abs(history[1].value - 80) < 0.000001);
});
