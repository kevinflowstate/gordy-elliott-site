export interface WorkoutSetData {
  set_number: number;
  weight: string;
  reps: string;
  notes: string;
  completed: boolean;
  circuit_rounds?: number;
  circuit_ends_at?: number;
  circuit_remaining_seconds?: number;
  circuit_duration_seconds?: number;
}

export function workoutSetProgress(sets: WorkoutSetData[] | undefined) {
  const total = sets?.length || 0;
  const completed = sets?.filter((set) => set.completed).length || 0;
  return {
    completed,
    total,
    done: total > 0 && completed === total,
  };
}

export function nextWorkoutExerciseIndex(currentIndex: number, exerciseCount: number) {
  if (exerciseCount <= 0 || currentIndex < 0 || currentIndex >= exerciseCount - 1) return null;
  return currentIndex + 1;
}

export function copyFirstWorkoutSetValues(sets: WorkoutSetData[]): WorkoutSetData[] {
  const first = sets[0];
  if (!first || sets.length < 2) return sets;

  return sets.map((set, index) => index === 0
    ? set
    : {
        ...set,
        weight: first.weight,
        reps: first.reps,
      });
}

// Prescribed rows stay in place; only client-added rows can be removed.
export function removeExtraWorkoutSet(sets: WorkoutSetData[], index: number, prescribedCount: number): WorkoutSetData[] {
  const minimum = Math.max(1, Math.floor(prescribedCount) || 1);
  if (!Number.isInteger(index) || index < minimum || index >= sets.length) return sets;
  return sets.filter((_, position) => position !== index).map((set, position) => ({ ...set, set_number: position + 1 }));
}

export function workoutSetHasValues(set: WorkoutSetData): boolean {
  return set.completed || [set.weight, set.reps, set.notes].some(value => value.trim().length > 0);
}
