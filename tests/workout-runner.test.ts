import assert from "node:assert/strict";
import test from "node:test";
import { copyFirstWorkoutSetValues, type WorkoutSetData } from "../lib/workout-runner";

function set(setNumber: number, values: Partial<WorkoutSetData> = {}): WorkoutSetData {
  return {
    set_number: setNumber,
    weight: "",
    reps: "",
    notes: "",
    completed: false,
    ...values,
  };
}

test("apply set 1 copies weight and reps without changing completion or notes", () => {
  const result = copyFirstWorkoutSetValues([
    set(1, { weight: "60", reps: "8", notes: "First set", completed: true }),
    set(2, { notes: "Keep this note", completed: false }),
    set(3, { weight: "50", reps: "10", completed: true }),
  ]);

  assert.deepEqual(result.map(({ weight, reps }) => ({ weight, reps })), [
    { weight: "60", reps: "8" },
    { weight: "60", reps: "8" },
    { weight: "60", reps: "8" },
  ]);
  assert.equal(result[1].notes, "Keep this note");
  assert.equal(result[1].completed, false);
  assert.equal(result[2].completed, true);
});

test("apply set 1 is a no-op for an empty or single-set exercise", () => {
  const single = [set(1, { weight: "20", reps: "12" })];
  assert.equal(copyFirstWorkoutSetValues(single), single);
  assert.deepEqual(copyFirstWorkoutSetValues([]), []);
});
