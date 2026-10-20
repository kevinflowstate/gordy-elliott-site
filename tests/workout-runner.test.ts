import assert from "node:assert/strict";
import test from "node:test";
import {
  copyFirstWorkoutSetValues,
  removeExtraWorkoutSet,
  workoutSetHasValues,
  nextWorkoutExerciseIndex,
  workoutSetProgress,
  type WorkoutSetData,
} from "../lib/workout-runner";

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

test("workout overview reports completed sets without treating an empty exercise as done", () => {
  assert.deepEqual(workoutSetProgress([
    set(1, { completed: true }),
    set(2),
    set(3, { completed: true }),
  ]), {
    completed: 2,
    total: 3,
    done: false,
  });
  assert.deepEqual(workoutSetProgress([]), {
    completed: 0,
    total: 0,
    done: false,
  });
});

test("up-next navigation stops cleanly at the final exercise", () => {
  assert.equal(nextWorkoutExerciseIndex(0, 5), 1);
  assert.equal(nextWorkoutExerciseIndex(3, 5), 4);
  assert.equal(nextWorkoutExerciseIndex(4, 5), null);
  assert.equal(nextWorkoutExerciseIndex(0, 0), null);
});

test("removing an extra set preserves prescribed values, reindexes later extras and survives serialisation", () => {
  const original = [set(1, {weight:"60",reps:"8",completed:true}),set(2),set(3),set(4,{notes:"accidental"}),set(5,{weight:"65",completed:true})];
  const removed = removeExtraWorkoutSet(original,3,3);
  assert.equal(removed.length,4);
  assert.deepEqual(removed[0],original[0]);
  assert.deepEqual(removed[3],{...original[4],set_number:4});
  assert.deepEqual(JSON.parse(JSON.stringify(removed)),removed);
  assert.equal(original.length,5);
});
test("prescribed sets and invalid indexes cannot be removed",()=>{
  const sets=[set(1),set(2),set(3),set(4)];
  for(const index of [-1,0,1,2,4,NaN,3.5]) assert.equal(removeExtraWorkoutSet(sets,index,3),sets);
  assert.equal(removeExtraWorkoutSet([set(1)],0,0).length,1);
});
test("filled and completed extra sets require confirmation, blank extras do not",()=>{
  assert.equal(workoutSetHasValues(set(4)),false);
  for(const change of [{weight:"0"},{reps:"5"},{notes:"keep"},{completed:true}]) assert.equal(workoutSetHasValues(set(4,change)),true);
});
