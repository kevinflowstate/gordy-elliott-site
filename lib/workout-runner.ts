export interface WorkoutSetData {
  set_number: number;
  weight: string;
  reps: string;
  notes: string;
  completed: boolean;
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
