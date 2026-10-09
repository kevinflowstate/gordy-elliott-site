import type { CheckinFormConfig, CheckinFormTemplate, FormQuestion, ProgressMetric, ProgrammeType } from "@/lib/types";

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

export const BOARDROOM_CHECKIN_QUESTIONS: FormQuestion[] = [
  { id: "wins", label: "Your wins this week", placeholder: "What moved forward?", type: "textarea", enabled: true, required: true },
  { id: "challenges", label: "Your number-one business problem", placeholder: "What is getting in the way?", type: "textarea", enabled: true, required: true },
  { id: "one_number", label: "The one number you want to move", placeholder: "The number and where it is today", type: "text", enabled: true },
  { id: "mission", label: "Did you hit this week's one mission?", placeholder: "", type: "select", options: ["Yes", "Partly", "No"], enabled: true },
];
export function buildFallbackCheckinConfig(programmeType?: ProgrammeType): CheckinFormConfig {
  if (programmeType === "boardroom") return { programme_type: "boardroom", title: "Your business check-in", checkin_day: "monday", mood_enabled: false, mood_options: [], questions: BOARDROOM_CHECKIN_QUESTIONS.map(q => ({ ...q })), progress_tracking: [] };
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

export function normalizeCheckinConfig(config: CheckinFormConfig | null | undefined, programmeType?: ProgrammeType): CheckinFormConfig {
  const isBoardroom = (programmeType || config?.programme_type) === "boardroom";
  const fallback = buildFallbackCheckinConfig(isBoardroom ? "boardroom" : programmeType);
  if (!config) return fallback;

  const loadedQuestions = config.questions || [];
  const loadedMetrics = config.progress_tracking || [];

  if (isBoardroom) return { ...fallback, ...config, programme_type: "boardroom", title: config.title || fallback.title, mood_options: config.mood_options || [], questions: loadedQuestions.map(q => ({ ...q })), progress_tracking: loadedMetrics.map(metric => ({ ...metric,
    ...(metric.kind === "number" ? { type: "number" as const } : {}),
    ...(metric.kind === "money" ? { type: "number" as const, unit: "£" } : {}),
    ...(metric.kind === "hours" ? { type: "number" as const, unit: "hrs", min: metric.min ?? 0 } : {}),
    ...(metric.kind === "count" ? { type: "number" as const, min: metric.min ?? 0 } : {}),
    ...(metric.kind === "percentage" ? { type: "number" as const, unit: "%", min: 0, max: 100 } : {}),
    ...(metric.kind === "score" ? { type: "scale" as const, min: 1, max: 10 } : {}),
  })) };
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

export function createCheckinTemplateDraft(name = "New Check-in Form", description = "", programmeType?: ProgrammeType) {
  return {
    name,
    description,
    config: buildFallbackCheckinConfig(programmeType),
  };
}

export function getTemplateLabel(template: Pick<CheckinFormTemplate, "name" | "is_default">) {
  return template.is_default ? `${template.name} (Default)` : template.name;
}

export function validateCheckinSubmission(config: CheckinFormConfig, mood: unknown, values: unknown): { error?: string; responses: Record<string, string>; mood: string | null } {
  const result: Record<string, string> = {};
  const fail = (error: string) => ({ error, responses: result, mood: null });
  if (!values || typeof values !== "object" || Array.isArray(values)) return fail("Check-in answers are required");
  if (config.mood_enabled && !config.mood_options.some(option => option.value === mood)) return fail("Choose a valid mood");
  const source = values as Record<string, unknown>;
  for (const field of [...config.questions.filter(q => q.enabled !== false), ...(config.progress_tracking || []).filter(m => m.enabled)]) {
    const raw = source[field.id];
    if (raw === undefined || raw === null || raw === "") { if (field.required) return fail(`${field.label} is required`); continue; }
    if (!["string", "number", "boolean"].includes(typeof raw)) return fail(`Invalid answer for ${field.label}`);
    const value = String(raw).trim();
    if (!value) { if (field.required) return fail(`${field.label} is required`); continue; }
    if (field.type === "number" || field.type === "scale") {
      const numeric = Number(value), metric = field as ProgressMetric;
      if (!Number.isFinite(numeric) || (metric.min !== undefined && numeric < metric.min) || (metric.max !== undefined && numeric > metric.max) || ((metric.kind === "count" || field.type === "scale") && !Number.isInteger(numeric))) return fail(`Enter a valid value for ${field.label}`);
    }
    if (field.type === "select" && !field.options?.includes(value)) return fail(`Choose a valid option for ${field.label}`);
    if (field.type === "boolean" && !["true", "false"].includes(value)) return fail(`Choose yes or no for ${field.label}`);
    if (field.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)))) return fail(`Enter a valid date for ${field.label}`);
    if (value.length > 20000) return fail(`${field.label} is too long`);
    result[field.id] = value;
  }
  for (const id of ["priority_message", "support_ask"]) if (typeof source[id] === "string") result[id] = source[id].slice(0, 20000);
  return { responses: result, mood: config.mood_enabled ? String(mood) : null };
}
export function validateCheckinTemplate(config: CheckinFormConfig): string | null {
  if (!config || typeof config !== "object" || !Array.isArray(config.questions) || !Array.isArray(config.mood_options) || (config.progress_tracking !== undefined && !Array.isArray(config.progress_tracking))) return "Invalid check-in form configuration";
  if (config.programme_type !== undefined && !["boardroom", "capacity", "shift", "in_person"].includes(config.programme_type)) return "Invalid check-in programme";
  if (typeof config.mood_enabled !== "boolean" || config.mood_options.some(option => !option || typeof option.value !== "string" || typeof option.label !== "string" || typeof option.color !== "string")) return "Invalid mood options";
  if (config.mood_enabled && !config.mood_options.length) return "Enabled mood needs answer options";
  const ids = new Set<string>();
  for (const field of [...config.questions, ...(config.progress_tracking || [])]) {
    if (!field || typeof field.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(field.id) || ids.has(field.id) || typeof field.label !== "string" || !field.label.trim()) return "Every field needs a unique stable ID and a label";
    ids.add(field.id);
    if (!["textarea", "text", "select", "file", "date", "boolean", "number", "scale"].includes(field.type)) return "Invalid field type";
    if ("kind" in field && field.kind !== undefined && !["money", "count", "hours", "percentage", "score", "number"].includes(String(field.kind))) return "Invalid metric kind";
    if (field.type === "select" && (!Array.isArray(field.options) || !field.options.length || field.options.some(option => typeof option !== "string"))) return "Select fields need answer options";
    const metric = field as ProgressMetric;
    if (metric.min !== undefined && !Number.isFinite(metric.min)) return "Metric minimum must be a number";
    if (metric.max !== undefined && !Number.isFinite(metric.max)) return "Metric maximum must be a number";
    if (metric.min !== undefined && metric.max !== undefined && metric.min > metric.max) return "Metric minimum must not exceed maximum";
  }
  return null;
}
