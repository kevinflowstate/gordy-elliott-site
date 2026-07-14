export const COACHING_NOTE_SOURCE_TYPES = [
  "call",
  "zoom",
  "loom",
  "fathom",
  "whatsapp",
  "voice_note",
  "email",
  "other",
] as const;

export type CoachingNoteSourceType = typeof COACHING_NOTE_SOURCE_TYPES[number];

export type CoachingPriority = {
  title: string;
  detail?: string;
  urgency?: "low" | "medium" | "high";
};

export type CoachingTaskSuggestion = {
  task_text: string;
  reason?: string;
};

export type CoachingNoteExtraction = {
  coach_summary: string;
  client_summary: string;
  coach_notes: string;
  priorities: CoachingPriority[];
  task_suggestions: CoachingTaskSuggestion[];
  follow_up_questions: string[];
  risk_flags: string[];
};

const SOURCE_LABELS: Record<CoachingNoteSourceType, string> = {
  call: "Call",
  zoom: "Zoom",
  loom: "Loom",
  fathom: "Fathom",
  whatsapp: "WhatsApp",
  voice_note: "Voice note",
  email: "Email",
  other: "Other",
};

export function isCoachingNoteSourceType(value: unknown): value is CoachingNoteSourceType {
  return typeof value === "string" && COACHING_NOTE_SOURCE_TYPES.includes(value as CoachingNoteSourceType);
}

export function labelCoachingNoteSource(value: string | null | undefined): string {
  return isCoachingNoteSourceType(value) ? SOURCE_LABELS[value] : SOURCE_LABELS.other;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean).slice(0, 8);
}

function asPriorities(value: unknown): CoachingPriority[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const title = asString(record.title);
      if (!title) return null;
      const urgency = asString(record.urgency).toLowerCase();
      return {
        title: title.slice(0, 140),
        detail: asString(record.detail).slice(0, 500) || undefined,
        urgency: urgency === "high" || urgency === "medium" || urgency === "low" ? urgency : "medium",
      };
    })
    .filter(Boolean)
    .slice(0, 6) as CoachingPriority[];
}

function asTaskSuggestions(value: unknown): CoachingTaskSuggestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const taskText = asString(record.task_text || record.title || record.task).slice(0, 240);
      if (!taskText) return null;
      return {
        task_text: taskText,
        reason: asString(record.reason).slice(0, 360) || undefined,
      };
    })
    .filter(Boolean)
    .slice(0, 8) as CoachingTaskSuggestion[];
}

export function extractJsonObject(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected JSON object");
  }
  return parsed as Record<string, unknown>;
}

export function normalizeCoachingNoteExtraction(raw: unknown): CoachingNoteExtraction {
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return {
    coach_summary: asString(record.coach_summary).slice(0, 2000),
    client_summary: asString(record.client_summary).slice(0, 1400),
    coach_notes: asString(record.coach_notes).slice(0, 3000),
    priorities: asPriorities(record.priorities),
    task_suggestions: asTaskSuggestions(record.task_suggestions),
    follow_up_questions: asStringArray(record.follow_up_questions),
    risk_flags: asStringArray(record.risk_flags),
  };
}

export function formatCoachingNotesForAdminPrompt(notes: Array<{
  source_type: string | null;
  source_title: string | null;
  source_date: string | null;
  coach_summary: string | null;
  coach_notes: string | null;
  priorities: unknown;
  task_suggestions: unknown;
}>): string {
  if (!notes.length) return "No recent coaching notes saved.";

  return notes.map((note, index) => {
    const priorities = Array.isArray(note.priorities)
      ? note.priorities.map((p) => {
        const item = p as Record<string, unknown>;
        return `- ${asString(item.title)}${asString(item.detail) ? `: ${asString(item.detail)}` : ""}`;
      }).filter(Boolean).join("\n")
      : "";
    const tasks = Array.isArray(note.task_suggestions)
      ? note.task_suggestions.map((t) => `- ${asString((t as Record<string, unknown>).task_text)}`).filter(Boolean).join("\n")
      : "";

    return [
      `Note ${index + 1}: ${labelCoachingNoteSource(note.source_type)}${note.source_title ? ` - ${note.source_title}` : ""}${note.source_date ? ` (${note.source_date})` : ""}`,
      note.coach_summary ? `Summary: ${note.coach_summary}` : null,
      note.coach_notes ? `Coach-only notes: ${note.coach_notes}` : null,
      priorities ? `Priorities:\n${priorities}` : null,
      tasks ? `Possible tasks:\n${tasks}` : null,
    ].filter(Boolean).join("\n");
  }).join("\n\n");
}
