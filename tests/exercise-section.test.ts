import assert from "node:assert/strict";
import test from "node:test";
import { createExerciseSectionDivider } from "../lib/exercise-section";
import { buildWorkoutBlocks } from "../lib/workout-groups";
import type { ExerciseSessionItem } from "../lib/types";

test("API headings retain section identity without inheriting exercise prescriptions or groups", () => {
  const source = {
    id: "first-exercise", session_id: "session", exercise_id: "exercise-uuid",
    order_index: 2, section_label: "Finisher", sets: 4, reps: "8",
    rest_seconds: 60, tempo: "2-0-1-0", notes: "Exercise-specific cue",
    superset_group: "C", prescription_type: "custom", prescription_text: "6-min AMRAP",
    exercise: { name: "Swing", video_url: "https://example.com/video" },
  };
  const before = structuredClone(source);
  const heading = createExerciseSectionDivider(source);
  assert.equal(heading.id, "section-first-exercise");
  assert.equal(heading.session_id, "session");
  assert.equal(heading.section_label, "Finisher");
  assert.equal(heading.order_index, 1.5);
  assert.equal(heading.exercise_id, "__section__");
  assert.equal(heading.sets, 0);
  assert.equal(heading.reps, "");
  for (const field of ["superset_group", "prescription_type", "prescription_text", "rest_seconds", "tempo", "notes", "exercise"] as const) {
    assert.equal(heading[field], null);
  }
  assert.deepEqual(source, before, "GET reconstruction must not alter real exercise rows");
});

test("clean headings preserve workout groups and separate sections without becoming exercises", () => {
  const first: ExerciseSessionItem & { section_label: string } = {
    id: "a", session_id: "session", exercise_id: "uuid-a", order_index: 0,
    section_label: "Strength", sets: 3, reps: "8", superset_group: "A",
  };
  const second = { ...first, id: "b", exercise_id: "uuid-b", order_index: 1, section_label: undefined };
  const third = { ...first, id: "c", exercise_id: "uuid-c", order_index: 2, section_label: "Finisher" };
  const fourth = { ...second, id: "d", exercise_id: "uuid-d", order_index: 3 };
  // API section rows have nullable metadata, unlike persisted exercise items.
  const headings = [first, third].map((row) => createExerciseSectionDivider(row) as unknown as ExerciseSessionItem);
  const items = [headings[0], first, second, headings[1], third, fourth];
  const blocks = buildWorkoutBlocks({ id: "session", name: "Training", day_number: 1, items });
  assert.deepEqual(blocks.map((block) => block.exercises.map((exercise) => exercise.item.id)), [["a", "b"], ["c", "d"]]);
  assert.equal(items.filter((row) => row.exercise_id !== "__section__").length, 4);
});
