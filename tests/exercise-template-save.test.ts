import assert from "node:assert/strict";
import test from "node:test";
import type { ExerciseTemplate, ExerciseSessionItem } from "../lib/types";
import { exerciseRows, validateTemplate } from "../app/api/admin/exercise-templates/route";

const validExercise = "1242d031-d66c-4743-a89b-b961a21ee506";
function item(id: string, order: number): ExerciseSessionItem {
  return { id, session_id: "local-session", exercise_id: validExercise, order_index: order, sets: 3, reps: "10" };
}
function draft(items: ExerciseSessionItem[]): ExerciseTemplate {
  return {
    id: "", name: "Strength", category: "strength", is_active: true,
    sessions: [{ id: "local-session", name: "Day One", day_number: 1, items }],
    created_at: "", updated_at: "",
  };
}

test("invalid exercise rows are rejected before a template can be written", () => {
  assert.match(validateTemplate(draft([{ ...item("bad", 0), exercise_id: "__missing__" }])) || "", /invalid/);
  assert.match(validateTemplate(draft([{ ...item("bad", 0), reps: "" }])) || "", /valid target/);
  assert.equal(validateTemplate(draft([{ ...item("timed", 0), reps: "", prescription_type: "time", prescription_text: "12 min" }])), null);
  assert.equal(validateTemplate(draft([item("ok", 0)])), null);
});

test("section labels are attached to the first exercise only, including repeated exercises", () => {
  const section: ExerciseSessionItem = {
    ...item("section", 0), exercise_id: "__section__", section_label: "Strength A", sets: 0, reps: "",
  };
  const rows = exerciseRows([section, item("first", 1), item("second", 2)], "saved-session");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].section_label, "Strength A");
  assert.equal(rows[1].section_label, null);
  assert.equal(rows[0].session_id, "saved-session");
});
