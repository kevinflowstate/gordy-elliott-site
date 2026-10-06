export const NATIVE_PUSH_REQUEST_EVENT = "shift:native-push-request";
export const NATIVE_PUSH_STATUS_EVENT = "shift:native-push-status";
export const NATIVE_PUSH_TOKEN_STORAGE_KEY = "shift-native-push-token";

// Permission granted does not mean the server has the device token yet.
export type NativePushStatus = "unknown" | "prompt" | "granted" | "registering" | "registered" | "denied" | "error";
export type NativePushEnvironment = "sandbox" | "production";

export function normalizeNativePushStatus(value: unknown): NativePushStatus {
  return value === "prompt" || value === "granted" || value === "registering" || value === "registered" || value === "denied" || value === "error"
    ? value
    : "unknown";
}

export function nativePushEnvironmentFromUserAgent(userAgent: string): NativePushEnvironment {
  return /(?:^|\s)SHIFT-APNS\/sandbox(?:\s|$)/i.test(userAgent) ? "sandbox" : "production";
}
