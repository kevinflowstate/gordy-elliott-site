import type { CheckinFormConfig, CheckinFormTemplate, FormQuestion, ProgressMetric } from "@/lib/types";

export const DEFAULT_CHECKIN_QUESTIONS: FormQuestion[] = [
  { id: "diet_detail", label: "Detail your diet from the last week", placeholder: "Describe what you've been eating...", type: "textarea", enabled: true },
  { id: "diet_adherence", label: "Did you stick to your diet?", placeholder: "", type: "select", options: ["Yes", "Mostly", "No"], enabled: true },
  { id: "wellbeing", label: "How do you feel / overall wellbeing?", placeholder: "How are you feeling overall?", type: "textarea", enabled: true },
  { id: "photos", label: "Current photos (front, back, side)", placeholder: "Upload your progress photos", type: "file", enabled: true },
  { id: "anything_else", label: "Anything else?", placeholder: "Anything else you'd like to share?", type: "textarea", enabled: true },
];

export const DEFAULT_PROGRESS_METRICS: ProgressMetric[] = [
  { id: "weight", label: "Weight", type: "number", unit: "kg", enabled: true },
  { id: "sleep", label: "Quality of sleep", type: "scale", min: 1, max: 10, enabled: true },
  { id: "stress", label: "Stress", type: "scale", min: 1, max: 10, enabled: true },
  { id: "hrv", label: "HRV", type: "number", enabled: false },
  { id: "fatigue", label: "Fatigue", type: "scale", min: 1, max: 10, enabled: true },
  { id: "hunger", label: "Hunger", type: "scale", min: 1, max: 10, enabled: false },
  { id: "recovery", label: "Recovery", type: "scale", min: 1, max: 10, enabled: true },
  { id: "energy", label: "Energy", type: "scale", min: 1, max: 10, enabled: true },
  { id: "digestion", label: "Digestion", type: "scale", min: 1, max: 10, enabled: false },
  { id: "steps", label: "Steps", type: "number", enabled: false },
  { id: "glucose", label: "Glucose level", type: "number", enabled: false },
  { id: "waist", label: "Waist", type: "number", unit: "cm", enabled: false },
  { id: "exercise_minutes", label: "Exercise Minutes", type: "number", enabled: false },
  { id: "sleep_hours", label: "Sleep Hours", type: "number", unit: "hrs", enabled: false },
  { id: "water_intake", label: "Water Intake", type: "number", unit: "litres", enabled: false },
  { id: "alcohol", label: "Alcohol Consumption", type: "select", options: ["None", "1-2 drinks", "3-5 drinks", "6+"], enabled: false },
  { id: "supplement_adherence", label: "Supplement Adherence", type: "select", options: ["Yes", "Mostly", "No"], enabled: false },
  { id: "menstrual_cycle", label: "Menstrual Cycle Phase", type: "select", options: ["N/A", "Follicular", "Ovulation", "Luteal", "Menstrual"], enabled: false },
  { id: "joint_comfort", label: "Joint / Injury Status", type: "scale", min: 1, max: 10, enabled: false },
  { id: "confidence", label: "Confidence Level", type: "scale", min: 1, max: 10, enabled: false },
  { id: "training_adherence", label: "Training Adherence", type: "scale", min: 1, max: 10, enabled: false },
  { id: "cardio_completed", label: "Cardio Completed", type: "select", options: ["Yes", "Partial", "No"], enabled: false },
  { id: "daily_habits", label: "Daily Habits Score", type: "scale", min: 1, max: 10, enabled: false },
];

export function buildFallbackCheckinConfig(): CheckinFormConfig {
  return {
    title: "Weekly Check-in",
    checkin_day: "monday",
    mood_enabled: true,
    mood_options: [
      { value: "great", label: "Great", color: "emerald" },
      { value: "good", label: "Good", color: "blue" },
      { value: "okay", label: "Okay", color: "amber" },
      { value: "struggling", label: "Struggling", color: "red" },
    ],
    questions: DEFAULT_CHECKIN_QUESTIONS,
    progress_tracking: DEFAULT_PROGRESS_METRICS,
  };
}

export function normalizeCheckinConfig(config: CheckinFormConfig | null | undefined): CheckinFormConfig {
  const fallback = buildFallbackCheckinConfig();
  if (!config) return fallback;

  const loadedQuestions = config.questions || [];
  const loadedMetrics = config.progress_tracking || [];

  const mergedQuestions = DEFAULT_CHECKIN_QUESTIONS.map((defaultQuestion) => {
    const found = loadedQuestions.find((question) => question.id === defaultQuestion.id);
    return found ? { ...defaultQuestion, ...found } : defaultQuestion;
  });
  const customQuestions = loadedQuestions.filter((question) => !DEFAULT_CHECKIN_QUESTIONS.find((defaultQuestion) => defaultQuestion.id === question.id));

  const mergedMetrics = DEFAULT_PROGRESS_METRICS.map((defaultMetric) => {
    const found = loadedMetrics.find((metric) => metric.id === defaultMetric.id);
    return found ? { ...defaultMetric, ...found } : defaultMetric;
  });
  const customMetrics = loadedMetrics.filter((metric) => !DEFAULT_PROGRESS_METRICS.find((defaultMetric) => defaultMetric.id === metric.id));

  return {
    ...fallback,
    ...config,
    title: config.title || fallback.title,
    mood_options: config.mood_options?.length ? config.mood_options : fallback.mood_options,
    questions: [...mergedQuestions, ...customQuestions],
    progress_tracking: [...mergedMetrics, ...customMetrics],
  };
}

export function createCheckinTemplateDraft(name = "New Check-in Form", description = "") {
  return {
    name,
    description,
    config: buildFallbackCheckinConfig(),
  };
}

export function getTemplateLabel(template: Pick<CheckinFormTemplate, "name" | "is_default">) {
  return template.is_default ? `${template.name} (Default)` : template.name;
}
