import type { ExerciseSession, ExerciseSessionItem } from "@/lib/types";

export interface WorkoutExercise {
  item: ExerciseSessionItem;
  section: string | null;
  blockID: string;
}
export interface WorkoutBlock {
  id: string;
  start: number;
  end: number;
  exercises: WorkoutExercise[];
  kind: "exercise" | "superset" | "circuit" | "amrap";
  durationSeconds: number | null;
}

// Only explicit AMRAP durations are inferred. Conflicting/missing durations stay unset.
export function amrapDuration(texts: string[]): number | null {
  const durations = new Set<number>();
  for (const text of texts) {
    for (const match of text.matchAll(/(?:\bamrap\s*[:—–-]?\s*(\d+(?:\.\d+)?)\s*[- ]?\s*(min(?:ute)?s?|m|sec(?:ond)?s?|s)\b|\b(\d+(?:\.\d+)?)\s*[- ]?\s*(min(?:ute)?s?|m|sec(?:ond)?s?|s)\s*[- ]?\s*amrap\b)/gi)) {
      const amount = Number(match[1] || match[3]);
      const unit = match[2] || match[4];
      const seconds = Math.round(amount * (/^m/i.test(unit) ? 60 : 1));
      if (seconds > 0 && seconds <= 7200) durations.add(seconds);
    }
  }
  return durations.size === 1 ? [...durations][0] : null;
}

export function buildWorkoutBlocks(session: ExerciseSession): WorkoutBlock[] {
  const blocks: WorkoutBlock[] = [];
  let section: string | null = null;
  let boundary = true;
  let previousGroup: string | null = null;
  let index = 0;
  for (const item of session.items) {
    if (item.exercise_id === "__section__") {
      section = item.section_label?.trim() || "Next section";
      boundary = true;
      continue;
    }
    // Also accept unreconstructed database rows; a label starts a new section.
    if (item.section_label) { section = item.section_label.trim(); boundary = true; }
    const group = item.superset_group?.trim() || null;
    const last = blocks.at(-1);
    const joins = last && !boundary && group && group === previousGroup;
    const block = joins ? last : {
      id: `${session.id}:${item.id}`, start: index, end: index,
      exercises: [], kind: "exercise" as const, durationSeconds: null,
    };
    block.exercises.push({ item, section, blockID: block.id });
    block.end = index++;
    if (!joins) blocks.push(block);
    previousGroup = group;
    boundary = false;
  }
  for (const block of blocks) {
    const texts = block.exercises.flatMap(({ item, section }) => [item.prescription_text || "", item.notes || "", section || ""]);
    const isAmrap = block.exercises.some(({ item }) => item.prescription_type === "amrap") || block.exercises.some(({ item, section }) => /\bamrap\b/i.test(`${item.prescription_text || ""} ${section || ""}`));
    block.kind = isAmrap ? "amrap" : block.exercises.length > 2 ? "circuit" : block.exercises.length === 2 ? "superset" : "exercise";
    block.durationSeconds = isAmrap ? amrapDuration(texts) : null;
  }
  return blocks;
}

export function blockForIndex(blocks: WorkoutBlock[], index: number) {
  return blocks.find(block => index >= block.start && index <= block.end);
}
