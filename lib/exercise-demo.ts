const VERIFIED_DEMOS: Record<string, string> = {
  "barbell row": "https://musclewiki.com/exercise/barbell-pronated-row",
  "pull-ups": "https://musclewiki.com/exercise/pull-ups",
  "pull ups": "https://musclewiki.com/exercise/pull-ups",
  "back squat": "https://musclewiki.com/exercise/barbell-squat",
  "romanian deadlift": "https://musclewiki.com/exercise/barbell-romanian-deadlift",
  "leg extension": "https://musclewiki.com/exercise/machine-leg-extension",
  lunges: "https://musclewiki.com/exercise/forward-lunges",
  "hip thrust": "https://musclewiki.com/exercise/barbell-hip-thrust",
  "rowing machine": "https://musclewiki.com/exercise/cardio-row-erg-rower-four-stroke-sprint-start",
  "assault bike": "https://musclewiki.com/exercise/cardio-assault-bike",
  deadlift: "https://musclewiki.com/exercise/barbell-deadlift",
};

export function getExerciseDemoUrl(value: string | null | undefined, exerciseName?: string | null): string | null {
  if (value) {
    try {
      const url = new URL(value);
      if (url.protocol === "https:" || url.protocol === "http:") return url.href;
    } catch {
      // Fall through to the verified exercise-name map.
    }
  }
  return exerciseName ? VERIFIED_DEMOS[exerciseName.trim().toLowerCase()] || null : null;
}
