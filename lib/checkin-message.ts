import { normalizeCheckinConfig } from "@/lib/checkin-form";
import type { CheckIn, CheckinFormConfig } from "@/lib/types";

export interface CheckinMessageContext {
  submitted_at: string;
  mood: string | null;
  wins?: string | null;
  challenges?: string | null;
  questions?: string | null;
  responses?: Record<string, unknown> | null;
  config?: CheckinFormConfig | null;
}

export function checkinDate(date: string) {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London",
  });
}

export function checkinAnswers(context: CheckinMessageContext) {
  const config = normalizeCheckinConfig(context.config);
  const labels = new Map([
    ...config.questions.map((q) => [q.id, q.label] as const),
    ...(config.progress_tracking || []).map((m) => [m.id, `${m.label}${m.unit ? ` (${m.unit})` : ""}`] as const),
    ["wins", "Wins"], ["challenges", "Challenges"], ["questions", "Questions"],
    ["priority_message", "Main priority"], ["support_ask", "Support from Gordy"],
  ]);
  const values: Record<string, unknown> = {
    wins: context.wins, challenges: context.challenges, questions: context.questions,
    ...context.responses,
  };
  return Object.entries(values)
    .filter(([key, value]) => key !== "photos" && typeof value === "string" && value.trim())
    .map(([key, value]) => ({
      key, label: labels.get(key) || key.replace(/_/g, " "), text: (value as string).trim(),
    }));
}

export function checkinPreview(context: CheckinMessageContext) {
  const answers = checkinAnswers(context);
  const priority = ["priority_message", "wins", "challenges", "support_ask", "wellbeing", "anything_else", "questions"];
  const ranked = [...answers].sort((a, b) => {
    const rank = (key: string) => priority.includes(key) ? priority.indexOf(key) : priority.length;
    return rank(a.key) - rank(b.key);
  });
  return ranked.slice(0, 2).map((answer) => ({
    ...answer, text: answer.text.length > 140 ? `${answer.text.slice(0, 137)}…` : answer.text,
  }));
}

export function contextFromCheckin(checkin: CheckIn, config?: CheckinFormConfig | null): CheckinMessageContext {
  return { ...checkin, submitted_at: checkin.created_at, config };
}
