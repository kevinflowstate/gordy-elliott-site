import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import WorkoutCircuitControls from "../components/portal/WorkoutCircuitControls";

const value = { set_number: 1, weight: "", reps: "", notes: "", completed: false, circuit_remaining_seconds: 300, circuit_duration_seconds: 360 };
const emomExercises = [{ name: "Swings", parity: "odd" as const }, { name: "Jumping jacks", parity: "even" as const }];

test("paused EMOM shows the active even-minute exercise and hides round logging", () => {
  const html = renderToStaticMarkup(createElement(WorkoutCircuitControls, { value, duration: 360, editing: false, emomExercises, onChange: () => {} }));
  assert.match(html, /EMOM controls/);
  assert.match(html, /Minute 2 of 6/);
  assert.match(html, /Jumping jacks/);
  assert.match(html, /60s until next minute/);
  assert.doesNotMatch(html, /\+ Round|Completed circuit rounds/);
});

test("resumed manually timed EMOM preserves its total duration and final state", () => {
  const html = renderToStaticMarkup(createElement(WorkoutCircuitControls, { value, duration: null, editing: false, emomExercises, onChange: () => {} }));
  assert.match(html, /Minute 2 of 6/);
  const finished = renderToStaticMarkup(createElement(WorkoutCircuitControls, { value: { ...value, circuit_remaining_seconds: 0 }, duration: 360, editing: false, emomExercises, onChange: () => {} }));
  assert.match(finished, /Time complete/);
  assert.doesNotMatch(finished, /until next minute/);
});

test("AMRAP retains rounds while saved EMOM editing does not invent elapsed minutes", () => {
  const circuit = renderToStaticMarkup(createElement(WorkoutCircuitControls, { value, duration: 360, editing: false, onChange: () => {} }));
  assert.match(circuit, /\+ Round/);
  const editing = renderToStaticMarkup(createElement(WorkoutCircuitControls, { value, duration: 360, editing: true, emomExercises, onChange: () => {} }));
  assert.doesNotMatch(editing, /Start timer|Minute 2|\+ Round/);
});
