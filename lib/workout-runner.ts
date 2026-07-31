export interface WorkoutSetData {
  set_number: number;
  weight: string;
  reps: string;
  notes: string;
  completed: boolean;
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
