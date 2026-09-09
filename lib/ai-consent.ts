export const AI_CONSENT_VERSION = "ai_sharing_v1";
export const AI_CONSENT_RECIPIENTS = "Anthropic, OpenAI and OpenRouter (routing requests to OpenAI)";
export const AI_CONSENT_DATA = "Your AI messages and relevant coaching information: name, goals, training and nutrition plans, check-ins, tracker entries, consultation answers, coach notes, and optional health, injury, cycle and wearable information.";
export type AIConsentState = { granted: boolean; version: string; updatedAt: string | null };
