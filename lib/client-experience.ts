import type { ClientExperienceMode } from "@/lib/types";

export const DEFAULT_CLIENT_EXPERIENCE: ClientExperienceMode = "ai_coaching";

export const CLIENT_EXPERIENCE_MODES: ReadonlyArray<ClientExperienceMode> = [
  "founder_dashboard",
  "ai_coaching",
];

export function isClientExperienceMode(value: unknown): value is ClientExperienceMode {
  return typeof value === "string"
    && CLIENT_EXPERIENCE_MODES.includes(value as ClientExperienceMode);
}

export function normalizeClientExperienceMode(value: unknown): ClientExperienceMode {
  return isClientExperienceMode(value) ? value : DEFAULT_CLIENT_EXPERIENCE;
}

export function isFounderExperience(value: unknown): boolean {
  return normalizeClientExperienceMode(value) === "founder_dashboard";
}
