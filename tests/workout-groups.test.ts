import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkoutBlocks, amrapDuration, emomDuration, emomMinuteParity, emomMinuteProgress, blockForIndex } from "../lib/workout-groups";
import { buildNativeWorkoutLaunchPayload } from "../lib/native-workout";
import { sanitiseSets } from "../lib/workout-log-input";
import type { ExerciseSession, ExerciseSessionItem } from "../lib/types";
const item = (id: string, group?: string, extra: Partial<ExerciseSessionItem> = {}): ExerciseSessionItem => ({ id, session_id: "s", exercise_id: id, order_index: 0, sets: 3, reps: "8", superset_group: group, ...extra });
const session = (items: ExerciseSessionItem[]): ExerciseSession => ({ id: "s", name: "Training", day_number: 1, items });

test("pairs and circuits group contiguously without swallowing singles or repeated labels", () => {
  const blocks = buildWorkoutBlocks(session([item("a", "A"), item("b", "A"), item("c"), item("d", "A"), item("e", "A"), item("f", "B"), item("g", "B"), item("h", "B")]));
  assert.deepEqual(blocks.map(b => [b.kind, b.start, b.end]), [["superset",0,1],["exercise",2,2],["superset",3,4],["circuit",5,7]]);
  assert.equal(blockForIndex(blocks, 4)?.start, 3);
  assert.equal(blockForIndex(blocks, 7)?.end, 7);
});
test("section dividers and raw section labels both prevent cross-section grouping", () => {
  for (const items of [
    [item("a","A"),item("divider",undefined,{exercise_id:"__section__",section_label:"Finisher"}),item("b","A")],
    [item("a","A"),item("b","A",{section_label:"Finisher"})],
  ]) assert.equal(buildWorkoutBlocks(session(items)).length, 2);
});
test("AMRAP duration comes from explicit prescriptions; conflicts and rep counts are not timer lengths", () => {
  assert.equal(amrapDuration(["6-min AMRAP · 6 reps", "6-min AMRAP · 20 m"]),360);
  assert.equal(amrapDuration(["AMRAP 90 seconds"]),90);
  assert.equal(amrapDuration(["AMRAP 6 reps", "20 m carry"]),null);
  assert.equal(amrapDuration(["6 min AMRAP", "8 min AMRAP"]),null);
  const blocks=buildWorkoutBlocks(session([item("a","A",{prescription_type:"custom",prescription_text:"6-min AMRAP · 6 reps"}),item("b","A",{prescription_text:"6-min AMRAP · 20 m"}),item("c","A")]));
  assert.equal(blocks[0].kind,"amrap");assert.equal(blocks[0].durationSeconds,360);
});
test("alternating six-minute EMOM stays together and carries the minute schedule to native", () => {
  const s = session([
    item("heading", undefined, { exercise_id: "__section__", section_label: "Finisher" }),
    item("swings", "E", { sets: 1, prescription_type: "custom", prescription_text: "6-min EMOM · odd minutes · 10 swings" }),
    item("jacks", "E", { sets: 1, prescription_type: "custom", prescription_text: "6-min EMOM · even minutes · 20 reps" }),
  ]);
  const blocks = buildWorkoutBlocks(s);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, "emom");
  assert.equal(blocks[0].durationSeconds, 360);
  assert.deepEqual(blocks[0].exercises.map(({ item }) => item.id), ["swings", "jacks"]);
  const payload = buildNativeWorkoutLaunchPayload({ session: s, date: "2026-10-05", dateLabel: "Today", mode: "workout", sets: {}, startedAt: null });
  assert.deepEqual(payload.session.exercises.map(e => [e.id, e.groupKind, e.emomMinuteParity, e.durationSeconds, e.usesSetLogging]), [
    ["swings", "emom", "odd", 360, false], ["jacks", "emom", "even", 360, false],
  ]);
});
test("custom prescriptions remain ordinary exercises unless EMOM is explicit; ambiguous times do not invent a timer", () => {
  assert.equal(buildWorkoutBlocks(session([item("a", "A", { prescription_type: "custom", prescription_text: "10 swings" }), item("b", "A", { prescription_type: "custom", prescription_text: "20 reps" })]))[0].kind, "superset");
  assert.equal(emomDuration(["EMOM · 10 reps", "20 reps"]), null);
  assert.equal(emomDuration(["6-min EMOM", "8-min EMOM"]), null);
  assert.equal(emomDuration(["EMOM: 6 minutes"]), 360);
  assert.equal(emomMinuteParity("odd minutes · 10 swings"), "odd");
  assert.equal(emomMinuteParity("even minutes · 20 reps"), "even");
  assert.equal(emomMinuteParity("odd minutes and even minutes"), null);
});
test("EMOM minute clock advances at minute boundaries and resumes from saved remaining time", () => {
  assert.deepEqual(emomMinuteProgress(360, 360), { minute: 1, minuteCount: 6, minuteRemaining: 60, parity: "odd", complete: false });
  assert.deepEqual(emomMinuteProgress(360, 301), { minute: 1, minuteCount: 6, minuteRemaining: 1, parity: "odd", complete: false });
  assert.deepEqual(emomMinuteProgress(360, 300), { minute: 2, minuteCount: 6, minuteRemaining: 60, parity: "even", complete: false });
  assert.deepEqual(emomMinuteProgress(360, 239), { minute: 3, minuteCount: 6, minuteRemaining: 59, parity: "odd", complete: false });
  assert.deepEqual(emomMinuteProgress(360, 0), { minute: 6, minuteCount: 6, minuteRemaining: 0, parity: "even", complete: true });
  assert.deepEqual(emomMinuteProgress(90, 30), { minute: 2, minuteCount: 2, minuteRemaining: 30, parity: "even", complete: false });
});
test("native bridge retains grouping, video URLs and original per-exercise log IDs", () => {
  const s=session([item("a","A",{prescription_type:"amrap",prescription_text:"AMRAP 6 min",exercise:{id:"a",name:"Demo",muscle_group:"Legs",equipment:"Bodyweight",is_active:true,created_at:"",video_url:"https://www.youtube.com/watch?v=iczbNSZEGIU"}}),item("b","A")]);
  const payload=buildNativeWorkoutLaunchPayload({session:s,date:"2026-10-01",dateLabel:"Today",mode:"workout",sets:{},startedAt:null});
  assert.deepEqual(payload.session.exercises.map(e=>e.id),["a","b"]);
  assert.equal(payload.session.exercises[0].groupID,payload.session.exercises[1].groupID);
  assert.equal(payload.session.exercises[0].durationSeconds,360);
  assert.equal(payload.session.exercises[0].demoURL,"https://www.youtube.com/watch?v=iczbNSZEGIU");
});
test("round count survives server sanitisation without overwriting reps, notes or accepting invalid values", () => {
  const input={set_number:1,weight:"20",reps:"6",notes:"Controlled",completed:true,circuit_rounds:4,circuit_ends_at:123456,circuit_remaining_seconds:300,circuit_duration_seconds:360};
  assert.deepEqual(sanitiseSets([input]),[{set_number:1,weight:"20",reps:"6",notes:"Controlled",completed:true,circuit_rounds:4}]);
  for(const rounds of [-1,1.5,10000,"3",null]) assert.equal(sanitiseSets([{...input,circuit_rounds:rounds}])?.[0].circuit_rounds,undefined);
  assert.equal(sanitiseSets([{...input,circuit_rounds:0}])?.[0].circuit_rounds,0);
});
