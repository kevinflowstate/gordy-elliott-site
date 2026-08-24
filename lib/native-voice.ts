export const MINIMUM_NATIVE_VOICE_BUILD = 9;

export function nativeBuildSupportsVoiceNotes(build: string | number | null | undefined) {
  const parsed = typeof build === "number" ? build : Number.parseInt(build || "", 10);
  return Number.isInteger(parsed) && parsed >= MINIMUM_NATIVE_VOICE_BUILD;
}
