export const NATIVE_PUSH_REQUEST_EVENT = "shift:native-push-request";
export const NATIVE_PUSH_STATUS_EVENT = "shift:native-push-status";
export const NATIVE_PUSH_TOKEN_STORAGE_KEY = "shift-native-push-token";

export type NativePushStatus = "unknown" | "prompt" | "granted" | "denied" | "error";
export type NativePushEnvironment = "sandbox" | "production";

export function normalizeNativePushStatus(value: unknown): NativePushStatus {
  return value === "prompt" || value === "granted" || value === "denied" || value === "error"
    ? value
    : "unknown";
}

export function nativePushEnvironmentFromUserAgent(userAgent: string): NativePushEnvironment {
  return /(?:^|\s)SHIFT-APNS\/sandbox(?:\s|$)/i.test(userAgent) ? "sandbox" : "production";
}
