type ExerciseSectionDivider<T> = Omit<T,
  "id" | "exercise_id" | "order_index" | "sets" | "reps" | "rest_seconds" |
  "tempo" | "notes" | "superset_group" | "prescription_type" | "prescription_text" | "exercise"
> & {
  id: string;
  exercise_id: "__section__";
  order_index: number;
  sets: number;
  reps: string;
  rest_seconds: null;
  tempo: null;
  notes: null;
  superset_group: null;
  prescription_type: null;
  prescription_text: null;
  exercise: null;
};

// Section dividers exist only in API responses. Keep exercise metadata on the
// original row so saving/grouping still uses the first exercise in the section.
export function createExerciseSectionDivider<T extends {
  id: string;
  order_index: number;
  section_label: string;
}>(item: T): ExerciseSectionDivider<T> {
  return {
    ...item,
    id: `section-${item.id}`,
    exercise_id: "__section__",
    order_index: item.order_index - 0.5,
    sets: 0,
    reps: "",
    rest_seconds: null,
    tempo: null,
    notes: null,
    superset_group: null,
    prescription_type: null,
    prescription_text: null,
    exercise: null,
  };
}
