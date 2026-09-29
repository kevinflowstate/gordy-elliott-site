import assert from "node:assert/strict";
import test from "node:test";
import type { ExerciseSessionItem } from "../lib/types";
import { canLinkSuperset, normaliseSupersetGroups, supersetPosition, toggleSupersetPair } from "../lib/superset-builder";

function exercise(id: string): ExerciseSessionItem {
  return { id, session_id: "s", exercise_id: id, order_index: 0, sets: 3, reps: "10" };
}
function section(): ExerciseSessionItem {
  return { ...exercise("divider"), exercise_id: "__section__", section_label: "Next" };
}

test("superset links stop at section dividers", () => {
  const items = [exercise("a"), section(), exercise("b")];
  assert.equal(canLinkSuperset(items, 0), false);
  assert.equal(canLinkSuperset(items, 1), false);
  assert.deepEqual(toggleSupersetPair(items, 0, () => "group"), items);
});

test("moving an exercise across a section removes an invalid one-item group", () => {
  const items = [
    { ...exercise("a"), superset_group: "same" },
    section(),
    { ...exercise("b"), superset_group: "same" },
    { ...exercise("c"), superset_group: "same" },
  ];
  const result = normaliseSupersetGroups(items, () => "new");
  assert.equal(result[0].superset_group, undefined);
  assert.equal(result[1].superset_group, undefined);
  assert.equal(result[2].superset_group, result[3].superset_group);
});

test("adjacent links form and split a four-exercise group", () => {
  let items = [exercise("a"), exercise("b"), exercise("c"), exercise("d"), section(), exercise("e")];
  let next = 0;
  const id = () => `group-${++next}`;
  items = toggleSupersetPair(items, 0, id);
  items = toggleSupersetPair(items, 2, id);
  items = toggleSupersetPair(items, 1, id);
  assert.equal(new Set(items.slice(0, 4).map((item) => item.superset_group)).size, 1);
  assert.deepEqual(items.slice(0, 4).map((_, index) => supersetPosition(items, index)), ["SS 1/4", "SS 2/4", "SS 3/4", "SS 4/4"]);
  assert.equal(items[5].superset_group, undefined);

  items = toggleSupersetPair(items, 1, id);
  assert.equal(items[0].superset_group, items[1].superset_group);
  assert.equal(items[2].superset_group, items[3].superset_group);
  assert.notEqual(items[1].superset_group, items[2].superset_group);
  assert.equal(supersetPosition(items, 2), "SS 1/2");
});
