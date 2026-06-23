import type { FormQuestion } from "@/lib/types";

export interface ConsultationFormConfig {
  title?: string;
  description?: string;
  questions: FormQuestion[];
}

export const CONSULTATION_SYSTEM_FIELD_IDS = ["date_of_birth", "sex", "cycle_tracking_enabled"] as const;

export const DEFAULT_CONSULTATION_QUESTIONS: FormQuestion[] = [
  {
    id: "date_of_birth",
    label: "Date of Birth",
    placeholder: "",
    type: "date",
    enabled: true,
  },
  {
    id: "sex",
    label: "Sex",
    placeholder: "",
    type: "select",
    options: ["Female", "Male", "Prefer not to say"],
    enabled: true,
  },
  {
    id: "cycle_tracking_enabled",
    label: "Cycle tracking",
    placeholder: "Cycle tools will appear in your portal.",
    type: "boolean",
    enabled: true,
  },
  {
    id: "fitness_level",
    label: "Current Fitness Level",
    placeholder: "",
    type: "select",
    options: ["Beginner", "Intermediate", "Advanced"],
    enabled: true,
    required: true,
  },
  {
    id: "primary_goal",
    label: "Primary Goal",
    placeholder: "",
    type: "select",
    options: ["Weight Loss", "Muscle Gain", "General Fitness", "Sport Specific", "Flexibility & Mobility"],
    enabled: true,
    required: true,
  },
  {
    id: "training_days",
    label: "Training Days Per Week",
    placeholder: "",
    type: "select",
    options: ["2", "3", "4", "5", "6"],
    enabled: true,
    required: true,
  },
  {
    id: "equipment_access",
    label: "Equipment Access",
    placeholder: "",
    type: "select",
    options: ["Full Gym", "Home Gym", "Limited", "Bodyweight Only"],
    enabled: true,
    required: true,
  },
  {
    id: "dietary_preferences",
    label: "Dietary Preferences or Restrictions",
    placeholder: "e.g. vegetarian, lactose intolerant, no preferences...",
    type: "textarea",
    enabled: true,
  },
  {
    id: "injuries",
    label: "Any Injuries or Limitations",
    placeholder: "e.g. lower back issues, bad knee, none...",
    type: "textarea",
    enabled: true,
  },
  {
    id: "supplements",
    label: "Current Supplements",
    placeholder: "e.g. protein powder, creatine, none...",
    type: "textarea",
    enabled: true,
  },
  {
    id: "additional_info",
    label: "Anything Else We Should Know",
    placeholder: "Any other context that would help us personalise your coaching...",
    type: "textarea",
    enabled: true,
  },
];

export function buildFallbackConsultationConfig(): ConsultationFormConfig {
  return {
    title: "Initial Consultation",
    description: "Help us personalise your coaching experience by filling in your details below.",
    questions: DEFAULT_CONSULTATION_QUESTIONS,
  };
}

function normalizeQuestion(question: FormQuestion): FormQuestion {
  const type = ["textarea", "text", "select", "file", "date", "boolean"].includes(question.type)
    ? question.type
    : "textarea";

  return {
    ...question,
    label: question.label || "Untitled question",
    placeholder: question.placeholder || "",
    type,
    enabled: question.enabled !== false,
    options: type === "select" ? question.options || [] : question.options,
    required: Boolean(question.required),
  };
}

export function normalizeConsultationConfig(config: ConsultationFormConfig | null | undefined): ConsultationFormConfig {
  const fallback = buildFallbackConsultationConfig();
  if (!config) return fallback;

  const loadedQuestions = Array.isArray(config.questions) ? config.questions : [];
  const mergedQuestions = DEFAULT_CONSULTATION_QUESTIONS.map((defaultQuestion) => {
    const found = loadedQuestions.find((question) => question.id === defaultQuestion.id);
    return normalizeQuestion(found ? { ...defaultQuestion, ...found } : defaultQuestion);
  });
  const customQuestions = loadedQuestions
    .filter((question) => !DEFAULT_CONSULTATION_QUESTIONS.find((defaultQuestion) => defaultQuestion.id === question.id))
    .map(normalizeQuestion);

  return {
    ...fallback,
    ...config,
    title: config.title || fallback.title,
    description: config.description || fallback.description,
    questions: [...mergedQuestions, ...customQuestions],
  };
}

export function isConsultationSystemField(id: string) {
  return CONSULTATION_SYSTEM_FIELD_IDS.includes(id as (typeof CONSULTATION_SYSTEM_FIELD_IDS)[number]);
}
