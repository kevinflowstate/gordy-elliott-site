export type RecoveryStatus = "good" | "watch" | "reduce_intensity";

export type WearableDailySummary = {
  id?: string;
  client_id?: string;
  summary_date: string;
  providers: string[];
  sleep_minutes: number | null;
  sleep_score: number | null;
  hrv_ms: number | null;
  resting_hr_bpm: number | null;
  steps: number | null;
  active_calories: number | null;
  total_calories_burned: number | null;
  training_load: number | null;
  workout_count: number | null;
  nutrition_calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  water_ml: number | null;
  readiness_score: number | null;
  recovery_status: RecoveryStatus;
  flags: string[];
  insight: string | null;
  source_payload_ids?: string[];
  created_at?: string;
  updated_at?: string;
};

export type WearableConnection = {
  id: string;
  client_id: string;
  provider: string;
  terra_user_id: string | null;
  reference_id: string;
  status: "connected" | "disconnected" | "pending" | "error";
  last_sync_at: string | null;
  connected_at: string | null;
  disconnected_at: string | null;
  scopes?: unknown;
  raw_user?: unknown;
  created_at?: string;
  updated_at?: string;
};

export function titleCaseProvider(provider: string | null | undefined) {
  if (!provider) return "Connected app";
  const normalized = provider.replace(/_/g, " ").toLowerCase();
  if (normalized === "myfitnesspal") return "MyFitnessPal";
  if (normalized === "whoop") return "WHOOP";
  if (normalized === "oura") return "Oura";
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function roundScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildWearableInsight(
  summary: Omit<WearableDailySummary, "readiness_score" | "recovery_status" | "flags" | "insight">,
  baselines?: { resting_hr_bpm?: number | null; hrv_ms?: number | null },
): Pick<WearableDailySummary, "readiness_score" | "recovery_status" | "flags" | "insight"> {
  const flags: string[] = [];
  let score = 82;

  if (summary.sleep_minutes !== null && summary.sleep_minutes < 360) {
    flags.push("poor_sleep");
    score -= 24;
  } else if (summary.sleep_score !== null && summary.sleep_score < 55) {
    flags.push("poor_sleep");
    score -= 20;
  } else if (summary.sleep_score !== null && summary.sleep_score < 70) {
    flags.push("light_sleep");
    score -= 10;
  }

  if (
    summary.resting_hr_bpm !== null &&
    ((baselines?.resting_hr_bpm && summary.resting_hr_bpm > baselines.resting_hr_bpm + 8) ||
      (!baselines?.resting_hr_bpm && summary.resting_hr_bpm >= 82))
  ) {
    flags.push("elevated_resting_hr");
    score -= 15;
  }

  if (
    summary.hrv_ms !== null &&
    baselines?.hrv_ms &&
    summary.hrv_ms < baselines.hrv_ms * 0.8
  ) {
    flags.push("low_hrv");
    score -= 15;
  }

  if ((summary.training_load !== null && summary.training_load >= 80) || (summary.workout_count !== null && summary.workout_count >= 2)) {
    flags.push("high_strain");
    score -= flags.includes("poor_sleep") ? 16 : 6;
  }

  if (summary.protein_g !== null && summary.protein_g < 90) {
    flags.push("low_protein");
    score -= 8;
  }

  if (summary.nutrition_calories !== null && summary.nutrition_calories < 1200) {
    flags.push("low_calories");
    score -= 8;
  }

  if (summary.steps !== null && summary.steps < 3000) {
    flags.push("low_steps");
    score -= 4;
  }

  const readinessScore = roundScore(score);
  const recoveryStatus: RecoveryStatus =
    flags.includes("poor_sleep") && (flags.includes("high_strain") || flags.includes("elevated_resting_hr") || flags.includes("low_hrv"))
      ? "reduce_intensity"
      : readinessScore < 62 || flags.includes("poor_sleep")
        ? "watch"
        : "good";

  const insight = recoveryStatus === "reduce_intensity"
    ? "Recovery is under pressure today. Keep the session technical and avoid chasing personal bests."
    : recoveryStatus === "watch"
      ? "Useful recovery signals are a bit lower today. Train, but keep an eye on effort and execution."
      : "Recovery signals look steady. No connected-app reason to change today's plan.";

  return {
    readiness_score: readinessScore,
    recovery_status: recoveryStatus,
    flags,
    insight,
  };
}

export function formatWearableSummaryForPrompt(summary: WearableDailySummary | null | undefined) {
  if (!summary) return "No connected-app summary is available.";

  return JSON.stringify({
    date: summary.summary_date,
    providers: summary.providers,
    readiness_score: summary.readiness_score,
    recovery_status: summary.recovery_status,
    flags: summary.flags,
    insight: summary.insight,
    sleep: {
      minutes: summary.sleep_minutes,
      score: summary.sleep_score,
      hrv_ms: summary.hrv_ms,
      resting_hr_bpm: summary.resting_hr_bpm,
    },
    activity: {
      steps: summary.steps,
      active_calories: summary.active_calories,
      training_load: summary.training_load,
      workout_count: summary.workout_count,
    },
    nutrition: {
      calories: summary.nutrition_calories,
      protein_g: summary.protein_g,
      carbs_g: summary.carbs_g,
      fat_g: summary.fat_g,
      water_ml: summary.water_ml,
    },
  }, null, 2);
}
