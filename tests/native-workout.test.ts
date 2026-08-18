import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNativeWorkoutLaunchPayload,
  prepareNativeWorkoutSyncPayload,
} from "../lib/native-workout";
import type { ExerciseSession } from "../lib/types";

const session: ExerciseSession = {
  id: "session-1",
  name: "Strength A",
  day_number: 1,
  notes: "Leave one clean rep in reserve.",
  items: [
    {
      id: "section-main",
      session_id: "session-1",
      exercise_id: "__section__",
      order_index: 0,
      sets: 0,
      reps: "",
      section_label: "Main strength",
    },
    {
      id: "squat-item",
      session_id: "session-1",
      exercise_id: "squat",
      order_index: 1,
      sets: 3,
      reps: "6",
      rest_seconds: 90,
      notes: "Control the descent.",
      exercise: {
        id: "squat",
        name: "Back Squat",
        muscle_group: "Legs",
        equipment: "Barbell",
        is_active: true,
        created_at: "2026-08-18T00:00:00Z",
      },
    },
    {
      id: "plank-item",
      session_id: "session-1",
      exercise_id: "plank",
      order_index: 2,
      sets: 1,
      reps: "",
      prescription_type: "time",
      prescription_text: "30 sec each side",
      exercise: {
        id: "plank",
        name: "Side Plank",
        muscle_group: "Core",
        equipment: "Bodyweight",
        is_active: true,
        created_at: "2026-08-18T00:00:00Z",
      },
    },
  ],
};

test("native launch payload removes section rows and carries their label forward", () => {
  const sets = {
    "squat-item": [{ set_number: 1, weight: "82.5", reps: "6", notes: "", completed: true }],
    "plank-item": [{ set_number: 1, weight: "", reps: "30 sec", notes: "", completed: false }],
  };
  const payload = buildNativeWorkoutLaunchPayload({
    session,
    date: "2026-08-18",
    dateLabel: "Today",
    mode: "workout",
    sets,
    startedAt: 1_776_508_800_000,
  });

  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.session.exercises.length, 2);
  assert.deepEqual(payload.session.exercises.map(({ id, section }) => ({ id, section })), [
    { id: "squat-item", section: "Main strength" },
    { id: "plank-item", section: "Main strength" },
  ]);
  assert.equal(payload.session.exercises[0].prescription, "3 x 6");
  assert.equal(payload.session.exercises[0].usesSetLogging, true);
  assert.equal(payload.session.exercises[1].prescription, "30 sec each side");
  assert.equal(payload.session.exercises[1].usesSetLogging, false);
  assert.equal(payload.startedAt, 1_776_508_800_000);
  assert.equal(payload.sets, sets);
});

test("native launch payload keeps edit mode and provides safe exercise fallbacks", () => {
  const payload = buildNativeWorkoutLaunchPayload({
    session: {
      ...session,
      notes: undefined,
      items: [{
        id: "missing-exercise",
        session_id: "session-1",
        exercise_id: "unknown",
        order_index: 0,
        sets: 0,
        reps: "",
        prescription_type: "custom",
        prescription_text: "Coach prescribed",
      }],
    },
    date: "2026-08-17",
    dateLabel: "Yesterday",
    mode: "edit",
    sets: {},
    startedAt: null,
  });

  assert.equal(payload.mode, "edit");
  assert.equal(payload.session.notes, null);
  assert.equal(payload.session.exercises[0].name, "Exercise");
  assert.equal(payload.session.exercises[0].section, null);
  assert.equal(payload.session.exercises[0].prescription, "Coach prescribed");
});

test("offline workout sync drops a stale start timestamp instead of retrying forever", () => {
  const payload = {
    session_id: "session-1",
    date: "2026-08-18",
    session_started_at: "2026-08-18T08:00:00.000Z",
    entries: [],
  };

  assert.equal(
    prepareNativeWorkoutSyncPayload(payload, Date.parse("2026-08-18T13:59:00.000Z")),
    payload,
  );
  assert.deepEqual(
    prepareNativeWorkoutSyncPayload(payload, Date.parse("2026-08-18T14:01:00.000Z")),
    { ...payload, session_started_at: null },
  );
});
