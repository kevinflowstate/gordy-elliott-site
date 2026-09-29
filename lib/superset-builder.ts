import type { ExerciseSessionItem } from "./types";

function sectionBounds(items: ExerciseSessionItem[], index: number): [number, number] {
  let start = index;
  let end = index + 1;
  while (start > 0 && items[start - 1].exercise_id !== "__section__") start--;
  while (end < items.length && items[end].exercise_id !== "__section__") end++;
  return [start, end];
}

export function canLinkSuperset(items: ExerciseSessionItem[], index: number): boolean {
  return items[index]?.exercise_id !== "__section__" &&
    !!items[index]?.exercise_id &&
    !!items[index + 1]?.exercise_id &&
    items[index + 1].exercise_id !== "__section__";
}

export function toggleSupersetPair(
  items: ExerciseSessionItem[],
  index: number,
  newId: () => string,
): ExerciseSessionItem[] {
  if (!canLinkSuperset(items, index)) return items;
  const result = items.map((item) => ({ ...item }));
  const [start, end] = sectionBounds(result, index);
  const leftGroup = result[index].superset_group;
  const rightGroup = result[index + 1].superset_group;

  if (leftGroup && leftGroup === rightGroup) {
    // Break the link, keeping each contiguous side together if it still has a pair.
    let leftStart = index;
    while (leftStart > start && result[leftStart - 1].superset_group === leftGroup) leftStart--;
    let rightEnd = index + 2;
    while (rightEnd < end && result[rightEnd].superset_group === rightGroup) rightEnd++;
    if (index === leftStart) result[index].superset_group = undefined;
    if (rightEnd === index + 2) result[index + 1].superset_group = undefined;
    else {
      const splitId = newId();
      for (let i = index + 1; i < rightEnd; i++) result[i].superset_group = splitId;
    }
    return result;
  }

  const mergedId = leftGroup || rightGroup || newId();
  let leftStart = index;
  while (leftStart > start && leftGroup && result[leftStart - 1].superset_group === leftGroup) leftStart--;
  let rightEnd = index + 2;
  while (rightEnd < end && rightGroup && result[rightEnd].superset_group === rightGroup) rightEnd++;
  for (let i = leftStart; i < rightEnd; i++) result[i].superset_group = mergedId;
  return result;
}

export function supersetPosition(items: ExerciseSessionItem[], index: number): string | null {
  const group = items[index]?.superset_group;
  if (!group || items[index].exercise_id === "__section__") return null;
  const [start, end] = sectionBounds(items, index);
  const members: number[] = [];
  for (let i = start; i < end; i++) {
    if (items[i].superset_group === group) members.push(i);
  }
  return members.length > 1 ? `SS ${members.indexOf(index) + 1}/${members.length}` : null;
}

export function normaliseSupersetGroups(items: ExerciseSessionItem[], newId: () => string): ExerciseSessionItem[] {
  const result = items.map((item) => ({ ...item }));
  const seen = new Set<string>();
  for (let start = 0; start < result.length;) {
    const group = result[start].exercise_id === "__section__" ? undefined : result[start].superset_group;
    if (!group) {
      result[start].superset_group = undefined;
      start++;
      continue;
    }
    let end = start + 1;
    while (end < result.length && result[end].exercise_id !== "__section__" && result[end].superset_group === group) end++;
    const safeGroup = seen.has(group) ? newId() : group;
    for (let i = start; i < end; i++) result[i].superset_group = end - start > 1 ? safeGroup : undefined;
    seen.add(group);
    start = end;
  }
  return result;
}
