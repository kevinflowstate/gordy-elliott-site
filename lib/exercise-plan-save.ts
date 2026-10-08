import { normalisePrescriptionType } from "@/lib/exercise-prescriptions";
import type { ExerciseTemplate, ExerciseSessionItem } from "@/lib/types";

export function validateTemplate(template: ExerciseTemplate): string | null {
  if (!template.name?.trim()) return "Give the template a name.";
  if (!Array.isArray(template.sessions)) return "Template sessions are required.";
  for (const [sessionIndex, session] of template.sessions.entries()) {
    if (!session.name?.trim()) return `Session ${sessionIndex + 1} needs a name.`;
    if (!Number.isInteger(session.day_number) || session.day_number < 1) return `Session ${sessionIndex + 1} needs a valid day.`;
    if (!Array.isArray(session.items)) return `Session ${sessionIndex + 1} has invalid exercises.`;
    for (const [itemIndex, item] of session.items.entries()) {
      if (item.exercise_id === "__section__") continue;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.exercise_id || "")) return `Exercise ${itemIndex + 1} in ${session.name} is invalid.`;
      const needsReps = normalisePrescriptionType(item.prescription_type) === "sets_reps";
      if (!Number.isInteger(item.sets) || item.sets < 0 || (needsReps && !item.reps?.trim())) return `Exercise ${itemIndex + 1} in ${session.name} needs a valid target.`;
    }
  }
  return null;
}

export function exerciseRows(items: ExerciseSessionItem[], sessionId: string, includeIds = false) {
  let section: string | null = null;
  let firstInSection = false;
  return items.flatMap((item, index) => {
    if (item.exercise_id === "__section__") {
      section = item.section_label?.trim() || "Section";
      firstInSection = true;
      return [];
    }
    const row = {
      ...(includeIds ? { id: item.id || null } : {}),
      session_id: sessionId,
      exercise_id: item.exercise_id,
      order_index: index,
      sets: item.sets,
      reps: item.reps,
      prescription_type: normalisePrescriptionType(item.prescription_type),
      prescription_text: item.prescription_text || null,
      rest_seconds: item.rest_seconds ?? null,
      tempo: item.tempo || null,
      notes: item.notes || null,
      section_label: firstInSection ? section : item.section_label?.trim() || null,
      superset_group: item.superset_group || null,
    };
    firstInSection = false;
    return [row];
  });
}

