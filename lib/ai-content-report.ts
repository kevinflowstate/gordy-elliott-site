export const AI_CONTENT_REPORT_KEY = "atcapacity-ai-content-report";

export function aiReportDescription(value: unknown, now = Date.now()) {
  if (!value || typeof value !== "object") return null;
  const draft = value as { reply?: unknown; createdAt?: unknown };
  if (typeof draft.reply !== "string" || typeof draft.createdAt !== "number" ||
      draft.createdAt > now || now - draft.createdAt > 10 * 60_000) return null;
  return `I want to report this AI reply:\n\n${draft.reply.slice(0, 2500)}\n\nWhat concerns me about it: `;
}
