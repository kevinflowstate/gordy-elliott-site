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
  kind: "exercise" | "superset" | "circuit" | "amrap" | "emom";
  durationSeconds: number | null;
}

// Only durations next to the circuit name count. Rep counts and conflicting durations stay unset.
function timedCircuitDuration(texts: string[], kind: "amrap" | "emom"): number | null {
  const durations = new Set<number>();
  const pattern = new RegExp(`(?:\\b${kind}\\s*[:—–-]?\\s*(\\d+(?:\\.\\d+)?)\\s*[- ]?\\s*(min(?:ute)?s?|m|sec(?:ond)?s?|s)\\b|\\b(\\d+(?:\\.\\d+)?)\\s*[- ]?\\s*(min(?:ute)?s?|m|sec(?:ond)?s?|s)\\s*[- ]?\\s*${kind}\\b)`, "gi");
  for (const text of texts) {
    for (const match of text.matchAll(pattern)) {
      const amount = Number(match[1] || match[3]);
      const unit = match[2] || match[4];
      const seconds = Math.round(amount * (/^m/i.test(unit) ? 60 : 1));
      if (seconds > 0 && seconds <= 7200) durations.add(seconds);
    }
  }
  return durations.size === 1 ? [...durations][0] : null;
}

export function amrapDuration(texts: string[]): number | null {
  return timedCircuitDuration(texts, "amrap");
}

export function emomDuration(texts: string[]): number | null {
  return timedCircuitDuration(texts, "emom");
}

export function emomMinuteParity(text: string): "odd" | "even" | null {
  const odd = /\bodd\s+min(?:ute)?s?\b/i.test(text);
  const even = /\beven\s+min(?:ute)?s?\b/i.test(text);
  return odd === even ? null : odd ? "odd" : "even";
}

// Deriving the minute from the saved countdown preserves progress after pause or app restart.
export function emomMinuteProgress(duration: number, remaining: number) {
  const elapsed = Math.max(0, duration - Math.max(0, remaining));
  const complete = remaining <= 0;
  const minute = complete ? Math.ceil(duration / 60) : Math.floor(elapsed / 60) + 1;
  return {
    minute,
    minuteCount: Math.ceil(duration / 60),
    minuteRemaining: complete ? 0 : Math.min(60 - elapsed % 60, remaining),
    parity: minute % 2 === 1 ? "odd" as const : "even" as const,
    complete,
  };
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
    const isEmom = block.exercises.some(({ item, section }) => /\bemom\b/i.test(`${item.prescription_text || ""} ${section || ""}`));
    block.kind = isAmrap ? "amrap" : isEmom ? "emom" : block.exercises.length > 2 ? "circuit" : block.exercises.length === 2 ? "superset" : "exercise";
    block.durationSeconds = isAmrap ? amrapDuration(texts) : isEmom ? emomDuration(texts) : null;
  }
  return blocks;
}

export function blockForIndex(blocks: WorkoutBlock[], index: number) {
  return blocks.find(block => index >= block.start && index <= block.end);
}
