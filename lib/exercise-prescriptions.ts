import type { ExerciseSessionItem, PrescriptionType } from "@/lib/types";

export const PRESCRIPTION_TYPES: Array<{ value: PrescriptionType; label: string; placeholder: string }> = [
  { value: "sets_reps", label: "Sets/Reps", placeholder: "3 x 10" },
  { value: "time", label: "Time", placeholder: "12 min" },
  { value: "calories", label: "Cals", placeholder: "50 cals" },
  { value: "rounds", label: "Rounds", placeholder: "5 rounds" },
  { value: "amrap", label: "AMRAP", placeholder: "AMRAP 12 min" },
  { value: "distance", label: "Distance", placeholder: "5 km" },
  { value: "custom", label: "Custom", placeholder: "As prescribed" },
];

export function normalisePrescriptionType(value?: string | null): PrescriptionType {
  return PRESCRIPTION_TYPES.some((type) => type.value === value) ? (value as PrescriptionType) : "sets_reps";
}

export function formatExercisePrescription(
  item: Pick<ExerciseSessionItem, "sets" | "reps"> & {
    prescription_type?: string | null;
    prescription_text?: string | null;
  },
): string {
  const type = normalisePrescriptionType(item.prescription_type);
  if (type === "sets_reps") {
    return `${item.sets || 1} x ${item.reps || "10"}`;
  }

  const text = item.prescription_text?.trim();
  if (text) return text;

  const fallback = PRESCRIPTION_TYPES.find((option) => option.value === type);
  return fallback?.label || "As prescribed";
}

export function shouldUseSetLogging(item: Pick<ExerciseSessionItem, "prescription_type">): boolean {
  return normalisePrescriptionType(item.prescription_type) === "sets_reps";
}
